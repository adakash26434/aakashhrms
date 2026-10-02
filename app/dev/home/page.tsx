import { notFound } from "next/navigation";
import { HomePreview } from "@/components/dev/home-preview";

export const metadata = { title: "Home preview", robots: { index: false, follow: false } };

// Development-only preview of Home (Phase 4.1) with sample data in every
// state (admin, branch-scoped, no queues, failed sections). Never real records.
// Blocked twice in production: here and in authorized() (lib/auth/auth.config.ts).
export default function DevHomePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HomePreview />;
}
