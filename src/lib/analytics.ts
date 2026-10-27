/**
 * The numbers behind /admin/analytics, computed from plain rows so they can be tested without a
 * database. Definitions follow the product deck:
 *
 * - North Star: words mastered per week. A word is mastered the first time one of its review
 *   gaps reaches 21 days.
 * - Inputs: active learners, study days per learner, new words started, recall rate.
 * - Funnel ("voronka"): Visit → Try → Join for guests, then Start → Return → Habit for new profiles.
 * - Retention: of the people who joined in a week, the share who studied in each later week.
 *
 * A "week" is a rolling block of 7 days ending today (not Monday–Sunday), so this week and last
 * week always have the same length. Only students count: teachers (admins) testing the app
 * would blur the picture. Days are 'YYYY-MM-DD' in the center's time zone.
 */
import { lastDays, shiftDay } from './stats';

export const WEEKS = 12;
export const START_ANSWERS = 20; // a real first session
export const HABIT_DAYS = 3; // study days in one week
export const COHORTS = 8;

export type Period = '30' | '90' | 'all';
export const PERIODS: { value: Period; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
];
export const parsePeriod = (v: unknown): Period => (v === '30' || v === 'all' ? v : '90');

export interface AnalyticsInput {
  today: string;
  students: { id: string; joinedDay: string }[];
  /** One row per student and day with at least one answer. */
  study: { userId: string; day: string; answers: number; newCards: number; reviews: number; recalled: number }[];
  /** The day each word was mastered (by a student). */
  mastered: { userId: string; day: string }[];
  masteredTotal: number;
  /** The day of each cheer a student sent. */
  cheerDays: string[];
  /** Browsers that opened the app without a profile. */
  visitors: { firstDay: string; lastDay: string; triedDay: string | null; joinedDay: string | null }[];
  /** First day anonymous visits were counted (null: none yet). */
  visitorsSince: string | null;
}

export interface Week {
  start: string;
  end: string;
}

export interface FunnelStep {
  key: string;
  label: string;
  definition: string;
  count: number;
  /** What the step converts from (the previous step, or its eligible part); null for the first step. */
  base: number | null;
  rate: number | null; // count / base
}

export interface Analytics {
  today: string;
  period: Period;
  periodStart: string | null; // null: all time
  users: {
    students: number;
    newThisWeek: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    stickiness: number | null; // average daily actives over 30 days ÷ monthly actives
    visitorsWeek: number; // browsers without a profile that opened the app in 7 days
  };
  weeks: Week[]; // oldest first; the last one ends today
  northStar: { perWeek: number[]; learnersThisWeek: number; total: number };
  inputs: {
    activeLearners: number[];
    studyDays: (number | null)[]; // per active learner
    newWords: number[];
    recallRate: (number | null)[];
  };
  health: {
    answersPerStudyDay: (number | null)[];
    cheersPerLearner: (number | null)[];
    reviews: number[];
  };
  funnel: {
    guests: FunnelStep[];
    learners: FunnelStep[];
    joinedDirectly: number; // made a profile without trying as a guest first
    stillNew: number; // joined less than 2 weeks ago: can't have returned yet
    visitorsSince: string | null;
    biggestDrop: { from: string; to: string; rate: number } | null;
  };
  cohorts: { start: string; end: string; size: number; weeks: ({ rate: number; complete: boolean } | null)[] }[];
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);
const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

export function computeAnalytics(input: AnalyticsInput, period: Period): Analytics {
  const { today } = input;
  const weeks: Week[] = Array.from({ length: WEEKS }, (_, i) => {
    const end = shiftDay(today, -7 * (WEEKS - 1 - i));
    return { start: shiftDay(end, -6), end };
  });
  const weekOf = (day: string) => weeks.findIndex((w) => inRange(day, w.start, w.end));

  // Study days per student
  const studyDays = new Map<string, Set<string>>();
  const answersOn = new Map<string, number>(); // `${id}|${day}`
  for (const r of input.study) {
    if (r.answers <= 0) continue;
    let s = studyDays.get(r.userId);
    if (!s) studyDays.set(r.userId, (s = new Set()));
    s.add(r.day);
    answersOn.set(`${r.userId}|${r.day}`, r.answers);
  }
  const studiedIn = (id: string, from: string, to: string) => {
    const s = studyDays.get(id);
    if (!s) return 0;
    let n = 0;
    for (const d of s) if (inRange(d, from, to)) n++;
    return n;
  };
  const activeIn = (from: string, to: string) => input.students.filter((s) => studiedIn(s.id, from, to) > 0).length;
  const activeToday = input.students.filter((s) => studyDays.get(s.id)?.has(today)).length;

  /* ---------- users ---------- */
  const week0 = shiftDay(today, -6);
  const month0 = shiftDay(today, -29);
  const activeMonth = activeIn(month0, today);
  const dailyActives = lastDays(today, 30).map((d) => input.students.filter((s) => studyDays.get(s.id)?.has(d)).length);
  const users = {
    students: input.students.length,
    newThisWeek: input.students.filter((s) => s.joinedDay >= week0).length,
    activeToday,
    activeWeek: activeIn(week0, today),
    activeMonth,
    stickiness: ratio(dailyActives.reduce((a, b) => a + b, 0) / 30, activeMonth),
    visitorsWeek: input.visitors.filter((v) => v.lastDay >= week0 && !v.joinedDay).length,
  };

  /* ---------- weekly series ---------- */
  const zero = () => weeks.map(() => 0);
  const learners = weeks.map(() => new Set<string>());
  const studyDayCount = zero();
  const answers = zero();
  const newWords = zero();
  const reviews = zero();
  const recalled = zero();
  for (const r of input.study) {
    const w = weekOf(r.day);
    if (w < 0) continue;
    if (r.answers > 0) {
      learners[w].add(r.userId);
      studyDayCount[w]++;
    }
    answers[w] += r.answers;
    newWords[w] += r.newCards;
    reviews[w] += r.reviews;
    recalled[w] += r.recalled;
  }
  const activeLearners = learners.map((s) => s.size);
  const perWeek = zero();
  const masteredBy = new Set<string>();
  for (const m of input.mastered) {
    const w = weekOf(m.day);
    if (w < 0) continue;
    perWeek[w]++;
    if (w === WEEKS - 1) masteredBy.add(m.userId);
  }
  const cheers = zero();
  for (const d of input.cheerDays) {
    const w = weekOf(d);
    if (w >= 0) cheers[w]++;
  }

  /* ---------- funnel ---------- */
  const periodStart = period === 'all' ? null : shiftDay(today, -(Number(period) - 1));
  const inPeriod = (day: string) => periodStart === null || day >= periodStart;

  const visitors = input.visitors.filter((v) => inPeriod(v.firstDay));
  const tried = visitors.filter((v) => v.triedDay);
  const joinedAfterTrying = tried.filter(
    (v) => v.joinedDay && v.joinedDay >= v.triedDay! && v.joinedDay <= shiftDay(v.triedDay!, 7),
  ).length;
  const guests: FunnelStep[] = [
    { key: 'visit', label: 'Visit', definition: 'Opened the app without a profile', count: visitors.length, base: null, rate: null },
    { key: 'try', label: 'Try', definition: 'Answered a first card as a guest', count: tried.length, base: visitors.length, rate: ratio(tried.length, visitors.length) },
    { key: 'join-guest', label: 'Join', definition: 'Made a profile within 7 days of trying', count: joinedAfterTrying, base: tried.length, rate: ratio(joinedAfterTrying, tried.length) },
  ];

  const cohort = input.students.filter((s) => inPeriod(s.joinedDay));
  const matureDay = shiftDay(today, -14); // joined on or before this day: their second week is over
  const started = cohort.filter((s) => (answersOn.get(`${s.id}|${s.joinedDay}`) ?? 0) >= START_ANSWERS);
  const startedMature = started.filter((s) => s.joinedDay <= matureDay);
  const returned = startedMature.filter((s) => studiedIn(s.id, shiftDay(s.joinedDay, 7), shiftDay(s.joinedDay, 13)) > 0);
  const habit = returned.filter((s) => {
    // Any 7-day block after the first week with 3+ study days
    for (let from = shiftDay(s.joinedDay, 7); from <= today; from = shiftDay(from, 7)) {
      if (studiedIn(s.id, from, shiftDay(from, 6)) >= HABIT_DAYS) return true;
    }
    return false;
  });
  const learnerSteps: FunnelStep[] = [
    { key: 'join', label: 'Join', definition: 'New profiles', count: cohort.length, base: null, rate: null },
    { key: 'start', label: 'Start', definition: `${START_ANSWERS}+ answers on their first day`, count: started.length, base: cohort.length, rate: ratio(started.length, cohort.length) },
    { key: 'return', label: 'Return', definition: 'Studied again in their second week', count: returned.length, base: startedMature.length, rate: ratio(returned.length, startedMature.length) },
    { key: 'habit', label: 'Habit', definition: `${HABIT_DAYS}+ study days in a week, after week one`, count: habit.length, base: returned.length, rate: ratio(habit.length, returned.length) },
  ];

  // Where most people are lost. Tiny bases (1–2 people) say nothing, so they don't qualify.
  let biggestDrop: Analytics['funnel']['biggestDrop'] = null;
  for (const steps of [guests, learnerSteps]) {
    for (let i = 1; i < steps.length; i++) {
      const { rate, base, label } = steps[i];
      if (rate === null || (base ?? 0) < 3) continue;
      if (!biggestDrop || rate < biggestDrop.rate) biggestDrop = { from: steps[i - 1].label, to: label, rate };
    }
  }

  /* ---------- retention cohorts ---------- */
  const cohorts: Analytics['cohorts'] = [];
  for (let c = COHORTS - 1; c >= 0; c--) {
    const end = shiftDay(today, -7 * c);
    const start = shiftDay(end, -6);
    const members = input.students.filter((s) => inRange(s.joinedDay, start, end));
    const cells = Array.from({ length: COHORTS }, (_, k) => {
      // Week k has begun for everyone once the latest joiner reaches it
      if (!members.length || shiftDay(end, 7 * k) > today) return null;
      const active = members.filter((s) => studiedIn(s.id, shiftDay(s.joinedDay, 7 * k), shiftDay(s.joinedDay, 7 * k + 6)) > 0).length;
      return { rate: active / members.length, complete: shiftDay(end, 7 * k + 6) <= today };
    });
    cohorts.push({ start, end, size: members.length, weeks: cells });
  }

  return {
    today,
    period,
    periodStart,
    users,
    weeks,
    northStar: { perWeek, learnersThisWeek: masteredBy.size, total: input.masteredTotal },
    inputs: {
      activeLearners,
      studyDays: studyDayCount.map((n, w) => ratio(n, activeLearners[w])),
      newWords,
      recallRate: recalled.map((n, w) => ratio(n, reviews[w])),
    },
    health: {
      answersPerStudyDay: answers.map((n, w) => ratio(n, studyDayCount[w])),
      cheersPerLearner: cheers.map((n, w) => ratio(n, activeLearners[w])),
      reviews,
    },
    funnel: {
      guests,
      learners: learnerSteps,
      joinedDirectly: visitors.filter((v) => v.joinedDay && !v.triedDay).length,
      stillNew: started.length - startedMature.length,
      visitorsSince: input.visitorsSince,
      biggestDrop,
    },
    cohorts,
  };
}
