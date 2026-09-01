import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { platformPolicyPacks, platformAuditLogs, companies } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { desc, eq } from 'drizzle-orm';
import { DEFAULT_NEPAL_POLICY_PACK_V1, StatutoryPolicyPackPayload } from '@/lib/platform/policy-pack-data';

export async function GET(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();

    const [packs, allCompanies] = await Promise.all([
      platformDb.select().from(platformPolicyPacks).orderBy(desc(platformPolicyPacks.version)),
      platformDb.select().from(companies),
    ]);

    let activePack = packs.find((p) => p.isPublished) || packs[0];

    // If no pack in DB yet, fallback to default seed
    if (!activePack) {
      activePack = {
        id: 'seed-v1',
        version: 1,
        name: DEFAULT_NEPAL_POLICY_PACK_V1.name,
        payload: DEFAULT_NEPAL_POLICY_PACK_V1 as any,
        isPublished: true,
        publishedAt: new Date(),
        createdAt: new Date(),
      };
    }

    const activeTenantsCount = allCompanies.filter((c) => c.status === 'ACTIVE').length;

    return NextResponse.json({
      success: true,
      activePack,
      allPacks: packs,
      activeTenantsCount,
    });
  } catch (error: any) {
    console.error('Error fetching policy packs:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch statutory policy packs.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    const { version, name, payload, isPublished } = body || {};

    if (!version || !name || !payload) {
      return NextResponse.json(
        { success: false, error: 'Version, name, and policy payload are required.' },
        { status: 400 }
      );
    }

    // Upsert the policy pack version
    const existing = await platformDb
      .select()
      .from(platformPolicyPacks)
      .where(eq(platformPolicyPacks.version, Number(version)))
      .limit(1);

    let savedPack;
    if (existing.length > 0) {
      const [updated] = await platformDb
        .update(platformPolicyPacks)
        .set({
          name,
          payload,
          isPublished: isPublished ?? true,
          publishedAt: isPublished ? new Date() : existing[0].publishedAt,
        })
        .where(eq(platformPolicyPacks.id, existing[0].id))
        .returning();
      savedPack = updated;
    } else {
      const [inserted] = await platformDb
        .insert(platformPolicyPacks)
        .values({
          version: Number(version),
          name,
          payload,
          isPublished: isPublished ?? true,
          publishedAt: new Date(),
        })
        .returning();
      savedPack = inserted;
    }

    // Audit log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'POLICY_PACK_UPDATE',
      meta: {
        version,
        name,
        isPublished: isPublished ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      pack: savedPack,
      message: `Statutory Policy Pack v${version} saved successfully.`,
    });
  } catch (error: any) {
    console.error('Error updating statutory policy pack:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update statutory policy pack.' },
      { status: 500 }
    );
  }
}
