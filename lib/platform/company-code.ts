export const INITIAL_COMPANY_CODE_NUMBER = 111111;
export const COMPANY_CODE_PREFIX = 'CMP-';

/**
 * Generates an easy-to-remember sequential public Company Code in the format: CMP-DDDDDD
 * (e.g., "CMP-111111", "CMP-111112", "CMP-111113", etc.).
 *
 * - "CMP-" prefix
 * - 6 numeric digits starting from 111111, incrementing serially
 * - Fallback-safe for existing or legacy company codes
 *
 * @param existingCodes List of company codes currently existing in the platform database
 */
export function generateCompanyCode(existingCodes: string[] = []): string {
  let maxNum = 0;

  for (const code of existingCodes) {
    if (!code || typeof code !== 'string') continue;
    const clean = code.trim().toUpperCase();

    // Match sequential numeric format: CMP-111111, CMP-111112, etc.
    const match = clean.match(/^CMP-(\d{5,8})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // If no sequential codes exist yet, start with INITIAL_COMPANY_CODE_NUMBER (111111)
  if (maxNum < INITIAL_COMPANY_CODE_NUMBER) {
    return `${COMPANY_CODE_PREFIX}${INITIAL_COMPANY_CODE_NUMBER}`;
  }

  const nextNum = maxNum + 1;
  return `${COMPANY_CODE_PREFIX}${nextNum}`;
}

export const getNextCompanyCode = generateCompanyCode;

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
