/**
 * One-off script to reseed the platform policy pack (v1.0) with the
 * latest DEFAULT_NEPAL_POLICY_PACK_V1 data (updated tax slab rates).
 *
 * Usage:  npx tsx scripts/reseed-policy-pack.ts
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function reseed() {
  // Use PLATFORM_DATABASE_URL first, fall back to DATABASE_URL
  let dbUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('Neither PLATFORM_DATABASE_URL nor DATABASE_URL is set.');

  if (dbUrl.includes('@localhost:')) {
    dbUrl = dbUrl.replace('@localhost:', '@127.0.0.1:');
  }

  console.log('🔄 Re-seeding platform policy pack v1.0 with updated tax slab rates...\n');

  const sql = postgres(dbUrl, { max: 1 });

  try {
    // Import the latest pack data
    const { DEFAULT_NEPAL_POLICY_PACK_V1 } = await import('../lib/platform/policy-pack-data');

    // Pretty-print what we're about to seed
    const slabs = DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline ?? [];
    console.log(`  📋 Tax Slabs Baseline (${slabs.length} slabs):`);
    for (const slab of slabs) {
      const to = slab.amountTo ?? 'Above';
      console.log(`     ${slab.category}: ${slab.amountFrom} → ${to}  @${slab.ratePercent}%  fixed=${slab.fixedDeduction}`);
    }
    console.log('');

    // Update existing record (version=1) with the new payload
    const result = await sql`
      UPDATE platform_policy_packs
      SET 
        name = ${DEFAULT_NEPAL_POLICY_PACK_V1.name},
        payload = ${JSON.stringify(DEFAULT_NEPAL_POLICY_PACK_V1)}::jsonb,
        published_at = now()
      WHERE version = 1
      RETURNING id, version, name
    `;

    if (result.length > 0) {
      console.log(`  ✅ Updated policy pack: id=${result[0].id}, version=${result[0].version}`);
      console.log(`     Name: ${result[0].name}`);
    } else {
      // No existing record — insert it fresh
      console.log('  ⚠️  No existing v1.0 pack found. Inserting fresh...');
      const insertResult = await sql`
        INSERT INTO platform_policy_packs (version, name, payload, is_published, published_at)
        VALUES (
          ${DEFAULT_NEPAL_POLICY_PACK_V1.version},
          ${DEFAULT_NEPAL_POLICY_PACK_V1.name},
          ${JSON.stringify(DEFAULT_NEPAL_POLICY_PACK_V1)}::jsonb,
          true,
          now()
        )
        RETURNING id, version, name
      `;
      console.log(`  ✅ Inserted policy pack: id=${insertResult[0].id}, version=${insertResult[0].version}`);
    }

    console.log('\n✅ Platform policy pack re-seeded successfully!');
  } finally {
    await sql.end();
  }
}

reseed().catch((err) => {
  console.error('❌ Reseed failed:', err);
  process.exit(1);
});
