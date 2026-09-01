// Uppercase alphabets (A-Z, excluding easily confused letters like I and O for human readability)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an easy-to-read public Company Code in the format: CMP-DDDDLL
 * (e.g., "CMP-1111AF", "CMP-4829XK").
 * - "CMP-" prefix
 * - 4 easy-to-read digits (0-9)
 * - 2 uppercase alphabetic characters (A-Z)
 */
export function generateCompanyCode(): string {
  let digits = '';
  for (let i = 0; i < 4; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }

  const char1 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const char2 = LETTERS[Math.floor(Math.random() * LETTERS.length)];

  return `CMP-${digits}${char1}${char2}`;
}

/**
 * Generates a clean URL slug from a company legal name or display brand name.
 * e.g., "Himalayan Co-operative Pvt. Ltd." -> "himalayan-co-operative"
 */
export function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove special characters
    .replace(/\s+/g, '-')         // replace spaces with hyphens
    .replace(/-+/g, '-')          // collapse consecutive hyphens
    .replace(/^(pvt|ltd|coop|cooperative)-|-?(pvt|ltd|coop|cooperative)$/g, '') // trim common suffixes if isolated
    .slice(0, 50);
}
