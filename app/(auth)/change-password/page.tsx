import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Change Password | PaySystem",
  description: "Update your password to continue",
};

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-green-50 p-4">
      <ChangePasswordForm />
    </div>
  );
}
