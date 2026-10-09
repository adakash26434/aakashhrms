// Recruitment & darbandi (G4): shared types for the positions and vacancies tabs.

export interface PositionListRow {
  id: string;
  designationId: string;
  designation: string;
  branchId: string;
  branch: string;
  positions: number;
  filled: number;
  vacant: number;
  over: number;
  decisionRef: string;
  note: string | null;
  isActive: boolean;
}

export interface VacancyListRow {
  id: string;
  designationId: string;
  designation: string;
  branchId: string;
  branch: string;
  openings: number;
  deadlineAd: string | null;
  note: string | null;
  status: 'open' | 'closed' | 'cancelled';
  applicantCount: number;
  selectedCount: number;
}

export interface ApplicantView {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  educationNote: string | null;
  stage: string;
  stageName: string;
  stageNameNp: string;
  examMarks: number | null;
  interviewMarks: number | null;
  total: number | null;
  rank: number | null;
  note: string | null;
  employeeId: string | null;
}

export interface RecruitmentPageData {
  positions: PositionListRow[];
  vacancies: VacancyListRow[];
  designations: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  permissions: { manage: boolean };
}
