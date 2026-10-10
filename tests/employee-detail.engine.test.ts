import test from "node:test";
import assert from "node:assert/strict";
import { availableActions, applyDecision } from "@/lib/engines/approval.engine";
import {
  cleanReason,
  detailDecisionCtx,
  detailDiff,
  detailLines,
  detailOutcome,
  detailRequest,
  detailSummary,
  detailValues,
  pendingConflicts,
  readPatch,
  staleFields,
  touchesBank,
} from "@/lib/engines/employee-detail.engine";

const stored = detailValues({ bankName: "Nabil Bank", bankBranch: "New Road", bankAccountNumber: "0123456789014821", panNumber: "123456789", taxStatus: "Normal Single", isDisabled: false });

test("values are compared the way they are saved (trimmed text, false for a missing flag)", () => {
  const v = detailValues({ bankName: "  Nabil Bank ", bankAccountNumber: null, isDisabled: undefined });
  assert.deepEqual(v, { bankName: "Nabil Bank", bankBranch: "", bankAccountNumber: "", panNumber: "", taxStatus: "", isDisabled: false });
});

test("the diff holds only the changed fields, before and after", () => {
  assert.equal(detailDiff(stored, { ...stored }), null);
  const d = detailDiff(stored, { ...stored, bankAccountNumber: "0987654321001111", taxStatus: "Married" })!;
  assert.deepEqual(d.fields, ["bankAccountNumber", "taxStatus"]);
  assert.deepEqual(d.before, { bankAccountNumber: "0123456789014821", taxStatus: "Normal Single" });
  assert.deepEqual(d.after, { bankAccountNumber: "0987654321001111", taxStatus: "Married" });
  assert.equal(touchesBank(d.after), true);
  assert.equal(touchesBank({ panNumber: "987654321" }), false);
});

test("own record always waits; otherwise approvals off or an exempt administrator apply at once", () => {
  const base = { approval: "required" as const, checker: "admin_exempt" as const, actorIsAdmin: false, ownRecord: false };
  assert.deepEqual(detailOutcome(base), { kind: "pending", because: "approval" });
  assert.deepEqual(detailOutcome({ ...base, actorIsAdmin: true }), { kind: "apply", route: "final_approve" });
  assert.deepEqual(detailOutcome({ ...base, actorIsAdmin: true, checker: "strict" }), { kind: "pending", because: "approval" });
  assert.deepEqual(detailOutcome({ ...base, approval: "off" }), { kind: "apply", route: "not_required" });
  // S21: not even an administrator with approvals off changes their own bank account alone.
  assert.deepEqual(detailOutcome({ ...base, approval: "off", actorIsAdmin: true, ownRecord: true }), { kind: "pending", because: "own_record" });
});

test("while a change waits, only moving away from both the record and the waiting value conflicts", () => {
  const waiting = { bankAccountNumber: "0987654321001111" };
  assert.deepEqual(pendingConflicts(stored, { ...stored }, waiting), []);
  assert.deepEqual(pendingConflicts(stored, { ...stored, bankAccountNumber: "0987654321001111" }, waiting), []);
  assert.deepEqual(pendingConflicts(stored, { ...stored, bankAccountNumber: "5555" }, waiting), ["bankAccountNumber"]);
  assert.deepEqual(pendingConflicts(stored, { ...stored, panNumber: "987654321" }, waiting), ["panNumber"]);
});

test("a change is stale when the record no longer has the values it was made against", () => {
  assert.deepEqual(staleFields(stored, { bankAccountNumber: "0123456789014821" }), []);
  assert.deepEqual(staleFields({ ...stored, bankAccountNumber: "1" }, { bankAccountNumber: "0123456789014821", taxStatus: "Normal Single" }), ["bankAccountNumber"]);
});

test("stored patches are read back with known fields of the right kind only", () => {
  assert.deepEqual(readPatch({ bankAccountNumber: "12", isDisabled: true, salary: 9, panNumber: 5, taxStatus: null }), { bankAccountNumber: "12", isDisabled: true });
  assert.deepEqual(readPatch(null), {});
});

test("a reason of a few words is required, cleaned and capped", () => {
  assert.equal(cleanReason("  ok "), null);
  assert.equal(cleanReason("Employee's   letter, old account closed"), "Employee's letter, old account closed");
  assert.equal(cleanReason("x".repeat(900))?.length, 500);
  assert.equal(cleanReason(42), null);
});

test("lines mask account numbers and PAN unless the viewer may see them in full", () => {
  const lines = detailLines({ bankAccountNumber: "0123456789014821", taxStatus: "Normal Single", isDisabled: false }, { bankAccountNumber: "0987654321001111", taxStatus: "Married", isDisabled: true }, false);
  assert.deepEqual(lines.map((l) => [l.label, l.from, l.to]), [
    ["Account number", "••••4821", "••••1111"],
    ["Tax status", "Single", "Married (couple slab)"],
    ["Disability relief", "No", "Yes"],
  ]);
  assert.equal(detailLines({ panNumber: "" }, { panNumber: "123456789" }, true)[0].to, "123456789");
  assert.equal(detailLines({ panNumber: "" }, { panNumber: "123456789" }, true)[0].from, "(none)");
});

test("summaries name the groups touched", () => {
  assert.equal(detailSummary(["bankAccountNumber", "bankName"]), "Bank account");
  assert.equal(detailSummary(["bankAccountNumber", "panNumber"]), "Bank account and PAN");
  assert.equal(detailSummary(["taxStatus", "panNumber", "bankBranch"]), "Bank account, PAN and tax status");
  assert.equal(detailSummary(["isDisabled"]), "Tax status");
});

test("deciding: a second person approves; the maker and the employee never do", () => {
  const today = "2026-10-10";
  const request = detailRequest({ status: "pending", preparedBy: "u-maker", employeeId: "e-ram" });
  const checker = { userId: "u-checker", employeeId: "e-hari", canApprove: true, isAdministrator: false };
  const can = availableActions(request, checker, detailDecisionCtx("admin_exempt", today));
  assert.ok(can.approve);
  assert.equal(applyDecision(request, "approve").status, "approved");

  const maker = availableActions(request, { userId: "u-maker", employeeId: null, canApprove: true, isAdministrator: false }, detailDecisionCtx("admin_exempt", today));
  assert.equal(maker.approve, null);
  assert.equal(maker.withdraw, true);
  assert.match(maker.reason ?? "", /You made this change/);

  const subject = availableActions(request, { userId: "u-ram", employeeId: "e-ram", canApprove: true, isAdministrator: true }, detailDecisionCtx("admin_exempt", today));
  assert.equal(subject.approve, null);
  assert.equal(subject.finalApprove, false);
  assert.equal(subject.reject, false);
  assert.match(subject.reason ?? "", /your own record/);
});

test("strict maker-checker: an administrator who made the change cannot Final approve it", () => {
  const today = "2026-10-10";
  const request = detailRequest({ status: "pending", preparedBy: "u-admin", employeeId: "e-ram" });
  const admin = { userId: "u-admin", employeeId: null, canApprove: true, isAdministrator: true };
  assert.equal(availableActions(request, admin, detailDecisionCtx("strict", today)).finalApprove, false);
  assert.equal(availableActions(request, admin, detailDecisionCtx("admin_exempt", today)).finalApprove, true);
  // A decided change offers nothing.
  const done = availableActions(detailRequest({ status: "approved", preparedBy: "u-maker", employeeId: "e-ram" }), admin, detailDecisionCtx("admin_exempt", today));
  assert.equal(done.finalApprove || !!done.approve || done.reject || done.withdraw, false);
  // An unknown status is inert.
  assert.equal(detailRequest({ status: "weird", preparedBy: null, employeeId: "e" }).status, "withdrawn");
});
