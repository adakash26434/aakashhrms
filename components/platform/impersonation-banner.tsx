"use client";

import { useState } from "react";
import { ShieldCheck, X, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ImpersonationBannerProps {
  actorName: string;
  companyName: string;
  companyId: string;
}

export function ImpersonationBanner({
  actorName,
  companyName,
  companyId,
}: ImpersonationBannerProps) {
  const [isExiting, setIsExiting] = useState(false);
  const router = useRouter();

  const handleExit = async () => {
    setIsExiting(true);
    try {
      const res = await fetch(
        `/api/platform/companies/${companyId}/impersonate`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push("/platform");
      }
    } catch {
      router.push("/platform");
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 flex flex-wrap items-center justify-between sticky top-0 z-[100] shadow-payroll-md gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 bg-white/20 px-2 py-0.5 rounded-md">
          <ShieldCheck className="w-4 h-4 text-amber-200" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Super Admin Mode
          </span>
        </div>

        <div className="h-3.5 w-px bg-white/30 hidden sm:block" />

        <span className="text-xs truncate">
          Viewing <strong className="font-bold text-white underline">{companyName}</strong> as{" "}
          <span className="font-semibold text-amber-100">{actorName}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <a
          href="/platform"
          className="text-xs text-white/90 hover:text-white underline underline-offset-2 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:inline">Platform Admin</span>
        </a>

        <button
          onClick={handleExit}
          disabled={isExiting}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all disabled:opacity-50 border border-white/20 cursor-pointer select-none active:scale-[0.98]"
        >
          {isExiting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
          <span>{isExiting ? "Exiting..." : "Exit"}</span>
        </button>
      </div>
    </div>
  );
}
