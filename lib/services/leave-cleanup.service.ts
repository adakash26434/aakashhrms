import { getDb } from '@/lib/db';
import {
  leaveTypes,
  leaveRules,
  employeeLeaveBalances,
  leaveApplications,
} from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

let isStatutoryCleanupDone = false;

/**
 * Deduplicates statutory leave types by consolidating legacy 'STAT_*' prefixed codes
 * into standard canonical codes ('HOME', 'SICK', 'MATERNITY', 'PATERNITY', 'MOURNING', 'PUBLIC', 'SUBSTITUTE').
 * Guarded to run only once per process lifecycle or when legacy codes exist.
 */
export async function deduplicateStatutoryLeaves(): Promise<void> {
  if (isStatutoryCleanupDone) return;

  try {
    const db = getDb();
    const allTypes = await db.select().from(leaveTypes);

    const hasLegacyStatCodes = allTypes.some((t) => t.code.startsWith('STAT_'));
    if (!hasLegacyStatCodes) {
      isStatutoryCleanupDone = true;
      return;
    }

    const CODE_MAPPINGS: Record<string, string> = {
      STAT_HOME: 'HOME',
      STAT_SICK: 'SICK',
      STAT_MATERNITY: 'MATERNITY',
      STAT_PATERNITY: 'PATERNITY',
      STAT_MOURNING: 'MOURNING',
      STAT_PUBLIC: 'PUBLIC',
      STAT_SUBSTITUTE: 'SUBSTITUTE',
    };

    for (const [statCode, canonicalCode] of Object.entries(CODE_MAPPINGS)) {
      const statType = allTypes.find((t) => t.code === statCode);
      const canonicalType = allTypes.find((t) => t.code === canonicalCode);

      if (statType && canonicalType) {
        // Both exist: Reassign child references to canonicalType, then delete statType

        // 1. Repoint leave applications
        await db
          .update(leaveApplications)
          .set({ leaveTypeId: canonicalType.id })
          .where(eq(leaveApplications.leaveTypeId, statType.id));

        // 2. Repoint or clean up employee leave balances
        try {
          await db
            .update(employeeLeaveBalances)
            .set({ leaveTypeId: canonicalType.id })
            .where(eq(employeeLeaveBalances.leaveTypeId, statType.id));
        } catch {
          // If unique constraint collides, remove redundant duplicate balance record
          await db
            .delete(employeeLeaveBalances)
            .where(eq(employeeLeaveBalances.leaveTypeId, statType.id));
        }

        // 3. Delete leave rules linked to statType
        await db
          .delete(leaveRules)
          .where(eq(leaveRules.leaveTypeId, statType.id));

        // 4. Delete redundant statType record
        await db
          .delete(leaveTypes)
          .where(eq(leaveTypes.id, statType.id));
      } else if (statType && !canonicalType) {
        // Only statType exists: normalize its code and statutoryCode
        await db
          .update(leaveTypes)
          .set({
            code: canonicalCode,
            statutoryCode: canonicalCode,
            updatedAt: new Date(),
          })
          .where(eq(leaveTypes.id, statType.id));
      }
    }

    // Clean duplicate rules for the exact same leaveTypeId (keep 1 rule per leave type)
    const currentRules = await db.select().from(leaveRules);
    const seenRuleTypeIds = new Set<string>();

    for (const rule of currentRules) {
      if (seenRuleTypeIds.has(rule.leaveTypeId)) {
        await db.delete(leaveRules).where(eq(leaveRules.id, rule.id));
      } else {
        seenRuleTypeIds.add(rule.leaveTypeId);
      }
    }
  } catch (err) {
    console.error('[deduplicateStatutoryLeaves] Error:', err);
  }
}
