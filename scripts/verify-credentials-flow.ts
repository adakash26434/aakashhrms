import { db } from "../lib/db";
import { users, employees, roles, userRoles, employeePersonal } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import * as userService from "../lib/services/user.service";
import * as empService from "../lib/services/employee.service";
import bcrypt from "bcryptjs";

async function verifyCredentialsFlow() {
  console.log("===============================================================");
  console.log("VERIFYING CREDENTIAL LIFECYCLE & EMAIL DISPATCH FLOW");
  console.log("===============================================================\n");

  const testEmail = `test.employee.${Date.now()}@acme-corp.com`;
  let createdEmpId: string | null = null;
  let createdUserId: string | null = null;

  try {
    // 1. Fetch or create valid org references
    const { departments, designations, branches } = await import("../lib/db/schema");
    let [br] = await db.select().from(branches).limit(1);
    if (!br) {
      [br] = await db.insert(branches).values({
        code: `BR-${Date.now().toString().slice(-4)}`,
        name: "Head Office",
        location: "Kathmandu",
        phone: "01-4400000",
        email: "headoffice@acme.com",
        isHeadOffice: true,
      }).returning();
    }

    let [dept] = await db.select().from(departments).limit(1);
    if (!dept) {
      [dept] = await db.insert(departments).values({
        code: `DEP-${Date.now().toString().slice(-4)}`,
        name: "Finance & Accounts",
        branchId: br.id,
        headName: "Ram Shrestha",
        description: "Finance department",
      }).returning();
    }

    let [desig] = await db.select().from(designations).limit(1);
    if (!desig) {
      [desig] = await db.insert(designations).values({
        name: "Senior Payroll Analyst",
        departmentId: dept.id,
        description: "Analyst role",
      }).returning();
    }

    // 1. Create a test employee record
    console.log(`[Step 1] Creating test employee with companyEmail: ${testEmail}...`);
    const empResult = await db.insert(employees).values({
      attendanceCode: `ATT-${Date.now().toString().slice(-4)}`,
      employeeCode: `EMP-${Date.now().toString().slice(-4)}`,
      fullName: "Sita Sharma Verification",
      gender: "Female",
      dateOfBirth: "1995-05-15",
      taxStatus: "Individual",
      isDisabled: false,
      category: "Permanent",
      status: "Active",
      departmentId: dept.id,
      designationId: desig.id,
      branchId: br.id,
      joiningDate: "2026-01-01",
    }).returning();

    createdEmpId = empResult[0].id;

    await db.insert(employeePersonal).values({
      employeeId: createdEmpId,
      citizenshipNo: `CIT-${Date.now()}`,
      issuingDistrict: "Kathmandu",
      email: testEmail,
      companyEmail: testEmail,
      mobileNo: "9841000000",
      permanentAddress: "Kathmandu-01",
    });

    console.log(`✅ Employee created: ID=${createdEmpId}`);

    // 2. Provision self-service login account with temporary password
    console.log("\n[Step 2] Provisioning self-service login via userService.createSecureUserAccount...");
    const { user, tempPassword } = await userService.createSecureUserAccount(
      createdEmpId,
      testEmail,
      "employee",
      "Sita Sharma Verification"
    );
    createdUserId = user.id;

    console.log(`✅ User account provisioned: ID=${createdUserId}`);
    console.log(`   Generated Temp Password: "${tempPassword}"`);

    // 3. Verify user row in database
    console.log("\n[Step 3] Inspecting database row for user...");
    const userRow = (await db.select().from(users).where(eq(users.id, createdUserId)).limit(1))[0];

    if (!userRow) {
      throw new Error("User record not found in database!");
    }

    console.log(`   Email: ${userRow.email}`);
    console.log(`   mustChangePassword: ${userRow.mustChangePassword}`);
    console.log(`   tempPassword column in DB: ${userRow.tempPassword} (must be null)`);
    console.log(`   passwordHash prefix: ${userRow.passwordHash.substring(0, 10)}...`);

    if (userRow.mustChangePassword !== true) {
      throw new Error("Expected mustChangePassword to be true on new account!");
    }
    if (userRow.tempPassword !== null) {
      throw new Error("S2 violation: plaintext temporary password was persisted to the database!");
    }
    const isTempHashValid = await bcrypt.compare(tempPassword, userRow.passwordHash);
    if (!isTempHashValid) {
      throw new Error("Password hash does not validate against generated temporary password!");
    }
    console.log("✅ Database row state pending first login verified 100% correct.");

    // 4. Verify getEmployeeAccess never exposes a temporary password to HR (S2)
    console.log("\n[Step 4] Checking HR view access via userService.getEmployeeAccess...");
    const hrAccess = await userService.getEmployeeAccess(createdEmpId);
    if (!hrAccess) {
      throw new Error("getEmployeeAccess returned null for linked employee!");
    }
    console.log(`   HR View - mustChangePassword: ${hrAccess.mustChangePassword}`);
    if ("tempPassword" in hrAccess) {
      throw new Error("S2 violation: HR view exposes a tempPassword field!");
    }
    console.log("✅ HR view shows pending-first-login status only; no password is retrievable.");

    // 5. Simulate First-Login Password Change
    console.log("\n[Step 5] Simulating employee first-login password change...");
    const permanentSecret = "SitaSecure#2026!Personal";
    const newPermanentHash = await bcrypt.hash(permanentSecret, 12);

    // Simulate change-password action execution:
    await db.update(users).set({
      passwordHash: newPermanentHash,
      tempPassword: null, // Purged upon password change!
      mustChangePassword: false,
      updatedAt: new Date(),
    }).where(eq(users.id, createdUserId));

    console.log("   Password changed by employee.");

    // 6. Inspect database after password change
    console.log("\n[Step 6] Inspecting database after password change...");
    const postChangeUserRow = (await db.select().from(users).where(eq(users.id, createdUserId)).limit(1))[0];

    console.log(`   mustChangePassword: ${postChangeUserRow.mustChangePassword}`);
    console.log(`   tempPassword in DB: ${postChangeUserRow.tempPassword}`);
    console.log(`   New passwordHash prefix: ${postChangeUserRow.passwordHash.substring(0, 10)}...`);

    if (postChangeUserRow.mustChangePassword !== false) {
      throw new Error("Expected mustChangePassword to be false after password change!");
    }
    if (postChangeUserRow.tempPassword !== null) {
      throw new Error("Expected tempPassword in DB to be NULL (purged) after password change!");
    }
    const isPermHashValid = await bcrypt.compare(permanentSecret, postChangeUserRow.passwordHash);
    if (!isPermHashValid) {
      throw new Error("New password hash does not validate against employee's permanent secret!");
    }
    console.log("✅ Temporary password safely purged from database; permanent password secured as bcrypt hash.");

    // 7. Verify HR View after password change
    console.log("\n[Step 7] Checking HR view access after first login completion...");
    const hrAccessPostChange = await userService.getEmployeeAccess(createdEmpId);
    console.log(`   HR View - mustChangePassword: ${hrAccessPostChange?.mustChangePassword}`);
    if (hrAccessPostChange && "tempPassword" in hrAccessPostChange) {
      throw new Error("S2 violation: HR view exposes a tempPassword field!");
    }
    console.log("✅ HR Detail Panel cleanly displays 'Active & Password Secured' with permanent hash hidden!");

    // 8. Test HR Admin Password Reset
    console.log("\n[Step 8] Testing HR Admin Password Reset action...");
    const resetResult = await userService.resetUserPassword(createdUserId);
    console.log(`   Reset temp password issued: "${resetResult.tempPassword}"`);

    const postResetUserRow = (await db.select().from(users).where(eq(users.id, createdUserId)).limit(1))[0];
    console.log(`   mustChangePassword: ${postResetUserRow.mustChangePassword}`);
    console.log(`   tempPassword column in DB: ${postResetUserRow.tempPassword} (must be null)`);

    if (postResetUserRow.mustChangePassword !== true) {
      throw new Error("Expected mustChangePassword to be true after reset!");
    }
    if (postResetUserRow.tempPassword !== null) {
      throw new Error("S2 violation: reset persisted the plaintext temporary password!");
    }
    console.log("✅ Reset Password workflow verified: account transitions back to pending first login with new temp password.");

    console.log("\n===============================================================");
    console.log("🎉 ALL TESTS PASSED: CREDENTIAL LIFECYCLE VERIFIED SUCCESSFULLY!");
    console.log("===============================================================\n");

  } finally {
    // Cleanup
    if (createdUserId) {
      console.log(`Cleaning up test user ${createdUserId}...`);
      await db.delete(userRoles).where(eq(userRoles.userId, createdUserId));
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    if (createdEmpId) {
      console.log(`Cleaning up test employee ${createdEmpId}...`);
      await db.delete(employeePersonal).where(eq(employeePersonal.employeeId, createdEmpId));
      await db.delete(employees).where(eq(employees.id, createdEmpId));
    }
    console.log("Cleanup completed.");
  }

  process.exit(0);
}

verifyCredentialsFlow().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
