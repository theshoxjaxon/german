'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { parseList, suggestDeck } from '@/lib/import-parser';
import { addsSharedWords, MY_WORDS_DECK } from '@/lib/ownership';
import { deckNames, nextOrder } from '@/lib/queue';
import { guessPos, newId, norm, parseTags } from '@/lib/text';
import type { Word } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { Term } from './ui';
import { useUI } from './ui-context';

/** Paste a word list from a PDF, a spreadsheet or a chat and turn it into cards. */
export function ImportSheet() {
  const data = useStore();
  const ui = useUI();
  const { t, tn } = useT();
  const [text, setText] = useState('');
  const [deckInput, setDeckInput] = useState<string | null>(null); // null until the user types a deck
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseList(text), [text]);
  const shared = addsSharedWords(data.me);
  const deck = deckInput ?? (parsed.deckHint || (shared ? suggestDeck(deckNames(data.words)) : MY_WORDS_DECK));
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
  if (!data.me) return null; // guests study only

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
      ...(shared ? {} : { personal: true }),
    }));
    const ok = await store.addWords(list);
    setBusy(false);
    if (ok) {
      ui.closeSheet();
      ui.toast(deck ? tn(list.length, 'Imported {n} word into {deck}', 'Imported {n} words into {deck}', { deck }) : tn(list.length, 'Imported {n} word', 'Imported {n} words'));
    }
  };

  return (
    <BottomSheet
      title={t('Import a word list')}
      footer={
        <>
          <button className="btn" onClick={ui.closeSheet}>{t('Cancel')}</button>
          <button className="btn btn-primary" disabled={!todo.length || busy} onClick={run}>
            {busy ? t('Importing…') : todo.length ? tn(todo.length, 'Import {n} word', 'Import {n} words') : t('Import')}
          </button>
        </>
      }
    >
      <p className="lede">
        {t('Paste one word per line. Put a tab, a spaced dash ( – ), = or ; between the word and its meaning. A list with each meaning on the line under its word works too.')}
      </p>
      <p className="hint">{t(shared ? 'These become lesson words for everyone in your class.' : 'These become your own words. Only you see them.')}</p>
      <div className="field">
        <label htmlFor="imp-text">{t('Word list')}</label>
        <textarea id="imp-text" rows={7} spellCheck={false} autoCapitalize="off" data-autofocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'die Familie – oila\nder Vater – ota\nsprechen – gapirmoq'} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="imp-deck">{t('Deck')}</label>
          <input id="imp-deck" list="deck-list-imp" value={deck} onChange={(e) => setDeckInput(e.target.value)} placeholder="Lektion 4" autoComplete="off" />
          <datalist id="deck-list-imp">
            {deckNames(data.words).map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="imp-tags">{t('Tags for all')}</label>
          <input id="imp-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="family" autoComplete="off" autoCapitalize="off" />
        </div>
      </div>
      {text.trim() && (
        <div aria-live="polite">
          <p className="small">
            <b>{tn(todo.length, '{n} word ready', '{n} words ready')}</b>
            {dupes > 0 && ` · ${t('{n} already in this deck', { n: dupes })}`}
            {parsed.skipped.length > 0 && ` · ${tn(parsed.skipped.length, '{n} line skipped', '{n} lines skipped')}`}
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
          {todo.length > 6 && <p className="hint">{t('and {n} more', { n: todo.length - 6 })}</p>}
          {parsed.skipped.length > 0 && (
            <p className="hint">{t('Skipped:')} {parsed.skipped.slice(0, 3).join(' · ')}{parsed.skipped.length > 3 ? ' …' : ''}</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
