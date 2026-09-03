"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export function PlatformLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch("/api/platform/auth/logout", { method: "POST" });
      router.push("/platform/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 hover:text-white active:scale-[0.98] transition-all border border-rose-500/20 hover:border-rose-500/40 cursor-pointer disabled:opacity-50 select-none shadow-payroll-xs"
    >
      <div className="flex items-center gap-2.5">
        {loading ? (
          <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="truncate">{loading ? "Exiting Session..." : "Exit Control Plane"}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider font-bold text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded">
        Sign Out
      </span>
    </button>
  );
}
