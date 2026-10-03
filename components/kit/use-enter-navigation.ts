"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type RefObject } from "react";
import { scrollIntoContainer } from "./scroll-into-view";
import { ENTER_FIELD_SELECTOR, enterIntent, isEnterStop, selectsOnArrival, stepFieldIndex } from "@/lib/kit/form-nav";

export interface EnterNavigationOptions {
  /**
   * Checks the field being left. Return false to stay (the form shows the
   * error). Fields are identified by their `name` attribute.
   */
  validate?: (name: string, el: HTMLElement) => boolean;
  /** Where focus goes after the last field, usually the Save button. */
  end?: () => HTMLElement | null;
}

export interface FormNav {
  /** Move from `el` to the next field without validating (a value was just picked from a list). */
  advanceFrom: (el: HTMLElement | null) => void;
}

export const FormNavContext = createContext<FormNav | null>(null);

/** For composite controls (combobox, date field): null outside an Enter-navigation form. */
export function useFormNav(): FormNav | null {
  return useContext(FormNavContext);
}

function isVisible(el: HTMLElement): boolean {
  if (el.closest("[inert], [aria-hidden='true'], [hidden]")) return false;
  return el.getClientRects().length > 0;
}

function stops(form: HTMLElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>(ENTER_FIELD_SELECTOR)).filter((el) =>
    isEnterStop({
      disabled: (el as HTMLInputElement).disabled,
      readOnly: (el as HTMLInputElement).readOnly,
      skip: el.closest("[data-enter-skip]") !== null,
      visible: isVisible(el),
    })
  );
}

function arrive(el: HTMLElement) {
  el.focus({ preventScroll: true });
  scrollIntoContainer(el);
  if (el instanceof HTMLInputElement && selectsOnArrival(el.type)) el.select();
}

/**
 * Enter-to-next for a form (see lib/kit/form-nav.ts for the rules). Returns
 * the form's onKeyDown and the context value for composite controls.
 */
export function useEnterNavigation(formRef: RefObject<HTMLFormElement | null>, options: EnterNavigationOptions = {}) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const move = useCallback(
    (from: HTMLElement, intent: "next" | "prev") => {
      const form = formRef.current;
      if (!form) return false;
      const fields = stops(form);
      // A composite control's inner input may not be the registered stop; use the nearest one.
      let index = fields.indexOf(from);
      if (index < 0) index = fields.findIndex((f) => f.contains(from) || from.contains(f));
      if (index < 0) return false;
      const target = fields[stepFieldIndex(fields.length, index, intent)];
      if (target) {
        arrive(target);
        return true;
      }
      if (intent === "next") {
        const end = optionsRef.current.end?.();
        if (end) {
          end.focus();
          scrollIntoContainer(end);
          return true;
        }
      }
      return false;
    },
    [formRef]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLFormElement>) => {
      const target = e.target as HTMLElement;
      const intent = enterIntent(
        {
          key: e.key,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          isComposing: e.nativeEvent.isComposing,
          defaultPrevented: e.defaultPrevented,
        },
        { tagName: target.tagName, type: (target as HTMLInputElement).type }
      );
      if (!intent) return;
      // Enter never submits the form, whatever happens next.
      e.preventDefault();
      if (intent === "next") {
        const name = target.getAttribute("name");
        const ok = name && optionsRef.current.validate ? optionsRef.current.validate(name, target) : true;
        if (!ok) return;
      }
      move(target, intent);
    },
    [move]
  );

  const nav = useMemo<FormNav>(
    () => ({
      advanceFrom: (el) => {
        if (!el) return;
        // Let the picked value render first (it can change the next field's options).
        requestAnimationFrame(() => move(el, "next"));
      },
    }),
    [move]
  );

  return { onKeyDown, nav };
}
