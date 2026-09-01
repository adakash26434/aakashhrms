
import { getDb } from "@/lib/db";
import {
  attendanceRecords,
  leaveOtCalculations,
  fiscalYears,
  employees,
  departments,
  branches,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  AttendanceRecord,
  AttendanceStatus,
  LeaveOtCalculation,
  AttendanceBulkItem,
} from "@/lib/types/attendance";
import { parseTimeToMinutes, evaluateLateArrival } from "@/lib/engines/attendance.engine";

type AttendanceRowJoined = {
  id: string;
  employeeId: string;
  employeeCode: string;
  attendanceCode: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  departmentName: string | null;
  branchId: string;
  branchName: string | null;
  fiscalYearId: string;
  attendanceDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  workHours: string;
  otHoursOfficeDay: string;
  otHoursOffDay: string;
  isLate: boolean;
  isManualEntry: boolean;
  remarks: string | null;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Helper: Automatically resolves placeholder fiscal year IDs ("fy-1") to the real Active Fiscal Year UUID.
 */
export async function resolveFiscalYearId(givenId?: string | null): Promise<string> {
  if (givenId && givenId.trim()) return givenId;
  const fys = await getDb().select().from(fiscalYears).where(eq(fiscalYears.status, "Active"));
  if (fys.length) return fys[0].id;
  const allFys = await getDb().select().from(fiscalYears);
  if (allFys.length) return allFys[0].id;
  throw new Error("Cannot save attendance: No Fiscal Year exists in the database. Please create an Active Fiscal Year first!");
}

function mapJoinedRowToRecord(row: AttendanceRowJoined): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    attendanceCode: row.attendanceCode || row.employeeCode,
    employeeName: `${row.firstName} ${row.lastName}`.trim(),
    departmentId: row.departmentId,
    departmentName: row.departmentName ?? "—",
    branchId: row.branchId,
    branchName: row.branchName ?? "—",
    fiscalYearId: row.fiscalYearId,
    attendanceDate: row.attendanceDate,
    bsDate: row.attendanceDate, // In production, pass through adToBsString(row.attendanceDate)
    status: row.status as AttendanceStatus,
    inTime: row.inTime || null,
    outTime: row.outTime || null,
    workHours: Number(row.workHours) || 0,
    otHoursOfficeDay: Number(row.otHoursOfficeDay) || 0,
    otHoursOffDay: Number(row.otHoursOffDay) || 0,
    isLate: row.isLate,
    isManualEntry: row.isManualEntry,
    remarks: row.remarks || null,
    isLocked: row.isLocked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Fetch all attendance records for a specific date (or date range), joined with employee organizational metadata.
 */
export async function findAttendanceByDate(targetDate: string): Promise<AttendanceRecord[]> {
  const rows = await getDb()
    .select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeCode: employees.employeeCode,
      attendanceCode: employees.attendanceCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      branchId: employees.branchId,
      branchName: branches.name,
      fiscalYearId: attendanceRecords.fiscalYearId,
      attendanceDate: attendanceRecords.attendanceDate,
      status: attendanceRecords.status,
      inTime: attendanceRecords.inTime,
      outTime: attendanceRecords.outTime,
      workHours: attendanceRecords.workHours,
      otHoursOfficeDay: attendanceRecords.otHoursOfficeDay,
      otHoursOffDay: attendanceRecords.otHoursOffDay,
      isLate: attendanceRecords.isLate,
      isManualEntry: attendanceRecords.isManualEntry,
      remarks: attendanceRecords.remarks,
      isLocked: attendanceRecords.isLocked,
      createdAt: attendanceRecords.createdAt,
      updatedAt: attendanceRecords.updatedAt,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(attendanceRecords.attendanceDate, targetDate))
    .orderBy(desc(attendanceRecords.updatedAt));

  return rows.map(mapJoinedRowToRecord);
}

/**
 * Fetch a single attendance record by ID.
 */
export async function findById(id: string): Promise<AttendanceRecord | null> {
  const rows = await getDb()
    .select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeCode: employees.employeeCode,
      attendanceCode: employees.attendanceCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      branchId: employees.branchId,
      branchName: branches.name,
      fiscalYearId: attendanceRecords.fiscalYearId,
      attendanceDate: attendanceRecords.attendanceDate,
      status: attendanceRecords.status,
      inTime: attendanceRecords.inTime,
      outTime: attendanceRecords.outTime,
      workHours: attendanceRecords.workHours,
      otHoursOfficeDay: attendanceRecords.otHoursOfficeDay,
      otHoursOffDay: attendanceRecords.otHoursOffDay,
      isLate: attendanceRecords.isLate,
      isManualEntry: attendanceRecords.isManualEntry,
      remarks: attendanceRecords.remarks,
      isLocked: attendanceRecords.isLocked,
      createdAt: attendanceRecords.createdAt,
      updatedAt: attendanceRecords.updatedAt,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(attendanceRecords.id, id));

  return rows.length ? mapJoinedRowToRecord(rows[0]) : null;
}

/**
 * Fetch all attendance records for a specific employee in a given B.S. month (using AD date prefix YYYY-MM).
 */
export async function findByEmployeeAndMonthPrefix(
  employeeId: string,
  datePrefix: string
): Promise<AttendanceRecord[]> {
  const rows = await getDb()
    .select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeCode: employees.employeeCode,
      attendanceCode: employees.attendanceCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      branchId: employees.branchId,
      branchName: branches.name,
      fiscalYearId: attendanceRecords.fiscalYearId,
      attendanceDate: attendanceRecords.attendanceDate,
      status: attendanceRecords.status,
      inTime: attendanceRecords.inTime,
      outTime: attendanceRecords.outTime,
      workHours: attendanceRecords.workHours,
      otHoursOfficeDay: attendanceRecords.otHoursOfficeDay,
      otHoursOffDay: attendanceRecords.otHoursOffDay,
      isLate: attendanceRecords.isLate,
      isManualEntry: attendanceRecords.isManualEntry,
      remarks: attendanceRecords.remarks,
      isLocked: attendanceRecords.isLocked,
      createdAt: attendanceRecords.createdAt,
      updatedAt: attendanceRecords.updatedAt,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(
      and(
        eq(attendanceRecords.employeeId, employeeId),
        sql`${attendanceRecords.attendanceDate}::text LIKE ${datePrefix + "%"}`
      )
    )
    .orderBy(desc(attendanceRecords.attendanceDate));

  return rows.map(mapJoinedRowToRecord);
}

/**
 * Create or update a single daily attendance punch record.
 */
export async function saveRecord(
  id: string | null,
  data: {
    employeeId: string;
    fiscalYearId?: string;
    attendanceDate: string;
    status: string;
    inTime: string | null;
    outTime: string | null;
    workHours: number;
    otHoursOfficeDay: number;
    otHoursOffDay: number;
    isLate: boolean;
    remarks: string | null;
  }
): Promise<AttendanceRecord> {
  const fyId = await resolveFiscalYearId(data.fiscalYearId);

  // Check if record is locked
  if (id) {
    const existing = await getDb().select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
    if (existing.length && existing[0].isLocked) {
      throw new Error("Cannot update attendance: This record is locked because payroll has already been generated for this period.");
    }
  } else {
    // Check if an entry already exists for this employee on this date
    const dup = await getDb().select().from(attendanceRecords).where(
      and(
        eq(attendanceRecords.employeeId, data.employeeId),
        eq(attendanceRecords.attendanceDate, data.attendanceDate)
      )
    );
    if (dup.length) {
      if (dup[0].isLocked) {
        throw new Error("Cannot update attendance: This record is locked for payroll.");
      }
      id = dup[0].id; // Switch to update existing punch
    }
  }

  if (id) {
    const existing = await findById(id);
    if (existing && existing.isLocked) {
      throw new Error("Cannot update attendance: This record is locked for pre-payroll / payroll processing.");
    }

    await getDb()
      .update(attendanceRecords)
      .set({
        status: data.status,
        inTime: data.inTime,
        outTime: data.outTime,
        workHours: data.workHours.toString(),
        otHoursOfficeDay: data.otHoursOfficeDay.toString(),
        otHoursOffDay: data.otHoursOffDay.toString(),
        isLate: data.isLate,
        isManualEntry: true,
        remarks: data.remarks,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, id));
    
    const updated = await findById(id);
    return updated!;
  } else {
    const inserted = await getDb()
      .insert(attendanceRecords)
      .values({
        employeeId: data.employeeId,
        fiscalYearId: fyId,
        attendanceDate: data.attendanceDate,
        status: data.status,
        inTime: data.inTime,
        outTime: data.outTime,
        workHours: data.workHours.toString(),
        otHoursOfficeDay: data.otHoursOfficeDay.toString(),
        otHoursOffDay: data.otHoursOffDay.toString(),
        isLate: data.isLate,
        isManualEntry: true,
        remarks: data.remarks,
        isLocked: false,
      })
      .returning();

    const created = await findById(inserted[0].id);
    return created!;
  }
}

/**
 * Helper: Calculate check-out time based on check-in time and work hours.
 */
function calculateOutTime(inTime: string, workHours: number): string {
  const inMins = parseTimeToMinutes(inTime);
  if (inMins === null) return "05:00 PM";
  
  const outMins = inMins + workHours * 60;
  const hours24 = Math.floor(outMins / 60) % 24;
  const minutes = Math.round(outMins % 60);
  const period = hours24 >= 12 ? "PM" : "AM";
  
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  
  const minutesStr = minutes.toString().padStart(2, "0");
  const hoursStr = hours12.toString().padStart(2, "0");
  
  return `${hoursStr}:${minutesStr} ${period}`;
}

/**
 * Bulk save daily attendance punches across multiple employees atomically.
 */
export async function saveBulkAttendance(
  items: AttendanceBulkItem[],
  date: string,
  fiscalYearId?: string
): Promise<AttendanceRecord[]> {
  const fyId = await resolveFiscalYearId(fiscalYearId);

  return await getDb().transaction(async (tx) => {
    for (const item of items) {
        // Check existing
        const dup = await tx.select().from(attendanceRecords).where(
          and(
            eq(attendanceRecords.employeeId, item.employeeId),
            eq(attendanceRecords.attendanceDate, date)
          )
        );

        if (dup.length && dup[0].isLocked) {
          continue;
        }

        const existing = dup.length ? dup[0] : null;
        const itemWorkHours = item.workHours ?? (existing ? Number(existing.workHours) : (item.status === "Present" ? 8 : item.status === "Half Day" ? 4 : 0));
        
        let inTime = item.inTime || (existing ? existing.inTime : null);
        let outTime = item.outTime || (existing ? existing.outTime : null);

        if (item.status === "Present" || item.status === "Half Day" || itemWorkHours > 0) {
          if (!inTime) {
            inTime = "09:00 AM";
          }
          if (!outTime) {
            outTime = calculateOutTime(inTime, itemWorkHours);
          }
        } else {
          if (itemWorkHours === 0) {
            inTime = item.inTime || null;
            outTime = item.outTime || null;
          }
        }

        const isLate = inTime ? evaluateLateArrival(inTime, 9, 0, 40) : false;

        if (existing) {
          await tx
            .update(attendanceRecords)
            .set({
              status: item.status,
              inTime,
              outTime,
              workHours: itemWorkHours.toString(),
              otHoursOfficeDay: (item.otHoursOfficeDay ?? Number(existing.otHoursOfficeDay)).toString(),
              otHoursOffDay: (item.otHoursOffDay ?? Number(existing.otHoursOffDay)).toString(),
              isLate,
              isManualEntry: true,
              remarks: item.remarks || existing.remarks,
              updatedAt: new Date(),
            })
            .where(eq(attendanceRecords.id, existing.id));
        } else {
          await tx.insert(attendanceRecords).values({
            employeeId: item.employeeId,
            fiscalYearId: fyId,
            attendanceDate: date,
            status: item.status,
            inTime,
            outTime,
            workHours: itemWorkHours.toString(),
            otHoursOfficeDay: (item.otHoursOfficeDay ?? 0).toString(),
            otHoursOffDay: (item.otHoursOffDay ?? 0).toString(),
            isLate,
            isManualEntry: true,
            remarks: item.remarks || "Bulk entry",
            isLocked: false,
          });
        }
    }
    return [];
  });
}

/**
 * Delete an attendance record.
 */
export async function remove(id: string): Promise<boolean> {
    const existing = await getDb().select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
    if (!existing.length) {
      throw new Error(`Attendance record not found: ${id}`);
    }
    if (existing[0].isLocked) {
      throw new Error("Cannot delete attendance: This record is locked for payroll.");
    }
    const res = await getDb().delete(attendanceRecords).where(eq(attendanceRecords.id, id)).returning({ id: attendanceRecords.id });
    return res.length > 0;
}

/**
 * Save or update the monthly pre-payroll calculation lock record.
 */
export async function saveCalculationLock(data: {
  employeeId: string;
  fiscalYearId?: string;
  bsMonth: number;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  payLeaveDays: number;
  nonPayLeaveDays: number;
  totalOtHoursOffice: number;
  totalOtHoursOff: number;
  otEarnedAmount: number;
  leaveDeductionAmount: number;
  isLocked: boolean;
  otWarnings: string | null;
}): Promise<LeaveOtCalculation> {
  const fyId = await resolveFiscalYearId(data.fiscalYearId);

  const existing = await getDb().select().from(leaveOtCalculations).where(
    and(
      eq(leaveOtCalculations.employeeId, data.employeeId),
      eq(leaveOtCalculations.bsMonth, data.bsMonth),
      eq(leaveOtCalculations.fiscalYearId, fyId)
    )
  );

  // Lock or unlock all daily attendance punch records for this employee in this fiscal year
  await getDb()
    .update(attendanceRecords)
    .set({ isLocked: data.isLocked })
    .where(
      and(
        eq(attendanceRecords.employeeId, data.employeeId),
        eq(attendanceRecords.fiscalYearId, fyId)
      )
    );

  if (existing.length) {
    const rows = await getDb()
      .update(leaveOtCalculations)
      .set({
        totalWorkingDays: data.totalWorkingDays.toString(),
        presentDays: data.presentDays.toString(),
        absentDays: data.absentDays.toString(),
        payLeaveDays: data.payLeaveDays.toString(),
        nonPayLeaveDays: data.nonPayLeaveDays.toString(),
        totalOtHoursOffice: data.totalOtHoursOffice.toString(),
        totalOtHoursOff: data.totalOtHoursOff.toString(),
        otEarnedAmount: data.otEarnedAmount.toString(),
        leaveDeductionAmount: data.leaveDeductionAmount.toString(),
        otWarnings: data.otWarnings,
        isLocked: data.isLocked,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leaveOtCalculations.id, existing[0].id))
      .returning();

    return {
      id: rows[0].id,
      employeeId: rows[0].employeeId,
      employeeName: "", // Joined by service if needed
      employeeCode: "",
      departmentName: "",
      fiscalYearId: rows[0].fiscalYearId,
      bsMonth: rows[0].bsMonth,
      totalWorkingDays: Number(rows[0].totalWorkingDays),
      presentDays: Number(rows[0].presentDays),
      absentDays: Number(rows[0].absentDays),
      payLeaveDays: Number(rows[0].payLeaveDays),
      nonPayLeaveDays: Number(rows[0].nonPayLeaveDays),
      totalOtHoursOffice: Number(rows[0].totalOtHoursOffice),
      totalOtHoursOff: Number(rows[0].totalOtHoursOff),
      otEarnedAmount: Number(rows[0].otEarnedAmount),
      leaveDeductionAmount: Number(rows[0].leaveDeductionAmount),
      otWarnings: rows[0].otWarnings,
      isLocked: rows[0].isLocked,
      lockedAt: rows[0].lockedAt.toISOString(),
      createdAt: rows[0].createdAt.toISOString(),
      updatedAt: rows[0].updatedAt.toISOString(),
    };
  } else {
    const rows = await getDb()
      .insert(leaveOtCalculations)
      .values({
        employeeId: data.employeeId,
        fiscalYearId: fyId,
        bsMonth: data.bsMonth,
        totalWorkingDays: data.totalWorkingDays.toString(),
        presentDays: data.presentDays.toString(),
        absentDays: data.absentDays.toString(),
        payLeaveDays: data.payLeaveDays.toString(),
        nonPayLeaveDays: data.nonPayLeaveDays.toString(),
        totalOtHoursOffice: data.totalOtHoursOffice.toString(),
        totalOtHoursOff: data.totalOtHoursOff.toString(),
        otEarnedAmount: data.otEarnedAmount.toString(),
        leaveDeductionAmount: data.leaveDeductionAmount.toString(),
        otWarnings: data.otWarnings,
        isLocked: data.isLocked,
        lockedAt: new Date(),
      })
      .returning();

    return {
      id: rows[0].id,
      employeeId: rows[0].employeeId,
      employeeName: "",
      employeeCode: "",
      departmentName: "",
      fiscalYearId: rows[0].fiscalYearId,
      bsMonth: rows[0].bsMonth,
      totalWorkingDays: Number(rows[0].totalWorkingDays),
      presentDays: Number(rows[0].presentDays),
      absentDays: Number(rows[0].absentDays),
      payLeaveDays: Number(rows[0].payLeaveDays),
      nonPayLeaveDays: Number(rows[0].nonPayLeaveDays),
      totalOtHoursOffice: Number(rows[0].totalOtHoursOffice),
      totalOtHoursOff: Number(rows[0].totalOtHoursOff),
      otEarnedAmount: Number(rows[0].otEarnedAmount),
      leaveDeductionAmount: Number(rows[0].leaveDeductionAmount),
      otWarnings: rows[0].otWarnings,
      isLocked: rows[0].isLocked,
      lockedAt: rows[0].lockedAt.toISOString(),
      createdAt: rows[0].createdAt.toISOString(),
      updatedAt: rows[0].updatedAt.toISOString(),
    };
  }
}

export async function bulkSaveRecords(
  attendanceDate: string,
  items: AttendanceBulkItem[],
  fiscalYearId?: string
): Promise<{ successCount: number; errorCount: number }> {
  await saveBulkAttendance(items, attendanceDate, fiscalYearId);
  return { successCount: items.length, errorCount: 0 };
}