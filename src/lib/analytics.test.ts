import { describe, expect, it } from 'vitest';
import { computeAnalytics, parsePeriod, type AnalyticsInput } from './analytics';

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`; // October 2026
const row = (userId: string, d: number, answers: number, extra: Partial<AnalyticsInput['study'][number]> = {}) => ({
  userId, day: day(d), answers, newCards: 0, reviews: 0, recalled: 0, ...extra,
});

// Today is 27 October. "This week" is 21–27 Oct, "last week" 14–20 Oct.
const input: AnalyticsInput = {
  today: day(27),
  students: [
    { id: 'a', joinedDay: day(1) }, // strong start, came back, built a habit
    { id: 'b', joinedDay: day(2) }, // weak first day
    { id: 'd', joinedDay: day(5) }, // good first day, never came back
    { id: 'c', joinedDay: day(20) }, // good first day, too new to have returned
  ],
  study: [
    row('a', 1, 25, { newCards: 10 }),
    row('a', 8, 12), row('a', 9, 15), row('a', 10, 9), // second week: three study days
    row('a', 27, 30, { reviews: 4, recalled: 3 }),
    row('b', 2, 5),
    row('d', 5, 20),
    row('c', 20, 30, { newCards: 10 }),
    row('c', 22, 10, { newCards: 5 }),
  ],
  mastered: [{ userId: 'a', day: day(18) }, { userId: 'a', day: day(25) }, { userId: 'a', day: day(27) }],
  masteredTotal: 7,
  cheerDays: [day(27), day(26)],
  visitors: [
    { firstDay: day(3), lastDay: day(4), triedDay: day(3), joinedDay: day(5) }, // tried, joined 2 days later
    { firstDay: day(6), lastDay: day(20), triedDay: day(6), joinedDay: day(20) }, // joined, but 14 days after trying
    { firstDay: day(10), lastDay: day(10), triedDay: day(10), joinedDay: null },
    { firstDay: day(11), lastDay: day(11), triedDay: null, joinedDay: day(11) }, // signed up straight away
    { firstDay: day(24), lastDay: day(26), triedDay: null, joinedDay: null }, // only looked, this week
  ],
  visitorsSince: day(3),
};

describe('analytics', () => {
  const a = computeAnalytics(input, '90');

  it('uses rolling 7-day weeks ending today', () => {
    expect(a.weeks).toHaveLength(12);
    expect(a.weeks.at(-1)).toEqual({ start: day(21), end: day(27) });
    expect(a.weeks.at(-2)).toEqual({ start: day(14), end: day(20) });
  });

  it('counts users', () => {
    expect(a.users).toMatchObject({ students: 4, newThisWeek: 0, activeToday: 1, activeWeek: 2, activeMonth: 4, visitorsWeek: 1 });
  });

  it('counts words mastered per week (the North Star)', () => {
    expect(a.northStar.perWeek.slice(-2)).toEqual([1, 2]);
    expect(a.northStar).toMatchObject({ learnersThisWeek: 1, total: 7 });
  });

  it('computes the input metrics and health checks for this week', () => {
    expect(a.inputs.activeLearners.at(-1)).toBe(2);
    expect(a.inputs.studyDays.at(-1)).toBe(1); // 2 study days ÷ 2 learners
    expect(a.inputs.newWords.at(-1)).toBe(5);
    expect(a.inputs.recallRate.at(-1)).toBe(0.75);
    expect(a.inputs.recallRate[0]).toBeNull(); // no reviews: no rate, not 0 %
    expect(a.health.answersPerStudyDay.at(-1)).toBe(20); // (30 + 10) ÷ 2
    expect(a.health.cheersPerLearner.at(-1)).toBe(1);
  });

  it('builds the guest funnel: Visit → Try → Join within 7 days', () => {
    expect(a.funnel.guests.map((s) => s.count)).toEqual([5, 3, 1]);
    expect(a.funnel.guests[2].rate).toBeCloseTo(1 / 3);
    expect(a.funnel.joinedDirectly).toBe(1);
  });

  it('builds the learner funnel, leaving out people too new to have returned', () => {
    expect(a.funnel.learners.map((s) => [s.key, s.count, s.base])).toEqual([
      ['join', 4, null],
      ['start', 3, 4],
      ['return', 1, 2], // c started but joined 7 days ago
      ['habit', 1, 1],
    ]);
    expect(a.funnel.stillNew).toBe(1);
  });

  it('names the biggest drop, ignoring steps with fewer than 3 people', () => {
    expect(a.funnel.biggestDrop).toEqual({ from: 'Try', to: 'Join', rate: 1 / 3 });
  });

  it('limits the funnel to the chosen period', () => {
    expect(computeAnalytics(input, '30').periodStart).toBe('2026-09-28');
    const later = computeAnalytics({ ...input, today: '2026-11-15' }, '30'); // 17 Oct – 15 Nov: only c joined
    expect(later.funnel.learners[0].count).toBe(1);
    expect(computeAnalytics(input, 'all').periodStart).toBeNull();
  });

  it('builds weekly retention cohorts', () => {
    const c = a.cohorts.find((x) => x.start === '2026-09-30')!; // joined 30 Sep – 6 Oct: a, b, d
    expect(c).toMatchObject({ end: day(6), size: 3 });
    expect(c.weeks[0]).toEqual({ rate: 1, complete: true }); // everyone studied in their first week
    expect(c.weeks[1]!.rate).toBeCloseTo(1 / 3); // only a came back
    const newest = a.cohorts.at(-1)!;
    expect(newest.size).toBe(0);
    expect(newest.weeks[0]).toBeNull();
  });

  it('defaults to 90 days for unknown periods', () => {
    expect(parsePeriod('30')).toBe('30');
    expect(parsePeriod('all')).toBe('all');
    expect(parsePeriod('7; DROP TABLE')).toBe('90');
    expect(parsePeriod(undefined)).toBe('90');
  });
});
