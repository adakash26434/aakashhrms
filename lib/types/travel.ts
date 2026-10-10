// TA-DA (G11): shared types.

export interface RateCardRow {
  id: string;
  name: string;
  designationId: string | null;
  designation: string | null;
  dailyAllowance: number;
  lodgingPerNight: number;
  kmRate: number;
  isActive: boolean;
}

export interface ClaimRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  purpose: string;
  fromPlace: string;
  toPlace: string;
  startAd: string;
  endAd: string;
  mode: string;
  modeName: string;
  km: number;
  nights: number;
  fareActual: number;
  lodgingActual: number;
  advance: number;
  rateName: string;
  days: number;
  dailyAllowance: number;
  lodging: number;
  travel: number;
  gross: number;
  payable: number;
  note: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'settled';
  decisionNote: string | null;
  decidedByName: string | null;
  createdByName: string;
}

export interface TravelPageData {
  claims: ClaimRow[];
  rates: RateCardRow[];
  designations: { id: string; name: string }[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { add: boolean; manage: boolean; approve: boolean; settle: boolean };
}
