'use client';

import { useMemo, useState } from 'react';
import { store, useStore } from '@/lib/client/store';
import { parseList, suggestDeck } from '@/lib/import-parser';
import { deckNames, nextOrder } from '@/lib/queue';
import { guessPos, newId, norm, parseTags } from '@/lib/text';
import { plural } from '@/lib/time';
import type { Word } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { Term } from './ui';
import { useUI } from './ui-context';

/** Paste a word list from a PDF, a spreadsheet or a chat and turn it into cards. */
export function ImportSheet() {
  const data = useStore();
  const ui = useUI();
  const [text, setText] = useState('');
  const [deckInput, setDeckInput] = useState<string | null>(null); // null until the user types a deck
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseList(text), [text]);
  const deck = deckInput ?? (parsed.deckHint || suggestDeck(deckNames(data.words)));
  const todo = useMemo(() => {
    const have = new Set([...data.words.values()].filter((w) => (w.deck || '') === deck).map((w) => norm(w.term)));
    const seen = new Set<string>();
    return parsed.pairs.filter((p) => {
      const k = norm(p.term);
      if (have.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [parsed, deck, data.words]);
  const dupes = parsed.pairs.length - todo.length;
  if (data.me?.role !== 'admin') return null; // only teachers change the shared word list

  const run = async () => {
    if (!todo.length || busy) return;
    setBusy(true);
    const base = nextOrder(store.getSnapshot().words, deck);
    const now = Date.now();
    const tagList = parseTags(tags);
    const list: Word[] = todo.map((p, i) => ({
      id: `${newId()}${i.toString(36)}`,
      term: p.term,
      meaning: p.meaning,
      pos: guessPos(p.term),
      pronunciation: '', forms: '', example: '', exampleTr: '', mnemonic: '', notes: '',
      tags: tagList,
      deck,
      order: base + i,
      createdAt: now + i,
      updatedAt: now + i,
    }));
    const ok = await store.addWords(list);
    setBusy(false);
    if (ok) {
      ui.closeSheet();
      ui.toast(`Imported ${plural(list.length, 'word', 'words')}${deck ? ` into ${deck}` : ''}`);
    }
  };

  return (
    <BottomSheet
      title="Import a word list"
      footer={
        <>
          <button className="btn" onClick={ui.closeSheet}>Cancel</button>
          <button className="btn btn-primary" disabled={!todo.length || busy} onClick={run}>
            {busy ? 'Importing…' : todo.length ? `Import ${plural(todo.length, 'word', 'words')}` : 'Import'}
          </button>
        </>
      }
    >
      <p className="lede">
        Paste one word per line. Put a tab, a spaced dash ( – ), = or ; between the word and its meaning. A list with each meaning on the line under its word works too.
      </p>
      <div className="field">
        <label htmlFor="imp-text">Word list</label>
        <textarea id="imp-text" rows={7} spellCheck={false} autoCapitalize="off" data-autofocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'die Familie – oila\nder Vater – ota\nsprechen – gapirmoq'} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="imp-deck">Deck</label>
          <input id="imp-deck" list="deck-list-imp" value={deck} onChange={(e) => setDeckInput(e.target.value)} placeholder="Lektion 4" autoComplete="off" />
          <datalist id="deck-list-imp">
            {deckNames(data.words).map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="imp-tags">Tags for all</label>
          <input id="imp-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="family" autoComplete="off" autoCapitalize="off" />
        </div>
      </div>
      {text.trim() && (
        <div aria-live="polite">
          <p className="small">
            <b>{plural(todo.length, 'word', 'words')} ready</b>
            {dupes > 0 && ` · ${dupes} already in this deck`}
            {parsed.skipped.length > 0 && ` · ${plural(parsed.skipped.length, 'line', 'lines')} skipped`}
          </p>
          {todo.length > 0 && (
            <table className="prev-table">
              <tbody>
                {todo.slice(0, 6).map((p) => (
                  <tr key={p.term}>
                    <td lang="de"><Term term={p.term} /></td>
                    <td>{p.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {todo.length > 6 && <p className="hint">and {todo.length - 6} more</p>}
          {parsed.skipped.length > 0 && (
            <p className="hint">Skipped: {parsed.skipped.slice(0, 3).join(' · ')}{parsed.skipped.length > 3 ? ' …' : ''}</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
