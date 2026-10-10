import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/frame/brand";

export const metadata = {
  title: "Sign in | AakashHRMS",
  description: "Sign in to your company's AakashHRMS workspace.",
};

/**
 * The sign-in page is the product's front door (there is no marketing home):
 * one card, the company code, email and password, nothing else to read.
 */
export default async function LoginPage() {
  // A super admin viewing a company goes straight to its dashboard.
  const impersonation = await getImpersonationSession();
  if (impersonation) redirect("/dashboard");

  try {
    const session = await auth();
    if (session?.user) redirect(session.user.scopeType === "SELF" ? "/self-service" : "/dashboard");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // A failed session check never blocks the sign-in page.
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f4f8f5] px-4 py-10 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <BrandLogo className="h-14 sm:h-16" priority />
          <p className="text-sm font-medium tracking-wide text-slate-500">Smart People, Strong Organization</p>
        </div>

        <section aria-labelledby="login-title" className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_8px_30px_rgba(16,185,129,0.08)] sm:p-8">
          <h1 id="login-title" className="text-xl font-bold tracking-tight text-slate-900">
            Sign in
          </h1>
          <p className="mb-5 mt-1 text-xs text-slate-500">Your company code, email and password.</p>
          <LoginForm />
        </section>

        <p className="mt-6 text-center text-2xs text-slate-400">
          Nepal Labour Act 2074 · IRD · SSF compliant · BS / AD calendars
        </p>
      </div>
    </main>
  );
}
