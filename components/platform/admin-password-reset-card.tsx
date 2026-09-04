"use client";

import React, { useState } from "react";
import { KeyRound, Mail, Check, Copy, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface Props {
  companyId: string;
  companyName: string;
  currentEmail: string;
}

export function AdminPasswordResetCard({ companyId, companyName, currentEmail }: Props) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastResetInfo, setLastResetInfo] = useState<{ email: string; password: string } | null>(null);
  const toast = useToast();

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let gen = "";
    for (let i = 0; i < 12; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen + "1A!");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/platform/companies/${companyId}/reset-admin-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reset credentials.");
      }

      setLastResetInfo({
        email: data.email,
        password: data.password,
      });
      setPassword("");
      toast.success("Office Admin credentials updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-payroll-light/60 pb-2.5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-payroll-primary" />
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Tenant Admin Credentials
            </h3>
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Manage the primary Office Administrator credentials for <strong>{companyName}</strong>. You can update their email or set/reset their password.
        </p>

        {lastResetInfo && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> New Admin Credentials
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(`Email: ${lastResetInfo.email}\nPassword: ${lastResetInfo.password}`)}
                className="text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 text-[11px]"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-2.5 rounded-lg border border-emerald-100">
              <div>
                <span className="text-gray-400 block text-[10px]">EMAIL</span>
                <span className="text-gray-800 font-semibold">{lastResetInfo.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">PASSWORD</span>
                <span className="text-emerald-700 font-bold">{lastResetInfo.password}</span>
              </div>
            </div>
            <p className="text-[10px] text-emerald-600">
              The user will be required to change this password upon their first sign-in.
            </p>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
              Admin Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-payroll-light bg-white focus:outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary text-payroll-navy font-medium"
                placeholder="admin@company.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-gray-600 uppercase">
                New Password (Optional)
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[10px] text-payroll-primary hover:underline flex items-center gap-1 font-semibold"
              >
                <Sparkles className="w-3 h-3" /> Auto-generate
              </button>
            </div>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to use DEFAULT_TENANT_ADMIN_PASSWORD"
              className="w-full px-3 py-2 text-xs rounded-lg border border-payroll-light bg-white focus:outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary text-payroll-navy font-mono"
            />
          </div>

          <Button
            type="submit"
            size="sm"
            className="w-full h-9 text-xs font-semibold"
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            )}
            {loading ? "Updating Credentials..." : "Update Admin Credentials"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
