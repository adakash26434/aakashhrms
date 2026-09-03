import { ensureTenantContext } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SelfServiceNav } from "@/components/self-service/self-service-nav";

export const dynamic = "force-dynamic";

export default async function SelfServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureTenantContext();

  const session = await auth();

  // 1. Force password change check
  if (session?.user?.mustChangePassword) {
    redirect("/change-password");
  }

  const userEmail = session?.user?.email || "Employee";
  const scopeType = session?.user?.scopeType || "SELF";

  return (
    <div className="min-h-screen bg-payroll-cream text-payroll-navy font-sans antialiased flex flex-col">
      {/* Self-Service Navigation Header */}
      <SelfServiceNav userEmail={userEmail} scopeType={scopeType} />

      {/* Page Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
