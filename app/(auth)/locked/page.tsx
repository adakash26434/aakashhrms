import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeReturnTo } from "@/lib/frame/return-to";
import { LockScreen } from "@/components/auth/lock-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session locked", robots: { index: false, follow: false } };

/** Idle lock screen (2.8). The route guard sends every locked session here. */
export default async function LockedPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const fallback = session.user.scopeType === "SELF" ? "/self-service" : "/dashboard";
  const { returnTo } = await searchParams;
  const destination = safeReturnTo(typeof returnTo === "string" ? returnTo : undefined, fallback);
  if (!session.user.locked) redirect(destination);

  const name = session.user.name || session.user.email || "Your account";
  return <LockScreen name={name} email={session.user.email ?? ""} lockedAt={session.user.lockedAt ?? null} returnTo={destination} />;
}
