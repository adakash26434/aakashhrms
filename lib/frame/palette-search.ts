// Command palette ranking (redesign 2.6). Pure so it can be unit-tested.

export interface PaletteCandidate {
  id: string;
  label: string;
  group: string;
  description?: string;
  keywords?: readonly string[];
}

function normalise(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Scores a candidate against a query. 0 means no match.
 * Prefix of the label > word prefix > substring > keyword > in-order letters.
 */
export function scoreCandidate(candidate: PaletteCandidate, rawQuery: string): number {
  const query = normalise(rawQuery);
  if (!query) return 1;
  const label = normalise(candidate.label);

  if (label === query) return 1000;
  if (label.startsWith(query)) return 800 - label.length;
  if (label.split(/[\s/&-]+/).some((w) => w.startsWith(query))) return 600 - label.length;
  if (label.includes(query)) return 500 - label.indexOf(query);

  const keywords = (candidate.keywords ?? []).map(normalise);
  if (keywords.some((k) => k.startsWith(query))) return 400;
  if (keywords.some((k) => k.includes(query))) return 300;
  if (candidate.description && normalise(candidate.description).includes(query)) return 200;

  // Subsequence ("slsh" → "salary sheet"), tolerant of skipped letters.
  let i = 0;
  for (const ch of label) if (ch === query[i]) i++;
  if (i === query.length && query.length >= 2) return 100 - label.length;
  return 0;
}

export function rankCandidates<T extends PaletteCandidate>(candidates: readonly T[], query: string, limit = 50): T[] {
  return candidates
    .map((c, index) => ({ c, index, score: scoreCandidate(c, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.c);
}
