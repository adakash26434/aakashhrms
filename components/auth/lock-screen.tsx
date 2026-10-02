"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { signOutFromLockAction, unlockSessionAction } from "@/app/actions/session-lock.actions";
import { useClientReady } from "@/lib/hooks/use-client-ready";

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function LockScreen({
  name,
  email,
  lockedAt,
  returnTo,
}: {
  name: string;
  email: string;
  lockedAt: number | null;
  returnTo: string;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Local time only after hydration (server and browser time zones differ).
  const ready = useClientReady();
  const lockedLabel =
    ready && lockedAt ? new Date(lockedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await unlockSessionAction(password, returnTo);
      if (result.success && result.redirectTo) {
        window.location.replace(result.redirectTo);
        return;
      }
      setPassword("");
      setError(result.error ?? "Could not unlock. Try again.");
      if (result.redirectTo) {
        window.location.replace(result.redirectTo);
        return;
      }
      inputRef.current?.focus();
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div aria-hidden className="h-0.5 bg-[linear-gradient(90deg,var(--brand)_0_68%,var(--brand-red)_68%_100%)]" />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-lg">
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
              <Image src="/AakashHrmsLogo.jpeg" alt="" width={28} height={28} className="h-full w-full object-cover" unoptimized />
            </span>
            <span className="text-sm font-semibold text-ink">
              Aakash<span className="text-brand-red">HRMS</span>
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
              {initials(name)}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
                <Lock className="h-3 w-3" />
              </span>
            </span>
            <h1 className="mt-3 text-base font-semibold text-ink">Session locked</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{name}</p>
            {email && email !== name && <p className="text-2xs text-ink-faint">{email}</p>}
            <p className="mt-2 text-xs text-ink-faint">
              Locked{lockedLabel ? ` at ${lockedLabel}` : ""} after a period of inactivity. Your work is safe — enter your password to continue.
            </p>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <label htmlFor="unlock-password" className="block text-xs font-medium text-ink">
              Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="unlock-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-md border border-line-strong bg-white px-3 pr-9 text-sm text-ink"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "unlock-error" : undefined}
                maxLength={256}
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-ink-faint hover:text-ink cursor-pointer"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p id="unlock-error" role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || password.length === 0}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60 cursor-pointer"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Unlock
            </button>
          </form>

          <form action={signOutFromLockAction} className="mt-3 text-center">
            <button type="submit" className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline cursor-pointer">
              Not you? Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
