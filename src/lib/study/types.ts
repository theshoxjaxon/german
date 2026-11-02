/** What the study-together API sends to the browser. Never a user id or an email: members are a name and a per-group key. */

export const REPORT_REASONS = ['rude', 'bullying', 'spam', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REASON_LABEL: Record<ReportReason, string> = {
  rude: 'Rude or mean',
  bullying: 'Bullying',
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  other: 'Something else',
};
export const isReason = (v: unknown): v is ReportReason => REPORT_REASONS.includes(v as ReportReason);

export interface StudyTask {
  prompt: string; // in the language studied
  cards: string[];
}

export interface StudyMember {
  key: string; // stable within the group only
  name: string;
  avatarUrl: string | null;
  me: boolean;
  left: boolean;
}

export interface StudyGroupView {
  id: string;
  week: string;
  slot: number | null; // the suggested hour (the earliest everyone shares)
  slots: number[]; // every hour they share
  task: StudyTask;
  members: StudyMember[];
  unread: number;
  open: boolean; // false once its week is over: read-only until it is deleted
  deleteAt: number;
}

export interface StudyMessage {
  id: number;
  key: string; // the author's member key
  body: string;
  at: number;
  mine: boolean;
}

export interface StudyClub {
  id: string;
  startsAt: number;
  place: string;
  going: number;
  me: boolean;
}

export interface StudyState {
  timeZone: string;
  eligible: boolean; // students on the class board; teachers plan speaking clubs instead
  week: string; // the week you sign up for now
  deadline: number; // when sign-ups for `week` close
  slots: number[] | null; // your free hours for `week`; null = not signed up
  groups: StudyGroupView[];
  /** The last week whose groups were made, if you had signed up for it and got no group. */
  noGroup: string | null;
  clubs: StudyClub[];
}

/** For teachers (/admin/study): counts only, never who or what was written. */
export interface StudyAdminView {
  timeZone: string;
  week: string; // the week sign-ups are open for
  deadline: number;
  heat: Record<number, number>; // slot → how many are free then
  signups: number;
  thisWeek: { week: string; signups: number; groups: number; grouped: number };
  clubs: StudyClub[];
  reports: { id: string; at: number; reporter: string; reported: string; reason: ReportReason }[];
}
