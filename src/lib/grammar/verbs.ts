/**
 * The Perfekt verbs of the German course: every verb on the lesson word lists whose card gives
 * its Perfekt ("hat gemacht", "ist gefahren"), plus a few the class uses. Read from the built-in
 * word lists, so it's imported on the server only (the lists are large) and sent to the trainer.
 */
import { SEED_PACKS } from '../seed';
import { buildVerbs, type Verb } from './perfekt';

let cache: Verb[] | null = null;

export function perfektVerbs(): Verb[] {
  cache ??= buildVerbs(
    SEED_PACKS.filter((p) => p.course === 'german').flatMap((p) =>
      p.rows.filter((r) => r[3] === 'verb').map(([id, term, meaning, , , forms]) => ({ id, term, meaning, forms, deck: p.deck })),
    ),
  );
  return cache;
}
