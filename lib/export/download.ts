"use client";

/**
 * Saves text as a file in the browser. CSV gets a UTF-8 BOM so Excel shows
 * Devanagari and "₨" correctly.
 */
export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const withBom = mime.startsWith("text/csv") ? `﻿${text}` : text;
  const url = URL.createObjectURL(new Blob([withBom], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
