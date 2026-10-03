// Kit combobox (4.2): searchable single-choice list. Pure filtering lives
// here; the control is components/kit/combobox.tsx.

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary text on the right (a code, a Nepali name, a province). */
  hint?: string;
  /** Extra words that should match the search but are not shown. */
  keywords?: string;
}

/**
 * Options matching the query, best first: label starts with the query, then a
 * word in the label starts with it, then it appears anywhere (label, hint or
 * keywords). Case-insensitive; an empty query returns the list as given.
 */
export function filterOptions(options: readonly ComboOption[], query: string, limit = 100): ComboOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  const ranked: { option: ComboOption; rank: number; index: number }[] = [];
  options.forEach((option, index) => {
    const label = option.label.toLowerCase();
    let rank = -1;
    if (label.startsWith(q)) rank = 0;
    else if (label.split(/[\s/(),.-]+/).some((w) => w.startsWith(q))) rank = 1;
    else if (`${label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase().includes(q)) rank = 2;
    if (rank >= 0) ranked.push({ option, rank, index });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((r) => r.option);
}

/** Highlight index after ↑/↓, wrapping; -1 when the list is empty. */
export function moveHighlight(count: number, current: number, delta: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/**
 * Type-ahead for a closed select (as in Windows lists): the next option after
 * `current` whose label starts with `query`, wrapping; repeating one letter
 * cycles through the options that start with it. -1 when nothing matches.
 */
export function typeaheadIndex(labels: readonly string[], query: string, current: number): number {
  const q = query.toLowerCase();
  if (!q || labels.length === 0) return -1;
  const cycling = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = cycling ? q[0] : q;
  // A longer query keeps the current match if it still fits; a single (or repeated) letter moves on.
  const start = current < 0 ? 0 : current + (needle.length > 1 ? 0 : 1);
  for (let i = 0; i < labels.length; i++) {
    const index = (start + i) % labels.length;
    if (labels[index].toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
