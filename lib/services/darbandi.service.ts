import * as repo from '@/lib/repositories/recruitment.repository';
import { asDarbandiMode, darbandiDecision, occupancy, type DarbandiMode } from '@/lib/engines/recruitment.engine';
import { UserFacingError } from '@/lib/errors/action-error';

// Darbandi enforcement (G4 follow-up): one check used by hiring (employee
// form), promotion and transfer (lifecycle events). The company chooses the
// mode under Recruitment → दरबन्दी: off, warn (default) or block. The check
// is advisory or blocking only for placements that CHANGE the pair — an edit
// that keeps the same designation and branch never trips it.

export async function darbandiMode(): Promise<DarbandiMode> {
  return asDarbandiMode(await repo.readDarbandiMode());
}

export async function setDarbandiMode(mode: unknown): Promise<DarbandiMode> {
  const m = asDarbandiMode(mode);
  await repo.writeDarbandiMode(m);
  return m;
}

export interface Placement {
  designationId: string;
  branchId: string;
  /** The pair the person holds now (null for a hire); unchanged pairs are not checked. */
  current?: { designationId: string; branchId: string } | null;
}

/**
 * Returns a warning (warn mode) or null; throws UserFacingError in block
 * mode when the post is full or unapproved. Never throws for other reasons —
 * a missing lookup counts as "no approval", which only matters in block mode.
 */
export async function checkPlacement(p: Placement): Promise<string | null> {
  if (p.current && p.current.designationId === p.designationId && p.current.branchId === p.branchId) return null;
  const mode = await darbandiMode();
  if (mode === 'off') return null;
  const [row, label] = await Promise.all([repo.occupancyFor(p.designationId, p.branchId), repo.positionLabel(p.designationId, p.branchId)]);
  const decision = darbandiDecision(mode, label, row ? occupancy(row.positions, row.filled) : null);
  if (!decision.allowed) throw new UserFacingError(decision.message ?? 'Over darbandi.');
  return decision.message;
}

/**
 * checkPlacement for many new hires at once (F15 import): the mode and each post are read once,
 * and every hire the checker allowed counts as filled for the rows after it (none is saved yet).
 */
export async function placementChecker(): Promise<(designationId: string, branchId: string) => Promise<string | null>> {
  const mode = await darbandiMode();
  const posts = new Map<string, Promise<[Awaited<ReturnType<typeof repo.occupancyFor>>, string]>>();
  const placed = new Map<string, number>();
  return async (designationId, branchId) => {
    if (mode === 'off') return null;
    const key = `${designationId}|${branchId}`;
    let post = posts.get(key);
    if (!post) {
      post = Promise.all([repo.occupancyFor(designationId, branchId), repo.positionLabel(designationId, branchId)]);
      posts.set(key, post);
    }
    const [row, label] = await post;
    const earlier = placed.get(key) ?? 0;
    const decision = darbandiDecision(mode, label, row ? occupancy(row.positions, row.filled + earlier) : null);
    if (!decision.allowed) throw new UserFacingError(decision.message ?? 'Over darbandi.');
    placed.set(key, earlier + 1);
    return decision.message;
  };
}
