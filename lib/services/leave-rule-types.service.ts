import * as leaveRepo from "@/lib/repositories/leave.repository";
import * as policyRepo from "@/lib/repositories/leave-policy.repository";
import { exceptionActive, floorOn, raiseToFloor, splitChange, valuesOf } from "@/lib/engines/leave-policy.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { LeaveRuleType } from "@/lib/types/leave";
import type { PolicyApplies, PolicySetting, PolicyValues } from "@/lib/types/leave-policy";

// Leave types as the rules use them (4.6c). Before they are read, any approved
// change whose date has come (days a year from the next leave year) is applied
// once, and a statutory setting below the minimum (the Labour Act, lowered only
// by an exception in force) is raised back to it as a recorded system change:
// e.g. when an exception ends, or a value written before the minimum was checked.

/**
 * Applies what is due and keeps statutory types at or above the minimum.
 * Returns true when something changed. Never stops leave from working: a
 * failure (e.g. tables not there before the restart) is logged and skipped.
 */
export async function applyDueChanges(types: LeaveRuleType[], today = nepalDateIso()): Promise<boolean> {
  try {
    let changed = false;
    for (const c of await policyRepo.findDueChanges(today)) {
      const later = splitChange(c.after as Partial<PolicyValues>, c.applies as PolicyApplies, true).later;
      if (await policyRepo.applyDue(c.id, c.leaveTypeId, later)) changed = true;
    }
    const current = changed ? await leaveRepo.findRuleTypes() : types;
    const exceptions = await policyRepo.findExceptions();
    for (const t of current) {
      if (!t.isStatutory || !t.statutoryCode || !t.isActive) continue;
      const { floor } = floorOn(t.statutoryCode, today, exceptions);
      const values = valuesOf(t);
      const raise = raiseToFloor(t.statutoryCode, values, floor);
      const keys = Object.keys(raise) as PolicySetting[];
      if (!keys.length) continue;
      const ended = exceptions.find((e) => e.statutoryCode === t.statutoryCode && keys.includes(e.setting) && !exceptionActive(e, today));
      const reason = ended
        ? `The exception "${ended.legalBasis}" ${ended.revokedAt ? "was withdrawn" : `ended on ${ended.validUntil}`}: back to the Labour Act minimum.`
        : "Below the Labour Act minimum, so it was raised to the law.";
      const before = Object.fromEntries(keys.map((k) => [k, values[k]])) as Partial<PolicyValues>;
      if (await policyRepo.recordSystemChange({ leaveTypeId: t.id, before, after: raise, reason, today, exceptionId: ended?.id ?? null })) changed = true;
    }
    return changed;
  } catch (err) {
    console.error("[leave-policy] applying due changes:", err instanceof Error ? err.message.slice(0, 200) : err);
    return false;
  }
}

/** Every leave type as the rules need it, with due policy changes applied first. */
export async function ruleTypes(): Promise<LeaveRuleType[]> {
  const types = await leaveRepo.findRuleTypes();
  return (await applyDueChanges(types)) ? leaveRepo.findRuleTypes() : types;
}
