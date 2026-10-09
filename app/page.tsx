import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The product has no public home page: "/" goes to the sign-in page, or
// straight to the right workspace when a session already exists.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await auth().catch(() => null);
  if (session?.user) redirect(session.user.scopeType === "SELF" ? "/self-service" : "/dashboard");
  redirect("/login");
}
