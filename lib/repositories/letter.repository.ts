import { getDb } from '@/lib/db';
import { branches, departments, designations, employeeFamily, employeePersonal, employeeSalaryMap, employees, fiscalYears, hrLetters, letterSequences, letterTemplates, systemConfig, users } from '@/lib/db/schema';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DefaultLetterTemplate } from '@/lib/constants/letter-templates';
import type { LetterEmployeeOption, LetterTemplateRow } from '@/lib/types/letter';

// HR letters (G2): Drizzle queries only. Template and numbering rules live in
// lib/engines/letter.engine.ts; orchestration in lib/services/letter.service.ts.

type TemplateDbRow = typeof letterTemplates.$inferSelect;
export type HrLetterRow = typeof hrLetters.$inferSelect;

const toTemplateRow = (r: TemplateDbRow): LetterTemplateRow => ({
  id: r.id,
  code: r.code,
  name: r.name,
  nameNp: r.nameNp,
  subjectEn: r.subjectEn,
  subjectNp: r.subjectNp,
  bodyEn: r.bodyEn,
  bodyNp: r.bodyNp,
  isSystem: r.isSystem,
  isActive: r.isActive,
  updatedAt: r.updatedAt.toISOString(),
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function countTemplates(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(letterTemplates);
  return row?.n ?? 0;
}

/** System templates present — the seed runs again only when a release adds a kind. */
export async function countSystemTemplates(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(letterTemplates).where(eq(letterTemplates.isSystem, true));
  return row?.n ?? 0;
}

export async function findTemplates(): Promise<LetterTemplateRow[]> {
  const db = await getDb();
  const rows = await db.select().from(letterTemplates).orderBy(letterTemplates.name);
  return rows.map(toTemplateRow);
}

export async function findTemplateById(id: string): Promise<LetterTemplateRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(letterTemplates).where(eq(letterTemplates.id, id)).limit(1);
  return row ? toTemplateRow(row) : null;
}

/** Seeds the system templates once (first read). Idempotent through the code unique key. */
export async function insertDefaultTemplates(defaults: readonly DefaultLetterTemplate[]): Promise<void> {
  const db = await getDb();
  for (const t of defaults) {
    await db
      .insert(letterTemplates)
      .values({ ...t, isSystem: true, isActive: true })
      .onConflictDoNothing({ target: letterTemplates.code });
  }
}

export interface TemplateWrite {
  code: string;
  name: string;
  nameNp: string;
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
  isActive: boolean;
}

export async function insertTemplate(data: TemplateWrite, userId: string): Promise<LetterTemplateRow> {
  const db = await getDb();
  const [row] = await db
    .insert(letterTemplates)
    .values({ ...data, isSystem: false, createdBy: userId, updatedBy: userId })
    .returning();
  return toTemplateRow(row);
}

/** The code and isSystem of a system template never change; a custom template may change both texts and its code. */
export async function updateTemplate(id: string, data: TemplateWrite, userId: string): Promise<LetterTemplateRow | null> {
  const db = await getDb();
  const [existing] = await db.select().from(letterTemplates).where(eq(letterTemplates.id, id)).limit(1);
  if (!existing) return null;
  const [row] = await db
    .update(letterTemplates)
    .set({
      ...(existing.isSystem ? { ...data, code: existing.code } : data),
      updatedBy: userId,
    })
    .where(eq(letterTemplates.id, id))
    .returning();
  return row ? toTemplateRow(row) : null;
}

export async function deleteTemplate(id: string): Promise<'deleted' | 'is_system' | 'in_use' | 'missing'> {
  const db = await getDb();
  const [existing] = await db.select().from(letterTemplates).where(eq(letterTemplates.id, id)).limit(1);
  if (!existing) return 'missing';
  if (existing.isSystem) return 'is_system';
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(hrLetters).where(eq(hrLetters.templateId, id));
  if ((used?.n ?? 0) > 0) return 'in_use';
  await db.delete(letterTemplates).where(eq(letterTemplates.id, id));
  return 'deleted';
}

// ---------------------------------------------------------------------------
// Employees and fiscal years (for the Issue window and filters)
// ---------------------------------------------------------------------------

export async function findEmployeeOptions(scopeCondition?: SQL<unknown>): Promise<LetterEmployeeOption[]> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(employees.status, 'Active'), scopeCondition) : eq(employees.status, 'Active');
  const rows = await db
    .select({ id: employees.id, fullName: employees.fullName, employeeCode: employees.employeeCode, branch: branches.name })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(where)
    .orderBy(employees.fullName);
  return rows;
}

export interface EmployeeLetterFacts {
  id: string;
  fullName: string;
  employeeCode: string;
  designation: string;
  department: string;
  branch: string;
  joiningDate: string; // YYYY-MM-DD (AD)
  status: string;
  designationDescription: string;
  fatherName: string;
  grandfatherName: string;
  citizenshipNo: string;
  permanentAddress: string;
  mobileNo: string;
}

/** The employee a letter is about, with names resolved — only within the caller's scope. */
export async function findEmployeeForLetter(employeeId: string, scopeCondition?: SQL<unknown>): Promise<EmployeeLetterFacts | null> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(employees.id, employeeId), scopeCondition) : eq(employees.id, employeeId);
  const [row] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      designation: designations.name,
      department: departments.name,
      branch: branches.name,
      joiningDate: employees.joiningDate,
      status: employees.status,
      designationDescription: sql<string>`COALESCE(${designations.description}, '')`,
      fatherName: sql<string>`COALESCE(${employeeFamily.fatherName}, '')`,
      grandfatherName: sql<string>`COALESCE(${employeeFamily.grandfatherName}, '')`,
      citizenshipNo: sql<string>`COALESCE(${employeePersonal.citizenshipNo}, '')`,
      permanentAddress: sql<string>`COALESCE(${employeePersonal.permanentAddress}, '')`,
      mobileNo: sql<string>`COALESCE(${employeePersonal.mobileNo}, '')`,
    })
    .from(employees)
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
    .where(where)
    .limit(1);
  return row ?? null;
}

export interface PackFacts {
  category: string;
  /** Monthly basic salary of the current approved revision, as stored; null when none yet. */
  basicSalary: string | null;
}

/** What the joining pack can fill by itself for this employee (scope is checked by the caller's earlier employee lookup). */
export async function findPackFacts(employeeId: string): Promise<PackFacts | null> {
  const db = await getDb();
  const [emp] = await db.select({ category: employees.category }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!emp) return null;
  const [pay] = await db
    .select({ basic: employeeSalaryMap.basicSalary })
    .from(employeeSalaryMap)
    .where(and(eq(employeeSalaryMap.employeeId, employeeId), eq(employeeSalaryMap.isActive, true), eq(employeeSalaryMap.status, 'approved')))
    .orderBy(desc(employeeSalaryMap.effectiveFrom))
    .limit(1);
  return { category: emp.category, basicSalary: pay?.basic ?? null };
}

export interface FiscalYearFacts {
  id: string;
  label: string;
  startDateAD: Date;
  endDateAD: Date;
  status: string;
}

export async function findFiscalYearsForLetters(): Promise<FiscalYearFacts[]> {
  const db = await getDb();
  return db
    .select({ id: fiscalYears.id, label: fiscalYears.label, startDateAD: fiscalYears.startDateAD, endDateAD: fiscalYears.endDateAD, status: fiscalYears.status })
    .from(fiscalYears)
    .orderBy(desc(fiscalYears.startDateAD));
}

// ---------------------------------------------------------------------------
// Letters
// ---------------------------------------------------------------------------

export interface LetterFilter {
  q?: string;
  kind?: string;
  status?: string;
  fiscalYearId?: string;
  employeeId?: string;
}

export interface LetterJoinedRow extends HrLetterRow {
  employeeName: string;
  employeeCode: string;
  issuedByName: string | null;
  voidedByName: string | null;
}

export async function listLetters(filter: LetterFilter, scopeCondition?: SQL<unknown>): Promise<LetterJoinedRow[]> {
  const db = await getDb();
  const voider = alias(users, 'voider');
  const conditions: SQL<unknown>[] = [];
  if (scopeCondition) conditions.push(scopeCondition);
  if (filter.kind) conditions.push(eq(hrLetters.kind, filter.kind));
  if (filter.status) conditions.push(eq(hrLetters.status, filter.status));
  if (filter.fiscalYearId) conditions.push(eq(hrLetters.fiscalYearId, filter.fiscalYearId));
  if (filter.employeeId) conditions.push(eq(hrLetters.employeeId, filter.employeeId));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    const match = or(ilike(employees.fullName, q), ilike(employees.employeeCode, q), ilike(hrLetters.letterNumber, q), ilike(hrLetters.subject, q));
    if (match) conditions.push(match);
  }
  const rows = await db
    .select({
      letter: hrLetters,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      issuedByName: users.name,
      voidedByName: voider.name,
    })
    .from(hrLetters)
    .innerJoin(employees, eq(hrLetters.employeeId, employees.id))
    .leftJoin(users, eq(hrLetters.issuedBy, users.id))
    .leftJoin(voider, eq(hrLetters.voidedBy, voider.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(hrLetters.issuedAt))
    .limit(1000);
  return rows.map((r) => ({ ...r.letter, employeeName: r.employeeName, employeeCode: r.employeeCode, issuedByName: r.issuedByName, voidedByName: r.voidedByName }));
}

export async function findLetterById(id: string, scopeCondition?: SQL<unknown>): Promise<LetterJoinedRow | null> {
  const db = await getDb();
  const voider = alias(users, 'voider');
  const where = scopeCondition ? and(eq(hrLetters.id, id), scopeCondition) : eq(hrLetters.id, id);
  const rows = await db
    .select({
      letter: hrLetters,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      issuedByName: users.name,
      voidedByName: voider.name,
    })
    .from(hrLetters)
    .innerJoin(employees, eq(hrLetters.employeeId, employees.id))
    .leftJoin(users, eq(hrLetters.issuedBy, users.id))
    .leftJoin(voider, eq(hrLetters.voidedBy, voider.id))
    .where(where)
    .limit(1);
  const r = rows[0];
  return r ? { ...r.letter, employeeName: r.employeeName, employeeCode: r.employeeCode, issuedByName: r.issuedByName, voidedByName: r.voidedByName } : null;
}

export interface IssueWrite {
  employeeId: string;
  templateId: string;
  kind: string;
  fiscalYearId: string;
  language: 'en' | 'np';
  /** Rendered with the final chalani number by the caller inside the transaction. */
  render: (seq: number) => { letterNumber: string; subject: string; body: string; mergeData: Record<string, string> };
  issuedDateBs: string;
  issuedDateAd: string;
  issuedBy: string;
}

/**
 * Issues a letter in one transaction: the fiscal year's sequence row is
 * created if missing, bumped with a single UPDATE ... RETURNING (so two
 * letters can never share a chalani number), and the letter inserted with the
 * rendered, frozen text.
 */
export async function issueLetterTx(write: IssueWrite): Promise<HrLetterRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.insert(letterSequences).values({ fiscalYearId: write.fiscalYearId, lastSeq: 0 }).onConflictDoNothing({ target: letterSequences.fiscalYearId });
    const [bumped] = await tx
      .update(letterSequences)
      .set({ lastSeq: sql`${letterSequences.lastSeq} + 1` })
      .where(eq(letterSequences.fiscalYearId, write.fiscalYearId))
      .returning({ lastSeq: letterSequences.lastSeq });
    const seq = bumped.lastSeq;
    const rendered = write.render(seq);
    const [row] = await tx
      .insert(hrLetters)
      .values({
        employeeId: write.employeeId,
        templateId: write.templateId,
        kind: write.kind,
        fiscalYearId: write.fiscalYearId,
        seq,
        letterNumber: rendered.letterNumber,
        language: write.language,
        subject: rendered.subject,
        body: rendered.body,
        mergeData: rendered.mergeData,
        status: 'issued',
        issuedDateBs: write.issuedDateBs,
        issuedDateAd: write.issuedDateAd,
        issuedBy: write.issuedBy,
      })
      .returning();
    return row;
  });
}

/** Voids an issued letter (records are never deleted; the number is never reused). */
export async function voidLetter(id: string, reason: string, userId: string): Promise<HrLetterRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(hrLetters)
    .set({ status: 'voided', voidReason: reason, voidedBy: userId, voidedAt: new Date() })
    .where(and(eq(hrLetters.id, id), eq(hrLetters.status, 'issued')))
    .returning();
  return row ?? null;
}

/** Register KPI counts within scope. */
export async function countLetters(scopeCondition?: SQL<unknown>): Promise<{ total: number; voided: number; kinds: Record<string, number> }> {
  const db = await getDb();
  const rows = await db
    .select({ kind: hrLetters.kind, status: hrLetters.status, n: sql<number>`count(*)::int` })
    .from(hrLetters)
    .innerJoin(employees, eq(hrLetters.employeeId, employees.id))
    .where(scopeCondition)
    .groupBy(hrLetters.kind, hrLetters.status);
  const out = { total: 0, voided: 0, kinds: {} as Record<string, number> };
  for (const r of rows) {
    out.total += r.n;
    if (r.status === 'voided') out.voided += r.n;
    else out.kinds[r.kind] = (out.kinds[r.kind] ?? 0) + r.n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Letter design (system_config, one JSON value)
// ---------------------------------------------------------------------------

export const LETTER_DESIGN_KEY = 'letters.design';

export async function readLetterDesignJson(): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, LETTER_DESIGN_KEY)).limit(1);
  return row?.value ?? null;
}

export async function writeLetterDesignJson(json: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(systemConfig)
    .values({ key: LETTER_DESIGN_KEY, value: json, dataType: 'json' })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: json, updatedAt: new Date() } });
}
