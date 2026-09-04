import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, platformAuditLogs } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { getTenantDb } from '@/lib/db/tenant-pool-manager';
import { users, userRoles, roles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id: companyId } = await params;

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const newEmail = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const rawPassword = body.password ? String(body.password).trim() : undefined;
    const tempPasswordPlain =
      rawPassword ||
      process.env.DEFAULT_TENANT_ADMIN_PASSWORD ||
      `${randomBytes(8).toString('base64url')}@1A`;

    const tenantDb = await getTenantDb(company.slug);
    if (!tenantDb) {
      return NextResponse.json(
        { success: false, error: 'Unable to connect to tenant database.' },
        { status: 500 }
      );
    }

    // Find office admin user in tenant database
    const targetEmail = company.contactEmail;
    const existingUsers = await tenantDb
      .select()
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1);

    let targetUserId: string;

    const passwordHash = await bcrypt.hash(tempPasswordPlain, 12);

    if (existingUsers.length > 0) {
      targetUserId = existingUsers[0].id;
      await tenantDb
        .update(users)
        .set({
          email: newEmail || existingUsers[0].email,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId));
    } else {
      // If not found by email, find by office_admin role
      const adminRoleUsers = await tenantDb
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.slug, 'office_admin'))
        .limit(1);

      if (adminRoleUsers.length > 0) {
        targetUserId = adminRoleUsers[0].userId;
        await tenantDb
          .update(users)
          .set({
            email: newEmail || targetEmail,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId));
      } else {
        // Create admin user if absent
        const [newUser] = await tenantDb
          .insert(users)
          .values({
            name: `${company.legalName} Admin`,
            email: newEmail || targetEmail,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
          })
          .returning();
        targetUserId = newUser.id;
      }
    }

    // If email was updated, synchronize company.contactEmail in platform DB
    const finalEmail = newEmail || targetEmail;
    if (newEmail && newEmail !== company.contactEmail) {
      await platformDb
        .update(companies)
        .set({ contactEmail: newEmail })
        .where(eq(companies.id, companyId));
    }

    // Audit log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'TENANT_ADMIN_PASSWORD_RESET',
      companyId: companyId,
      meta: {
        adminEmail: finalEmail,
        resetBy: actor.email,
      },
    });

    return NextResponse.json({
      success: true,
      email: finalEmail,
      password: tempPasswordPlain,
    });
  } catch (error: any) {
    console.error('Error resetting tenant admin password:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset admin credentials.' },
      { status: 500 }
    );
  }
}
