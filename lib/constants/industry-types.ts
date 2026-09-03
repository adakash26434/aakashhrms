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

export interface ShreniPresetItem {
  id: string;
  name: string;
  levelNumber?: number;
  category: IndustrySectorKey;
  description?: string;
}

export const INDUSTRY_SECTORS: Record<IndustrySectorKey, IndustrySectorMeta> = {
  BFIs: {
    id: "BFIs",
    label: "Banks & Financial Institutions",
    labelNepali: "बैंक तथा वित्तीय संस्था (तह १ देखि ११)",
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
    label: "Corporate, Commercial & Tech",
    labelNepali: "कम्पनी, व्यापार तथा निजी प्रतिष्ठान",
    shortLabel: "Corporate",
    description: "Private & Public limited enterprises, IT companies, Trading houses, and Consultancy firms.",
    iconName: "Briefcase",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  Healthcare: {
    id: "Healthcare",
    label: "Healthcare & Hospitals",
    labelNepali: "स्वास्थ्य, अस्पताल तथा क्लिनिक",
    shortLabel: "Healthcare",
    description: "Hospitals, Nursing Homes, Diagnostic Centers, and Pharmaceutical establishments.",
    iconName: "Hospital",
    badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
  },
  Education: {
    id: "Education",
    label: "Educational Institutions",
    labelNepali: "शैक्षिक संस्था (स्कूल तथा कलेज)",
    shortLabel: "Education",
    description: "Schools, Colleges, Universities, and Academic / Vocational training institutions.",
    iconName: "GraduationCap",
    badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  Manufacturing: {
    id: "Manufacturing",
    label: "Manufacturing, Industry & Construction",
    labelNepali: "उत्पादन, उद्योग तथा निर्माण",
    shortLabel: "Industry",
    description: "Factories, Production Plants, Hydropower, Mills, and Construction firms.",
    iconName: "Factory",
    badgeColor: "bg-orange-50 text-orange-800 border-orange-200",
  },
  Hospitality: {
    id: "Hospitality",
    label: "Hospitality & Tourism",
    labelNepali: "होटल, रिसोर्ट तथा पर्यटन",
    shortLabel: "Hospitality",
    description: "Hotels, Resorts, Travel agencies, Restaurants, and Tourism operators.",
    iconName: "Hotel",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
  },
  NGO_INGO: {
    id: "NGO_INGO",
    label: "NGOs, INGOs & Development Sector",
    labelNepali: "गैर-सरकारी तथा सामाजिक संस्था",
    shortLabel: "NGO / INGO",
    description: "Non-profit organizations, Community Development projects, and International Agencies.",
    iconName: "Globe2",
    badgeColor: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  Government: {
    id: "Government",
    label: "Government & Public Enterprises",
    labelNepali: "सरकारी तथा सार्वजनिक संस्थान",
    shortLabel: "Public / Sansthan",
    description: "Public Enterprises (संस्थान), Autonomous Boards, and Parastatal corporations.",
    iconName: "ShieldCheck",
    badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
  },
  General: {
    id: "General",
    label: "General / Unclassified Organization",
    labelNepali: "सामान्य / अन्य संस्था (अधिकतम तह १ देखि १२)",
    shortLabel: "General / Universal",
    description: "Unclassified or diversified organizations — equipped with the Maximum Universal 12-Tier Shreni Scale.",
    iconName: "Layers",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export const SHRENI_PRESETS_BY_SECTOR: Record<IndustrySectorKey, ShreniPresetItem[]> = {
  // 1. Banking & Financial Institutions (Level 1 to 11)
  BFIs: [
    { id: "BFI-L10", name: "Level 10-11: Executive / Management (तह १०-११: कार्यकारी)", levelNumber: 11, category: "BFIs", description: "CEO, DCEO, General Manager" },
    { id: "BFI-L8", name: "Level 8-9: Senior Manager / Manager (तह ८-९: व्यवस्थापक)", levelNumber: 9, category: "BFIs", description: "Department Head, Branch Manager" },
    { id: "BFI-L7", name: "Level 7: Deputy / Assistant Manager (तह ७: सहायक व्यवस्थापक)", levelNumber: 7, category: "BFIs", description: "Deputy Manager, Asst. Manager" },
    { id: "BFI-L6", name: "Level 6: Senior Officer / Officer (तह ६: अधिकृत)", levelNumber: 6, category: "BFIs", description: "Credit Officer, Operations Officer" },
    { id: "BFI-L5", name: "Level 5: Junior Officer / Supervisor (तह ५: कनिष्ठ अधिकृत)", levelNumber: 5, category: "BFIs", description: "Junior Officer, Supervisor" },
    { id: "BFI-L4", name: "Level 4: Senior Assistant (तह ४: वरिष्ठ सहायक)", levelNumber: 4, category: "BFIs", description: "Senior Assistant, Head Teller" },
    { id: "BFI-L3", name: "Level 3: Assistant / Junior Assistant (तह ३: सहायक)", levelNumber: 3, category: "BFIs", description: "Assistant, Teller, Trainee" },
    { id: "BFI-L1", name: "Level 1-2: Support Staff (तह १-२: सहयोगी तह)", levelNumber: 2, category: "BFIs", description: "Office Assistant, Driver, Messenger" },
  ],

  // 2. Cooperatives
  Cooperatives: [
    { id: "COOP-CEO", name: "व्यवस्थापक / मुख्य कार्यकारी (General Manager / CEO)", category: "Cooperatives", description: "प्रमुख कार्यकारी अधिकृत, व्यवस्थापक" },
    { id: "COOP-OFF", name: "अधिकृत तह (Officer — Accounts / Credit)", category: "Cooperatives", description: "लेखा अधिकृत, ऋण अधिकृत" },
    { id: "COOP-SRASST", name: "वरिष्ठ सहायक (Senior Assistant / Head Cashier)", category: "Cooperatives", description: "वरिष्ठ सहायक, क्यासियर" },
    { id: "COOP-ASST", name: "सहायक तह (Assistant / Loan Supervisor)", category: "Cooperatives", description: "सहायक, ऋण सुपरभाइजर" },
    { id: "COOP-JR", name: "कनिष्ठ सहायक / बजार प्रतिनिधि (Junior Assistant / Field Collector)", category: "Cooperatives", description: "कनिष्ठ सहायक, बजार प्रतिनिधि" },
    { id: "COOP-SUPP", name: "सहयोगी तह (Support Staff / Peon)", category: "Cooperatives", description: "सहयोगी, कार्यालय सहयोगी" },
  ],

  // 3. Corporate & Private Sector
  Corporate: [
    { id: "CORP-EXEC", name: "Executive / C-Suite (विशिष्ट / कार्यकारी: MD, Director, VP)", category: "Corporate", description: "Managing Director, Director, VP" },
    { id: "CORP-SRMGR", name: "Senior Management (वरिष्ठ व्यवस्थापन: GM, Senior Manager)", category: "Corporate", description: "General Manager, Senior Manager" },
    { id: "CORP-MIDMGR", name: "Middle Management (मध्यम व्यवस्थापन: Manager, Asst. Manager)", category: "Corporate", description: "Manager, Assistant Manager" },
    { id: "CORP-JROFF", name: "Junior Officer / Supervisory (कनिष्ठ अधिकृत / सुपरभाइजर)", category: "Corporate", description: "Team Lead, Junior Officer" },
    { id: "CORP-ASST", name: "Assistant / Operational (सहायक / परिचालन तह)", category: "Corporate", description: "Associate, Assistant, Trainee" },
    { id: "CORP-SUPP", name: "Support Staff (सहयोगी / सेवा तह)", category: "Corporate", description: "Office Assistant, Maintenance" },
  ],

  // 4. Healthcare & Hospitals
  Healthcare: [
    { id: "HLTH-DIR", name: "Medical Director / Hospital Administrator (मेडिकल डाइरेक्टर)", category: "Healthcare", description: "Chief Medical Officer, Administrator" },
    { id: "HLTH-CONS", name: "Senior Consultant / Specialist (वरिष्ठ कन्सल्टेन्ट / विशेषज्ञ)", category: "Healthcare", description: "MD/MS Specialist Doctor" },
    { id: "HLTH-MEDOFF", name: "Medical Officer / Registrar (मेडिकल अधिकृत / रजिस्ट्रार)", category: "Healthcare", description: "MBBS Resident / Medical Officer" },
    { id: "HLTH-MATRON", name: "Nursing Supervisor / Matron (नर्सिङ सुपरभाइजर)", category: "Healthcare", description: "In-charge Nurse, Nursing Head" },
    { id: "HLTH-STAFFNURSE", name: "Staff Nurse / Lab Technologist (स्टाफ नर्स / प्राविधिक)", category: "Healthcare", description: "BN/B.Sc Nurse, Senior Technologist" },
    { id: "HLTH-ASST", name: "ANM / Assistant / Pharmacist (एएनएम / फार्मेसिस्ट / सहायक)", category: "Healthcare", description: "ANM, CMA, Pharmacy Assistant" },
    { id: "HLTH-SUPP", name: "Hospital Support Staff / Ward Boy (अस्पताल सहयोगी / वार्ड ब्वाय)", category: "Healthcare", description: "Aaya, Ward Helper, Peon" },
  ],

  // 5. Educational Institutions
  Education: [
    { id: "EDU-PRIN", name: "Principal / Campus Chief (प्रिन्सिपल / क्याम्पस प्रमुख)", category: "Education", description: "Executive Academic Head" },
    { id: "EDU-VICE", name: "Vice Principal / Academic Coordinator (उप-प्रिन्सिपल)", category: "Education", description: "Vice Principal, Program Coordinator" },
    { id: "EDU-PROF", name: "Senior Faculty / Professor / PGT (वरिष्ठ प्राध्यापक / शिक्षक)", category: "Education", description: "Professor, Senior Lecturer" },
    { id: "EDU-LECT", name: "Lecturer / Secondary Teacher (मा.वि. शिक्षक / प्राध्यापक)", category: "Education", description: "Subject Teacher / Lecturer" },
    { id: "EDU-PRT", name: "Basic / Primary Teacher (प्रा.वि. / आ.वि. शिक्षक)", category: "Education", description: "Primary / Junior Teacher" },
    { id: "EDU-ADMIN", name: "Administrative / Lab Assistant (प्रशासनिक / ल्याब सहायक)", category: "Education", description: "Accountant, Lab Assistant" },
    { id: "EDU-SUPP", name: "School Support Staff / Helper (विद्यालय सहयोगी)", category: "Education", description: "Peon, Bus Helper, Caretaker" },
  ],

  // 6. Manufacturing, Industry & Construction
  Manufacturing: [
    { id: "MFG-PLANT", name: "Plant / Project Manager (आयोजना / प्लान्ट प्रबन्धक)", category: "Manufacturing", description: "Factory / Project Head" },
    { id: "MFG-ENG", name: "Production Engineer / Quality Head (इन्जिनियर / गुणस्तर प्रमुख)", category: "Manufacturing", description: "Mechanical/Electrical Engineer, QC Head" },
    { id: "MFG-SUP", name: "Shift Supervisor / Foreman (शिफ्ट सुपरभाइजर / फोरम्यान)", category: "Manufacturing", description: "Line Supervisor, Foreman" },
    { id: "MFG-TECH", name: "Senior Technician / Machinist (वरिष्ठ प्राविधिक)", category: "Manufacturing", description: "Senior Mechanic, Electrician" },
    { id: "MFG-OP", name: "Skilled Machine Operator (दक्ष मेसिन अपरेटर)", category: "Manufacturing", description: "Machine Operator, Driver" },
    { id: "MFG-SEMI", name: "Semi-Skilled / Helper (अर्ध-दक्ष / सहयोगी)", category: "Manufacturing", description: "Assembly Line Helper" },
    { id: "MFG-LABOR", name: "General Labor / Unskilled (सामान्य श्रमिक)", category: "Manufacturing", description: "Loading, Cleaning, General Labor" },
  ],

  // 7. Hospitality & Tourism
  Hospitality: [
    { id: "HOSP-GM", name: "General Manager / Resort Manager (महाप्रबन्धक)", category: "Hospitality", description: "Resort / Hotel General Manager" },
    { id: "HOSP-DEPT", name: "Department Head (F&B, Front Office, Executive Chef)", category: "Hospitality", description: "F&B Manager, Executive Chef" },
    { id: "HOSP-CAPT", name: "Supervisor / Restaurant Captain (सुपरभाइजर / क्याप्टेन)", category: "Hospitality", description: "Floor Supervisor, Captain" },
    { id: "HOSP-STAFF", name: "Senior Staff / Front Desk / Cook (वरिष्ठ कर्मचारी / सेफ)", category: "Hospitality", description: "Receptionist, Chef de Partie" },
    { id: "HOSP-ASST", name: "Associate / Steward / Housekeeper (सहयोगी कर्मचारी)", category: "Hospitality", description: "Waiter, Housekeeping Attendant" },
    { id: "HOSP-UTIL", name: "Utility Staff / Kitchen Helper (युटिलिटी / सहयोगी)", category: "Hospitality", description: "Dishwasher, Utility Helper" },
  ],

  // 8. NGOs & INGOs
  NGO_INGO: [
    { id: "NGO-DIR", name: "Country Director / Executive Director (कार्यकारी निर्देशक)", category: "NGO_INGO", description: "Country Director, Executive Head" },
    { id: "NGO-MGR", name: "Program Manager / Technical Lead (कार्यक्रम प्रबन्धक)", category: "NGO_INGO", description: "Program Manager, Thematic Lead" },
    { id: "NGO-OFF", name: "Project Officer / Coordinator (परियोजना अधिकृत)", category: "NGO_INGO", description: "Project Officer, M&E Officer" },
    { id: "NGO-FIELD", name: "Field Officer / Monitoring Officer (कार्यक्षेत्र अधिकृत)", category: "NGO_INGO", description: "Field Officer, District Coordinator" },
    { id: "NGO-ASST", name: "Finance / Admin Assistant (प्रशासन तथा वित्त सहायक)", category: "NGO_INGO", description: "Accounts Assistant, Admin Assistant" },
    { id: "NGO-MOB", name: "Community Mobilizer / Social Mobilizer (सामाजिक परिचालक)", category: "NGO_INGO", description: "Social Mobilizer, Field Assistant" },
    { id: "NGO-SUPP", name: "Support Staff / Driver (सहयोगी कर्मचारी / चालक)", category: "NGO_INGO", description: "Driver, Office Helper" },
  ],

  // 9. Government & Public Enterprises
  Government: [
    { id: "GOV-SPEC", name: "विशिष्ट श्रेणी (Special Class / Executive)", category: "Government", description: "Chief Secretary, Secretary" },
    { id: "GOV-S1", name: "प्रथम श्रेणी (First Class / Shreni 1 / Level 8-9)", category: "Government", description: "Joint Secretary / Director" },
    { id: "GOV-S2", name: "द्वितीय श्रेणी (Second Class / Shreni 2 / Level 7)", category: "Government", description: "Deputy Secretary / Under Secretary" },
    { id: "GOV-S3", name: "तृतीय श्रेणी (Third Class / Shreni 3 / Level 6)", category: "Government", description: "Section Officer / अधिकृत" },
    { id: "GOV-S4", name: "चतुर्थ श्रेणी (Fourth Class / Shreni 4 / Level 4-5)", category: "Government", description: "Nayab Subba / Senior Assistant" },
    { id: "GOV-S5", name: "पञ्चम श्रेणी (Fifth Class / Shreni 5 / Level 3)", category: "Government", description: "Kharidar / Assistant" },
    { id: "GOV-UNCAT", name: "श्रेणी विहीन (Uncategorized / Level 1-2)", category: "Government", description: "Support Staff, Helper" },
  ],

  // 10. General / Unclassified Organizations (MAXIMUM UNIVERSAL 12-TIER SCALE)
  General: [
    { id: "GEN-L12", name: "Level 12: Executive / Top Board (तह १२: विशिष्ट / शीर्ष व्यवस्थापन)", levelNumber: 12, category: "General", description: "CEO, Managing Director, Chairman" },
    { id: "GEN-L11", name: "Level 11: Chief Officer / Senior Director (तह ११: मुख्य अधिकृत)", levelNumber: 11, category: "General", description: "Chief Executive Officer, Senior Director" },
    { id: "GEN-L10", name: "Level 10: Director / Senior Management (तह १०: निर्देशक / वरिष्ठ व्यवस्थापन)", levelNumber: 10, category: "General", description: "Director, Division Head" },
    { id: "GEN-L9", name: "Level 9: Senior Manager / Head (तह ९: वरिष्ठ प्रबन्धक)", levelNumber: 9, category: "General", description: "Senior Manager, Department Head" },
    { id: "GEN-L8", name: "Level 8: Manager / Operations Lead (तह ८: प्रबन्धक)", levelNumber: 8, category: "General", description: "Manager, Assistant Director" },
    { id: "GEN-L7", name: "Level 7: Deputy / Assistant Manager (तह ७: सहायक प्रबन्धक)", levelNumber: 7, category: "General", description: "Deputy Manager, Asst. Manager" },
    { id: "GEN-L6", name: "Level 6: Senior Officer / Section Head (तह ६: वरिष्ठ अधिकृत)", levelNumber: 6, category: "General", description: "Senior Officer, Unit Lead" },
    { id: "GEN-L5", name: "Level 5: Officer / Specialist (तह ५: अधिकृत)", levelNumber: 5, category: "General", description: "Officer, Subject Specialist" },
    { id: "GEN-L4", name: "Level 4: Junior Officer / Supervisor (तह ४: कनिष्ठ अधिकृत)", levelNumber: 4, category: "General", description: "Junior Officer, Team Supervisor" },
    { id: "GEN-L3", name: "Level 3: Senior Assistant / Senior Associate (तह ३: वरिष्ठ सहायक)", levelNumber: 3, category: "General", description: "Senior Assistant, Senior Associate" },
    { id: "GEN-L2", name: "Level 2: Assistant / Associate / Trainee (तह २: सहायक)", levelNumber: 2, category: "General", description: "Assistant, Junior Associate, Trainee" },
    { id: "GEN-L1", name: "Level 1: Support Staff / Office Assistant (तह १: सहयोगी तह)", levelNumber: 1, category: "General", description: "Office Assistant, Support, Driver" },
  ],
};

/**
 * Returns the recommended presets for the specified industry sector,
 * falling back to the Maximum 12-Tier General scale if unclassified or undefined.
 */
export function getRecommendedShreniPresets(sector?: string | null): ShreniPresetItem[] {
  const key = (sector as IndustrySectorKey) || "General";
  return SHRENI_PRESETS_BY_SECTOR[key] || SHRENI_PRESETS_BY_SECTOR.General;
}

/**
 * Returns all presets across all sectors flat-mapped.
 */
export function getAllShreniPresets(): ShreniPresetItem[] {
  const items: ShreniPresetItem[] = [];
  (Object.keys(SHRENI_PRESETS_BY_SECTOR) as IndustrySectorKey[]).forEach((key) => {
    items.push(...SHRENI_PRESETS_BY_SECTOR[key]);
  });
  return items;
}
