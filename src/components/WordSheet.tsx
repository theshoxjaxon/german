'use client';

import { useState, type FormEvent } from 'react';
import { useNow } from '@/lib/client/hooks';
import { speak, useSpeechSupported } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import { addsSharedWords, canEditWord, MY_WORDS_DECK } from '@/lib/ownership';
import { currentDeck, deckNames, enabledDirs, lapsesOf, latestDeck, LEECH_AT, nextOrder, stateInfo } from '@/lib/queue';
import { cleanTerm, guessPos, newId, norm, parseTags } from '@/lib/text';
import { dayIndex, DAY, fmtSpan, plural } from '@/lib/time';
import { POS_OPTIONS, RATING_LABEL, type Pos, type Word } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { ConfirmButton, Icon, StatusPill, Term } from './ui';
import { useUI } from './ui-context';
import { dueLabel } from './WordsView';

/** The record view: edit every field of a word, see its progress, pause, reset or delete it. */
export function WordSheet({ id }: { id: string | null }) {
  const data = useStore();
  const ui = useUI();
  const speech = useSpeechSupported();
  // Fill the form once from the word as it was when the sheet opened, so live updates never overwrite typing.
  const [initial] = useState<Word | null>(() => (id ? data.words.get(id) ?? null : null));
  const [errors, setErrors] = useState<{ term?: string; meaning?: string }>({});
  const canEdit = canEditWord(data.me, initial); // the server enforces this too
  const shared = initial ? !initial.personal : addsSharedWords(data.me);

  if (id && !initial) {
    return (
      <BottomSheet title="Word not found">
        <p className="lede">This word was deleted.</p>
      </BottomSheet>
    );
  }

  if (!initial && !canEdit) return null;

  const lapses = initial ? lapsesOf(data.cards.get(initial.id)) : 0;
  const deckDefault = initial
    ? initial.deck
    : ui.query.filters.deck.length === 1
      ? ui.query.filters.deck[0]
      : !shared
        ? MY_WORDS_DECK
        : currentDeck(data) !== 'all'
          ? currentDeck(data)
          : latestDeck(data.words);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) ?? '').trim();
    const term = cleanTerm(get('term'));
    const meaning = get('meaning');
    const deck = get('deck');
    const next: typeof errors = {};
    if (!term) next.term = 'Enter the German word or phrase.';
    if (!meaning) next.meaning = 'Enter what it means.';
    const dup = [...store.getSnapshot().words.values()].find((x) => x.id !== initial?.id && norm(x.term) === norm(term) && (x.deck || '') === deck);
    if (term && dup) next.term = `This word is already in ${deck || 'your words'}.`;
    setErrors(next);
    if (next.term || next.meaning) {
      form.querySelector<HTMLInputElement>(next.term ? '#f-term' : '#f-meaning')?.focus();
      return;
    }
    const now = Date.now();
    const words = store.getSnapshot().words;
    const word: Word = {
      id: initial?.id ?? newId(),
      term,
      meaning,
      pos: (get('pos') as Pos) || guessPos(term),
      pronunciation: get('pronunciation'),
      forms: get('forms'),
      example: get('example'),
      exampleTr: get('exampleTr'),
      mnemonic: get('mnemonic'),
      notes: get('notes'),
      tags: parseTags(get('tags')),
      deck,
      order: initial && initial.deck === deck ? initial.order : nextOrder(words, deck),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      ...(shared ? {} : { personal: true }),
    };
    ui.closeSheet();
    void store.saveWord(word).then((ok) => ok && ui.toast(initial ? 'Saved' : `Added “${term}”`));
  };

  const remove = () => {
    if (!initial) return;
    ui.closeSheet();
    void store.deleteWord(initial.id).then((ok) => ok && ui.toast(`Deleted “${initial.term}”`));
  };

  return (
    <BottomSheet
      title={initial ? <span lang="de"><Term term={initial.term} /></span> : 'New word'}
      footer={
        canEdit ? (
          <>
            <button className="btn" onClick={ui.closeSheet}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="word-form">{initial ? 'Save' : 'Add word'}</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={ui.closeSheet}>Close</button>
        )
      }
    >
      <form id="word-form" noValidate onSubmit={onSubmit}>
        <p className="owner-note">
          {shared
            ? canEdit ? 'Lesson word: everyone in your class studies it.' : 'Lesson word from your teacher. Add your own words with the + button.'
            : 'Your own word: only you see and study it.'}
        </p>
        <fieldset className="form" disabled={!canEdit}>
        <div className="field">
          <label htmlFor="f-term">German word or phrase</label>
          <input id="f-term" name="term" defaultValue={initial?.term} required autoComplete="off" autoCapitalize="off" spellCheck={false} lang="de"
            aria-describedby="f-term-hint f-term-err" aria-invalid={!!errors.term} data-autofocus={initial ? undefined : true} />
          {canEdit && <p className="hint" id="f-term-hint">Start nouns with der, die or das to get the gender colour.</p>}
          {errors.term && <p className="err" id="f-term-err">{errors.term}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-meaning">Meaning</label>
          <input id="f-meaning" name="meaning" defaultValue={initial?.meaning} required autoComplete="off" aria-describedby="f-meaning-err" aria-invalid={!!errors.meaning} />
          {errors.meaning && <p className="err" id="f-meaning-err">{errors.meaning}</p>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="f-pron">Pronunciation (IPA)</label>
            <div className="input-wrap">
              <input id="f-pron" name="pronunciation" className="ipa-input" defaultValue={initial?.pronunciation} placeholder="[faˈmiːli̯ə]" autoComplete="off" spellCheck={false} />
              {speech && (
                <button type="button" className="speak" aria-label="Hear the word"
                  onClick={() => speak((document.getElementById('f-term') as HTMLInputElement | null)?.value, data.prefs.ttsLang)}>
                  <Icon name="volume" />
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-pos">Type</label>
            <select id="f-pos" name="pos" defaultValue={initial?.pos ?? ''}>
              <option value="">Detect from the word</option>
              {POS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-forms">Forms</label>
          <input id="f-forms" name="forms" defaultValue={initial?.forms} placeholder="Plural, or verb forms: er spricht · sprach · hat gesprochen" autoComplete="off" lang="de" />
        </div>
        <div className="field">
          <label htmlFor="f-example">Example sentence</label>
          <textarea id="f-example" name="example" rows={2} lang="de" defaultValue={initial?.example} />
        </div>
        <div className="field">
          <label htmlFor="f-exampleTr">Example translation</label>
          <textarea id="f-exampleTr" name="exampleTr" rows={2} defaultValue={initial?.exampleTr} />
        </div>
        {lapses >= LEECH_AT && !initial?.mnemonic && (
          <div className="callout">
            <Icon name="alert" />
            <span>You have forgotten this word {plural(lapses, 'time', 'times')}. A vivid memory hook helps most here.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="f-mnemonic">Memory hook</label>
          <textarea id="f-mnemonic" name="mnemonic" rows={2} placeholder="A picture, a sound-alike, a story that makes it stick" defaultValue={initial?.mnemonic} />
        </div>
        <div className="field">
          <label htmlFor="f-notes">Notes</label>
          <textarea id="f-notes" name="notes" rows={2} defaultValue={initial?.notes} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="f-tags">Tags</label>
            <input id="f-tags" name="tags" defaultValue={(initial?.tags || []).join(', ')} placeholder="family, verbs" autoComplete="off" autoCapitalize="off" />
          </div>
          <div className="field">
            <label htmlFor="f-deck">Deck</label>
            <input id="f-deck" name="deck" defaultValue={deckDefault} list="deck-list" placeholder="Lektion 3" autoComplete="off" />
            <datalist id="deck-list">
              {deckNames(data.words).map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
        </div>
        {initial && (
          <ConfirmButton className="btn btn-danger" confirmLabel="Tap again to delete" onConfirm={remove}>
            Delete word
          </ConfirmButton>
        )}
        </fieldset>
      </form>
      {initial && <ProgressPanel wordId={initial.id} />}
    </BottomSheet>
  );
}

const DIRS = [
  ['f', 'Recognition', 'German → meaning'],
  ['r', 'Production', 'meaning → German'],
] as const;

function ProgressPanel({ wordId }: { wordId: string }) {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const doc = data.cards.get(wordId);
  const today = dayIndex(now);
  const dirs = DIRS.filter(([d]) => enabledDirs(data.prefs).includes(d) || doc?.[d]);

  const toggleSuspend = () => {
    const suspended = !doc?.suspended;
    void store.setSuspended(wordId, suspended);
    ui.toast(suspended ? 'Paused. It will not appear in study sessions.' : 'Back in your study sessions.');
  };
  const reset = () => {
    void store.saveCard(wordId, null);
    ui.toast('Progress reset. The word is new again.');
  };

  return (
    <section className="progress-panel" aria-label="Your progress">
      <h3>Your progress</h3>
      {dirs.map(([d, title, sub]) => {
        const s = doc?.[d] ?? null;
        const info = stateInfo(s, !!doc?.suspended, today);
        return (
          <div key={d} className="dir-block">
            <div className="dir-title">
              <span>{title} <span className="muted small">{sub}</span></span>
              <span><StatusPill info={info} /></span>
            </div>
            {s && s.type !== 'new' ? (
              <>
                <dl className="facts">
                  <div><dt>Due</dt><dd>{dueLabel(info, now)}</dd></div>
                  <div><dt>Interval</dt><dd>{s.type === 'review' ? fmtSpan(s.ivl * DAY) : 'learning'}</dd></div>
                  <div><dt>Ease</dt><dd>{Math.round(s.ease * 100)}%</dd></div>
                  <div><dt>Reviews</dt><dd>{(s.log || []).length}</dd></div>
                  <div><dt>Lapses</dt><dd>{s.lapses}</dd></div>
                </dl>
                <div className="dots" aria-label="Recent answers">
                  {(s.log || []).slice(-12).map((e, i) => <i key={i} className={`r-${e.r}-bg`} title={RATING_LABEL[e.r]} />)}
                  <span className="muted small">&nbsp;recent answers</span>
                </div>
              </>
            ) : (
              <p className="muted small">Not studied yet.</p>
            )}
          </div>
        );
      })}
      <div className="btn-row">
        <button type="button" className="btn" onClick={toggleSuspend}>{doc?.suspended ? 'Resume studying' : 'Pause this word'}</button>
        {doc && (
          <ConfirmButton confirmLabel="Tap again to reset" onConfirm={reset}>
            Reset progress
          </ConfirmButton>
        )}
      </div>
    </section>
  );
}
