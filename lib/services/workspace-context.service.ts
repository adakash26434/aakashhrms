import { auth } from '@/lib/auth';
import { getUserAllowedModulesArray } from '@/lib/auth/get-user-permissions';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import { getDbAsync } from '@/lib/db';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies } from '@/lib/platform/schema';
import { users, roles, userRoles, employees, employeePersonal, fiscalYears, leaveApplications, branches } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getFiscalYear } from '@/lib/utils/bs-calendar';

export interface WorkspaceContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    initials: string;
  };
  company: {
    name: string;
    legalName?: string;
    displayName?: string;
    code: string;
    slug: string;
    branch: string;
    panVatNumber?: string;
    contactPhone?: string;
    contactEmail?: string;
    headOfficeAddress?: string;
  };
  activeFiscalYear: {
    id: string | null;
    name: string;
  };
  pendingApprovalsCount: number;
  allowedModules: string[];
  isImpersonating: boolean;
  impersonationDetails?: {
    actorName: string;
    companyName: string;
    companyId: string;
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'US';
}

function getDefaultFiscalYearName(): string {
  try {
    const fy = getFiscalYear(new Date());
    return `FY ${fy.fyString}`;
  } catch {
    return 'FY 2081/82';
  }
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const [impersonation, session] = await Promise.all([
    getImpersonationSession(),
    auth(),
  ]);

  // 1. Handle Impersonation ("View As Company") mode
  if (impersonation) {
    let companyName = impersonation.companyName;
    let companyLegalName = impersonation.companyName;
    let companyDisplayName = impersonation.companyName;
    let companyCode = 'CMP-ACTIVE';
    let companyPan: string | undefined;
    let companyPhone: string | undefined;
    let companyEmail: string | undefined;
    let companyAddress: string | undefined;
    const slug = impersonation.companySlug;

    const companyPromise = (async () => {
      try {
        await ensurePlatformTablesExist();
        const [comp] = await platformDb
          .select()
          .from(companies)
          .where(eq(companies.slug, impersonation.companySlug))
          .limit(1);

        if (comp) {
          companyName = comp.displayName || comp.legalName;
          companyLegalName = comp.legalName;
          companyDisplayName = comp.displayName;
          companyCode = comp.companyCode;
          companyPan = comp.panVatNumber || undefined;
          companyPhone = comp.contactPhone || undefined;
          companyEmail = comp.contactEmail || undefined;
          companyAddress = comp.headOfficeAddress || undefined;
        }
      } catch {
        // Fallback to session details
      }
    })();

    // Connect to tenant DB for FY, Branches & Pending approvals in parallel
    let activeFyName = getDefaultFiscalYearName();
    let activeFyId: string | null = null;
    let branchName = 'Head Office';
    let pendingCount = 0;

    const tenantPromise = (async () => {
      try {
        const tenantDb = await getDbAsync(slug);
        if (tenantDb) {
          const [fyResult, branchResult, pendingResult] = await Promise.all([
            tenantDb
              .select({ id: fiscalYears.id, label: fiscalYears.label })
              .from(fiscalYears)
              .where(eq(fiscalYears.status, 'Active'))
              .limit(1),
            tenantDb
              .select({ name: branches.name })
              .from(branches)
              .limit(1),
            tenantDb
              .select({ count: sql<number>`count(*)::int` })
              .from(leaveApplications)
              .where(eq(leaveApplications.status, 'Pending')),
          ]);

          if (fyResult[0]) {
            activeFyName = fyResult[0].label;
            activeFyId = fyResult[0].id;
          }

          if (branchResult[0]) {
            branchName = branchResult[0].name;
          }

          if (pendingResult[0]) {
            pendingCount = Number(pendingResult[0].count) || 0;
          }
        }
      } catch {
        // Fallback
      }
    })();

    await Promise.all([companyPromise, tenantPromise]);

    return {
      user: {
        id: impersonation.actorId,
        name: impersonation.actorName,
        email: impersonation.actorEmail || 'superadmin@aakashhrms.com',
        role: 'Super Admin (Viewing)',
        initials: getInitials(impersonation.actorName || 'SA'),
      },
      company: {
        name: companyName,
        legalName: companyLegalName || companyName,
        displayName: companyDisplayName || companyName,
        code: companyCode,
        slug,
        branch: branchName,
        panVatNumber: companyPan,
        contactPhone: companyPhone,
        contactEmail: companyEmail,
        headOfficeAddress: companyAddress,
      },
      activeFiscalYear: {
        id: activeFyId,
        name: activeFyName,
      },
      pendingApprovalsCount: pendingCount,
      allowedModules: [], // Impersonation has full access, sidebar shows all
      isImpersonating: true,
      impersonationDetails: impersonation,
    };
  }

  // 2. Handle Normal Authenticated User mode
  const tenantSlug = session?.user?.tenantSlug;
  const userEmail = session?.user?.email || 'admin@aakashhrms.com';
  const userId = session?.user?.id || '';

  let companyName = 'Company Workspace';
  let companyLegalName = 'Company Workspace';
  let companyDisplayName = 'Company Workspace';
  let companyCode = 'CMP-ACTIVE';
  let companyPan: string | undefined;
  let companyPhone: string | undefined;
  let companyEmail: string | undefined;
  let companyAddress: string | undefined;
  const slug = tenantSlug || 'default';
  let branchName = 'Main Branch';
  let userName = '';
  let userRoleName = 'Office Administrator';
  let activeFyName = getDefaultFiscalYearName();
  let activeFyId: string | null = null;
  let pendingCount = 0;

  // A. Resolve Company info from Platform DB in parallel with Tenant DB
  const companyPromise = (async () => {
    if (tenantSlug) {
      try {
        await ensurePlatformTablesExist();
        const [comp] = await platformDb
          .select()
          .from(companies)
          .where(eq(companies.slug, tenantSlug))
          .limit(1);

        if (comp) {
          companyName = comp.displayName || comp.legalName;
          companyLegalName = comp.legalName;
          companyDisplayName = comp.displayName;
          companyCode = comp.companyCode;
          companyPan = comp.panVatNumber || undefined;
          companyPhone = comp.contactPhone || undefined;
          companyEmail = comp.contactEmail || undefined;
          companyAddress = comp.headOfficeAddress || undefined;
        }
      } catch (err) {
        console.error('Error resolving company info:', err);
      }
    }
  })();

  // B. Resolve Tenant Database Details in parallel
  const tenantPromise = (async () => {
    try {
      const tenantDb = await getDbAsync(tenantSlug || undefined);

      if (tenantDb) {
        // Run User query, FY query, Branch query, and Pending leaves count concurrently
        const userDetailsPromise = (async () => {
          const [userRecord] = await tenantDb
            .select()
            .from(users)
            .where(eq(users.email, userEmail))
            .limit(1);

          if (userRecord) {
            const [personalResult, roleResult] = await Promise.all([
              tenantDb
                .select({ employeeId: employeePersonal.employeeId })
                .from(employeePersonal)
                .where(eq(employeePersonal.personalEmail, userEmail))
                .limit(1)
                .catch(() => []),
              tenantDb
                .select({ roleName: roles.name })
                .from(userRoles)
                .innerJoin(roles, eq(userRoles.roleId, roles.id))
                .where(eq(userRoles.userId, userRecord.id))
                .limit(1)
                .catch(() => []),
            ]);

            if (roleResult[0]?.roleName) {
              userRoleName = roleResult[0].roleName;
            }

            if (personalResult[0]?.employeeId) {
              const [emp] = await tenantDb
                .select({ fullName: employees.fullName })
                .from(employees)
                .where(eq(employees.id, personalResult[0].employeeId))
                .limit(1)
                .catch(() => []);

              if (emp?.fullName) {
                userName = emp.fullName;
              }
            }
          }

          if (!userName) {
            const prefix = userEmail.split('@')[0];
            userName = prefix
              .split(/[\._]/)
              .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
              .join(' ');
          }
        })();

        const fyPromise = tenantDb
          .select({ id: fiscalYears.id, label: fiscalYears.label })
          .from(fiscalYears)
          .where(eq(fiscalYears.status, 'Active'))
          .limit(1);

        const branchPromise = tenantDb
          .select({ name: branches.name })
          .from(branches)
          .limit(1);

        const pendingLeavesPromise = tenantDb
          .select({ count: sql<number>`count(*)::int` })
          .from(leaveApplications)
          .where(eq(leaveApplications.status, 'Pending'));

        const [, fyResult, branchResult, pendingResult] = await Promise.all([
          userDetailsPromise,
          fyPromise.catch(() => []),
          branchPromise.catch(() => []),
          pendingLeavesPromise.catch(() => []),
        ]);

        if (fyResult[0]) {
          activeFyName = fyResult[0].label;
          activeFyId = fyResult[0].id;
        }

        if (branchResult[0]) {
          branchName = branchResult[0].name;
        }

        if (pendingResult[0]) {
          pendingCount = Number(pendingResult[0].count) || 0;
        }
      }
    } catch (err) {
      console.error('Error resolving tenant workspace context:', err);
    }
  })();

  await Promise.all([companyPromise, tenantPromise]);

  if (!userName) {
    userName = 'Administrator';
  }

  // Resolve the user's allowed modules for sidebar filtering
  let allowedModules: string[] = [];
  try {
    allowedModules = await getUserAllowedModulesArray();
  } catch (err) {
    console.error('Error resolving user allowed modules:', err);
  }

  return {
    user: {
      id: userId,
      name: userName,
      email: userEmail,
      role: userRoleName,
      initials: getInitials(userName),
    },
    company: {
      name: companyName,
      legalName: companyLegalName || companyName,
      displayName: companyDisplayName || companyName,
      code: companyCode,
      slug,
      branch: branchName,
      panVatNumber: companyPan,
      contactPhone: companyPhone,
      contactEmail: companyEmail,
      headOfficeAddress: companyAddress,
    },
    activeFiscalYear: {
      id: activeFyId,
      name: activeFyName,
    },
    pendingApprovalsCount: pendingCount,
    allowedModules,
    isImpersonating: false,
  };
}
