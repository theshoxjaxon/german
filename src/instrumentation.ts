/**
 * Runs once when the server starts: create the tables, load the Lektion 3 words and,
 * while nobody has signed up yet, print the join code in the terminal so the teacher can
 * create the first (admin) profile.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    const { getDb } = await import('./lib/server/db');
    await getDb();
  } catch (e) {
    const { describeDbError } = await import('./lib/server/db-health');
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: could not open the database (${problem}). ${message}`);
  }
}
