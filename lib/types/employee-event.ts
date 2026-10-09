// Employee lifecycle events (G2): shared types for the register and the New event window.

export interface EventListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  kind: string;
  kindName: string;
  kindNameNp: string;
  change: string;
  effectiveDateAd: string; // YYYY-MM-DD
  effectiveDateBs: string;
  reason: string | null;
  status: 'scheduled' | 'applied' | 'cancelled';
  letterId: string | null;
  createdByName: string;
  cancelReason: string | null;
}

export interface EventOption {
  id: string;
  name: string;
}

export interface EventsPageData {
  events: EventListRow[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  designations: EventOption[];
  branches: EventOption[];
  departments: EventOption[];
  scheduled: number;
  permissions: { add: boolean; cancel: boolean; issueLetter: boolean };
}

export interface CreateEventResult {
  event: EventListRow;
  letterId: string | null;
  /** The event saved but its letter could not be issued (e.g. template inactive). */
  letterWarning: string | null;
}
