"use client";

import { useState } from "react";
import { ShieldCheck, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface ImpersonationBannerProps {
  actorName: string;
  companyName: string;
  companyId: string;
}

/**
 * Persistent top-banner shown when a Super Admin is viewing a company's data
 * via the impersonation flow. Always visible to make it unambiguous which mode
 * the admin is in. Includes an "Exit" button that ends the impersonation session.
 */
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
      // Force redirect even if the API fails — always exit
      router.push("/platform");
    }
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-100 shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-white/90" />
          <span className="text-sm font-bold tracking-tight">
            Super Admin View
          </span>
        </div>

        <div className="h-4 w-px bg-white/30" />

        <span className="text-sm">
          Viewing <strong className="font-bold">{companyName}</strong> as{" "}
          <span className="font-medium">{actorName}</span>
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <a
          href="/platform"
          className="text-xs text-white/80 hover:text-white underline underline-offset-2 flex items-center space-x-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Control Plane</span>
        </a>

        <button
          onClick={handleExit}
          disabled={isExiting}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all disabled:opacity-50 border border-white/20"
        >
          <X className="w-3.5 h-3.5" />
          <span>{isExiting ? "Exiting..." : "Exit Impersonation"}</span>
        </button>
      </div>
    </div>
  );
}
