import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canMove,
  capProblem,
  feedAmounts,
  isEditable,
  nextStatuses,
  normalizeClaimForm,
  normalizeTypeForm,
  validateClaimForm,
  validateDecisionNote,
  validateTypeForm,
} from "@/lib/engines/reimbursement.engine";

// F16 reimbursements: the pure rules.

const today = "2026-10-10";
const type = { receiptRequired: true, perClaimCap: 5000, isActive: true };
const claim = (over: Record<string, unknown> = {}) =>
  normalizeClaimForm({ employeeId: "e1", typeId: "t1", expenseDate: "2026-10-01", amount: "1,250.50", receiptNo: " B-102 ", description: " Eye check-up ", ...over });

test("a claim moves draft → submitted → approved (or back / rejected) → settled, and only drafts are edited", () => {
  assert.deepEqual(nextStatuses("draft"), ["submitted"]);
  assert.deepEqual(nextStatuses("submitted"), ["approved", "rejected", "draft"]);
  assert.deepEqual(nextStatuses("approved"), ["settled"]);
  assert.deepEqual(nextStatuses("settled"), []);
  assert.equal(canMove("approved", "draft"), false);
  assert.equal(canMove("rejected", "submitted"), false);
  assert.equal(isEditable("draft"), true);
  assert.equal(isEditable("submitted"), false);
});

test("types: a code once, amounts in rupees, the claim cap within the yearly cap", () => {
  const f = normalizeTypeForm({ code: "medical bill", name: "Medical", taxable: "false", perClaimCap: "5000", yearlyCap: "20,000" });
  assert.deepEqual([f.code, f.taxable, f.perClaimCap, f.yearlyCap, f.receiptRequired, f.isActive], ["MEDICAL_BILL", false, 5000, 20000, true, true]);
  assert.deepEqual(validateTypeForm(f), {});
  assert.ok(validateTypeForm({ ...f, code: "9X" }).code);
  assert.match(validateTypeForm(f, "MEDICAL").code ?? "", /never changes/);
  assert.match(validateTypeForm({ ...f, perClaimCap: 30000 }).perClaimCap ?? "", /yearly cap/);
  assert.ok(validateTypeForm({ ...f, yearlyCap: Number.NaN }).yearlyCap);
  assert.ok(validateTypeForm({ ...f, name: "" }).name);
});

test("a claim is one bill: dated, not in the future or older than a year, within the type's cap", () => {
  const ok = claim();
  assert.deepEqual([ok.amount, ok.receiptNo, ok.description], [1250.5, "B-102", "Eye check-up"]);
  assert.deepEqual(validateClaimForm(ok, type, today), {});
  assert.match(validateClaimForm(claim({ expenseDate: "2026-10-11" }), type, today).expenseDate ?? "", /future/);
  assert.match(validateClaimForm(claim({ expenseDate: "2025-10-09" }), type, today).expenseDate ?? "", /older than 365 days/);
  assert.equal(validateClaimForm(claim({ expenseDate: "2025-10-10" }), type, today).expenseDate, undefined);
  assert.match(validateClaimForm(claim({ amount: "5000.01" }), type, today).amount ?? "", /At most NPR 5,000 a claim/);
  assert.ok(validateClaimForm(claim({ amount: "12.345" }), type, today).amount);
  assert.ok(validateClaimForm(claim({ amount: "0" }), type, today).amount);
  assert.ok(validateClaimForm(claim({ receiptNo: "" }), type, today).receiptNo);
  assert.equal(validateClaimForm(claim({ receiptNo: "" }), { ...type, receiptRequired: false }, today).receiptNo, undefined);
  assert.match(validateClaimForm(ok, { ...type, isActive: false }, today).typeId ?? "", /no longer in use/);
  assert.ok(validateClaimForm(ok, null, today).typeId);
});

test("the yearly cap says what is left", () => {
  assert.equal(capProblem(0, 99999, 5000, "Medical"), null);
  assert.equal(capProblem(20000, 15000, 5000, "Medical"), null);
  assert.equal(capProblem(20000, 15000.5, 5000, "Medical"), "Only NPR 4,999.5 left of the NPR 20,000 a year for Medical");
  assert.equal(capProblem(20000, 20000, 1, "Medical"), "The NPR 20,000 a year for Medical is used up");
});

test("returning or rejecting says why; the pay run sums claims by taxability in paisa", () => {
  assert.ok(validateDecisionNote("rejected", " "));
  assert.ok(validateDecisionNote("draft", "ok"));
  assert.equal(validateDecisionNote("approved", ""), null);
  assert.deepEqual(
    feedAmounts([
      { taxable: false, amount: "0.10" },
      { taxable: false, amount: "0.20" },
      { taxable: true, amount: 1000 },
    ]),
    { free: "0.30", taxable: "1000.00" }
  );
});
