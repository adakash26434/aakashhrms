// Assets (G14): shared types for the register and the asset window.

export interface AssetRow {
  id: string;
  tag: string;
  name: string;
  category: string;
  categoryName: string;
  branchId: string | null;
  branch: string | null;
  note: string | null;
  status: 'available' | 'issued' | 'retired';
  holderId: string | null;
  holderName: string | null;
  holderCode: string | null;
  issuedAd: string | null;
}

export interface HandoverRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  issuedAd: string;
  returnedAd: string | null;
  condition: string | null;
  note: string | null;
}

export interface AssetDetail extends AssetRow {
  handovers: HandoverRow[];
}

export interface AssetsPageData {
  assets: AssetRow[];
  branches: { id: string; name: string }[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { add: boolean; manage: boolean };
}
