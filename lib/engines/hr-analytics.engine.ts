// HR analytics (G13, docs/redesign/06-hrms-gap-analysis.md): pure aggregation
// over plain facts the service collects — no database access, unit-tested in
// tests/hr-analytics.test.ts. Nothing here touches pay figures: headcount,
// movement, tenure, age, leave, training and cases only (the COPOMIS / DoC
// staff section is headcount by category and gender plus training).

export interface StaffFact {
  id: string;
  gender: string; // Male | Female | Other
  category: string; // Permanent | Contract | …
  branch: string;
  department: string;
  designation: string;
  joiningDate: string; // ISO
  dateOfBirth: string; // ISO
  status: string; // Active | Inactive | …
  isDisabled: boolean;
}

export interface MovementFact {
  joined: number; // joined inside the period
  left: number; // terminations inside the period
  openingHeadcount: number; // active at the period start
}

export interface CountRow {
  label: string;
  count: number;
  female: number;
  male: number;
  other: number;
}

const isActive = (s: StaffFact) => s.status.toLowerCase() === 'active';

/** Full years between two ISO dates (birthday / anniversary not yet reached counts the year before). */
export function fullYearsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  let years = ty - fy;
  if (tm < fm || (tm === fm && td < fd)) years -= 1;
  return Math.max(0, years);
}

function countBy(staff: StaffFact[], key: (s: StaffFact) => string): CountRow[] {
  const map = new Map<string, CountRow>();
  for (const s of staff) {
    const label = key(s) || '—';
    const row = map.get(label) ?? { label, count: 0, female: 0, male: 0, other: 0 };
    row.count += 1;
    const g = s.gender.toLowerCase();
    if (g === 'female') row.female += 1;
    else if (g === 'male') row.male += 1;
    else row.other += 1;
    map.set(label, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export const headcountByBranch = (staff: StaffFact[]) => countBy(staff.filter(isActive), (s) => s.branch);
export const headcountByDepartment = (staff: StaffFact[]) => countBy(staff.filter(isActive), (s) => s.department);
export const headcountByDesignation = (staff: StaffFact[]) => countBy(staff.filter(isActive), (s) => s.designation);
export const headcountByCategory = (staff: StaffFact[]) => countBy(staff.filter(isActive), (s) => s.category);

export const AGE_BANDS = ['under 25', '25–34', '35–44', '45–54', '55 and over'] as const;

export function ageBand(age: number): (typeof AGE_BANDS)[number] {
  if (age < 25) return 'under 25';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  if (age < 55) return '45–54';
  return '55 and over';
}

export function headcountByAgeBand(staff: StaffFact[], today: string): CountRow[] {
  const rows = countBy(staff.filter(isActive), (s) => ageBand(fullYearsBetween(s.dateOfBirth, today)));
  return AGE_BANDS.map((band) => rows.find((r) => r.label === band) ?? { label: band, count: 0, female: 0, male: 0, other: 0 });
}

export interface Summary {
  active: number;
  female: number;
  femaleShare: number; // 0–100, one decimal
  permanent: number;
  averageTenureYears: number; // one decimal
  averageAge: number; // one decimal
  disabled: number;
  /** Annualised turnover: left / average headcount × 100, one decimal; 0 when there is nobody. */
  turnoverRate: number;
  joined: number;
  left: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(staff: StaffFact[], movement: MovementFact, today: string): Summary {
  const active = staff.filter(isActive);
  const female = active.filter((s) => s.gender.toLowerCase() === 'female').length;
  const closing = active.length;
  const average = (movement.openingHeadcount + closing) / 2;
  return {
    active: closing,
    female,
    femaleShare: closing ? round1((female / closing) * 100) : 0,
    permanent: active.filter((s) => s.category.toLowerCase() === 'permanent').length,
    averageTenureYears: closing ? round1(active.reduce((sum, s) => sum + fullYearsBetween(s.joiningDate, today), 0) / closing) : 0,
    averageAge: closing ? round1(active.reduce((sum, s) => sum + fullYearsBetween(s.dateOfBirth, today), 0) / closing) : 0,
    disabled: active.filter((s) => s.isDisabled).length,
    turnoverRate: average > 0 ? round1((movement.left / average) * 100) : 0,
    joined: movement.joined,
    left: movement.left,
  };
}

// ---------------------------------------------------------------------------
// COPOMIS / Department of Cooperatives staff section
// ---------------------------------------------------------------------------

export interface TrainingFact {
  trainedEmployees: number; // distinct employees with a completed programme in the period
  trainingHours: number;
  programmes: number; // completed programmes in the period
}

export interface ReturnRow {
  item: string;
  itemNp: string;
  male: number;
  female: number;
  other: number;
  total: number;
}

/**
 * The staff table a cooperative files with its yearly return (DoC / COPOMIS
 * "कर्मचारी विवरण"): headcount by employment category and gender, staff
 * with disabilities, movement, and training in the fiscal year. Headcount
 * only — pay totals come from payroll's own returns.
 */
export function staffReturn(staff: StaffFact[], movement: MovementFact, training: TrainingFact): ReturnRow[] {
  const active = staff.filter(isActive);
  const g = (rows: StaffFact[], gender: string) => rows.filter((s) => s.gender.toLowerCase() === gender).length;
  const row = (item: string, itemNp: string, rows: StaffFact[]): ReturnRow => {
    const male = g(rows, 'male');
    const female = g(rows, 'female');
    const other = rows.length - male - female;
    return { item, itemNp, male, female, other, total: rows.length };
  };
  const categories = [...new Set(active.map((s) => s.category))].sort();
  const rows: ReturnRow[] = [row('Total staff', 'जम्मा कर्मचारी', active)];
  for (const c of categories) rows.push(row(`  ${c}`, '', active.filter((s) => s.category === c)));
  rows.push(row('Staff with disabilities', 'अपाङ्गता भएका कर्मचारी', active.filter((s) => s.isDisabled)));
  rows.push({ item: 'Joined this year', itemNp: 'यस वर्ष नियुक्त', male: 0, female: 0, other: 0, total: movement.joined });
  rows.push({ item: 'Left this year', itemNp: 'यस वर्ष छोडेका', male: 0, female: 0, other: 0, total: movement.left });
  rows.push({ item: 'Staff trained this year', itemNp: 'तालिम प्राप्त कर्मचारी', male: 0, female: 0, other: 0, total: training.trainedEmployees });
  rows.push({ item: 'Training programmes completed', itemNp: 'सम्पन्न तालिम', male: 0, female: 0, other: 0, total: training.programmes });
  rows.push({ item: 'Training hours', itemNp: 'तालिम घण्टा', male: 0, female: 0, other: 0, total: Math.round(training.trainingHours * 100) / 100 });
  return rows;
}
