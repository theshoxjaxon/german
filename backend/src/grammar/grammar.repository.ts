import { Injectable } from '@nestjs/common';
import { Database } from '@api/database/database.service';
import { parse, todayKey } from '@api/common/db-util';



@Injectable()
export class GrammarRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** A student's practice state for a topic, or null before their first session. */
  async getGrammar(userId: string, topic: string): Promise<unknown | null> {
    const db = await this.database.get();
    const r = await db.query('SELECT data FROM grammar_state WHERE user_id = $1 AND topic = $2', [userId, topic]);
    return r.rows[0] ? parse<unknown>(r.rows[0].data) : null;
  }

  /**
   * Save the state after a session and count its answers toward today's activity (the streak,
   * the teacher's page and the evening reminder see it). One statement.
   */
  async saveGrammar(userId: string, topic: string, data: unknown, answers: number, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query(
      `WITH g AS (
         INSERT INTO grammar_state (user_id, topic, data, updated_at) VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (user_id, topic) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       )
       INSERT INTO activity (user_id, day, answers) SELECT $1, $5, $6 WHERE $6::int > 0
       ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers`,
      [userId, topic, JSON.stringify(data), now, todayKey(now), answers],
    );
  }
}
