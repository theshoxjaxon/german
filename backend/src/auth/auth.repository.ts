import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Database } from '@api/database/database.service';
import { str, num } from '@api/common/db-util';
import { UserRow } from '@api/users/users.repository';
import { USER_SELECT } from '@api/users/users.repository';
import { USER_FROM } from '@api/users/users.repository';
import { toUser } from '@api/users/users.repository';
import { UsersRepository } from '@api/users/users.repository';

/** Only a SHA-256 of the cookie token is stored, so a leaked database can't be used to log in. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthRepository {
  constructor(
    private readonly database: Database,
    private readonly usersRepo: UsersRepository,
  ) {}

  async createSession(userId: string, ttlMs: number, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
    const db = await this.database.get();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + ttlMs;
    await db.query(
      `WITH expired AS (DELETE FROM sessions WHERE expires_at < $3), -- housekeeping
       capped AS ( -- at most 10 devices: this person's oldest sessions go
         DELETE FROM sessions WHERE user_id = $2 AND id NOT IN (
           SELECT id FROM sessions WHERE user_id = $2 ORDER BY created_at DESC LIMIT 9)
       )
       INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
      [hashToken(token), userId, now, expiresAt],
    );
    return { token, expiresAt };
  }

  async findSession(token: string, now = Date.now()): Promise<{ user: UserRow; expiresAt: number } | null> {
    const db = await this.database.get();
    const r = await db.query(
      `SELECT ${USER_SELECT}, s.expires_at AS session_expires
       FROM ${USER_FROM} JOIN sessions s ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > $2`,
      [hashToken(token), now],
    );
    const row = r.rows[0];
    return row ? { user: toUser(row), expiresAt: num(row.session_expires) } : null;
  }

  async extendSession(token: string, expiresAt: number): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE sessions SET expires_at = $2 WHERE id = $1', [hashToken(token), expiresAt]);
  }

  async deleteSession(token: string): Promise<void> {
    const db = await this.database.get();
    await db.query('DELETE FROM sessions WHERE id = $1', [hashToken(token)]);
  }

  /** Sign a person out everywhere (after a password change or reset), optionally keeping one session. */
  async deleteUserSessions(userId: string, keepToken?: string): Promise<void> {
    const db = await this.database.get();
    await db.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, keepToken ? hashToken(keepToken) : '']);
  }

  /**
   * A "Forgot password" link: a random 256-bit token, of which only the SHA-256 is stored. A new
   * link replaces this person's older ones, so only the latest email works.
   */
  async createResetToken(userId: string, ttlMs: number, now = Date.now()): Promise<string> {
    const db = await this.database.get();
    const token = randomBytes(32).toString('base64url');
    await db.query(
      `WITH old AS (DELETE FROM password_reset_tokens WHERE user_id = $2 OR expires_at < $3)
       INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
      [hashToken(token), userId, now, now + ttlMs],
    );
    return token;
  }

  /**
   * Use a link to set a new password: once, before it expires. In the same statement the address
   * counts as verified (the email reached its owner) and every session ends, so a stolen session
   * or an old password stops working. Null when the link is unknown, used or expired.
   */
  async useResetToken(token: string, passwordHash: string, now = Date.now()): Promise<UserRow | null> {
    const db = await this.database.get();
    const r = await db.query(
      `WITH t AS (
         UPDATE password_reset_tokens SET used_at = $3
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $3
         RETURNING user_id
       ), u AS (
         UPDATE users SET password_hash = $2, email_verified = true, updated_at = $3
         FROM t WHERE users.id = t.user_id
         RETURNING users.id
       ), signout AS (
         DELETE FROM sessions WHERE user_id IN (SELECT id FROM u)
       )
       SELECT id FROM u`,
      [hashToken(token), passwordHash, now],
    );
    const id = r.rows[0]?.id;
    return id ? this.usersRepo.findUserById(str(id)) : null;
  }
}
