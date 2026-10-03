import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { branches, departments, designations, employees, employmentTypes, holidays, payrollRuns, shreniLevels, users } from "@/lib/db/schema";
import type {
  BranchInput,
  DepartmentInput,
  DesignationInput,
  EmploymentTypeInput,
  LevelInput,
  OrgHeadcount,
  OrgKind,
  OrgPerson,
  OrgStatus,
} from "@/lib/types/organization";

// Organization (4.3): reads for the five masters and everything that refers
// to them, and the writes. Counts are always worked out live (the stored
// departments.employee_count / designation_count are not trusted).

export type BranchRow = typeof branches.$inferSelect;
export type DepartmentRow = typeof departments.$inferSelect;
export type DesignationRow = typeof designations.$inferSelect;
export type LevelRow = typeof shreniLevels.$inferSelect;
export type TypeRow = typeof employmentTypes.$inferSelect;

export async function findMasters() {
  const db = await getDb();
  const [branchRows, departmentRows, designationRows, levelRows, typeRows] = await Promise.all([
    db.select().from(branches),
    db.select().from(departments),
    db.select().from(designations),
    db.select().from(shreniLevels),
    db.select().from(employmentTypes),
  ]);
  return { branchRows, departmentRows, designationRows, levelRows, typeRows };
}

/** How many times each id / value is referred to. */
export interface UsageCounts {
  employeesByBranch: Map<string, number>;
  employeesByDepartment: Map<string, number>;
  employeesByDesignation: Map<string, number>;
  employeesByLevel: Map<string, number>;
  employeesByCategory: Map<string, number>;
  designationsByDepartment: Map<string, number>;
  departmentsByBranch: Map<string, number>;
  usersByBranch: Map<string, number>;
  usersByDepartment: Map<string, number>;
  holidaysByBranch: Map<string, number>;
  runsByBranch: Map<string, number>;
  runsByDepartment: Map<string, number>;
  runsByDesignation: Map<string, number>;
  runsByCategory: Map<string, number>;
  headcounts: OrgHeadcount[];
}

const tally = (rows: { key: string | null; count: number }[]) => new Map(rows.filter((r) => r.key).map((r) => [r.key as string, Number(r.count)]));

function tallyArrays(lists: (readonly (string | null)[] | null)[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of lists) for (const id of new Set(list ?? [])) if (id) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

export async function findUsage(): Promise<UsageCounts> {
  const db = await getDb();
  const count = sql<number>`count(*)::int`;
  const [byBranch, byDepartment, byDesignation, byLevel, byCategory, designationCounts, deptBranchLists, userLists, holidayLists, runLists, active] =
    await Promise.all([
      db.select({ key: employees.branchId, count }).from(employees).groupBy(employees.branchId),
      db.select({ key: employees.departmentId, count }).from(employees).groupBy(employees.departmentId),
      db.select({ key: employees.designationId, count }).from(employees).groupBy(employees.designationId),
      db.select({ key: employees.shreni, count }).from(employees).groupBy(employees.shreni),
      db.select({ key: employees.category, count }).from(employees).groupBy(employees.category),
      db.select({ key: designations.departmentId, count }).from(designations).groupBy(designations.departmentId),
      db.select({ ids: departments.branchIds }).from(departments),
      db.select({ branchIds: users.assignedBranchIds, departmentIds: users.assignedDepartmentIds }).from(users),
      db.select({ ids: holidays.branchIds }).from(holidays),
      db
        .select({
          branchIds: payrollRuns.branchIds,
          departmentIds: payrollRuns.departmentIds,
          designationIds: payrollRuns.designationIds,
          categories: payrollRuns.employeeCategories,
        })
        .from(payrollRuns),
      db
        .select({ branchId: employees.branchId, departmentId: employees.departmentId, designationId: employees.designationId, count })
        .from(employees)
        .where(eq(employees.status, "Active"))
        .groupBy(employees.branchId, employees.departmentId, employees.designationId),
    ]);

  return {
    employeesByBranch: tally(byBranch),
    employeesByDepartment: tally(byDepartment),
    employeesByDesignation: tally(byDesignation),
    employeesByLevel: tally(byLevel),
    employeesByCategory: tally(byCategory),
    designationsByDepartment: tally(designationCounts),
    departmentsByBranch: tallyArrays(deptBranchLists.map((r) => r.ids)),
    usersByBranch: tallyArrays(userLists.map((r) => r.branchIds)),
    usersByDepartment: tallyArrays(userLists.map((r) => r.departmentIds)),
    holidaysByBranch: tallyArrays(holidayLists.map((r) => r.ids)),
    runsByBranch: tallyArrays(runLists.map((r) => r.branchIds)),
    runsByDepartment: tallyArrays(runLists.map((r) => r.departmentIds)),
    runsByDesignation: tallyArrays(runLists.map((r) => r.designationIds)),
    runsByCategory: tallyArrays(runLists.map((r) => r.categories)),
    headcounts: active.map((r) => ({ branchId: r.branchId, departmentId: r.departmentId, designationId: r.designationId, count: Number(r.count) })),
  };
}

/** People for the reporting chart and the department-head picker, within the caller's scope. */
export async function findPeople(scopeCondition: SQL | undefined): Promise<OrgPerson[]> {
  const rows = await (await getDb())
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      status: employees.status,
      branchId: employees.branchId,
      departmentId: employees.departmentId,
      designationId: employees.designationId,
      supervisorId: employees.supervisorId,
      isSupervisor: employees.isSupervisor,
    })
    .from(employees)
    .where(scopeCondition);
  return rows.map((r) => ({ ...r, status: r.status === "Inactive" ? "Inactive" : "Active" }));
}

export async function employeeExists(id: string): Promise<boolean> {
  const rows = await (await getDb()).select({ id: employees.id }).from(employees).where(eq(employees.id, id)).limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const clean = (v: string) => v.trim();
const nullable = (v: string) => v.trim() || null;

export async function saveBranch(id: string | null, input: BranchInput, status?: OrgStatus): Promise<BranchRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Only one head office: choosing one moves the flag.
    if (input.isHeadOffice) {
      const others = id ? and(eq(branches.isHeadOffice, true), ne(branches.id, id)) : eq(branches.isHeadOffice, true);
      await tx.update(branches).set({ isHeadOffice: false, updatedAt: new Date() }).where(others);
    }
    const values = {
      code: clean(input.code).toUpperCase(),
      name: clean(input.name),
      location: clean(input.location),
      phone: clean(input.phone),
      email: clean(input.email),
      isHeadOffice: input.isHeadOffice,
      remoteCategory: input.remoteCategory || "NONE",
    };
    const [row] = id
      ? await tx.update(branches).set({ ...values, updatedAt: new Date() }).where(eq(branches.id, id)).returning()
      : await tx.insert(branches).values({ ...values, status: status ?? "active" }).returning();
    return row;
  });
}

export async function saveDepartment(id: string | null, input: DepartmentInput): Promise<DepartmentRow> {
  const db = await getDb();
  const values = {
    code: clean(input.code).toUpperCase(),
    name: clean(input.name),
    branchIds: [...new Set(input.branchIds)],
    headEmployeeId: input.headEmployeeId || null,
    description: clean(input.description),
  };
  const [row] = id
    ? await db.update(departments).set({ ...values, updatedAt: new Date() }).where(eq(departments.id, id)).returning()
    : await db.insert(departments).values({ ...values, status: "active" }).returning();
  return row;
}

export async function saveDesignation(id: string | null, input: DesignationInput): Promise<DesignationRow> {
  const db = await getDb();
  const values = { name: clean(input.name), departmentId: input.departmentId, description: clean(input.description) };
  const [row] = id
    ? await db.update(designations).set({ ...values, updatedAt: new Date() }).where(eq(designations.id, id)).returning()
    : await db.insert(designations).values({ ...values, status: "active" }).returning();
  return row;
}

/** Saves a level; renames move the employees that hold it in the same transaction. Returns how many moved. */
export async function saveLevel(id: string | null, input: LevelInput, renames: { from: string; to: string }[]): Promise<{ row: LevelRow; moved: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const values = {
      code: clean(input.code).toUpperCase(),
      name: clean(input.name),
      levelNumber: input.levelNumber,
      labelNepali: clean(input.labelNepali) || clean(input.name),
      description: nullable(input.description),
      minSalary: String(Math.max(0, input.minSalary || 0)),
      maxSalary: String(Math.max(0, input.maxSalary || 0)),
      rankOrder: input.rankOrder,
    };
    const [row] = id
      ? await tx.update(shreniLevels).set({ ...values, updatedAt: new Date() }).where(eq(shreniLevels.id, id)).returning()
      : await tx.insert(shreniLevels).values({ ...values, isActive: true }).returning();
    let moved = 0;
    for (const r of renames) {
      const updated = await tx.update(employees).set({ shreni: r.to, updatedAt: new Date() }).where(eq(employees.shreni, r.from)).returning({ id: employees.id });
      moved += updated.length;
    }
    return { row, moved };
  });
}

/** Saves an employment type; a new name moves the employees that hold the old one, in the same transaction. */
export async function saveType(id: string | null, input: EmploymentTypeInput, renames: { from: string; to: string }[]): Promise<{ row: TypeRow; moved: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const values = {
      code: clean(input.code).toUpperCase(),
      name: clean(input.name),
      nameNepali: nullable(input.nameNepali),
      isPfEligible: input.isPfEligible,
      isSsfEligible: input.isSsfEligible,
      isFestivalEligible: input.isFestivalEligible,
      isLeaveEligible: input.isLeaveEligible,
      isOtEligible: input.isOtEligible,
      noticePeriodDays: input.noticePeriodDays,
      probationMonths: input.probationMonths,
      rankOrder: input.rankOrder,
    };
    const [row] = id
      ? await tx.update(employmentTypes).set({ ...values, updatedAt: new Date() }).where(eq(employmentTypes.id, id)).returning()
      : await tx.insert(employmentTypes).values({ ...values, isActive: true }).returning();
    let moved = 0;
    for (const r of renames) {
      const updated = await tx.update(employees).set({ category: r.to, updatedAt: new Date() }).where(eq(employees.category, r.from)).returning({ id: employees.id });
      moved += updated.length;
    }
    return { row, moved };
  });
}

export async function setStatus(kind: OrgKind, id: string, status: OrgStatus): Promise<void> {
  const db = await getDb();
  const now = new Date();
  switch (kind) {
    case "branch":
      await db.update(branches).set({ status, updatedAt: now }).where(eq(branches.id, id));
      return;
    case "department":
      await db.update(departments).set({ status, updatedAt: now }).where(eq(departments.id, id));
      return;
    case "designation":
      await db.update(designations).set({ status, updatedAt: now }).where(eq(designations.id, id));
      return;
    case "level":
      await db.update(shreniLevels).set({ isActive: status === "active", updatedAt: now }).where(eq(shreniLevels.id, id));
      return;
    case "type":
      await db.update(employmentTypes).set({ isActive: status === "active", updatedAt: now }).where(eq(employmentTypes.id, id));
      return;
  }
}

export async function deleteRecord(kind: OrgKind, id: string): Promise<void> {
  const db = await getDb();
  switch (kind) {
    case "branch":
      await db.delete(branches).where(eq(branches.id, id));
      return;
    case "department":
      await db.delete(departments).where(eq(departments.id, id));
      return;
    case "designation":
      await db.delete(designations).where(eq(designations.id, id));
      return;
    case "level":
      await db.delete(shreniLevels).where(eq(shreniLevels.id, id));
      return;
    case "type":
      await db.delete(employmentTypes).where(eq(employmentTypes.id, id));
      return;
  }
}

/** Branch ids that exist (for validating a department's branch list). */
export async function existingBranchIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await (await getDb()).select({ id: branches.id }).from(branches).where(inArray(branches.id, ids));
  return rows.map((r) => r.id);
}
