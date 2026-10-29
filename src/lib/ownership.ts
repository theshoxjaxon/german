/**
 * Who may change which word. The server enforces the same rules (repo.saveWord / deleteWord);
 * these only decide what the UI offers.
 *
 *   shared lesson words → the course's teachers change them, everyone in it studies them
 *   your own words      → only you see, study and change them
 */
import type { Me, Word } from './types';

/** Where a student's new words go unless they pick another deck. */
export const MY_WORDS_DECK = 'My words';

/** Teachers add their course's shared lesson words; everyone else adds their own words. */
export const addsSharedWords = (me: Me | null) => !!me?.teacher;

/** Words are only sent to their owner, so `personal` means "mine". */
export function canEditWord(me: Me | null, word: Word | null | undefined): boolean {
  if (!me) return false; // guests study only
  if (!word) return true; // anyone signed in can add a word
  return word.personal ? true : me.teacher;
}
