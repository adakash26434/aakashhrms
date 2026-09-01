import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, platformAuditLogs } from '@/lib/platform/schema';
import { generateCompanyCode, slugifyCompanyName } from '@/lib/platform/company-code';
import { validatePhoneNumber } from '@/lib/utils/phone';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { desc, eq } from 'drizzle-orm';

const RESERVED_SLUGS = [
  'platform',
  'admin',
  'api',
  'www',
  'mail',
  'login',
  'app',
  'localhost',
  'system',
  'root',
  'superadmin',
];

export async function GET(request: Request) {
  // Require authenticated Super Admin session
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();
    const list = await platformDb
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt));

    return NextResponse.json({ success: true, companies: list });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch companies list.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Require authenticated Super Admin session
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

    const { legalName, displayName, slug, contactEmail, contactPhone, registeredAt, notes } = body || {};

    const cleanLegalName = (legalName || '').trim();
    const cleanContactEmail = (contactEmail || '').trim().toLowerCase();

    if (!cleanLegalName) {
      return NextResponse.json(
        { success: false, error: 'Legal Company Name is required.' },
        { status: 400 }
      );
    }

    if (!cleanContactEmail || !cleanContactEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid Contact Email is required.' },
        { status: 400 }
      );
    }

    const finalDisplayName = (displayName || cleanLegalName).trim();
    const rawSlug = (slug || slugifyCompanyName(cleanLegalName)).toLowerCase().trim();
    const finalSlug = rawSlug.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

    if (!finalSlug || finalSlug.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Company database slug must be at least 2 alphanumeric characters.' },
        { status: 400 }
      );
    }

    if (RESERVED_SLUGS.includes(finalSlug)) {
      return NextResponse.json(
        { success: false, error: `Company slug "${finalSlug}" is a reserved system keyword. Please choose another slug.` },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingSlug = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.slug, finalSlug))
      .limit(1);

    if (existingSlug.length > 0) {
      return NextResponse.json(
        { success: false, error: `Company slug "${finalSlug}" is already taken.` },
        { status: 400 }
      );
    }

    // Validate contact phone if provided (supports all international codes with Nepal fallback)
    let validatedPhone: string | null = null;
    if (contactPhone && String(contactPhone).trim()) {
      const phoneValidation = validatePhoneNumber(String(contactPhone));
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { success: false, error: phoneValidation.error || 'Invalid contact phone number format.' },
          { status: 400 }
        );
      }
      validatedPhone = phoneValidation.formatted || String(contactPhone).trim();
    }

    // Auto-generate public Company Code (CMP-1111AF) with collision check
    let companyCode = generateCompanyCode();
    let collisionCheck = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.companyCode, companyCode))
      .limit(1);

    while (collisionCheck.length > 0) {
      companyCode = generateCompanyCode();
      collisionCheck = await platformDb
        .select()
        .from(companies)
        .where(eq(companies.companyCode, companyCode))
        .limit(1);
    }

    const [newCompany] = await platformDb
      .insert(companies)
      .values({
        companyCode,
        legalName: cleanLegalName,
        displayName: finalDisplayName,
        slug: finalSlug,
        status: 'PENDING',
        contactEmail: cleanContactEmail,
        contactPhone: validatedPhone,
        registeredAt: registeredAt ? String(registeredAt).split('T')[0] : new Date().toISOString().split('T')[0],
        notes: notes ? String(notes).trim() : null,
        policyPackVersion: 1,
      })
      .returning();

    // Audit log — now includes verified actor identity
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'COMPANY_REGISTER',
      companyId: newCompany.id,
      meta: { companyCode, slug: finalSlug, legalName: cleanLegalName, contactEmail: cleanContactEmail },
    });

    return NextResponse.json({ success: true, company: newCompany });
  } catch (error: any) {
    console.error('Error registering company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to register company on platform.' },
      { status: 500 }
    );
  }
}
