import { notFound } from "next/navigation";
import { KitGallery } from "@/components/dev/kit-gallery";

export const metadata = { title: "Component gallery", robots: { index: false, follow: false } };

// Development-only gallery (roadmap 3.9, started in Phase 1 to verify the
// reskin without signing in). Renders sample data only — never real records.
// Blocked twice in production: here and in authorized() (lib/auth/auth.config.ts).
export default function DevKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitGallery />;
}
