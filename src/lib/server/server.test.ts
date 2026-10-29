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
import type { GoogleProfile } from './repo';
import { hashPassword, temporaryPassword, verifyPassword } from './password';

let repo: typeof import('./repo');
let close = async () => {};

beforeAll(async () => {
  process.env.ADMIN_EMAILS = 'ustoz@markaz.uz, second@markaz.uz,THIRD@markaz.uz';
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

/** A profile by email, as the sign-up form makes it (or with Google, when `emailVerified`). */
const profile = async (email: string, displayName: string, extra: { emailVerified?: boolean; visitorId?: string; googleId?: string } = {}) => {
  const u = await repo.createUser({ email, displayName, passwordHash: '$2b$11$not-a-real-hash', ...extra });
  if (u === 'taken') throw new Error(`${email} is taken`);
  return u;
};
const byEmail = async (email: string) => (await repo.findUserByEmail(email))!;

describe('passwords', () => {
  it('hashes with bcrypt and a salt, and verifies', async () => {
    const a = await hashPassword('Guten Tag 123');
    const b = await hashPassword('Guten Tag 123');
    expect(a).not.toBe(b); // different salts
    expect(a).toMatch(/^\$2[aby]\$11\$/);
    expect(await verifyPassword('Guten Tag 123', a)).toBe(true);
    expect(await verifyPassword('guten tag 123', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false); // a Google-only profile has no password
  });
  it('makes readable temporary passwords', () => {
    expect(temporaryPassword()).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe('database', () => {
  const doc = (f: CardDoc['f']): CardDoc => ({ f, r: null, suspended: false, updatedAt: Date.now() });

  it('seeds the built-in lists (Lektion 2, 3, 4, 5, 7, 8, 9 and 10)', async () => {
    const words = Object.values(await repo.listWords(null));
    const count = (deck: string) => words.filter((w) => w.deck === deck).length;
    expect([2, 3, 4, 5, 7, 8, 9, 10].map((n) => count(`Lektion ${n}`))).toEqual([61, 34, 48, 59, 46, 47, 85, 62]);
    expect(words).toHaveLength(442);
    // No word appears in two lessons
    expect(new Set(words.map((w) => w.term.toLowerCase())).size).toBe(words.length);
  });

  it('makes everyone a student in the one class, and an ADMIN_EMAILS address admin once it is verified', async () => {
    // Signing up first with the teacher's address, unverified, doesn't make anyone admin
    const early = await profile('ustoz@markaz.uz', 'Not the teacher');
    expect([early.role, early.inClass, early.emailVerified]).toEqual(['student', true, false]);
    expect(await repo.ensureAdminRole(early)).toMatchObject({ role: 'student' });
    await repo.deleteUser(early.id);

    const teacher = await profile('ustoz@markaz.uz', 'Ustoz', { emailVerified: true }); // e.g. with Google
    const student = await profile('malika@example.com', 'Malika K');
    expect(teacher.role).toBe('admin');
    expect([student.role, student.inClass]).toEqual(['student', true]);
    expect(await repo.createUser({ email: 'malika@example.com', displayName: 'Other', passwordHash: 'x' })).toBe('taken');
    expect((await byEmail('malika@example.com')).displayName).toBe('Malika K');
  });

  it('shows email addresses to admins only', async () => {
    const student = repo.publicUser(await byEmail('malika@example.com'));
    const teacher = repo.publicUser(await byEmail('ustoz@markaz.uz'));
    expect(student).not.toHaveProperty('email'); // not even their own
    expect(teacher.email).toBe('ustoz@markaz.uz');
    expect(student).toMatchObject({ displayName: 'Malika K', hasPassword: true, hasGoogle: false, avatarUrl: null });
    expect(JSON.stringify(await repo.classOverview(teacher.id))).not.toContain('@');
    expect(JSON.stringify(await repo.unseenCheers(student.id))).not.toContain('@');
    expect((await repo.adminStats()).people.map((p) => p.email).sort()).toEqual(['malika@example.com', 'ustoz@markaz.uz']);
  });

  it('stores only a hash of the session token and expires sessions', async () => {
    const user = await byEmail('malika@example.com');
    const { token } = await repo.createSession(user.id, 60_000);
    expect((await repo.findSession(token))?.user.displayName).toBe('Malika K');
    expect(await repo.findSession(token, Date.now() + 120_000)).toBeNull(); // expired
    await repo.deleteSession(token);
    expect(await repo.findSession(token)).toBeNull();
  });

  it('keeps progress per person and feeds the class and admin numbers', async () => {
    const malika = await byEmail('malika@example.com');
    const teacher = await byEmail('ustoz@markaz.uz');
    const t = Date.now();
    const s1 = answer(null, 'good', t);
    await repo.putCard(malika.id, 'l3-familie', doc(s1));
    await repo.putCard(malika.id, 'l3-familie', doc(answer(s1, 'good', t + 1000)));
    await repo.putCard(malika.id, 'l3-mutter', doc(answer(null, 'easy', t)));
    expect(await repo.putCard(malika.id, 'no-such-word', doc(s1))).toBe('no-word');

    expect(Object.keys(await repo.listCards(malika.id))).toEqual(expect.arrayContaining(['l3-familie', 'l3-mutter']));
    expect(await repo.listCards(teacher.id)).toEqual({}); // private per person

    const cls = await repo.classOverview(teacher.id);
    const m = cls.members.find((x) => x.id === malika.id)!;
    expect(m).toMatchObject({ activeWords: 2, answersToday: 3, studiedToday: true, streak: 1, isMe: false });
    expect(await repo.myStreak(malika.id)).toEqual({ days: 1, studiedToday: true });
    expect(await repo.myStreak(teacher.id)).toEqual({ days: 0, studiedToday: false });

    const stats = await repo.adminStats();
    expect(stats.totals).toMatchObject({ profiles: 2, admins: 1, studiedToday: 1, openedToday: 2, activeWeek: 1, answersToday: 3 });
    expect(stats.studiedByDay.at(-1)).toBe(1);
    expect(stats.signupsByDay.at(-1)).toBe(2);
  });

  it('limits cheers to one per classmate per day', async () => {
    const malika = await byEmail('malika@example.com');
    const teacher = await byEmail('ustoz@markaz.uz');
    expect(await repo.sendCheer(teacher.id, malika.id, 'keep-going')).toBe('ok');
    expect(await repo.sendCheer(teacher.id, malika.id, 'great-streak')).toBe('already');
    expect(await repo.sendCheer(malika.id, malika.id, 'keep-going')).toBe('self');
    const inbox = await repo.unseenCheers(malika.id);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: 'keep-going', from: { id: teacher.id, displayName: 'Ustoz' } });
    await repo.markCheersSeen(malika.id);
    expect(await repo.unseenCheers(malika.id)).toHaveLength(0);
    expect((await repo.classOverview(teacher.id)).members.find((x) => x.id === malika.id)?.cheeredToday).toBe(true);
  });

  it('puts everyone on the leaderboard until a teacher takes them off it', async () => {
    const teacher = await byEmail('ustoz@markaz.uz');
    const karim = await profile('karim@example.com', 'Karim');
    const names = async () => (await repo.classOverview(teacher.id)).members.map((m) => m.displayName);
    expect(await names()).toContain('Karim');
    await repo.setInClass(karim.id, false);
    expect(await names()).not.toContain('Karim');
    expect(await repo.sendCheer(teacher.id, karim.id, 'keep-going')).toBe('no-user');
    expect((await repo.adminStats()).people.find((p) => p.id === karim.id)?.inClass).toBe(false);
    await repo.setInClass(karim.id, true);
    expect(await names()).toContain('Karim');
    await repo.deleteUser(karim.id);
  });

  it('adds guest progress to a profile without overwriting what is there', async () => {
    const created = await profile('dilnoza@example.com', 'Dilnoza');
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
    const aziz = await profile('aziz@example.com', 'Aziz');
    const malika = await byEmail('malika@example.com');
    const teacher = await byEmail('ustoz@markaz.uz');
    const word = (term: string): WordData => ({
      term, meaning: 'vokzal', pos: 'noun', pronunciation: '', forms: '', example: '', exampleTr: '', mnemonic: '', notes: '',
      tags: [], deck: 'My words', order: 0, createdAt: 1, updatedAt: 1,
    });

    expect(await repo.saveWord(repo.ownerFor(malika), 'm-bahnhof', word('der Bahnhof'))).toBe('ok');
    const mine = await repo.listWords(malika.id);
    expect(mine['m-bahnhof']).toMatchObject({ term: 'der Bahnhof', personal: true });
    expect(mine['l3-familie'].personal).toBeUndefined(); // shared words stay shared
    expect(Object.keys(mine)).toHaveLength(443);
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
    const malika = await byEmail('malika@example.com');
    await repo.deleteUser(malika.id);
    expect(await repo.findUserById(malika.id)).toBeNull();
    expect(await repo.listCards(malika.id)).toEqual({});
    expect(await repo.countOwnWords(malika.id)).toBe(0); // her own words went too
    expect(Object.keys(await repo.listWords(null))).toHaveLength(442); // the shared ones stay
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
    const nodira = await profile('nodira@example.com', 'Nodira', { visitorId: V0 });
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
    await profile('jasur@example.com', 'Jasur', { visitorId: V1 });

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
    const nodira = await byEmail('nodira@example.com');
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

describe('Google sign-in', () => {
  const google = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
    sub: 'g-100', email: 'zarina@gmail.com', emailVerified: true, name: 'Zarina', picture: 'https://lh3.googleusercontent.com/a/z', ...over,
  });
  const signIn = async (g: GoogleProfile) => {
    const r = await repo.googleSignIn(g);
    if (typeof r === 'string') throw new Error(r);
    return r;
  };

  it('creates a profile the first time, then finds it by the Google account id', async () => {
    const first = await signIn(google());
    expect(first.created).toBe(true);
    expect(first.user).toMatchObject({ email: 'zarina@gmail.com', emailVerified: true, hasGoogle: true, hasPassword: false, role: 'student', inClass: true });
    expect(first.user.avatarUrl).toBe('https://lh3.googleusercontent.com/a/z');
    // Same Google account with a changed address and photo: still the same profile
    const again = await signIn(google({ email: 'zarina.new@gmail.com', picture: 'https://lh3.googleusercontent.com/a/new' }));
    expect(again).toMatchObject({ created: false, user: { id: first.user.id, avatarUrl: 'https://lh3.googleusercontent.com/a/new' } });
  });

  it('links the profile that already has the email instead of making a second one', async () => {
    const mine = await profile('bobur@example.com', 'Bobur'); // signed up with a password, address never proven
    const { token } = await repo.createSession(mine.id, 60_000);
    const r = await signIn(google({ sub: 'g-200', email: 'bobur@example.com', name: 'Bobur from Google' }));
    expect(r).toMatchObject({ created: false, user: { id: mine.id, displayName: 'Bobur', hasGoogle: true, emailVerified: true } });
    // Whoever set that password never proved the address was theirs: it goes, and so do their sessions
    expect(r.user.passwordHash).toBeNull();
    expect(await repo.findSession(token)).toBeNull();
  });

  it('keeps the password and sessions of a profile whose address was already proven', async () => {
    const v = await profile('dono@example.com', 'Dono', { emailVerified: true });
    const { token } = await repo.createSession(v.id, 60_000);
    const r = await signIn(google({ sub: 'g-300', email: 'dono@example.com' }));
    expect(r.user).toMatchObject({ id: v.id, hasPassword: true, hasGoogle: true });
    expect(await repo.findSession(token)).not.toBeNull();
  });

  it('refuses an unverified Google email, and a second Google account for one address', async () => {
    expect(await repo.googleSignIn(google({ sub: 'g-400', email: 'new@example.com', emailVerified: false }))).toBe('unverified');
    expect(await repo.findUserByEmail('new@example.com')).toBeNull();
    expect(await repo.googleSignIn(google({ sub: 'g-401', email: 'zarina@gmail.com' }))).toBe('other-google');
  });

  it('makes an ADMIN_EMAILS address admin, since Google verified it', async () => {
    expect((await signIn(google({ sub: 'g-500', email: 'second@markaz.uz', name: 'Second teacher' }))).user.role).toBe('admin');
  });
});

describe('rate limits', () => {
  it('allows `max` attempts per window, then refuses until the window ends', async () => {
    const { hit } = await import('./rate-limit');
    const t = 1_000_000;
    expect(await hit('test:login', 2, 1000, t)).toBe(true);
    expect(await hit('test:login', 2, 1000, t + 1)).toBe(true);
    expect(await hit('test:login', 2, 1000, t + 2)).toBe(false);
    expect(await hit('test:other', 2, 1000, t + 2)).toBe(true); // each key counts on its own
    expect(await hit('test:login', 2, 1000, t + 1000)).toBe(true); // a new window
  });

  it('stores keys (emails, IP addresses) only as hashes', async () => {
    const conn = await (await import('./db')).getDb();
    const keys = (await conn.query<{ key: string }>('SELECT key FROM rate_limits')).rows.map((r) => r.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => /^[0-9a-f]{64}$/.test(k))).toBe(true);
  });
});

describe('password links (forgot / reset)', () => {
  const MIN45 = 45 * 60_000;

  it('work once, before they expire, and only the newest one works', async () => {
    const lola = await profile('lola@example.com', 'Lola');
    const { token: session } = await repo.createSession(lola.id, 60_000);
    const older = await repo.createResetToken(lola.id, MIN45);
    const link = await repo.createResetToken(lola.id, MIN45);
    expect(await repo.useResetToken(older, '$2b$new-1')).toBeNull(); // replaced by the newer email
    expect(await repo.useResetToken(link, '$2b$new-2')).toMatchObject({ id: lola.id, emailVerified: true, passwordHash: '$2b$new-2' });
    expect(await repo.findSession(session)).toBeNull(); // signed out everywhere
    expect(await repo.useResetToken(link, '$2b$new-3')).toBeNull(); // used once already
    const late = await repo.createResetToken(lola.id, MIN45, Date.now() - MIN45 - 60_000);
    expect(await repo.useResetToken(late, '$2b$new-4')).toBeNull(); // expired a minute ago
    expect(await repo.useResetToken('made-up-token-that-was-never-sent', '$2b$new-5')).toBeNull();
    expect((await byEmail('lola@example.com')).passwordHash).toBe('$2b$new-2');
  });

  it('store only a hash of the token', async () => {
    const lola = await byEmail('lola@example.com');
    const link = await repo.createResetToken(lola.id, MIN45);
    const conn = await (await import('./db')).getDb();
    const rows = (await conn.query<{ token_hash: string }>('SELECT token_hash FROM password_reset_tokens WHERE user_id = $1', [lola.id])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toContain(link);
  });

  it('let a Google-only profile set a password', async () => {
    const r = await repo.googleSignIn({ sub: 'g-700', email: 'gulnoza@gmail.com', emailVerified: true, name: 'Gulnoza', picture: null });
    if (typeof r === 'string') throw new Error(r);
    expect(r.user.hasPassword).toBe(false);
    const done = await repo.useResetToken(await repo.createResetToken(r.user.id, MIN45), await hashPassword('ein-neues-passwort'));
    expect(done).toMatchObject({ hasPassword: true, hasGoogle: true });
    expect(await verifyPassword('ein-neues-passwort', done!.passwordHash)).toBe(true);
  });

  it('prove an ADMIN_EMAILS address, which then becomes admin', async () => {
    const t = await profile('third@markaz.uz', 'Third teacher');
    expect(t.role).toBe('student'); // signed up with a password: not proven yet
    const done = await repo.useResetToken(await repo.createResetToken(t.id, MIN45), '$2b$x');
    expect((await repo.ensureAdminRole(done!)).role).toBe('admin');
    expect((await byEmail('third@markaz.uz')).role).toBe('admin');
  });
});

describe('the class lesson', () => {
  it('is unset until a teacher picks one of the shared decks', async () => {
    expect(await repo.getClassLesson()).toBeNull();
    expect(await repo.setClassLesson('Lektion 99')).toBe(false); // no such deck
    expect(await repo.getClassLesson()).toBeNull();
    expect(await repo.setClassLesson('Lektion 7')).toBe(true);
    expect(await repo.getClassLesson()).toBe('Lektion 7');
    expect((await repo.adminStats()).classLesson).toBe('Lektion 7');
    expect((await repo.adminStats()).decks.map((d) => d.deck)).toEqual(expect.arrayContaining(['Lektion 3', 'Lektion 7']));
    expect(await repo.setClassLesson(null)).toBe(true);
    expect(await repo.getClassLesson()).toBeNull();
  });
});
