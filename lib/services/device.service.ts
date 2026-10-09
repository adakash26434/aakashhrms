import * as repo from '@/lib/repositories/device.repository';
import { findAllBranches } from '@/lib/repositories/branch.repository';
import { findEmployeeOptions } from '@/lib/repositories/letter.repository';
import { dedupePunches, deviceHealth, handshakeResponse, isValidSerial, parseAttlog } from '@/lib/engines/device.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';

// Attendance devices (G3): orchestration. A device is trusted by its
// registered serial + enabled flag; punches land in attendance_punches
// (source 'device'), which the 4.5 day engine already reads — devices change
// no attendance rules. Unknown PINs wait in the unmatched list until HR maps
// them; mapping claims the waiting punches in one transaction.

export class DeviceValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'DeviceValidationError';
  }
}

export interface DeviceCtx {
  userId: string;
  scope: ScopeFilter;
}

// ---------------------------------------------------------------------------
// The device-facing pipeline (no session; the iclock routes call these)
// ---------------------------------------------------------------------------

export interface PushResult {
  matched: number;
  unmatched: number;
  malformed: number;
}

/** GET cdata?options=…: the registry block, and the device is marked seen. */
export async function deviceHandshake(serialNo: string): Promise<string | null> {
  if (!isValidSerial(serialNo)) return null;
  const device = await repo.findDeviceBySerial(serialNo);
  if (!device || !device.enabled) return null;
  await repo.touchDevice(device.id);
  return handshakeResponse(device.serialNo);
}

/** GET getrequest: command poll; we queue no commands. */
export async function devicePoll(serialNo: string): Promise<string | null> {
  if (!isValidSerial(serialNo)) return null;
  const device = await repo.findDeviceBySerial(serialNo);
  if (!device || !device.enabled) return null;
  await repo.touchDevice(device.id);
  return 'OK';
}

/** POST cdata table=ATTLOG: the punches. Non-ATTLOG tables are acknowledged, not stored. */
export async function devicePush(serialNo: string, table: string, body: string): Promise<PushResult | null> {
  if (!isValidSerial(serialNo)) return null;
  const device = await repo.findDeviceBySerial(serialNo);
  if (!device || !device.enabled) return null;

  if ((table || '').toUpperCase() !== 'ATTLOG') {
    await repo.touchDevice(device.id);
    return { matched: 0, unmatched: 0, malformed: 0 };
  }

  const { punches, malformed } = parseAttlog(body, device.tzOffsetMinutes);
  const batch = dedupePunches(punches).slice(0, 5000);
  const pinMap = await repo.pinMapFor(device.id);

  const matched: repo.PunchInsert[] = [];
  const unmatched: repo.UnmatchedInsert[] = [];
  let lastPunchAt: Date | undefined;
  for (const p of batch) {
    if (!lastPunchAt || p.punchedAt > lastPunchAt) lastPunchAt = p.punchedAt;
    const employeeId = pinMap.get(p.deviceUserId);
    if (employeeId) matched.push({ employeeId, punchedAt: p.punchedAt, deviceSerial: device.serialNo });
    else unmatched.push({ deviceId: device.id, deviceUserId: p.deviceUserId, punchedAt: p.punchedAt, raw: p.raw });
  }

  const [matchedCount, unmatchedCount] = await Promise.all([repo.insertDevicePunches(matched), repo.insertUnmatched(unmatched)]);
  await repo.touchDevice(device.id, lastPunchAt);
  return { matched: matchedCount, unmatched: unmatchedCount, malformed };
}

// ---------------------------------------------------------------------------
// The screen (ATTENDANCE module)
// ---------------------------------------------------------------------------

const toDeviceRow = (d: repo.DeviceJoinedRow, now: Date) => ({
  id: d.id,
  name: d.name,
  branchId: d.branchId,
  branch: d.branch,
  serialNo: d.serialNo,
  enabled: d.enabled,
  tzOffsetMinutes: d.tzOffsetMinutes,
  health: deviceHealth(d.lastSeenAt, now),
  lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
  lastPunchAt: d.lastPunchAt ? d.lastPunchAt.toISOString() : null,
  mappedUsers: d.mappedUsers,
  unmatchedCount: d.unmatchedCount,
});

export type DeviceScreenRow = ReturnType<typeof toDeviceRow>;

export interface DevicesPageData {
  devices: DeviceScreenRow[];
  unmatched: {
    deviceId: string;
    deviceName: string;
    deviceUserId: string;
    punchCount: number;
    firstAt: string;
    lastAt: string;
  }[];
  branches: { id: string; name: string }[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { manage: boolean };
}

/** Branch-scoped users see their branches' devices; everyone else all. */
function scopeBranchIds(scope: ScopeFilter): string[] | undefined {
  return scope.scopeType === 'BRANCH' ? scope.branchIds : undefined;
}

export async function devicesPage(ctx: DeviceCtx, permissions: { manage: boolean }): Promise<DevicesPageData> {
  const now = new Date();
  const branchIds = scopeBranchIds(ctx.scope);
  const [devices, unmatched, branches, employees] = await Promise.all([
    repo.listDevices(branchIds),
    repo.unmatchedSummary(branchIds),
    findAllBranches(),
    findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope)),
  ]);
  return {
    devices: devices.map((d) => toDeviceRow(d, now)),
    unmatched: unmatched.map((u) => ({
      deviceId: u.deviceId,
      deviceName: u.deviceName,
      deviceUserId: u.deviceUserId,
      punchCount: u.punchCount,
      firstAt: new Date(u.firstAt).toISOString(),
      lastAt: new Date(u.lastAt).toISOString(),
    })),
    branches: branches.filter((b) => b.status === 'active').map((b) => ({ id: b.id, name: b.name })),
    employees,
    permissions,
  };
}

export interface DeviceForm {
  name: string;
  branchId: string;
  serialNo: string;
  enabled: boolean;
  tzOffsetMinutes: number;
}

export function normalizeDeviceForm(raw: unknown): DeviceForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const tz = Number(r.tzOffsetMinutes);
  return {
    name: s(r.name, 100),
    branchId: s(r.branchId, 64),
    serialNo: s(r.serialNo, 60),
    enabled: r.enabled !== false,
    tzOffsetMinutes: Number.isFinite(tz) ? Math.max(-720, Math.min(840, Math.round(tz))) : 345,
  };
}

export async function saveDevice(id: string | null, raw: unknown, ctx: DeviceCtx) {
  const form = normalizeDeviceForm(raw);
  const errors: Record<string, string> = {};
  if (!form.name) errors.name = 'Name the device, e.g. "Head office door".';
  if (!form.branchId) errors.branchId = 'Choose the branch.';
  if (!isValidSerial(form.serialNo)) errors.serialNo = 'The serial number as the device shows it (4–60 letters/digits).';
  if (Object.keys(errors).length) throw new DeviceValidationError(errors);
  try {
    const row = id ? await repo.updateDevice(id, form, ctx.userId) : await repo.insertDevice(form, ctx.userId);
    if (!row) throw new UserFacingError('Not found: this device no longer exists.');
    return row;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new DeviceValidationError({ serialNo: 'A device with this serial number already exists.' });
    }
    throw error;
  }
}

export async function listPins(deviceId: string) {
  return repo.listDeviceUsers(deviceId);
}

export async function mapPin(deviceId: string, deviceUserId: string, employeeId: string, ctx: DeviceCtx): Promise<number> {
  const pin = (deviceUserId ?? '').trim();
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(pin)) throw new DeviceValidationError({ deviceUserId: 'The PIN as the device shows it.' });
  const device = await repo.findDeviceById(deviceId);
  if (!device) throw new UserFacingError('Not found: this device no longer exists.');
  // The employee must be in the caller's scope.
  const inScope = (await findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).some((e) => e.id === employeeId);
  if (!inScope) throw new DeviceValidationError({ employeeId: 'Choose an employee (within your scope).' });
  return repo.mapPinAndClaimTx(deviceId, pin, employeeId, device.serialNo, ctx.userId);
}

export async function unmapPin(id: string): Promise<void> {
  await repo.unmapDeviceUser(id);
}

/** Pasted ATTLOG / punch-file lines run through the same pipeline as a push. */
export async function importPunchLines(deviceId: string, text: string): Promise<PushResult> {
  const device = await repo.findDeviceById(deviceId);
  if (!device) throw new UserFacingError('Not found: this device no longer exists.');
  const result = await devicePush(device.serialNo, 'ATTLOG', (text ?? '').slice(0, 2_000_000));
  if (!result) throw new UserFacingError('This device is disabled — enable it first.');
  return result;
}
