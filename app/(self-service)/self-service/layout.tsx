import { ensureTenantContext } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SelfServiceNav } from "@/components/self-service/self-service-nav";
import { essLang } from "@/lib/i18n/ess-server";

export const dynamic = "force-dynamic";

export default async function SelfServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureTenantContext();

  const session = await auth();

  // Defense in depth (S8): never render self-service without a session
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 1. Force password change check
  if (session?.user?.mustChangePassword) {
    redirect("/change-password");
  }

  const userEmail = session?.user?.email || "Employee";
  const scopeType = session?.user?.scopeType || "SELF";
  const lang = await essLang();

  return (
    <div className="min-h-screen bg-payroll-cream text-payroll-navy font-sans antialiased flex flex-col">
      {/* Self-Service Navigation Header & Sidebar */}
      <SelfServiceNav userEmail={userEmail} scopeType={scopeType} lang={lang} />

      {/* Page Content */}
      <main className="flex-1 w-full sm:pl-64 print:pl-0">
        <div className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
