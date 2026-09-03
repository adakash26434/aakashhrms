"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Super Admin authentication failed.");
      }

      router.push("/platform");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid Super Admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-payroll-cream text-payroll-navy flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans select-none">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-payroll-primary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex items-center justify-center mx-auto shadow-payroll-md border border-payroll-light/80">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS Control Plane"
              width={64}
              height={64}
              className="object-cover h-full w-full"
              priority
              unoptimized
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-payroll-navy tracking-tight">
                Super Admin Control Plane
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              AakashHRMS Multi-Tenant Governance Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-payroll-light/80 shadow-payroll-md bg-white">
          <CardContent className="p-6 sm:p-8 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 font-semibold">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Super Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@aakashhrms.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-payroll-light bg-white text-payroll-navy text-xs focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Super Admin Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-payroll-light bg-white text-payroll-navy text-xs focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-payroll-primary" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                isLoading={loading}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm mt-2"
              >
                <span>{loading ? "Authenticating..." : "Sign In to Control Plane"}</span>
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-[11px] text-gray-500 font-medium">
          Protected Control Plane · AakashHRMS SaaS Multi-Tenant Engine
        </p>
      </div>
    </div>
  );
}
