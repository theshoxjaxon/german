/**
 * Who may change which word. The server enforces the same rules (repo.saveWord / deleteWord);
 * these only decide what the UI offers.
 *
 *   shared lesson words → admins (teachers) change them, everyone studies them
 *   your own words      → only you see, study and change them
 */
import type { Me, Word } from './types';

/** Where a student's new words go unless they pick another deck. */
export const MY_WORDS_DECK = 'My words';

/** Admins add shared lesson words; everyone else adds their own words. */
export const addsSharedWords = (me: Me | null) => me?.role === 'admin';

/** Words are only sent to their owner, so `personal` means "mine". */
export function canEditWord(me: Me | null, word: Word | null | undefined): boolean {
  if (!me) return false; // guests study only
  if (!word) return true; // anyone signed in can add a word
  return word.personal ? true : me.role === 'admin';
}
