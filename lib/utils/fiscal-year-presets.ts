import {
  getFiscalYear,
  bsToAD,
  getDaysInBSMonth,
  formatADDate,
} from './bs-calendar';

export interface FiscalYearPresetOption {
  label: string; // e.g. "FY 2081/82"
  slug: string; // e.g. "fy-2081-82"
  bsYear: number;
  startDateBS: string; // e.g. "2081-04-01"
  endDateBS: string; // e.g. "2082-03-31"
  startDateAD: string; // ISO string
  endDateAD: string; // ISO string
  formattedDateRangeAD: string; // e.g. "Jul 16, 2024 to Jul 15, 2025"
  isCurrent: boolean;
  tag?: string;
}

/**
 * Dynamically computes a standard Bikram Sambat fiscal year preset
 * for a given opening BS year (Shrawan 1 of bsYear to Asar last day of bsYear + 1).
 */
export function buildFiscalYearPreset(
  openingBsYear: number,
  currentOpeningBsYear: number
): FiscalYearPresetOption {
  const closingBsYear = openingBsYear + 1;
  const shortClosing = String(closingBsYear).slice(-2);
  const label = `FY ${openingBsYear}/${shortClosing}`;
  const slug = `fy-${openingBsYear}-${shortClosing}`;

  const asarDays = getDaysInBSMonth(closingBsYear, 3) || 31;
  const startDateBS = `${openingBsYear}-04-01`;
  const endDateBS = `${closingBsYear}-03-${String(asarDays).padStart(2, '0')}`;

  const startAd = bsToAD(openingBsYear, 4, 1);
  const endAd = bsToAD(closingBsYear, 3, asarDays);

  const isCurrent = openingBsYear === currentOpeningBsYear;
  let tag: string | undefined;
  if (isCurrent) {
    tag = 'Current Active Cycle';
  } else if (openingBsYear === currentOpeningBsYear - 1) {
    tag = 'Previous Year';
  } else if (openingBsYear === currentOpeningBsYear + 1) {
    tag = 'Upcoming Year';
  }

  return {
    label,
    slug,
    bsYear: openingBsYear,
    startDateBS,
    endDateBS,
    startDateAD: startAd.toISOString(),
    endDateAD: endAd.toISOString(),
    formattedDateRangeAD: `${formatADDate(startAd, 'short')} to ${formatADDate(endAd, 'short')}`,
    isCurrent,
    tag,
  };
}

/**
 * Returns dynamic fiscal year options centered around today's current Bikram Sambat date.
 * Typically includes: Previous FY, Current Active FY, and Next FY.
 */
export function getAvailableFiscalYearPresets(
  referenceDate: Date = new Date()
): {
  current: FiscalYearPresetOption;
  options: FiscalYearPresetOption[];
} {
  const currentFyInfo = getFiscalYear(referenceDate);
  const currentBsYear = currentFyInfo.bsYear;

  // Generate options from (currentBsYear - 1) to (currentBsYear + 2)
  const years = [
    currentBsYear - 1,
    currentBsYear,
    currentBsYear + 1,
    currentBsYear + 2,
  ];

  const options = years.map((y) => buildFiscalYearPreset(y, currentBsYear));
  const current = options.find((o) => o.isCurrent) || buildFiscalYearPreset(currentBsYear, currentBsYear);

  return { current, options };
}
