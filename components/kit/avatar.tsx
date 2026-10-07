"use client";

import { useState } from "react";
import { initials } from "@/lib/utils/initials";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-7 w-7 text-2xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-2xl",
} as const;

/**
 * A person's photo in a circle, or their initials when there is none (or it fails to load).
 * `src` is a same-origin image URL; the photo's alt text is the name.
 */
export function Avatar({
  name,
  src,
  size = "md",
  tone = "subtle",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE;
  /** "subtle": brand tint with brand initials; "solid": brand fill with white initials. */
  tone?: "subtle" | "solid";
  className?: string;
}) {
  // The src that failed, so a new photo is tried again.
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!src && failed !== src;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        SIZE[size],
        tone === "solid" ? "bg-brand text-white" : "bg-brand-subtle text-brand-strong",
        className
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private, already-small image from our own route
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
