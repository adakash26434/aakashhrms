import Image from "next/image";
import { cn } from "@/lib/utils";

// The AakashHRMS brand images (public/brand/, cut from the original logo so nothing is cropped by
// CSS): the mark — the three people and the swoosh — for small square places, and the logo — the
// mark with "Aakash HRMS" and its underline — for the sign-in pages. The tagline is set as text
// where it is shown, so it stays sharp at any size.

/** The mark (three people), square. Decorative by default: the wordmark or a label names the place. */
export function BrandMark({ size = 28, className, priority, alt = "" }: { size?: number; className?: string; priority?: boolean; alt?: string }) {
  return <Image src="/brand/aakash-hrms-mark-128.png" alt={alt} width={size} height={size} className={cn("shrink-0 object-contain", className)} priority={priority} unoptimized />;
}

/** The logo (the mark with "Aakash HRMS"), its height set by the class (h-12 by default). */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/aakash-hrms-logo.png" alt="AakashHRMS" width={1502} height={318} sizes="320px" className={cn("h-12 w-auto object-contain", className)} priority={priority} />;
}
