// Notice board (G14): shared types.

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  audience: 'company' | 'branch' | 'department' | 'employees';
  audienceLabel: string; // "Whole company", the branch / department name, or "3 employees"
  branchId: string | null;
  departmentId: string | null;
  recipients: { id: string; name: string }[];
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
  status: 'draft' | 'published' | 'withdrawn';
  authorName: string;
}

export interface NoticesPageData {
  notices: NoticeRow[];
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { add: boolean; manage: boolean; withdraw: boolean };
}

/** What Home shows: title, body, audience and date — nothing else. */
export interface BoardNotice {
  id: string;
  title: string;
  body: string;
  /** Who it was addressed to, for the reader: null = whole company. */
  branch: string | null;
  publishAd: string;
  pinned: boolean;
}
