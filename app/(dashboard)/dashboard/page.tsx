export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/workspace-home/home-view";
import { getHomeSnapshot } from "@/lib/services/home.service";

export const metadata: Metadata = {
  title: "Home",
  description: "Your work queues: approvals, payroll progress, deadlines and records to fix.",
};

export default async function HomePage() {
  let data;
  try {
    // Signs-in check, permissions and scope are all applied inside (S3, S17).
    data = await getHomeSnapshot();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized")) redirect("/login");
    throw error;
  }
  return <HomeView data={data} />;
}
