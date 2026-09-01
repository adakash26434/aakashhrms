import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login | AakashHRMS",
  description: "Secure login to the AakashHRMS portal.",
};

export default async function LoginPage() {
  // If already logged in, skip the login page and go straight to the dashboard
  try {
    const session = await auth();
    if (session?.user) {
      if (session.user.scopeType === "SELF") {
        redirect("/self-service");
      }
      redirect("/dashboard");
    }
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // Session check error should not crash the page, let user proceed to login
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-payroll-cream px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-payroll-light/60">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md border border-payroll-light/60">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS"
              width={64}
              height={64}
              className="object-cover h-full w-full"
              priority
              unoptimized
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-payroll-navy">
            AakashHRMS
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter your company code to sign in to your workspace
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
