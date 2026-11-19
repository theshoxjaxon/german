/**
 * When the database can't be used: what went wrong, in words the person running the app can
 * act on. Nothing here repeats the connection string, so no password reaches logs or pages.
 */
import { DbConfigError, getDb } from './db';

export interface DbProblem {
  problem: string;
  message: string;
}

export function describeDbError(e: unknown): DbProblem {
  if (e instanceof DbConfigError) return { problem: e.problem, message: e.message };
  const code = String((e as { code?: unknown })?.code ?? '');
  const text = String((e as { message?: unknown })?.message ?? '');
  if (code === '28P01' || /password authentication failed/i.test(text)) {
    return { problem: 'password', message: 'The database rejected the password in DATABASE_URL. Reset it in Supabase (Project Settings → Database) and update DATABASE_URL.' };
  }
  if (/tenant or user not found/i.test(text)) {
    return {
      problem: 'project',
      message: 'Supabase doesn’t recognise this project or user. Check that the user name is postgres.<project-ref>, and that the project isn’t paused (free projects pause after about a week without use; restore it in the Supabase dashboard).',
    };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { problem: 'host', message: 'The database host in DATABASE_URL can’t be found. Copy the connection string again from Supabase → Connect.' };
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || code === 'EADDRNOTAVAIL') {
    return { problem: 'network', message: 'This server can’t reach the database address, usually because it is Supabase’s IPv6-only direct connection. Use the Transaction pooler connection string (port 6543).' };
  }
  if (code === 'ECONNREFUSED') {
    return { problem: 'refused', message: 'The database refused the connection. Check the port in DATABASE_URL (6543 for the pooler) and that the Supabase project is running.' };
  }
  if (code === 'ETIMEDOUT' || /timeout|timed out/i.test(text)) {
    return { problem: 'timeout', message: 'Connecting to the database timed out. Check that the Supabase project is running and that DATABASE_URL is the pooler connection string.' };
  }
  if (code === '3D000') return { problem: 'database', message: 'The database name at the end of DATABASE_URL doesn’t exist. On Supabase it is “postgres”.' };
  if (/certificate|ssl|tls/i.test(text)) {
    return { problem: 'tls', message: 'The secure connection to the database failed. If DATABASE_CA_CERT is set, check that it is Supabase’s certificate, or remove it.' };
  }
  return { problem: 'unknown', message: 'The database returned an unexpected error. The server logs have the details.' };
}

/** Can the app use its database right now? */
export async function checkDatabase(): Promise<({ ok: true } | ({ ok: false } & DbProblem))> {
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    return { ok: true };
  } catch (e) {
    return { ok: false, ...describeDbError(e) };
  }
}
