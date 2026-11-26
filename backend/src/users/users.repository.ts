import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DEFAULT_COURSE } from '@/lib/courses';
import { type Me, type Role } from '@/lib/types';
import { isAdminEmail } from '@api/auth/admins';
import { Database, type Row } from '@api/database/database.service';
import { str, num, isUniqueViolation, todayKey } from '@api/common/db-util';
import { hashToken } from '@api/auth/auth.repository';

export interface UserRow extends Me {
  email: string; // '' for profiles made before sign-in by email
  emailVerified: boolean;
  googleId: string | null;
  passwordHash: string | null; // null: signs in with Google only
  createdAt: number;
  lastSeenAt: number | null;
  member: boolean; // a member of their active course (false only for a profile older than courses)
}

/*
 * A user always comes with their active course and their membership in it, so every route knows
 * which course's words, leaderboard and teacher rights apply without asking the browser.
 * No active course yet (or it was deleted): the default course.
 */
export const USER_SELECT = `u.id, u.email, u.email_verified, u.google_id, u.avatar_url, u.display_name, u.role, u.created_at,
  u.last_seen_at, u.password_hash, coalesce(u.course_id, '${DEFAULT_COURSE}') AS active_course,
  m.user_id IS NOT NULL AS member, m.role AS course_role, m.on_board`;

export const USER_FROM = `users u LEFT JOIN course_members m ON m.user_id = u.id AND m.course_id = coalesce(u.course_id, '${DEFAULT_COURSE}')`;

export function toUser(r: Row): UserRow {
  const role: Role = r.role === 'admin' ? 'admin' : 'student';
  return {
    id: str(r.id),
    email: str(r.email),
    emailVerified: r.email_verified === true,
    googleId: r.google_id == null ? null : str(r.google_id),
    avatarUrl: r.avatar_url == null ? null : str(r.avatar_url),
    displayName: str(r.display_name),
    role,
    courseId: str(r.active_course),
    teacher: role === 'admin' || r.course_role === 'teacher', // admins teach every course
    inClass: r.on_board === true,
    member: r.member === true,
    hasPassword: r.password_hash != null,
    hasGoogle: r.google_id != null,
    createdAt: num(r.created_at),
    lastSeenAt: r.last_seen_at == null ? null : num(r.last_seen_at),
    passwordHash: r.password_hash == null ? null : str(r.password_hash),
  };
}

/** What the browser gets about you. Email addresses are for admins only, their own included. */
export const publicUser = (u: UserRow): Me => ({
  id: u.id,
  displayName: u.displayName,
  role: u.role,
  courseId: u.courseId,
  teacher: u.teacher,
  inClass: u.inClass,
  avatarUrl: u.avatarUrl,
  hasPassword: u.hasPassword,
  hasGoogle: u.hasGoogle,
  ...(u.role === 'admin' && u.email ? { email: u.email } : {}),
});

export interface GoogleProfile {
  sub: string; // Google's id for the account: stable, unlike the email
  email: string; // normalized
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

@Injectable()
export class UsersRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** `email` must already be normalized (lowercase, trimmed): see normalizeEmail(). */
  async findUserByEmail(email: string): Promise<UserRow | null> {
    if (!email) return null;
    const db = await this.database.get();
    const r = await db.query(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.email = $1`, [email]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const db = await this.database.get();
    const r = await db.query(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.id = $1`, [id]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  /**
   * Create a profile in a course (`courseId`: the one the person picked or followed a link to;
   * unknown → the default course). Everyone is on its leaderboard (no class code for now). An
   * ADMIN_EMAILS address becomes admin right away only when it is already verified (signing up with
   * Google). `visitorId` (the browser's anonymous id) records that this browser joined, for the
   * Visit → Try → Join funnel. 'taken': the email (or Google account) already has a profile.
   */
  async createUser(
    input: {
      email: string;
      displayName: string;
      passwordHash?: string | null;
      googleId?: string | null;
      avatarUrl?: string | null;
      emailVerified?: boolean;
      visitorId?: string | null;
      courseId?: string | null;
    },
    now = Date.now(),
  ): Promise<UserRow | 'taken'> {
    const db = await this.database.get();
    const id = `u_${randomBytes(12).toString('base64url')}`;
    const verified = input.emailVerified ?? false;
    try {
      await db.query(
        `WITH course AS (
           SELECT coalesce((SELECT id FROM courses WHERE id = $12), (SELECT id FROM courses WHERE id = '${DEFAULT_COURSE}')) AS id
         ), u AS (
           INSERT INTO users (id, email, display_name, password_hash, google_id, avatar_url, email_verified, role, in_class, created_at, updated_at, last_seen_at, course_id)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9, $9, id FROM course
           RETURNING id, course_id
         ), member AS (
           INSERT INTO course_members (course_id, user_id, joined_at) SELECT course_id, id, $9 FROM u WHERE course_id IS NOT NULL
         ), visitor AS (
           INSERT INTO visitors (id, first_day, last_day, user_id, joined_day, course_id)
           SELECT $11, $10, $10, id, $10, course_id FROM u WHERE $11::text IS NOT NULL
           ON CONFLICT (id) DO UPDATE SET last_day = excluded.last_day, user_id = excluded.user_id, joined_day = excluded.joined_day,
             course_id = coalesce(excluded.course_id, visitors.course_id)
             WHERE visitors.user_id IS NULL
         )
         INSERT INTO activity (user_id, day, visits) SELECT id, $10, 1 FROM u`,
        [
          id, input.email, input.displayName, input.passwordHash ?? null, input.googleId ?? null, input.avatarUrl ?? null,
          verified, verified && isAdminEmail(input.email) ? 'admin' : 'student', now, todayKey(now), input.visitorId ?? null,
          input.courseId ?? null,
        ],
      );
    } catch (e) {
      if (isUniqueViolation(e)) return 'taken';
      throw e;
    }
    return (await this.findUserById(id))!;
  }

  /** After a sign-in: an ADMIN_EMAILS address whose owner is proven becomes admin. Returns the user as they are now. */
  async ensureAdminRole(user: UserRow): Promise<UserRow> {
    if (user.role === 'admin' || !user.emailVerified || !isAdminEmail(user.email)) return user;
    await this.setRole(user.id, 'admin');
    return { ...user, role: 'admin', teacher: true };
  }

  /**
   * Sign in with Google: find the profile by its Google id, else link the profile with the same
   * email, else create one. Only a verified Google email links or creates, so nobody can claim an
   * address with a Google account that doesn't own it.
   *
   * Linking a profile whose email was never verified also removes its password and signs it out
   * everywhere: whoever set that password never proved the address was theirs, and must not keep
   * a way into the real owner's profile ("pre-account hijacking"). The owner can set a password
   * later with "Forgot password".
   *
   * 'unverified': Google hasn't verified the email. 'other-google': the profile with this email
   * is already linked to a different Google account.
   */
  async googleSignIn(
    g: GoogleProfile,
    opts: { visitorId?: string | null; courseId?: string | null } = {},
    now = Date.now(),
  ): Promise<{ user: UserRow; created: boolean } | 'unverified' | 'other-google'> {
    const db = await this.database.get();
    for (let attempt = 0; attempt < 2; attempt++) {
      const known = await db.query(
        'UPDATE users SET avatar_url = COALESCE($2, avatar_url), updated_at = $3 WHERE google_id = $1 RETURNING id',
        [g.sub, g.picture, now],
      );
      if (known.rows[0]) return { user: (await this.findUserById(str(known.rows[0].id)))!, created: false };
      if (!g.emailVerified) return 'unverified';

      const linked = await db.query(
        `WITH link AS (
           UPDATE users SET google_id = $2, avatar_url = COALESCE(avatar_url, $3), email_verified = true, updated_at = $4,
             password_hash = CASE WHEN email_verified THEN password_hash END
           WHERE email = $1 AND google_id IS NULL
           RETURNING id, (SELECT NOT email_verified FROM users WHERE email = $1) AS was_unverified
         ), signout AS (
           DELETE FROM sessions WHERE user_id IN (SELECT id FROM link WHERE was_unverified)
         )
         SELECT id FROM link`,
        [g.email, g.sub, g.picture, now],
      );
      if (linked.rows[0]) return { user: (await this.findUserById(str(linked.rows[0].id)))!, created: false };
      if (await this.findUserByEmail(g.email)) return 'other-google';

      const created = await this.createUser(
        { email: g.email, displayName: g.name, googleId: g.sub, avatarUrl: g.picture, emailVerified: true, visitorId: opts.visitorId, courseId: opts.courseId },
        now,
      );
      if (created !== 'taken') return { user: created, created: true };
      // Someone else (or another tab) created it a moment ago: look again
    }
    throw new Error('Google sign-in: the profile changed while signing in. Try again.');
  }

  async setPasswordHash(userId: string, passwordHash: string, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1', [userId, passwordHash, now]);
  }

  /** The platform role: admins (ADMIN_EMAILS) run the whole app and teach every course. */
  async setRole(userId: string, role: Role): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
  }

  /** Remove a profile and everything that belongs to it (sessions, own words, progress, cheers…). */
  async deleteUser(userId: string): Promise<void> {
    const db = await this.database.get();
    await db.query('DELETE FROM users WHERE id = $1', [userId]); // ON DELETE CASCADE does the rest
  }

  /** Note that someone opened the app (at most every few minutes): feeds "active today" for the admin. */
  async recordVisit(userId: string, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query(
      `WITH seen AS (UPDATE users SET last_seen_at = $2 WHERE id = $1 RETURNING id)
       INSERT INTO activity (user_id, day, visits) SELECT id, $3, 1 FROM seen
       ON CONFLICT (user_id, day) DO UPDATE SET visits = activity.visits + 1`,
      [userId, now, todayKey(now)],
    );
  }

  /**
   * Someone opened the app without a profile (tried: and answered a card as a guest). Counted per
   * browser and day; the id is random and says nothing about the person.
   */
  async recordVisitor(visitorId: string, tried: boolean, courseId: string | null, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query(
      `INSERT INTO visitors (id, first_day, last_day, tried_day, course_id)
       VALUES ($1, $2, $2, CASE WHEN $3::boolean THEN $2 END, (SELECT id FROM courses WHERE id = $4))
       ON CONFLICT (id) DO UPDATE SET last_day = excluded.last_day, tried_day = COALESCE(visitors.tried_day, excluded.tried_day),
         course_id = COALESCE(excluded.course_id, visitors.course_id)`,
      [visitorId, todayKey(now), tried, courseId],
    );
  }

  /**
   * When confirming the email began. Profiles made before it log in as they always did; later ones
   * must click the link in their email first. Written the first time it is asked, once.
   */
  async confirmSince(): Promise<number> {
    const db = await this.database.get();
    const r = await db.query(
      `WITH ins AS (INSERT INTO settings (key, value) VALUES ('email_confirm_since', $1) ON CONFLICT (key) DO NOTHING RETURNING value)
       SELECT value FROM ins UNION ALL SELECT value FROM settings WHERE key = 'email_confirm_since'`,
      [String(Date.now())],
    );
    return Number(r.rows[0]?.value) || 0;
  }

  /** Signed up with email and password, and hasn't clicked the link in the email yet. */
  async mustConfirm(u: UserRow): Promise<boolean> {
    return !u.emailVerified && !u.googleId && u.createdAt >= (await this.confirmSince());
  }

  /** Someone typed this address before and never confirmed it: let the new sign-up take its place. */
  async replaceUnconfirmed(id: string, input: { displayName: string; passwordHash: string }, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query(
      'UPDATE users SET display_name = $2, password_hash = $3, updated_at = $4 WHERE id = $1 AND email_verified = false AND google_id IS NULL',
      [id, input.displayName, input.passwordHash, now],
    );
  }

  /**
   * Use the link from the confirmation email: once, before it expires. The address counts as
   * verified from here on. Null when the link is unknown, used or expired.
   */
  async useConfirmToken(token: string, now = Date.now()): Promise<UserRow | null> {
    const db = await this.database.get();
    const r = await db.query(
      `WITH t AS (
         UPDATE password_reset_tokens SET used_at = $2
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
         RETURNING user_id
       )
       UPDATE users SET email_verified = true, updated_at = $2 FROM t WHERE users.id = t.user_id RETURNING users.id`,
      [hashToken(token), now],
    );
    const id = r.rows[0]?.id;
    return id ? this.findUserById(str(id)) : null;
  }
}
