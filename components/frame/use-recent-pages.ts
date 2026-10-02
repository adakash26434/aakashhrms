"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

export interface RecentPage {
  href: string;
  label: string;
  module: string;
}

const KEY = "aakash.recentPages";
const CHANGE_EVENT = "aakash:recent-pages";
const MAX = 6;

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): RecentPage[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.href === "string" && typeof p.label === "string").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Recently visited *pages* (navigation sections) for the navigator and the
 * palette. Only section paths and labels are stored — never record names,
 * ids or other data (security plan, standing measure 3).
 */
export function useRecentPages(current: RecentPage | null): RecentPage[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const pages = useMemo(() => parse(raw), [raw]);
  const href = current?.href;
  const label = current?.label;
  const moduleLabel = current?.module;

  useEffect(() => {
    if (!href || !label || !moduleLabel) return;
    const existing = parse(readRaw());
    const next = [{ href, label, module: moduleLabel }, ...existing.filter((p) => p.href !== href)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // storage blocked: no recent list
    }
  }, [href, label, moduleLabel]);

  return pages;
}
