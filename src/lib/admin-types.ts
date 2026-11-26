/** What the teachers' dashboard shows. Built by the API (backend/), drawn by the web app (components/admin). */
import type { Role } from './types';

export interface AdminStats {
  today: string;
  timeZone: string;
  totals: {
    profiles: number; // members of the course
    admins: number; // its teachers (admins teach every course)
    newThisWeek: number;
    studiedToday: number; // daily active (answered at least one card)
    openedToday: number; // opened the app today
    activeWeek: number; // studied in the last 7 days
    activeMonth: number; // studied in the last 30 days
    answersToday: number;
  };
  days: string[]; // last 30 days, oldest first
  studiedByDay: number[];
  openedOnlyByDay: number[];
  signupsByDay: number[];
  people: {
    id: string;
    email: string; // '' for profiles from before sign-in by email, and always for teachers who aren't admins
    displayName: string;
    avatarUrl: string | null;
    hasGoogle: boolean;
    hasPassword: boolean;
    role: Role; // 'admin': runs the whole app
    teacher: boolean; // teaches this course (admins too)
    inClass: boolean; // on this course's leaderboard
    createdAt: number;
    joinedDay: string; // joined this course: 'YYYY-MM-DD' in the center's time zone
    lastSeenAt: number | null;
    streak: number;
    activeWords: number;
    matureWords: number;
    answersWeek: number;
    studiedToday: boolean;
  }[];
  classLesson: string | null; // the lesson the class is on
  decks: { deck: string; words: number }[]; // the shared decks, for picking it
}

/** One line of the Telegram set-up check: what is fine, and how to fix what is not. */
export interface CheckLine {
  ok: boolean;
  label: string;
  fix?: string;
}
