'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as deviceService from '@/lib/services/device.service';

// Attendance devices (G3): managed under ATTENDANCE (VIEW watches, EDIT
// manages devices, PIN mappings and imports). The device-facing endpoints
// are /iclock/* with their own serial-number gate — no server action feeds
// punches without a session.

async function deviceCtx(action: 'VIEW' | 'EDIT'): Promise<deviceService.DeviceCtx> {
  const scope = await checkPermissionWithScope(action, 'ATTENDANCE');
  return { userId: scope.userId, scope };
}

function revalidate() {
  revalidatePath('/timeAndLeave/devices');
  revalidatePath('/timeAndLeave/attendance');
}

const validationFailure = (error: unknown) =>
  error instanceof deviceService.DeviceValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getDevicesPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await deviceCtx('VIEW');
    const manage = await hasPermission('EDIT', 'ATTENDANCE');
    const data = await deviceService.devicesPage(ctx, { manage });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'device.list');
  }
}

export async function saveDeviceAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await deviceCtx('EDIT');
    const device = await deviceService.saveDevice(id, form, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: id ? 'EDIT' : 'ADD',
      module: 'ATTENDANCE',
      recordId: device.id,
      result: 'SUCCESS',
      newValues: { device: device.name, serial: device.serialNo, enabled: device.enabled },
    });
    revalidate();
    return { success: true as const, data: { id: device.id, name: device.name } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'device.save');
  }
}

export async function listDevicePinsAction(deviceId: string) {
  await ensureTenantContext();
  try {
    await deviceCtx('VIEW');
    const data = await deviceService.listPins(typeof deviceId === 'string' ? deviceId : '');
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'device.pins');
  }
}

export async function mapDevicePinAction(deviceId: string, deviceUserId: string, employeeId: string) {
  await ensureTenantContext();
  try {
    const ctx = await deviceCtx('EDIT');
    const claimed = await deviceService.mapPin(deviceId, deviceUserId, employeeId, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: 'ATTENDANCE',
      recordId: deviceId,
      result: 'SUCCESS',
      newValues: { devicePin: deviceUserId, employeeId, claimedPunches: claimed },
    });
    revalidate();
    return { success: true as const, data: { claimed } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'device.map-pin');
  }
}

export async function unmapDevicePinAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await deviceCtx('EDIT');
    await deviceService.unmapPin(typeof id === 'string' ? id : '');
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'ATTENDANCE', recordId: id, result: 'SUCCESS', newValues: { devicePinRemoved: true } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'device.unmap-pin');
  }
}

export async function importDevicePunchesAction(deviceId: string, text: string) {
  await ensureTenantContext();
  try {
    const ctx = await deviceCtx('EDIT');
    const result = await deviceService.importPunchLines(typeof deviceId === 'string' ? deviceId : '', typeof text === 'string' ? text : '');
    await recordAuditLog({
      userId: ctx.userId,
      action: 'ADD',
      module: 'ATTENDANCE',
      recordId: deviceId,
      result: 'SUCCESS',
      newValues: { punchImport: true, matched: result.matched, unmatched: result.unmatched, malformed: result.malformed },
    });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'device.import');
  }
}
