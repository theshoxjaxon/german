/**
 * Integration tests: the real queries against a throw-away SQLite file.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { answer } from '../srs';
import type { CardDoc } from '../types';
import { hashPassword, temporaryPassword, verifyPassword } from './password';

const dir = mkdtempSync(path.join(tmpdir(), 'kk-test-'));
let repo: typeof import('./repo');

beforeAll(async () => {
  process.env.DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  process.env.JOIN_CODE = 'TEST42';
  repo = await import('./repo');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('Guten Tag 123');
    const b = await hashPassword('Guten Tag 123');
    expect(a).not.toBe(b); // different salts
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Guten Tag 123', a)).toBe(true);
    expect(await verifyPassword('guten tag 123', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
  it('makes readable temporary passwords', () => {
    expect(temporaryPassword()).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe('database', () => {
  const doc = (f: CardDoc['f']): CardDoc => ({ f, r: null, suspended: false, updatedAt: Date.now() });

  it('seeds the Lektion 3 words and the join code', async () => {
    expect(Object.keys(await repo.listWords())).toHaveLength(34);
    expect(await repo.getJoinCode()).toBe('TEST42');
  });

  it('makes the first profile the admin and later ones students', async () => {
    const teacher = await repo.createUser({ username: 'teacher', displayName: 'Ustoz', passwordHash: 'x' });
    const student = await repo.createUser({ username: 'malika', displayName: 'Malika K', passwordHash: 'x' });
    expect(teacher !== 'taken' && teacher.role).toBe('admin');
    expect(student !== 'taken' && student.role).toBe('student');
    expect(await repo.createUser({ username: 'malika', displayName: 'Other', passwordHash: 'x' })).toBe('taken');
  });

  it('stores only a hash of the session token and expires sessions', async () => {
    const user = (await repo.findUserByUsername('malika'))!;
    const { token } = await repo.createSession(user.id, 60_000);
    expect((await repo.findSession(token))?.user.username).toBe('malika');
    expect(await repo.findSession(token, Date.now() + 120_000)).toBeNull(); // expired
    await repo.deleteSession(token);
    expect(await repo.findSession(token)).toBeNull();
  });

  it('keeps progress per person and feeds the class and admin numbers', async () => {
    const malika = (await repo.findUserByUsername('malika'))!;
    const teacher = (await repo.findUserByUsername('teacher'))!;
    const t = Date.now();
    const s1 = answer(null, 'good', t);
    await repo.putCard(malika.id, 'l3-familie', doc(s1));
    await repo.putCard(malika.id, 'l3-familie', doc(answer(s1, 'good', t + 1000)));
    await repo.putCard(malika.id, 'l3-mutter', doc(answer(null, 'easy', t)));
    expect(await repo.putCard(malika.id, 'no-such-word', doc(s1))).toBe('no-word');

    expect(Object.keys(await repo.listCards(malika.id))).toEqual(expect.arrayContaining(['l3-familie', 'l3-mutter']));
    expect(await repo.listCards(teacher.id)).toEqual({}); // private per person

    const cls = await repo.classOverview(teacher.id);
    const m = cls.members.find((x) => x.username === 'malika')!;
    expect(m).toMatchObject({ activeWords: 2, answersToday: 3, studiedToday: true, streak: 1, isMe: false });

    const stats = await repo.adminStats();
    expect(stats.totals).toMatchObject({ profiles: 2, admins: 1, studiedToday: 1, openedToday: 2, activeWeek: 1, answersToday: 3 });
    expect(stats.studiedByDay.at(-1)).toBe(1);
    expect(stats.signupsByDay.at(-1)).toBe(2);
  });

  it('limits cheers to one per classmate per day', async () => {
    const malika = (await repo.findUserByUsername('malika'))!;
    const teacher = (await repo.findUserByUsername('teacher'))!;
    expect(await repo.sendCheer(teacher.id, malika.id, 'keep-going')).toBe('ok');
    expect(await repo.sendCheer(teacher.id, malika.id, 'great-streak')).toBe('already');
    expect(await repo.sendCheer(malika.id, malika.id, 'keep-going')).toBe('self');
    const inbox = await repo.unseenCheers(malika.id);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: 'keep-going', from: { username: 'teacher' } });
    await repo.markCheersSeen(malika.id);
    expect(await repo.unseenCheers(malika.id)).toHaveLength(0);
    expect((await repo.classOverview(teacher.id)).members.find((x) => x.username === 'malika')?.cheeredToday).toBe(true);
  });

  it('deletes a profile with everything that belongs to it', async () => {
    const malika = (await repo.findUserByUsername('malika'))!;
    await repo.deleteUser(malika.id);
    expect(await repo.findUserById(malika.id)).toBeNull();
    expect(await repo.listCards(malika.id)).toEqual({});
    expect((await repo.adminStats()).totals.profiles).toBe(1);
  });
});
