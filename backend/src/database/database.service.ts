import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { describeDbError } from './db-health';
import { getDb, type Db, type Row } from './db';

export type { Db, Row };

/**
 * The one door to PostgreSQL (Supabase in production). Repositories ask it for the connection
 * pool; the pool, the schema and the built-in word lists live in `db.ts`.
 */
@Injectable()
export class Database implements OnModuleInit {
  private readonly log = new Logger('Database');

  get(): Promise<Db> {
    return getDb();
  }

  /** Creates the tables and loads the word lists on start; a database that is down must not stop the server. */
  async onModuleInit(): Promise<void> {
    try {
      await getDb();
    } catch (e) {
      const { problem, message } = describeDbError(e);
      this.log.error(`Could not open the database (${problem}). ${message}`);
    }
  }
}
