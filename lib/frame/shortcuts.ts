// Global keyboard shortcuts (redesign 2.7). One list drives both the key
// handling in the frame and the "?" help overlay, so they cannot drift apart.

export type ShortcutId =
  | "palette"
  | "paletteAlt"
  | "module"
  | "toggleNavigator"
  | "lockSession"
  | "help";

export interface ShortcutDef {
  id: ShortcutId;
  /** Display keys, e.g. ["Ctrl", "K"]. */
  keys: readonly string[];
  label: string;
  group: "General" | "Navigation" | "Session";
}

export const GLOBAL_SHORTCUTS: readonly ShortcutDef[] = [
  { id: "palette", keys: ["Ctrl", "K"], label: "Search pages, employees and commands", group: "General" },
  { id: "paletteAlt", keys: ["Alt", "G"], label: "Go to (Tally-style alias for the palette)", group: "General" },
  { id: "help", keys: ["?"], label: "Show keyboard shortcuts", group: "General" },
  { id: "module", keys: ["Alt", "1–7"], label: "Switch module (Home, Workforce, Time, Payroll, Reports, Setup, Admin)", group: "Navigation" },
  { id: "toggleNavigator", keys: ["Ctrl", "B"], label: "Show or hide the section navigator", group: "Navigation" },
  { id: "lockSession", keys: ["Ctrl", "Shift", "L"], label: "Lock the session now", group: "Session" },
];

/** Keys handled inside windows and lists (listed in help, handled locally). */
export const CONTEXT_SHORTCUTS: readonly { keys: readonly string[]; label: string }[] = [
  { keys: ["Esc"], label: "Close the palette, menu or window" },
  { keys: ["↑", "↓"], label: "Move through palette results" },
  { keys: ["Enter"], label: "Open the highlighted result" },
];

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface EventTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

/** True while the user is typing in a field: plain-key shortcuts must not fire. */
export function isTypingTarget(target: EventTargetLike | null | undefined): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.getAttribute?.("role") === "textbox";
}

/**
 * Resolves a key event to a global shortcut. Ctrl and Cmd are treated alike
 * so Mac users get the same bindings.
 */
export function resolveShortcut(
  e: KeyLike,
  target?: EventTargetLike | null
): { id: ShortcutId; moduleIndex?: number } | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // Alt+digit / Alt+G: use e.code because Alt changes e.key on some layouts.
  const code = e.code ?? "";

  if (mod && !e.altKey && !e.shiftKey && key === "k") return { id: "palette" };
  if (e.altKey && !mod && !e.shiftKey && (code === "KeyG" || key === "g")) return { id: "paletteAlt" };
  if (e.altKey && !mod && !e.shiftKey) {
    const digit = /^Digit([1-7])$/.exec(code)?.[1] ?? (/^[1-7]$/.test(key) ? key : undefined);
    if (digit) return { id: "module", moduleIndex: Number(digit) - 1 };
  }
  if (mod && !e.altKey && !e.shiftKey && key === "b") return { id: "toggleNavigator" };
  if (mod && e.shiftKey && !e.altKey && key === "l") return { id: "lockSession" };
  if (!mod && !e.altKey && key === "?" && !isTypingTarget(target)) return { id: "help" };
  return null;
}

/**
 * Matches a page-level combo such as "Ctrl+N", "Ctrl+Shift+E" or "F2"
 * (CommandToolbar actions). Ctrl also matches Cmd.
 */
export function matchesCombo(e: KeyLike, combo: string): boolean {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1];
  const wantCtrl = parts.includes("ctrl") || parts.includes("cmd");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  if ((e.ctrlKey || e.metaKey) !== wantCtrl) return false;
  if (e.shiftKey !== wantShift) return false;
  if (e.altKey !== wantAlt) return false;
  const pressed = e.key.toLowerCase();
  if (key.length === 1 && e.code && /^Key[A-Z]$|^Digit\d$/.test(e.code)) {
    return e.code.slice(-1).toLowerCase() === key;
  }
  return pressed === key;
}
