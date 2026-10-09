// Notice board (G14): shared types.

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  branchId: string | null;
  branch: string | null;
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
  status: 'draft' | 'published' | 'withdrawn';
  authorName: string;
}

export interface NoticesPageData {
  notices: NoticeRow[];
  branches: { id: string; name: string }[];
  permissions: { add: boolean; manage: boolean; withdraw: boolean };
}

/** What Home shows: title, body, audience and date — nothing else. */
export interface BoardNotice {
  id: string;
  title: string;
  body: string;
  branch: string | null;
  publishAd: string;
  pinned: boolean;
}
