// Enter-to-next form navigation (roadmap 4.2). Pure decisions live here so
// they can be tested without a browser; the DOM side is
// components/kit/use-enter-navigation.ts.
//
// Rules (also in docs/redesign/02-design-system.md):
// - Enter on an input, select or checkbox: check that field, then move to the
//   next field (across sections). An invalid field shows its error and stays.
// - Shift+Enter: previous field, never blocked.
// - Textarea: Enter is a new line; Ctrl+Enter moves on.
// - Buttons and links keep their own Enter. The form never submits on Enter;
//   the last field hands focus to Save.
// - Mouse and Tab are never blocked or redirected.

export type EnterIntent = "next" | "prev" | null;

export interface EnterKeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** IME composition in progress (Devanagari input methods use Enter to commit). */
  isComposing?: boolean;
  /** A control (combobox, date picker) already handled this Enter. */
  defaultPrevented?: boolean;
}

export interface FieldTargetLike {
  tagName?: string;
  type?: string;
}

/** Input types that are actions, not values: Enter keeps its native meaning. */
const ACTION_INPUT_TYPES = new Set(["button", "submit", "reset", "image", "file", "hidden"]);

export function enterIntent(e: EnterKeyLike, target: FieldTargetLike | null | undefined): EnterIntent {
  if (e.key !== "Enter" || e.isComposing || e.defaultPrevented || e.altKey) return null;
  const tag = (target?.tagName ?? "").toUpperCase();
  const mod = e.ctrlKey || e.metaKey;

  if (tag === "TEXTAREA") {
    if (!mod) return null; // a new line
    return e.shiftKey ? "prev" : "next";
  }
  if (tag === "SELECT") return e.shiftKey ? "prev" : mod ? null : "next";
  if (tag === "INPUT") {
    if (ACTION_INPUT_TYPES.has((target?.type ?? "text").toLowerCase())) return null;
    if (mod) return null;
    return e.shiftKey ? "prev" : "next";
  }
  return null; // buttons, links, anything else
}

/** Index of the field to move to, or -1 at either end (no wrapping). */
export function stepFieldIndex(count: number, current: number, intent: Exclude<EnterIntent, null>): number {
  if (count <= 0 || current < 0) return -1;
  const next = intent === "next" ? current + 1 : current - 1;
  return next >= 0 && next < count ? next : -1;
}

/** Fields Enter can land on. Composite controls mark their input with data-enter-field. */
export const ENTER_FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image']):not([type='file'])",
  "select",
  "textarea",
].join(",");

export interface FieldStateLike {
  disabled?: boolean;
  readOnly?: boolean;
  /** `data-enter-skip` present. */
  skip?: boolean;
  /** Rendered and not inside a hidden / inert region. */
  visible: boolean;
}

/** Whether Enter may land on a field. Read-only and helper controls are skipped. */
export function isEnterStop(field: FieldStateLike): boolean {
  return field.visible && !field.disabled && !field.readOnly && !field.skip;
}

/** Input types whose text is selected on arrival, so typing replaces it (as in Excel or Tally). */
export function selectsOnArrival(type: string | null | undefined): boolean {
  return ["text", "search", "tel", "email", "number", "url", ""].includes((type ?? "").toLowerCase());
}
