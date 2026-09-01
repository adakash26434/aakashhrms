"use client";

import React from "react";
import { formatNPR } from "@/lib/utils/report-format";

interface NprTextProps {
  value: string | number;
  showPrefix?: boolean;
  type?: "neutral" | "positive" | "negative";
  className?: string;
}

export function NprText({
  value,
  showPrefix = false,
  type = "neutral",
  className = "",
}: NprTextProps) {
  const colorClass =
    type === "positive"
      ? "text-emerald-700 font-semibold"
      : type === "negative"
      ? "text-red-700 font-semibold"
      : "text-[#1b3a1f]";

  return (
    <span className={`font-mono tabular-nums ${colorClass} ${className}`}>
      {formatNPR(value, showPrefix)}
    </span>
  );
}
