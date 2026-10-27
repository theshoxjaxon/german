/**
 * Integration tests: the real queries against a real Postgres.
 *
 * By default that is PGlite, Postgres compiled to WebAssembly, running in memory: nothing to
 * install. To run them against a Postgres server instead, set TEST_DATABASE_URL to an EMPTY
 * database you can throw away (the tests create tables and users in it).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { answer } from '../srs';
import type { CardDoc, WordData } from '../types';
import { hashPassword, temporaryPassword, verifyPassword } from './password';

let repo: typeof import('./repo');
let close = async () => {};

beforeAll(async () => {
  process.env.JOIN_CODE = 'TEST42';
  const db = await import('./db');
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    const { PGlite, types } = await import('@electric-sql/pglite');
    const pg = await PGlite.create({ parsers: { [types.INT8]: Number, [types.NUMERIC]: Number } });
    close = () => pg.close();
    db.setDatabase({
      async query<R extends Record<string, unknown>>(text: string, params?: unknown[]) {
        const r = params?.length ? await pg.query<R>(text, params) : ((await pg.exec(text)).at(-1) as { rows: R[]; affectedRows?: number } | undefined);
        const rows = (r?.rows ?? []) as R[];
        return { rows, rowCount: Math.max(r?.affectedRows ?? 0, rows.length) };
      },
    });
  }
  repo = await import('./repo');
}, 60_000); // PGlite (Postgres in WebAssembly) can take a while to boot on a busy machine
afterAll(() => close());

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

  it('seeds the built-in lists (Lektion 3 and 5) and the join code', async () => {
    const words = Object.values(await repo.listWords(null));
    expect(words.filter((w) => w.deck === 'Lektion 3')).toHaveLength(34);
    expect(words.filter((w) => w.deck === 'Lektion 5')).toHaveLength(59);
    expect(words).toHaveLength(93);
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

  it('adds guest progress to a profile without overwriting what is there', async () => {
    const created = await repo.createUser({ username: 'guest_now', displayName: 'Dilnoza', passwordHash: 'x' });
    if (created === 'taken') throw new Error('taken');
    const t = Date.now();
    const mine = doc(answer(null, 'easy', t));
    await repo.putCard(created.id, 'l3-mutter', mine);
    const guest = {
      'l3-mutter': doc(answer(null, 'again', t)), // already studied in the profile: keep the profile's
      'l3-vater': doc(answer(answer(null, 'good', t - 60_000), 'good', t)),
      'no-such-word': doc(answer(null, 'good', t)),
    };
    expect(await repo.importCards(created.id, guest, { newPerDay: 5 })).toBe(1);
    const cards = await repo.listCards(created.id);
    expect(Object.keys(cards).sort()).toEqual(['l3-mutter', 'l3-vater']);
    expect(cards['l3-mutter'].f?.log.at(-1)?.r).toBe('easy');
    expect((await repo.getPrefs(created.id)).newPerDay).toBe(5);
    const me = (await repo.classOverview(created.id)).members.find((m) => m.isMe)!;
    expect(me).toMatchObject({ activeWords: 2, answersToday: 3, studiedToday: true });
    // Importing again changes nothing.
    expect(await repo.importCards(created.id, guest)).toBe(0);
    await repo.deleteUser(created.id);
  });

  it('keeps each person’s own words private and only lets the owner change them', async () => {
    const aziz = await repo.createUser({ username: 'aziz', displayName: 'Aziz', passwordHash: 'x' });
    const malika = (await repo.findUserByUsername('malika'))!;
    const teacher = (await repo.findUserByUsername('teacher'))!;
    if (aziz === 'taken') throw new Error('taken');
    const word = (term: string): WordData => ({
      term, meaning: 'vokzal', pos: 'noun', pronunciation: '', forms: '', example: '', exampleTr: '', mnemonic: '', notes: '',
      tags: [], deck: 'My words', order: 0, createdAt: 1, updatedAt: 1,
    });

    expect(await repo.saveWord(repo.ownerFor(malika), 'm-bahnhof', word('der Bahnhof'))).toBe('ok');
    const mine = await repo.listWords(malika.id);
    expect(mine['m-bahnhof']).toMatchObject({ term: 'der Bahnhof', personal: true });
    expect(mine['l3-familie'].personal).toBeUndefined(); // shared words stay shared
    expect(Object.keys(mine)).toHaveLength(94);
    expect((await repo.listWords(aziz.id))['m-bahnhof']).toBeUndefined(); // others don't see it
    expect((await repo.listWords(teacher.id))['m-bahnhof']).toBeUndefined(); // not even the admin
    expect((await repo.listWords(null))['m-bahnhof']).toBeUndefined(); // nor guests

    // Nobody else can change, delete or study it; students can't change lesson words.
    expect(await repo.saveWord(repo.ownerFor(aziz), 'm-bahnhof', word('hijacked'))).toBe('forbidden');
    expect(await repo.saveWord(repo.ownerFor(teacher), 'm-bahnhof', word('hijacked'))).toBe('forbidden');
    expect(await repo.deleteWord(repo.ownerFor(aziz), 'm-bahnhof')).toBe('forbidden');
    expect(await repo.saveWord(repo.ownerFor(malika), 'l3-familie', word('changed'))).toBe('forbidden');
    expect(await repo.putCard(aziz.id, 'm-bahnhof', doc(answer(null, 'good', Date.now())))).toBe('no-word');
    expect((await repo.listWords(malika.id))['m-bahnhof'].term).toBe('der Bahnhof');

    // The owner studies it like any other word; bulk import lands in their own words too.
    expect(await repo.putCard(malika.id, 'm-bahnhof', doc(answer(null, 'good', Date.now())))).toBe('ok');
    expect(await repo.putWords(repo.ownerFor(malika), [{ id: 'm-zug', data: word('der Zug') }, { id: 'm-bus', data: word('der Bus') }])).toBe(2);
    expect(await repo.countOwnWords(malika.id)).toBe(3);
    expect(await repo.deleteWord(repo.ownerFor(malika), 'm-bus')).toBe('ok');
    expect(await repo.countOwnWords(malika.id)).toBe(2);
    await repo.deleteUser(aziz.id);
  });

  it('deletes a profile with everything that belongs to it', async () => {
    const malika = (await repo.findUserByUsername('malika'))!;
    await repo.deleteUser(malika.id);
    expect(await repo.findUserById(malika.id)).toBeNull();
    expect(await repo.listCards(malika.id)).toEqual({});
    expect(await repo.countOwnWords(malika.id)).toBe(0); // her own words went too
    expect(Object.keys(await repo.listWords(null))).toHaveLength(93); // the shared ones stay
    expect((await repo.adminStats()).totals.profiles).toBe(1);
  });

  it('adds a new built-in list to an existing database once, without undoing the teacher’s changes', async () => {
    const dbm = await import('./db');
    const conn = await dbm.getDb();
    // Make it look like a database from before Lektion 5 existed, where the teacher deleted a
    // Lektion 3 word and had already typed one Lektion 5 word in by hand.
    await conn.query(`DELETE FROM words WHERE id LIKE 'l5-%'`);
    await conn.query(`DELETE FROM settings WHERE key = 'seeded:lektion-5'`);
    await conn.query(`UPDATE settings SET value = '1' WHERE key = 'schema_version'`);
    await repo.deleteWord(null, 'l3-oma');
    await repo.saveWord(null, 'w-handmade', {
      term: 'die Uhr', meaning: 'soat', pos: 'noun', pronunciation: '', forms: '', example: '', exampleTr: '', mnemonic: '', notes: '',
      tags: [], deck: 'Lektion 5', order: 1, createdAt: 1, updatedAt: 1,
    });

    dbm.setDatabase(conn); // a server restart with the new version
    await dbm.getDb();
    const words = await repo.listWords(null);
    expect(Object.values(words).filter((w) => w.deck === 'Lektion 5')).toHaveLength(59); // 58 new + the hand-made one
    expect(words['l5-uhr']).toBeUndefined(); // not doubled
    expect(words['l5-handy']?.meaning).toBe('mobil telefon');
    expect(words['l3-oma']).toBeUndefined(); // deleted stays deleted

    dbm.setDatabase(conn); // and again: nothing changes
    await dbm.getDb();
    expect(Object.keys(await repo.listWords(null))).toHaveLength(Object.keys(words).length);
  });
});

describe('analytics', () => {
  const DAY = 86_400_000;
  const now = Date.now();
  const e1 = { t: now - 30 * DAY, r: 'good' as const, k: 'learning' as const, i: 1 };
  const e2 = { t: now - 20 * DAY, r: 'hard' as const, k: 'review' as const, i: 6 };
  const e3 = { t: now - 1000, r: 'easy' as const, k: 'review' as const, i: 22 }; // the first 21+ day gap
  const state = (log: (typeof e1 | typeof e2 | typeof e3)[], ivl: number): CardDoc => ({
    f: { type: 'review', step: 0, due: now + ivl * DAY, ivl, ease: 2.5, reps: log.length, lapses: 0, first: e1.t, last: log.at(-1)!.t, log },
    r: null,
    suspended: false,
    updatedAt: now,
  });
  const V0 = '00000000-0000-4000-8000-000000000000';
  const V1 = '11111111-1111-4111-8111-111111111111';
  const V2 = '22222222-2222-4222-8222-222222222222';
  const masteredAt = async (userId: string) => {
    const conn = await (await import('./db')).getDb();
    return (await conn.query('SELECT mastered_at FROM cards WHERE user_id = $1', [userId])).rows[0]?.mastered_at;
  };

  it('counts reviews, recall and the moment a word is mastered, and keeps it after an undo', async () => {
    const nodira = await repo.createUser({ username: 'nodira', displayName: 'Nodira', passwordHash: 'x', visitorId: V0 });
    if (nodira === 'taken') throw new Error('taken');
    await repo.putCard(nodira.id, 'l3-familie', state([e1, e2], 6));
    expect(await masteredAt(nodira.id)).toBeNull();
    await repo.putCard(nodira.id, 'l3-familie', state([e1, e2, e3], 22));
    expect(await masteredAt(nodira.id)).toBe(e3.t);
    await repo.putCard(nodira.id, 'l3-familie', state([e1, e2], 6)); // undo
    expect(await masteredAt(nodira.id)).toBe(e3.t);

    const a = await repo.analytics('90');
    expect(a.northStar).toMatchObject({ total: 1, learnersThisWeek: 1 });
    expect(a.northStar.perWeek.at(-1)).toBe(1);
    expect(a.inputs.recallRate.at(-1)).toBe(0.5); // Hard (not remembered) and Easy (remembered)
    expect(a.users).toMatchObject({ students: 1, newThisWeek: 1, activeToday: 1 }); // the admin doesn't count
  });

  it('counts anonymous visitors and links the browser someone signs up in', async () => {
    await repo.recordVisitor(V1, false);
    await repo.recordVisitor(V1, true); // answered a card as a guest
    await repo.recordVisitor(V2, false); // only looked
    const jasur = await repo.createUser({ username: 'jasur', displayName: 'Jasur', passwordHash: 'x', visitorId: V1 });
    expect(jasur).not.toBe('taken');

    const { funnel, users } = await repo.analytics('30');
    expect(funnel.guests.map((s) => s.count)).toEqual([3, 1, 1]); // V0, V1, V2 → V1 tried → V1 joined
    expect(funnel.joinedDirectly).toBe(1); // V0 (nodira) signed up without trying
    expect(funnel.learners[0].count).toBe(2);
    expect(funnel.visitorsSince).toBe(repo.todayKey());
    expect(users.visitorsWeek).toBe(1); // V2: no profile yet
  });

  it('fills in mastery and recall from the review history of an older database', async () => {
    const dbm = await import('./db');
    const conn = await dbm.getDb();
    const nodira = (await repo.findUserByUsername('nodira'))!;
    await repo.putCard(nodira.id, 'l3-familie', state([e1, e2, e3], 22));
    // Make it look like a database from before analytics existed
    await conn.query('UPDATE cards SET mastered_at = NULL');
    await conn.query('UPDATE activity SET reviews = 0, recalled = 0');
    await conn.query(`DELETE FROM settings WHERE key = 'analytics_backfill'`);
    await conn.query(`UPDATE settings SET value = '2' WHERE key = 'schema_version'`);

    dbm.setDatabase(conn); // a server restart with the new version
    await dbm.getDb();
    expect(await masteredAt(nodira.id)).toBe(e3.t);
    const days = await conn.query<{ day: string; reviews: number; recalled: number }>(
      'SELECT day, reviews, recalled FROM activity WHERE user_id = $1 AND reviews > 0 ORDER BY day',
      [nodira.id],
    );
    // Each review lands on the day it was given: Hard 20 days ago, Easy today
    expect(days.rows.map((r) => [r.day, r.reviews, r.recalled])).toEqual([
      [repo.todayKey(e2.t), 1, 0],
      [repo.todayKey(), 1, 1],
    ]);
  });
});
