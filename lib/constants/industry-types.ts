import {
  Landmark,
  Building2,
  Briefcase,
  Hospital,
  GraduationCap,
  Factory,
  Hotel,
  Globe2,
  ShieldCheck,
  Layers,
  LucideIcon,
} from "lucide-react";

export type IndustrySectorKey =
  | "BFIs"
  | "Cooperatives"
  | "Corporate"
  | "Healthcare"
  | "Education"
  | "Manufacturing"
  | "Hospitality"
  | "NGO_INGO"
  | "Government"
  | "General";

export interface IndustrySectorMeta {
  id: IndustrySectorKey;
  label: string;
  labelNepali: string;
  shortLabel: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export interface ShreniLevelItem {
  id: string; // e.g. "S1"
  code: string; // e.g. "S1"
  name: string; // e.g. "S1 — Level 1"
  levelNumber: number; // 1
  labelNepali: string; // "तह १ (सहयोगी तह)"
  description?: string; // "Entry / Support Level"
  category?: string;
  minSalary?: number;
  maxSalary?: number;
}

export type ShreniPresetItem = ShreniLevelItem;

export const INDUSTRY_SECTORS: Record<IndustrySectorKey, IndustrySectorMeta> = {
  BFIs: {
    id: "BFIs",
    label: "Banks & Financial Institutions",
    labelNepali: "बैंक तथा वित्तीय संस्था",
    shortLabel: "BFIs / Bank",
    description: "Commercial Banks (Class A), Development Banks (Class B), Finance (Class C), and Microfinance (Class D) regulated by NRB.",
    iconName: "Landmark",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Cooperatives: {
    id: "Cooperatives",
    label: "Cooperatives (Saving & Multipurpose)",
    labelNepali: "सहकारी संस्था (बचत, ऋण तथा बहुउद्देश्यीय)",
    shortLabel: "Cooperative",
    description: "Saving & Credit Cooperatives (साकोस), Agricultural and Multipurpose cooperatives under Cooperative Act 2074.",
    iconName: "Building2",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
  },
  Corporate: {
    id: "Corporate",
    label: "Corporate & Private Enterprise",
    labelNepali: "निजी तथा कर्पोरेट प्रतिष्ठान",
    shortLabel: "Corporate",
    description: "Public and Private Limited companies, Trading houses, Tech firms, and Commercial holding enterprises.",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  Healthcare: {
    id: "Healthcare",
    label: "Healthcare, Hospitals & Pharmaceuticals",
    labelNepali: "स्वास्थ्य, अस्पताल तथा पोलिक्लिनिक",
    shortLabel: "Healthcare",
    description: "Hospitals, Nursing Homes, Diagnostic centers, Polyclinics, and Pharmaceutical laboratories.",
    iconName: "Hospital",
    badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
  },
  Education: {
    id: "Education",
    label: "Educational Institutions & Universities",
    labelNepali: "शैक्षिक संस्था, क्याम्पस तथा विद्यालय",
    shortLabel: "Education",
    description: "Colleges, Universities, Higher Secondary, and Primary schools under Ministry of Education.",
    iconName: "GraduationCap",
    badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  Manufacturing: {
    id: "Manufacturing",
    label: "Manufacturing, FMCG & Heavy Industry",
    labelNepali: "उद्योग, उत्पादन तथा निर्माण",
    shortLabel: "Manufacturing",
    description: "Factories, Production plants, FMCG manufacturers, and Infrastructure construction contractors.",
    iconName: "Factory",
    badgeColor: "bg-orange-50 text-orange-800 border-orange-200",
  },
  Hospitality: {
    id: "Hospitality",
    label: "Hospitality, Hotels & Tourism",
    labelNepali: "होटल, रिसोर्ट तथा पर्यटन",
    shortLabel: "Hospitality",
    description: "Star Hotels, Resorts, Banquet centers, Airlines, Travel agencies, and Restaurant chains.",
    iconName: "Hotel",
    badgeColor: "bg-amber-50 text-amber-900 border-amber-300",
  },
  NGO_INGO: {
    id: "NGO_INGO",
    label: "NGOs, INGOs & Development Sector",
    labelNepali: "गैर-सरकारी संस्था तथा विकास साझेदार",
    shortLabel: "NGO / INGO",
    description: "Non-Governmental Organizations and International NGOs registered under Social Welfare Council.",
    iconName: "Globe2",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
  },
  Government: {
    id: "Government",
    label: "Public Corporations & Semi-Govt Bodies",
    labelNepali: "सार्वजनिक संस्थान तथा स्वायत्त निकाय",
    shortLabel: "Public Enterprise",
    description: "Public Corporations, Autonomous Boards, Municipal Undertakings, and Regulated Public Entities.",
    iconName: "ShieldCheck",
    badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
  },
  General: {
    id: "General",
    label: "General / Unclassified Organization",
    labelNepali: "सामान्य / अन्य संस्था",
    shortLabel: "General / Universal",
    description: "Diversified, commercial, or unclassified organizations operating across Nepal.",
    iconName: "Layers",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

/**
 * Canonical Universal Shreni Level Scale (S1 to S15).
 * Shreni represents the grade/tier/level in an organization,
 * while the role/title is cleanly governed by Designation.
 */
export const STANDARD_SHRENI_LEVELS: ShreniLevelItem[] = [
  {
    id: "S1",
    code: "S1",
    name: "S1 — Level 1",
    levelNumber: 1,
    labelNepali: "तह १ (सहयोगी तह)",
    description: "Entry / Support / Operational Level",
    category: "General",
  },
  {
    id: "S2",
    code: "S2",
    name: "S2 — Level 2",
    levelNumber: 2,
    labelNepali: "तह २ (कनिष्ठ सहायक)",
    description: "Junior Assistant / Trainee Level",
    category: "General",
  },
  {
    id: "S3",
    code: "S3",
    name: "S3 — Level 3",
    levelNumber: 3,
    labelNepali: "तह ३ (सहायक तह)",
    description: "Assistant Level",
    category: "General",
  },
  {
    id: "S4",
    code: "S4",
    name: "S4 — Level 4",
    levelNumber: 4,
    labelNepali: "तह ४ (वरिष्ठ सहायक)",
    description: "Senior Assistant Level",
    category: "General",
  },
  {
    id: "S5",
    code: "S5",
    name: "S5 — Level 5",
    levelNumber: 5,
    labelNepali: "तह ५ (सुपरभाइजर / कनिष्ठ अधिकृत)",
    description: "Supervisor / Junior Officer Level",
    category: "General",
  },
  {
    id: "S6",
    code: "S6",
    name: "S6 — Level 6",
    levelNumber: 6,
    labelNepali: "तह ६ (अधिकृत तह)",
    description: "Officer Level",
    category: "General",
  },
  {
    id: "S7",
    code: "S7",
    name: "S7 — Level 7",
    levelNumber: 7,
    labelNepali: "तह ७ (वरिष्ठ अधिकृत)",
    description: "Senior Officer Level",
    category: "General",
  },
  {
    id: "S8",
    code: "S8",
    name: "S8 — Level 8",
    levelNumber: 8,
    labelNepali: "तह ८ (सहायक प्रबन्धक)",
    description: "Assistant Manager Level",
    category: "General",
  },
  {
    id: "S9",
    code: "S9",
    name: "S9 — Level 9",
    levelNumber: 9,
    labelNepali: "तह ९ (उप-प्रबन्धक)",
    description: "Deputy Manager Level",
    category: "General",
  },
  {
    id: "S10",
    code: "S10",
    name: "S10 — Level 10",
    levelNumber: 10,
    labelNepali: "तह १० (प्रबन्धक)",
    description: "Manager Level",
    category: "General",
  },
  {
    id: "S11",
    code: "S11",
    name: "S11 — Level 11",
    levelNumber: 11,
    labelNepali: "तह ११ (वरिष्ठ प्रबन्धक / निर्देशक)",
    description: "Senior Manager / Director Level",
    category: "General",
  },
  {
    id: "S12",
    code: "S12",
    name: "S12 — Level 12",
    levelNumber: 12,
    labelNepali: "तह १२ (कार्यकारी / महाप्रबन्धक)",
    description: "Executive / General Manager Level",
    category: "General",
  },
  {
    id: "S13",
    code: "S13",
    name: "S13 — Level 13",
    levelNumber: 13,
    labelNepali: "तह १३ (उप-कार्यकारी प्रमुख)",
    description: "Deputy Executive / Division Head",
    category: "General",
  },
  {
    id: "S14",
    code: "S14",
    name: "S14 — Level 14",
    levelNumber: 14,
    labelNepali: "तह १४ (कार्यकारी निर्देशक)",
    description: "Executive Director / VP Level",
    category: "General",
  },
  {
    id: "S15",
    code: "S15",
    name: "S15 — Level 15",
    levelNumber: 15,
    labelNepali: "तह १५ (प्रमुख कार्यकारी अधिकृत)",
    description: "Chief Executive Officer / C-Suite Apex",
    category: "General",
  },
];

/**
 * Returns the canonical Universal Shreni Levels (S1 to S15).
 */
export function getStandardShreniLevels(): ShreniLevelItem[] {
  return STANDARD_SHRENI_LEVELS;
}

/**
 * Banking & Financial Institutions (BFI) Scale — 15 Levels
 */
export const BFI_SHRENI_PRESET: ShreniLevelItem[] = [
  { id: "B1", code: "L1", name: "Level 1 — Junior Assistant", levelNumber: 1, labelNepali: "तह १ (कनिष्ठ सहायक)", description: "Entry Level Operations / Trainee Support", category: "BFIs" },
  { id: "B2", code: "L2", name: "Level 2 — Assistant", levelNumber: 2, labelNepali: "तह २ (सहायक)", description: "Teller / Customer Care / Operational Assistant", category: "BFIs" },
  { id: "B3", code: "L3", name: "Level 3 — Senior Assistant", levelNumber: 3, labelNepali: "तह ३ (वरिष्ठ सहायक)", description: "Senior Teller / Account Specialist", category: "BFIs" },
  { id: "B4", code: "L4", name: "Level 4 — Supervisor", levelNumber: 4, labelNepali: "तह ४ (सुपरभाइजर)", description: "Branch Service Supervisor / Clearing Lead", category: "BFIs" },
  { id: "B5", code: "L5", name: "Level 5 — Junior Officer", levelNumber: 5, labelNepali: "तह ५ (कनिष्ठ अधिकृत)", description: "Credit / Trade Finance / Junior Relationship Manager", category: "BFIs" },
  { id: "B6", code: "L6", name: "Level 6 — Officer", levelNumber: 6, labelNepali: "तह ६ (अधिकृत)", description: "Relationship Manager / Compliance Officer", category: "BFIs" },
  { id: "B7", code: "L7", name: "Level 7 — Senior Officer", levelNumber: 7, labelNepali: "तह ७ (वरिष्ठ अधिकृत)", description: "Branch Manager (Class C) / Central Operations Lead", category: "BFIs" },
  { id: "B8", code: "L8", name: "Level 8 — Assistant Manager", levelNumber: 8, labelNepali: "तह ८ (सहायक प्रबन्धक)", description: "Branch Manager (Class B) / Unit Head", category: "BFIs" },
  { id: "B9", code: "L9", name: "Level 9 — Deputy Manager", levelNumber: 9, labelNepali: "तह ९ (उप-प्रबन्धक)", description: "Provincial Credit Head / Branch Manager (Main)", category: "BFIs" },
  { id: "B10", code: "L10", name: "Level 10 — Manager", levelNumber: 10, labelNepali: "तह १० (प्रबन्धक)", description: "Department Head / Corporate Branch Manager", category: "BFIs" },
  { id: "B11", code: "L11", name: "Level 11 — Senior Manager", levelNumber: 11, labelNepali: "तह ११ (वरिष्ठ प्रबन्धक)", description: "Province Head / Chief Risk Officer", category: "BFIs" },
  { id: "B12", code: "L12", name: "Level 12 — Chief Manager", levelNumber: 12, labelNepali: "तह १२ (मुख्य प्रबन्धक)", description: "Division Head / Senior Vice President", category: "BFIs" },
  { id: "B13", code: "L13", name: "Level 13 — Assistant General Manager (AGM)", levelNumber: 13, labelNepali: "तह १३ (सहायक महाप्रबन्धक)", description: "Apex Management / Division Executive", category: "BFIs" },
  { id: "B14", code: "L14", name: "Level 14 — Deputy General Manager (DGM)", levelNumber: 14, labelNepali: "तह १४ (नायब महाप्रबन्धक)", description: "Second-in-Command / Executive Leadership", category: "BFIs" },
  { id: "B15", code: "L15", name: "Level 15 — Chief Executive Officer (CEO)", levelNumber: 15, labelNepali: "तह १५ (प्रमुख कार्यकारी अधिकृत)", description: "Apex Executive Head of Organization", category: "BFIs" },
];

/**
 * Nepal Public Corporation / Sansthan Scale (तह १ देखि १२)
 */
export const SANSTHAN_SHRENI_PRESET: ShreniLevelItem[] = [
  { id: "S1", code: "T1", name: "तह १ — कार्यालय सहयोगी", levelNumber: 1, labelNepali: "तह १ (कार्यालय सहयोगी)", description: "Support & Utility Staff", category: "Government" },
  { id: "S2", code: "T2", name: "तह २ — कनिष्ठ सहायक", levelNumber: 2, labelNepali: "तह २ (कनिष्ठ सहायक)", description: "Junior Assistant / Technical Helper", category: "Government" },
  { id: "S3", code: "T3", name: "तह ३ — सहायक", levelNumber: 3, labelNepali: "तह ३ (सहायक)", description: "Assistant (Non-Gazetted)", category: "Government" },
  { id: "S4", code: "T4", name: "तह ४ — वरिष्ठ सहायक", levelNumber: 4, labelNepali: "तह ४ (वरिष्ठ सहायक)", description: "Senior Assistant (Non-Gazetted 1st)", category: "Government" },
  { id: "S5", code: "T5", name: "तह ५ — मुख्य सहायक", levelNumber: 5, labelNepali: "तह ५ (मुख्य सहायक / सुपरभाइजर)", description: "Chief Assistant / Supervisor", category: "Government" },
  { id: "S6", code: "T6", name: "तह ६ — अधिकृत", levelNumber: 6, labelNepali: "तह ६ (अधिकृत - राजपत्रांकित तृतीय)", description: "Officer (Gazetted 3rd / Entry Officer)", category: "Government" },
  { id: "S7", code: "T7", name: "तह ७ — वरिष्ठ अधिकृत", levelNumber: 7, labelNepali: "तह ७ (वरिष्ठ अधिकृत)", description: "Senior Officer", category: "Government" },
  { id: "S8", code: "T8", name: "तह ८ — सहायक निर्देशक", levelNumber: 8, labelNepali: "तह ८ (सहायक निर्देशक / उप-प्रबन्धक)", description: "Assistant Director / Deputy Manager", category: "Government" },
  { id: "S9", code: "T9", name: "तह ९ — उपनिर्देशक", levelNumber: 9, labelNepali: "तह ९ (उपनिर्देशक / प्रबन्धक)", description: "Deputy Director / Manager (Gazetted 2nd)", category: "Government" },
  { id: "S10", code: "T10", name: "तह १० — निर्देशक", levelNumber: 10, labelNepali: "तह १० (निर्देशक / वरिष्ठ प्रबन्धक)", description: "Director / Joint Director (Gazetted 1st)", category: "Government" },
  { id: "S11", code: "T11", name: "तह ११ — वरिष्ठ निर्देशक", levelNumber: 11, labelNepali: "तह ११ (वरिष्ठ निर्देशक / नायब महाप्रबन्धक)", description: "Senior Director / Deputy General Manager", category: "Government" },
  { id: "S12", code: "T12", name: "तह १२ — महाप्रबन्धक", levelNumber: 12, labelNepali: "तह १२ (कार्यकारी निर्देशक / महाप्रबन्धक)", description: "Executive Director / Managing Director", category: "Government" },
];

/**
 * Corporate & Tech Enterprise Scale (10 Levels)
 */
export const CORPORATE_SHRENI_PRESET: ShreniLevelItem[] = [
  { id: "C1", code: "L1", name: "Level 1 — Associate / Support", levelNumber: 1, labelNepali: "तह १ (सहयोगी)", description: "Entry Associate & Operational Support", category: "Corporate" },
  { id: "C2", code: "L2", name: "Level 2 — Junior Specialist / Executive", levelNumber: 2, labelNepali: "तह २ (कनिष्ठ अधिकृत)", description: "Junior Developer / Operations Executive", category: "Corporate" },
  { id: "C3", code: "L3", name: "Level 3 — Specialist / Mid-Level", levelNumber: 3, labelNepali: "तह ३ (अधिकृत)", description: "Independent Contributor / Mid Engineer", category: "Corporate" },
  { id: "C4", code: "L4", name: "Level 4 — Senior Specialist", levelNumber: 4, labelNepali: "तह ४ (वरिष्ठ अधिकृत)", description: "Senior Engineer / Senior Functional Executive", category: "Corporate" },
  { id: "C5", code: "L5", name: "Level 5 — Team Lead / Assistant Manager", levelNumber: 5, labelNepali: "तह ५ (टोली प्रमुख)", description: "Module Lead / Assistant Manager", category: "Corporate" },
  { id: "C6", code: "L6", name: "Level 6 — Manager / Staff Specialist", levelNumber: 6, labelNepali: "तह ६ (प्रबन्धक)", description: "Department Manager / Technical Architect", category: "Corporate" },
  { id: "C7", code: "L7", name: "Level 7 — Senior Manager / Principal", levelNumber: 7, labelNepali: "तह ७ (वरिष्ठ प्रबन्धक)", description: "Practice Lead / Principal Specialist", category: "Corporate" },
  { id: "C8", code: "L8", name: "Level 8 — Associate Director / Head", levelNumber: 8, labelNepali: "तह ८ (विभागीय प्रमुख)", description: "Head of Function / Associate Director", category: "Corporate" },
  { id: "C9", code: "L9", name: "Level 9 — Director / Vice President", levelNumber: 9, labelNepali: "तह ९ (निर्देशक)", description: "Strategic Business Unit Head / VP", category: "Corporate" },
  { id: "C10", code: "L10", name: "Level 10 — Executive / C-Suite", levelNumber: 10, labelNepali: "तह १० (कार्यकारी प्रमुख)", description: "Managing Director / CXO Apex", category: "Corporate" },
];

/**
 * NGO / INGO Development Sector Scale (Band 1 to Band 7)
 */
export const NGO_SHRENI_PRESET: ShreniLevelItem[] = [
  { id: "N1", code: "B1", name: "Band 1 — Support Staff", levelNumber: 1, labelNepali: "ब्यान्ड १ (सहायक कर्मचारी)", description: "Logistics, Driver & Office Assistant", category: "NGO_INGO" },
  { id: "N2", code: "B2", name: "Band 2 — Program Assistant", levelNumber: 2, labelNepali: "ब्यान्ड २ (कार्यक्रम सहायक)", description: "Field Assistant / Admin Assistant", category: "NGO_INGO" },
  { id: "N3", code: "B3", name: "Band 3 — Program Officer", levelNumber: 3, labelNepali: "ब्यान्ड ३ (कार्यक्रम अधिकृत)", description: "District Officer / MEAL Officer", category: "NGO_INGO" },
  { id: "N4", code: "B4", name: "Band 4 — Senior Officer / Specialist", levelNumber: 4, labelNepali: "ब्यान्ड ४ (वरिष्ठ अधिकृत)", description: "Thematic Specialist / Senior Program Officer", category: "NGO_INGO" },
  { id: "N5", code: "B5", name: "Band 5 — Project Manager / Coordinator", levelNumber: 5, labelNepali: "ब्यान्ड ५ (आयोजना प्रबन्धक)", description: "Project Coordinator / Regional Lead", category: "NGO_INGO" },
  { id: "N6", code: "B6", name: "Band 6 — Head of Programs", levelNumber: 6, labelNepali: "ब्यान्ड ६ (विभाग प्रमुख)", description: "Head of Operations / Program Director", category: "NGO_INGO" },
  { id: "N7", code: "B7", name: "Band 7 — Country Representative", levelNumber: 7, labelNepali: "ब्यान्ड ७ (देशीय निर्देशक)", description: "Country Director / Representative", category: "NGO_INGO" },
];

export interface IndustryPresetTemplate {
  key: string;
  name: string;
  nameNepali: string;
  description: string;
  levelCount: number;
  levels: ShreniLevelItem[];
}

export const INDUSTRY_PRESET_TEMPLATES: IndustryPresetTemplate[] = [
  {
    key: "universal",
    name: "Universal Canonical Scale (S1 to S15)",
    nameNepali: "सार्वभौमिक तह संरचना (S1 देखि S15)",
    description: "Standard 15-tier progression suitable for cross-industry and enterprise payroll.",
    levelCount: 15,
    levels: STANDARD_SHRENI_LEVELS,
  },
  {
    key: "bfi",
    name: "BFI / Banking Industry Scale (15 Levels)",
    nameNepali: "बैंक तथा वित्तीय संस्था तह संरचना (१५ तह)",
    description: "Standard hierarchy for Commercial, Development Banks & Finance companies in Nepal.",
    levelCount: 15,
    levels: BFI_SHRENI_PRESET,
  },
  {
    key: "sansthan",
    name: "Nepal Public Enterprise / Sansthan (तह १ देखि १२)",
    nameNepali: "सार्वजनिक संस्थान / सरकारी निकाय (तह १ देखि १२)",
    description: "Civil & Public Corporation scale with non-gazetted (तह १-५) and gazetted (तह ६-१२).",
    levelCount: 12,
    levels: SANSTHAN_SHRENI_PRESET,
  },
  {
    key: "corporate",
    name: "Corporate & Tech Enterprise (10 Levels)",
    nameNepali: "कर्पोरेट तथा सूचना प्रविधि प्रतिष्ठान (१० तह)",
    description: "Clean 10-level hierarchy from Junior Associate to C-Suite Executives.",
    levelCount: 10,
    levels: CORPORATE_SHRENI_PRESET,
  },
  {
    key: "ngo",
    name: "NGO / INGO Band Scale (Bands 1 to 7)",
    nameNepali: "गैर-सरकारी संस्था ब्यान्ड संरचना (ब्यान्ड १ देखि ७)",
    description: "Social Welfare Council & INGO standard thematic bands from Support to Country Director.",
    levelCount: 7,
    levels: NGO_SHRENI_PRESET,
  },
];

export function getPresetLevels(presetKey: string): ShreniLevelItem[] {
  const match = INDUSTRY_PRESET_TEMPLATES.find((t) => t.key.toLowerCase() === presetKey.toLowerCase());
  return match ? match.levels : STANDARD_SHRENI_LEVELS;
}

/**
 * Backward-compatible helper for code importing getRecommendedShreniPresets.
 */
export function getRecommendedShreniPresets(sector?: string | null): ShreniPresetItem[] {
  return STANDARD_SHRENI_LEVELS;
}

/**
 * Backward-compatible helper for code importing getAllShreniPresets.
 */
export function getAllShreniPresets(): ShreniPresetItem[] {
  return STANDARD_SHRENI_LEVELS;
}

export const SHRENI_PRESETS_BY_SECTOR: Record<IndustrySectorKey, ShreniPresetItem[]> = {
  BFIs: STANDARD_SHRENI_LEVELS,
  Cooperatives: STANDARD_SHRENI_LEVELS,
  Corporate: STANDARD_SHRENI_LEVELS,
  Healthcare: STANDARD_SHRENI_LEVELS,
  Education: STANDARD_SHRENI_LEVELS,
  Manufacturing: STANDARD_SHRENI_LEVELS,
  Hospitality: STANDARD_SHRENI_LEVELS,
  NGO_INGO: STANDARD_SHRENI_LEVELS,
  Government: STANDARD_SHRENI_LEVELS,
  General: STANDARD_SHRENI_LEVELS,
};

