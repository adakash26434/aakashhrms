import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases, platformAuditLogs } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { decryptPassword } from '@/lib/platform/crypto';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const [tenantDbRecord] = await platformDb
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.companyId, id))
      .limit(1);

    if (!tenantDbRecord) {
      return NextResponse.json(
        { success: false, error: 'Database record not found for this company.' },
        { status: 404 }
      );
    }

    // Decrypt database password
    let dbPasswordPlain = '';
    try {
      dbPasswordPlain = decryptPassword(tenantDbRecord.dbPasswordEncrypted);
    } catch {
      dbPasswordPlain = 'admin'; // fallback if unencrypted in development
    }

    const dbHost = tenantDbRecord.dbHost || '127.0.0.1';
    const dbPort = tenantDbRecord.dbPort || 5432;
    const dbUser = tenantDbRecord.dbUser || 'postgres';
    const dbName = tenantDbRecord.dbName;

    const connectionUri = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/${dbName}`;
    const psqlCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;
    const drizzleStudioCommand = `$env:DATABASE_URL="${connectionUri}"; npm run db:studio`;

    // Audit log credential access
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'CREDENTIALS_REVEAL',
      companyId: id,
      meta: { dbName, dbUser, host: dbHost },
    });

    return NextResponse.json({
      success: true,
      credentials: {
        dbName,
        dbHost,
        dbPort,
        dbUser,
        dbPasswordPlain,
        connectionUri,
        psqlCommand,
        drizzleStudioCommand,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tenant credentials:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve credentials.' },
      { status: 500 }
    );
  }
}
