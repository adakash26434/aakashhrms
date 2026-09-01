export const dynamic = "force-dynamic";

import React from "react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { platformPolicyPacks, companies } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";
import { PolicyPackManager } from "@/components/platform/policy-pack-manager";
import { DEFAULT_NEPAL_POLICY_PACK_V1 } from "@/lib/platform/policy-pack-data";

export default async function StatutoryPoliciesPage() {
  await ensurePlatformTablesExist();

  const [packs, allCompanies] = await Promise.all([
    platformDb
      .select()
      .from(platformPolicyPacks)
      .orderBy(desc(platformPolicyPacks.version)),
    platformDb.select().from(companies),
  ]);

  let activePack = packs.find((p) => p.isPublished) || packs[0];

  if (!activePack) {
    activePack = {
      id: "default-seed-v1",
      version: 1,
      name: DEFAULT_NEPAL_POLICY_PACK_V1.name,
      payload: DEFAULT_NEPAL_POLICY_PACK_V1 as any,
      isPublished: true,
      publishedAt: new Date(),
      createdAt: new Date(),
    };
  }

  const activeTenantsCount = allCompanies.filter(
    (c) => c.status === "ACTIVE"
  ).length;

  return (
    <PolicyPackManager
      initialPack={{
        id: activePack.id,
        version: activePack.version,
        name: activePack.name,
        payload: activePack.payload as any,
        isPublished: activePack.isPublished,
        publishedAt: activePack.publishedAt
          ? new Date(activePack.publishedAt).toISOString()
          : new Date().toISOString(),
      }}
      activeTenantsCount={activeTenantsCount}
    />
  );
}
