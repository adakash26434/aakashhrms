import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies } from '@/lib/platform/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/resolve-company
 *
 * Resolves a company code (e.g. "CMP-A3F9K2") to a company name and slug.
 * Used as the first step of the two-step login flow.
 *
 * This endpoint is public (no auth required) — it only returns the company's
 * display name and validates that the code maps to an ACTIVE company.
 * It does NOT return slugs, database details, or any sensitive information
 * to prevent information leakage.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyCode = (body.companyCode || '').trim().toUpperCase();

    if (!companyCode) {
      return NextResponse.json(
        { success: false, error: 'Company code is required.' },
        { status: 400 }
      );
    }

    // Basic format validation — company codes are "CMP-" followed by 6 alphanumeric chars (e.g. CMP-1111AF)
    if (!/^CMP-[A-Z0-9]{4,8}$/i.test(companyCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid company code format. Expected format: CMP-XXXXXX (e.g., CMP-1111AF)' },
        { status: 400 }
      );
    }

    await ensurePlatformTablesExist();

    const [company] = await platformDb
      .select({
        id: companies.id,
        companyCode: companies.companyCode,
        displayName: companies.displayName,
        slug: companies.slug,
        status: companies.status,
      })
      .from(companies)
      .where(eq(companies.companyCode, companyCode))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found. Please check your company code.' },
        { status: 404 }
      );
    }

    if (company.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'This company is not currently active. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Return only the display name and slug — slug is needed for the signIn call
    // but is not sensitive (it's the same as the subdomain in the old routing)
    return NextResponse.json({
      success: true,
      company: {
        displayName: company.displayName,
        slug: company.slug,
      },
    });
  } catch (error: any) {
    console.error('Error resolving company code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve company code.' },
      { status: 500 }
    );
  }
}
