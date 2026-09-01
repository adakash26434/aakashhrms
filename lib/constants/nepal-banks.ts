export interface NepalBank {
  id: string;
  name: string;
  shortName: string;
  category: "Class A - Commercial Bank" | "Class B - Development Bank" | "Class C - Finance Company" | "Central / Infrastructure Bank";
  swiftCode?: string;
  code?: string;
}

export const NEPAL_BANKS: NepalBank[] = [
  // ---------------------------------------------------------------------------
  // CLASS 'A' COMMERCIAL BANKS (20 Licensed Banks)
  // ---------------------------------------------------------------------------
  { id: "nabil", name: "Nabil Bank Limited", shortName: "Nabil Bank", category: "Class A - Commercial Bank", swiftCode: "NARBNPKA", code: "01" },
  { id: "global-ime", name: "Global IME Bank Limited", shortName: "Global IME Bank", category: "Class A - Commercial Bank", swiftCode: "GIMEGB22", code: "02" },
  { id: "nic-asia", name: "NIC Asia Bank Limited", shortName: "NIC Asia Bank", category: "Class A - Commercial Bank", swiftCode: "NICA0001", code: "03" },
  { id: "everest", name: "Everest Bank Limited", shortName: "Everest Bank", category: "Class A - Commercial Bank", swiftCode: "EVBLNPKA", code: "04" },
  { id: "standard-chartered", name: "Standard Chartered Bank Nepal Limited", shortName: "Standard Chartered Bank", category: "Class A - Commercial Bank", swiftCode: "SCBLNPKA", code: "05" },
  { id: "rastriya-banijya", name: "Rastriya Banijya Bank Limited", shortName: "Rastriya Banijya Bank", category: "Class A - Commercial Bank", swiftCode: "RBBLLPKA", code: "06" },
  { id: "agrimarket", name: "Agricultural Development Bank Limited", shortName: "ADBL / Agricultural Development Bank", category: "Class A - Commercial Bank", swiftCode: "ADBLNPKA", code: "07" },
  { id: "nepal-bank", name: "Nepal Bank Limited", shortName: "Nepal Bank", category: "Class A - Commercial Bank", swiftCode: "NEBLNPKA", code: "08" },
  { id: "nmb", name: "NMB Bank Limited", shortName: "NMB Bank", category: "Class A - Commercial Bank", swiftCode: "NMBBNPKA", code: "09" },
  { id: "prabhu", name: "Prabhu Bank Limited", shortName: "Prabhu Bank", category: "Class A - Commercial Bank", swiftCode: "PRBUNPKA", code: "10" },
  { id: "sanima", name: "Sanima Bank Limited", shortName: "Sanima Bank", category: "Class A - Commercial Bank", swiftCode: "SANINPKA", code: "11" },
  { id: "machhapuchchre", name: "Machhapuchchhre Bank Limited", shortName: "Machhapuchchhre Bank", category: "Class A - Commercial Bank", swiftCode: "MBLENPKA", code: "12" },
  { id: "kumari", name: "Kumari Bank Limited", shortName: "Kumari Bank", category: "Class A - Commercial Bank", swiftCode: "KMBLNPKA", code: "13" },
  { id: "prime", name: "Prime Commercial Bank Limited", shortName: "Prime Commercial Bank", category: "Class A - Commercial Bank", swiftCode: "PCBLNPKA", code: "14" },
  { id: "citizens", name: "Citizens Bank International Limited", shortName: "Citizens Bank", category: "Class A - Commercial Bank", swiftCode: "CTZNINPK", code: "15" },
  { id: "siddhartha", name: "Siddhartha Bank Limited", shortName: "Siddhartha Bank", category: "Class A - Commercial Bank", swiftCode: "SDBLNPKA", code: "16" },
  { id: "laxmi-sunrise", name: "Laxmi Sunrise Bank Limited", shortName: "Laxmi Sunrise Bank", category: "Class A - Commercial Bank", swiftCode: "LXBLNPKA", code: "17" },
  { id: "himalayan", name: "Himalayan Bank Limited", shortName: "Himalayan Bank", category: "Class A - Commercial Bank", swiftCode: "HIMANPKA", code: "18" },
  { id: "nepal-investment-mega", name: "Nepal Investment Mega Bank Limited", shortName: "Nepal Investment Mega Bank", category: "Class A - Commercial Bank", swiftCode: "NIBLNPKA", code: "19" },
  { id: "nepal-sbi", name: "Nepal SBI Bank Limited", shortName: "Nepal SBI Bank", category: "Class A - Commercial Bank", swiftCode: "NSBINPKA", code: "20" },

  // ---------------------------------------------------------------------------
  // CLASS 'B' DEVELOPMENT BANKS
  // ---------------------------------------------------------------------------
  { id: "garima", name: "Garima Bikas Bank Limited", shortName: "Garima Bikas Bank", category: "Class B - Development Bank", swiftCode: "GRMBNPKA" },
  { id: "muktinath", name: "Muktinath Bikas Bank Limited", shortName: "Muktinath Bikas Bank", category: "Class B - Development Bank", swiftCode: "MUKTNPKA" },
  { id: "jyoti", name: "Jyoti Bikas Bank Limited", shortName: "Jyoti Bikas Bank", category: "Class B - Development Bank", swiftCode: "JYOTNPKA" },
  { id: "shine-resunga", name: "Shine Resunga Development Bank Limited", shortName: "Shine Resunga Bikas Bank", category: "Class B - Development Bank", swiftCode: "SRDBNPKA" },
  { id: "mahalaxmi", name: "Mahalaxmi Bikas Bank Limited", shortName: "Mahalaxmi Bikas Bank", category: "Class B - Development Bank", swiftCode: "MLBLNPKA" },
  { id: "shangrila", name: "Shangri-la Development Bank Limited", shortName: "Shangri-la Development Bank", category: "Class B - Development Bank", swiftCode: "SHNDNPKA" },
  { id: "kamana-sewa", name: "Kamana Sewa Bikas Bank Limited", shortName: "Kamana Sewa Bikas Bank", category: "Class B - Development Bank", swiftCode: "KSMBNPKA" },
  { id: "miteri", name: "Miteri Development Bank Limited", shortName: "Miteri Development Bank", category: "Class B - Development Bank" },
  { id: "corporate", name: "Corporate Development Bank Limited", shortName: "Corporate Development Bank", category: "Class B - Development Bank" },
  { id: "green", name: "Green Development Bank Limited", shortName: "Green Development Bank", category: "Class B - Development Bank" },
  { id: "sindhu", name: "Sindhu Bikash Bank Limited", shortName: "Sindhu Bikash Bank", category: "Class B - Development Bank" },
  { id: "salapa", name: "Salapa Bikas Bank Limited", shortName: "Salapa Bikas Bank", category: "Class B - Development Bank" },

  // ---------------------------------------------------------------------------
  // CLASS 'C' FINANCE COMPANIES
  // ---------------------------------------------------------------------------
  { id: "manjushree", name: "Manjushree Finance Limited", shortName: "Manjushree Finance", category: "Class C - Finance Company" },
  { id: "icfc", name: "ICFC Finance Limited", shortName: "ICFC Finance", category: "Class C - Finance Company" },
  { id: "goodwill", name: "Goodwill Finance Limited", shortName: "Goodwill Finance", category: "Class C - Finance Company" },
  { id: "pokhara", name: "Pokhara Finance Limited", shortName: "Pokhara Finance", category: "Class C - Finance Company" },
  { id: "reliance", name: "Reliance Finance Limited", shortName: "Reliance Finance", category: "Class C - Finance Company" },
  { id: "gurkhas", name: "Gurkhas Finance Limited", shortName: "Gurkhas Finance", category: "Class C - Finance Company" },
  { id: "janaki", name: "Janaki Finance Limited", shortName: "Janaki Finance", category: "Class C - Finance Company" },
  { id: "central", name: "Central Finance Limited", shortName: "Central Finance", category: "Class C - Finance Company" },
  { id: "progressive", name: "Progressive Finance Limited", shortName: "Progressive Finance", category: "Class C - Finance Company" },
  { id: "multipurpose", name: "Multipurpose Finance Limited", shortName: "Multipurpose Finance", category: "Class C - Finance Company" },
  { id: "samriddhi", name: "Samriddhi Finance Company Limited", shortName: "Samriddhi Finance", category: "Class C - Finance Company" },

  // ---------------------------------------------------------------------------
  // SPECIALIZED & CENTRAL FINANCIAL INSTITUTIONS
  // ---------------------------------------------------------------------------
  { id: "nrb", name: "Nepal Rastra Bank (Central Bank of Nepal)", shortName: "Nepal Rastra Bank", category: "Central / Infrastructure Bank", swiftCode: "NRBNNPKA" },
  { id: "nibd", name: "Nepal Infrastructure Bank Limited (NIFRA)", shortName: "NIFRA / Infrastructure Bank", category: "Central / Infrastructure Bank" },
];

export function findBankByName(query: string): NepalBank | undefined {
  if (!query) return undefined;
  const clean = query.trim().toLowerCase();
  return NEPAL_BANKS.find(
    (b) =>
      b.name.toLowerCase() === clean ||
      b.shortName.toLowerCase() === clean ||
      b.id === clean
  );
}
