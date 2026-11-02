import { describe, expect, it } from 'vitest';
import { makeGroups, seeded, type Signup } from './match';
import { checkMessage } from './text';
import { ALL_SLOTS, deadline, dueWeek, isSlot, localTime, signupWeek, slotStart, weekEnd, weekOf, weekdayOf } from './week';

const TZ = 'Asia/Tashkent'; // UTC+5, no daylight saving
const at = (iso: string) => Date.parse(iso);

describe('study weeks and hours', () => {
  it('knows the weekday, the week and Tashkent time', () => {
    expect(weekdayOf('2026-11-02')).toBe(0); // Monday
    expect(weekdayOf('2026-11-08')).toBe(6); // Sunday
    expect(weekOf(at('2026-11-04T10:00:00Z'), TZ)).toBe('2026-11-02');
    // Sunday 23:30 in Tashkent is still the old week; Monday 00:30 is the new one
    expect(weekOf(at('2026-11-08T18:30:00Z'), TZ)).toBe('2026-11-02');
    expect(weekOf(at('2026-11-08T19:30:00Z'), TZ)).toBe('2026-11-09');
    expect(localTime('2026-11-09', 19, TZ)).toBe(at('2026-11-09T14:00:00Z'));
    expect(localTime('2026-03-30', 9, 'Europe/Berlin')).toBe(at('2026-03-30T07:00:00Z')); // summer time
    expect(localTime('2026-01-05', 9, 'Europe/Berlin')).toBe(at('2026-01-05T08:00:00Z'));
  });

  it('closes sign-ups on Sunday at 18:00 and moves on to the week after', () => {
    expect(deadline('2026-11-09', TZ)).toBe(at('2026-11-08T13:00:00Z'));
    expect(signupWeek(at('2026-11-08T12:59:00Z'), TZ)).toBe('2026-11-09');
    expect(signupWeek(at('2026-11-08T13:00:00Z'), TZ)).toBe('2026-11-16');
    expect(dueWeek(at('2026-11-08T12:59:00Z'), TZ)).toBe('2026-11-02');
    expect(dueWeek(at('2026-11-08T13:00:00Z'), TZ)).toBe('2026-11-09');
    expect(weekEnd('2026-11-09', TZ)).toBe(at('2026-11-15T19:00:00Z'));
  });

  it('numbers the hours of the grid', () => {
    expect(ALL_SLOTS).toHaveLength(7 * 14);
    expect(ALL_SLOTS[0]).toBe(8);
    expect(ALL_SLOTS.at(-1)).toBe(6 * 24 + 21);
    expect([8, 21, 24 + 8, 6 * 24 + 21].every(isSlot)).toBe(true);
    expect([7, 22, -1, 7 * 24 + 8, 1.5, '8'].some(isSlot)).toBe(false);
    expect(slotStart('2026-11-09', 24 + 19, TZ)).toBe(at('2026-11-10T14:00:00Z')); // Tuesday 19:00
  });
});

const su = (userId: string, ...slots: number[]): Signup => ({ userId, slots });
const none = () => false;

describe('making study groups', () => {
  it('makes groups of 3 who share an hour, with that hour first', () => {
    const r = makeGroups([su('a', 10, 11), su('b', 10, 11, 12), su('c', 11, 12), su('d', 40), su('e', 40, 41), su('f', 41, 40)], none, seeded(1));
    expect(r.unmatched).toEqual([]);
    expect(r.groups).toHaveLength(2);
    const byFirst = Object.fromEntries(r.groups.map((g) => [[...g.members].sort().join(''), g.slots]));
    expect(byFirst).toEqual({ abc: [11], def: [40] });
  });

  it('puts one left over into a group of 4, and pairs two left over', () => {
    const four = makeGroups([su('a', 9), su('b', 9), su('c', 9), su('d', 9)], none, seeded(2));
    expect(four.groups.map((g) => g.members.length)).toEqual([4]);
    const five = makeGroups([su('a', 9), su('b', 9), su('c', 9), su('d', 9), su('e', 9)], none, seeded(3));
    expect(five.groups.map((g) => g.members.length).sort()).toEqual([2, 3]);
  });

  it('never groups people without a shared hour, or who blocked each other', () => {
    const apart = makeGroups([su('a', 9), su('b', 10), su('c', 11)], none, seeded(4));
    expect(apart.groups).toEqual([]);
    expect(apart.unmatched.sort()).toEqual(['a', 'b', 'c']);
    const blocked = (x: string, y: string) => x === 'a' && y === 'b';
    for (let seed = 0; seed < 30; seed++) {
      const r = makeGroups([su('a', 9), su('b', 9), su('c', 9), su('d', 9)], blocked, seeded(seed));
      for (const g of r.groups) expect(g.members.includes('a') && g.members.includes('b')).toBe(false);
      for (const g of r.groups) expect(g.slots.length).toBeGreaterThan(0);
    }
  });

  it('is random, but the same seed gives the same groups', () => {
    const all = Array.from({ length: 9 }, (_, i) => su(`s${i}`, 9, 10));
    const one = makeGroups(all, none, seeded(7)).groups.map((g) => g.members);
    expect(makeGroups(all, none, seeded(7)).groups.map((g) => g.members)).toEqual(one);
    const seen = new Set(Array.from({ length: 10 }, (_, s) => JSON.stringify(makeGroups(all, none, seeded(s)).groups.map((g) => [...g.members].sort()))));
    expect(seen.size).toBeGreaterThan(1);
    expect(one.flat().sort()).toEqual(all.map((s) => s.userId).sort()); // everyone, once
  });

  it('ignores empty and repeated sign-ups', () => {
    const r = makeGroups([su('a'), su('b', 9), su('b', 9), su('c', 9)], none, seeded(5));
    expect(r.groups.map((g) => [...g.members].sort())).toEqual([['b', 'c']]);
  });
});

describe('study chat messages', () => {
  it('keeps plain text and tidies it', () => {
    expect(checkMessage('  Hallo!\r\n\n\n\nWann treffen wir uns? 19:00?  ')).toEqual({ ok: true, body: 'Hallo!\n\nWann treffen wir uns? 19:00?' });
    expect(checkMessage('Ich heiße\u0000 Malika\u202e')).toEqual({ ok: true, body: 'Ich heiße Malika' });
    expect(checkMessage('Am 12.11. um 18 Uhr, Raum 204')).toMatchObject({ ok: true });
  });

  it('refuses empty, too long, links, emails, phone numbers and usernames', () => {
    expect(checkMessage('   ')).toMatchObject({ ok: false });
    expect(checkMessage(42)).toMatchObject({ ok: false });
    expect(checkMessage('a'.repeat(501))).toMatchObject({ ok: false });
    expect(checkMessage('😀'.repeat(500))).toMatchObject({ ok: true }); // characters, not UTF-16 units
    for (const bad of ['see https://x.example', 'www.site.uz', 'join t.me/group', 'mysite.com', 'mail me a.b@mail.ru', 'call +998 90 123 45 67', '901234567', 'add me @malika_22']) {
      expect(checkMessage(bad), bad).toMatchObject({ ok: false });
    }
  });
});
