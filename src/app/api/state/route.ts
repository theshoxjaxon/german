import { connection } from 'next/server';
import { readData } from '@/lib/server/db';
import { ok } from '@/lib/server/http';

/** GET /api/state → every word, this person's progress and settings. */
export async function GET() {
  await connection(); // always read at request time, never prerendered
  return ok(await readData());
}
