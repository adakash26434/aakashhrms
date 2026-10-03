import { getDb } from '@/lib/db';
import { shreniLevels } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import {
  getStandardShreniLevels,
  getPresetLevels,
  ShreniLevelItem,
} from '@/lib/constants/industry-types';

type ShreniRow = typeof shreniLevels.$inferSelect;

function mapRowToItem(row: ShreniRow): ShreniLevelItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    levelNumber: row.levelNumber,
    labelNepali: row.labelNepali,
    description: row.description || undefined,
    minSalary: row.minSalary ? Number(row.minSalary) : 0,
    maxSalary: row.maxSalary ? Number(row.maxSalary) : 0,
    isActive: row.isActive,
  };
}

/**
 * Retrieves all active/configured Shreni levels for the current tenant.
 * Auto-seeds with standard universal presets if table is empty.
 */
export async function findAllShreniLevels(): Promise<ShreniLevelItem[]> {
  const db = (await getDb());
  let rows: ShreniRow[] = [];

  try {
    rows = await db
      .select()
      .from(shreniLevels)
      .orderBy(asc(shreniLevels.rankOrder), asc(shreniLevels.levelNumber));
  } catch {
    // If table not yet present or query fails during cold boot, fallback to standard presets
    return getStandardShreniLevels();
  }

  if (rows.length === 0) {
    // Auto-seed canonical S1–S15 levels
    try {
      const defaults = getStandardShreniLevels();
      for (let i = 0; i < defaults.length; i++) {
        const item = defaults[i];
        await db
          .insert(shreniLevels)
          .values({
            code: item.code,
            name: item.name,
            levelNumber: item.levelNumber,
            labelNepali: item.labelNepali,
            description: item.description,
            rankOrder: i + 1,
            isActive: true,
          })
          .onConflictDoNothing();
      }

      rows = await db
        .select()
        .from(shreniLevels)
        .orderBy(asc(shreniLevels.rankOrder), asc(shreniLevels.levelNumber));
    } catch {
      return getStandardShreniLevels();
    }
  }

  return rows.map(mapRowToItem);
}

/**
 * Find single level by ID or code
 */
export async function findShreniLevelByCode(code: string): Promise<ShreniLevelItem | undefined> {
  const db = (await getDb());
  const rows = await db
    .select()
    .from(shreniLevels)
    .where(eq(shreniLevels.code, code.trim().toUpperCase()))
    .limit(1);

  if (!rows.length) return undefined;
  return mapRowToItem(rows[0]);
}

/**
 * Loads a preset template (e.g. 'bfi', 'sansthan', 'corporate', 'ngo', 'universal')
 * Replaces existing empty or resets levels with confirmation.
 */
export async function seedShreniPreset(presetKey: string): Promise<ShreniLevelItem[]> {
  const db = (await getDb());
  const presetLevels = getPresetLevels(presetKey);

  for (let i = 0; i < presetLevels.length; i++) {
    const p = presetLevels[i];
    await db
      .insert(shreniLevels)
      .values({
        code: p.code,
        name: p.name,
        levelNumber: p.levelNumber,
        labelNepali: p.labelNepali,
        description: p.description,
        rankOrder: i + 1,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: shreniLevels.code,
        set: {
          name: p.name,
          levelNumber: p.levelNumber,
          labelNepali: p.labelNepali,
          description: p.description,
          rankOrder: i + 1,
          updatedAt: new Date(),
        },
      });
  }

  return findAllShreniLevels();
}
