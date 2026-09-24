import { getDb } from '@/lib/db';
import { shreniLevels, employees } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import {
  getStandardShreniLevels,
  getPresetLevels,
  ShreniLevelItem,
} from '@/lib/constants/industry-types';
import type { ShreniLevelFormData } from '@/lib/types/shreni';

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
  };
}

/**
 * Retrieves all active/configured Shreni levels for the current tenant.
 * Auto-seeds with standard universal presets if table is empty.
 */
export async function findAllShreniLevels(): Promise<ShreniLevelItem[]> {
  const db = getDb();
  let rows: ShreniRow[] = [];

  try {
    rows = await db
      .select()
      .from(shreniLevels)
      .orderBy(asc(shreniLevels.rankOrder), asc(shreniLevels.levelNumber));
  } catch (err: unknown) {
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
  const db = getDb();
  const rows = await db
    .select()
    .from(shreniLevels)
    .where(eq(shreniLevels.code, code.trim().toUpperCase()))
    .limit(1);

  if (!rows.length) return undefined;
  return mapRowToItem(rows[0]);
}

/**
 * Creates a new custom Shreni level
 */
export async function createShreniLevel(data: ShreniLevelFormData): Promise<ShreniLevelItem> {
  const db = getDb();
  const code = data.code.trim().toUpperCase();

  const [row] = await db
    .insert(shreniLevels)
    .values({
      code,
      name: data.name.trim(),
      levelNumber: Number(data.levelNumber) || 1,
      labelNepali: data.labelNepali.trim() || data.name.trim(),
      description: data.description?.trim() || null,
      minSalary: String(data.minSalary || 0),
      maxSalary: String(data.maxSalary || 0),
      rankOrder: data.rankOrder !== undefined ? data.rankOrder : Number(data.levelNumber) || 0,
      isActive: data.isActive ?? true,
    })
    .returning();

  return mapRowToItem(row);
}

/**
 * Updates an existing Shreni level
 */
export async function updateShreniLevel(
  id: string,
  data: Partial<ShreniLevelFormData>
): Promise<ShreniLevelItem> {
  const db = getDb();
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) updates.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.levelNumber !== undefined) updates.levelNumber = Number(data.levelNumber);
  if (data.labelNepali !== undefined) updates.labelNepali = data.labelNepali.trim();
  if (data.description !== undefined) updates.description = data.description.trim() || null;
  if (data.minSalary !== undefined) updates.minSalary = String(data.minSalary);
  if (data.maxSalary !== undefined) updates.maxSalary = String(data.maxSalary);
  if (data.rankOrder !== undefined) updates.rankOrder = data.rankOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [row] = await db
    .update(shreniLevels)
    .set(updates)
    .where(eq(shreniLevels.id, id))
    .returning();

  return mapRowToItem(row);
}

/**
 * Deletes a Shreni level with check for employee usage
 */
export async function deleteShreniLevel(id: string): Promise<void> {
  const db = getDb();

  const [level] = await db.select().from(shreniLevels).where(eq(shreniLevels.id, id)).limit(1);
  if (!level) return;

  // Check if any active employee is using this level code
  const inUse = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.shreni, level.code));

  const usageCount = inUse[0]?.count ?? 0;
  if (usageCount > 0) {
    throw new Error(
      `Cannot delete level "${level.code}" (${level.name}) because it is currently assigned to ${usageCount} employee(s). Reassign them first.`
    );
  }

  await db.delete(shreniLevels).where(eq(shreniLevels.id, id));
}

/**
 * Loads a preset template (e.g. 'bfi', 'sansthan', 'corporate', 'ngo', 'universal')
 * Replaces existing empty or resets levels with confirmation.
 */
export async function seedShreniPreset(presetKey: string): Promise<ShreniLevelItem[]> {
  const db = getDb();
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
