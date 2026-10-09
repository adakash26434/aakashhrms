// Training (G7): shared types for the register and the programme window.

export interface ProgramRow {
  id: string;
  title: string;
  provider: string;
  kind: string;
  kindName: string;
  startAd: string;
  endAd: string;
  hours: number;
  cost: number;
  bondMonths: number;
  note: string | null;
  status: 'planned' | 'running' | 'completed' | 'cancelled';
  nominated: number;
  completed: number;
}

export interface ParticipantRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branch: string;
  status: 'nominated' | 'attended' | 'absent' | 'completed';
  score: number | null;
  certificateNo: string | null;
  /** Last day of the service bond (completed participants of a bonded programme), else null. */
  bondEndsAd: string | null;
}

export interface ProgramDetail extends ProgramRow {
  participants: ParticipantRow[];
  next: string[];
}

export interface TrainingPageData {
  programs: ProgramRow[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { add: boolean; manage: boolean };
}
