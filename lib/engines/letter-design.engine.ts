// Letter design (G2 follow-up): how a company's letters look — letterhead,
// text size, spacing, margins and the signature blocks of each letter kind.
// Pure: no database access, unit-tested in tests/letter-design.test.ts.
//
// The words of an issued letter are frozen at issue; the design is only how
// they are drawn, so changing it restyles printouts but never the text.

export const HEADER_ALIGNS = ['center', 'left'] as const;
export const LOGO_SIZES = ['sm', 'md', 'lg'] as const;
export const RULE_STYLES = ['brand', 'line', 'none'] as const;
export const FONT_SIZES = ['sm', 'md', 'lg'] as const;
export const LINE_SPACINGS = ['normal', 'relaxed'] as const;
export const MARGINS = ['compact', 'normal', 'wide'] as const;
export const SUBJECT_STYLES = ['underline', 'bold', 'plain'] as const;

export type HeaderAlign = (typeof HEADER_ALIGNS)[number];
export type LogoSize = (typeof LOGO_SIZES)[number];
export type RuleStyle = (typeof RULE_STYLES)[number];
export type FontSize = (typeof FONT_SIZES)[number];
export type LineSpacing = (typeof LINE_SPACINGS)[number];
export type Margin = (typeof MARGINS)[number];
export type SubjectStyle = (typeof SUBJECT_STYLES)[number];

/** A box to sign at the foot of a letter. */
export const SIGNATURE_BLOCKS = [
  { code: 'signatory', en: 'Authorised signatory', np: 'अधिकार प्राप्त अधिकारी' },
  { code: 'signatory2', en: 'Second signatory', np: 'दोस्रो हस्ताक्षरकर्ता' },
  { code: 'received', en: 'Received by employee', np: 'बुझिलिनेको सही' },
  { code: 'employee', en: 'Employee', np: 'कर्मचारी' },
  { code: 'guarantor', en: 'Guarantor', np: 'जमानी बस्ने' },
  { code: 'witness', en: 'Witness', np: 'साक्षी' },
] as const;
export type SignatureBlock = (typeof SIGNATURE_BLOCKS)[number]['code'];
export const MAX_SIGNATURE_BLOCKS = 6;

export interface KindLayout {
  /** The addressee block (name and code) under the reference number. */
  showRecipient: boolean;
  blocks: SignatureBlock[];
}

export interface LetterDesign {
  headerAlign: HeaderAlign;
  /** A small PNG / JPEG as a data URL ('' = no logo). Kept in the design so the page's image rule (self, data:) allows it. */
  logoDataUrl: string;
  logoSize: LogoSize;
  ruleStyle: RuleStyle;
  showRegNo: boolean;
  showContact: boolean;
  headerNote: string;
  footerText: string;
  fontSize: FontSize;
  lineSpacing: LineSpacing;
  margin: Margin;
  subjectStyle: SubjectStyle;
  /** Per letter kind; kinds without an entry use the defaults below. */
  kinds: Record<string, KindLayout>;
}

const addressed: KindLayout = { showRecipient: true, blocks: ['received', 'signatory'] };

/** Layout a kind gets until the company changes it. */
export const DEFAULT_KIND_LAYOUTS: Record<string, KindLayout> = {
  appointment: addressed,
  confirmation: addressed,
  promotion: addressed,
  transfer: addressed,
  job_description: addressed,
  experience: { showRecipient: false, blocks: ['signatory'] },
  noc: { showRecipient: false, blocks: ['signatory'] },
  kyc: { showRecipient: false, blocks: ['employee', 'signatory'] },
  dhanjamani: { showRecipient: false, blocks: ['guarantor', 'employee', 'witness', 'signatory'] },
  agreement: { showRecipient: false, blocks: ['signatory', 'employee', 'witness', 'witness'] },
};

export const DEFAULT_DESIGN: LetterDesign = {
  headerAlign: 'center',
  logoDataUrl: '',
  logoSize: 'md',
  ruleStyle: 'brand',
  showRegNo: false,
  showContact: false,
  headerNote: '',
  footerText: '',
  fontSize: 'md',
  lineSpacing: 'normal',
  margin: 'normal',
  subjectStyle: 'underline',
  kinds: {},
};

export const LOGO_MAX_CHARS = 200_000;
const LOGO_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const BLOCK_CODES: readonly SignatureBlock[] = SIGNATURE_BLOCKS.map((b) => b.code);

function normalizeKind(raw: unknown, fallback: KindLayout): KindLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const blocks = Array.isArray(r.blocks) ? (r.blocks.filter((b): b is SignatureBlock => BLOCK_CODES.includes(b as SignatureBlock)).slice(0, MAX_SIGNATURE_BLOCKS) as SignatureBlock[]) : fallback.blocks;
  return { showRecipient: flag(r.showRecipient, fallback.showRecipient), blocks };
}

/** Cleans any stored or submitted value into a complete, safe design. */
export function normalizeDesign(raw: unknown): LetterDesign {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const logo = typeof r.logoDataUrl === 'string' ? r.logoDataUrl.trim() : '';
  const kinds: Record<string, KindLayout> = {};
  const rawKinds = (r.kinds && typeof r.kinds === 'object' ? r.kinds : {}) as Record<string, unknown>;
  for (const [code, value] of Object.entries(rawKinds)) {
    if (!/^[a-z0-9][a-z0-9_-]{1,29}$/.test(code)) continue;
    kinds[code] = normalizeKind(value, kindLayout(DEFAULT_DESIGN, code));
  }
  return {
    headerAlign: pick(HEADER_ALIGNS, r.headerAlign, DEFAULT_DESIGN.headerAlign),
    logoDataUrl: LOGO_PATTERN.test(logo) && logo.length <= LOGO_MAX_CHARS ? logo : '',
    logoSize: pick(LOGO_SIZES, r.logoSize, DEFAULT_DESIGN.logoSize),
    ruleStyle: pick(RULE_STYLES, r.ruleStyle, DEFAULT_DESIGN.ruleStyle),
    showRegNo: flag(r.showRegNo, DEFAULT_DESIGN.showRegNo),
    showContact: flag(r.showContact, DEFAULT_DESIGN.showContact),
    headerNote: text(r.headerNote, 200),
    footerText: text(r.footerText, 300),
    fontSize: pick(FONT_SIZES, r.fontSize, DEFAULT_DESIGN.fontSize),
    lineSpacing: pick(LINE_SPACINGS, r.lineSpacing, DEFAULT_DESIGN.lineSpacing),
    margin: pick(MARGINS, r.margin, DEFAULT_DESIGN.margin),
    subjectStyle: pick(SUBJECT_STYLES, r.subjectStyle, DEFAULT_DESIGN.subjectStyle),
    kinds,
  };
}

/** Problems a person can fix; normalizeDesign already makes the value safe. */
export function validateDesign(raw: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof r.logoDataUrl === 'string' && r.logoDataUrl.trim()) {
    const logo = r.logoDataUrl.trim();
    if (!LOGO_PATTERN.test(logo)) errors.logoDataUrl = 'Use a PNG or JPEG image.';
    else if (logo.length > LOGO_MAX_CHARS) errors.logoDataUrl = 'The logo is too large; use a smaller image.';
  }
  const rawKinds = (r.kinds && typeof r.kinds === 'object' ? r.kinds : {}) as Record<string, { blocks?: unknown }>;
  for (const [code, value] of Object.entries(rawKinds)) {
    if (Array.isArray(value?.blocks) && value.blocks.length > MAX_SIGNATURE_BLOCKS) errors[`kinds.${code}`] = `At most ${MAX_SIGNATURE_BLOCKS} signature boxes.`;
  }
  return errors;
}

/** The layout for a kind: the company's choice, else the default, else the plain addressed letter. */
export function kindLayout(design: LetterDesign, kind: string): KindLayout {
  return design.kinds[kind] ?? DEFAULT_KIND_LAYOUTS[kind] ?? addressed;
}

export function blockLabel(code: SignatureBlock, np: boolean): string {
  const b = SIGNATURE_BLOCKS.find((x) => x.code === code);
  return b ? (np ? b.np : b.en) : code;
}

// Tailwind class maps (full class names, so the compiler sees them).
export const FONT_CLASS: Record<FontSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
export const SPACING_CLASS: Record<LineSpacing, { en: string; np: string }> = {
  normal: { en: 'leading-relaxed', np: 'leading-7' },
  relaxed: { en: 'leading-8', np: 'leading-9' },
};
export const MARGIN_CLASS: Record<Margin, string> = { compact: 'p-6 print:px-0', normal: 'p-10 print:px-4', wide: 'p-14 print:px-10' };
export const LOGO_CLASS: Record<LogoSize, string> = { sm: 'h-10', md: 'h-14', lg: 'h-20' };
