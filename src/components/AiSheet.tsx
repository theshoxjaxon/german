'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AI_LANGUAGES, isAiLanguage, type AiLanguage, type AiResult } from '@/lib/ai-shared';
import { prepareImage, requestAiWords } from '@/lib/client/ai';
import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { suggestDeck } from '@/lib/import-parser';
import { addsSharedWords, MY_WORDS_DECK } from '@/lib/ownership';
import { deckNames, nextOrder } from '@/lib/queue';
import { newId, norm } from '@/lib/text';
import { POS_LABEL, type Word } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { Icon, Term } from './ui';
import { useUI } from './ui-context';

type Mode = 'photo' | 'text';
const isMode = (v: unknown) => v === 'photo' || v === 'text';

/** The language the AI writes meanings in, remembered on this device. Shared with the word form. */
export function useAiLanguage() {
  return useLocalState<AiLanguage>('kk.aiLang', 'en', isAiLanguage);
}

export function LanguageSelect({ id, value, onChange }: { id: string; value: AiLanguage; onChange: (v: AiLanguage) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => isAiLanguage(e.target.value) && onChange(e.target.value)}>
      {AI_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}

/**
 * "Add words with AI": a photo of a vocabulary list, or German words typed one per line.
 * The AI suggests finished flashcards; the person ticks the ones to keep and picks the topic.
 */
export function AiSheet() {
  const data = useStore();
  const ui = useUI();
  const { t, tn } = useT();
  const shared = addsSharedWords(data.me);
  const [mode, setMode] = useLocalState<Mode>('kk.aiMode', 'photo', isMode);
  const [lang, setLang] = useAiLanguage();
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof prepareImage>> | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [deck, setDeck] = useState('');
  const [adding, setAdding] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);

  // Words you already have (any deck) start unticked.
  const known = useMemo(() => new Set([...data.words.values()].map((w) => norm(w.term))), [data.words]);

  if (!data.me) return null; // the AI helper is for profiles

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still triggers onChange
    if (!file) return;
    setError('');
    try {
      setPhoto(await prepareImage(file));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const ready = mode === 'photo' ? !!photo : !!text.trim();
  const run = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    abort.current = new AbortController();
    try {
      const r = await requestAiWords(
        mode === 'photo' && photo ? { mode, language: lang, image: { data: photo.data, mediaType: photo.mediaType } } : { mode: 'text', language: lang, text },
        abort.current.signal,
      );
      setResult(r);
      setPicked(new Set(r.words.flatMap((w, i) => (known.has(norm(w.term)) ? [] : [i]))));
      setDeck(r.topic || (shared ? suggestDeck(deckNames(data.words)) || t('New words') : MY_WORDS_DECK));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => abort.current?.abort();

  const add = async () => {
    if (!result || !picked.size || adding) return;
    const topic = deck.trim();
    setAdding(true);
    const base = nextOrder(store.getSnapshot().words, topic);
    const now = Date.now();
    const list: Word[] = result.words
      .filter((_, i) => picked.has(i))
      .map((w, i) => ({
        ...w,
        id: `${newId()}${i.toString(36)}`,
        notes: '',
        deck: topic,
        order: base + i,
        createdAt: now + i,
        updatedAt: now + i,
        ...(shared ? {} : { personal: true }),
      }));
    const ok = await store.addWords(list);
    setAdding(false);
    if (ok) {
      ui.closeSheet();
      ui.toast(topic ? tn(list.length, 'Added {n} word to {topic}', 'Added {n} words to {topic}', { topic }) : tn(list.length, 'Added {n} word', 'Added {n} words'));
    }
  };

  /* ---------- step 2: review ---------- */
  if (result) {
    const toggle = (i: number) => setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
    const all = picked.size === result.words.length;
    return (
      <BottomSheet
        title={t('Check the words')}
        footer={
          <>
            <button className="btn" onClick={() => setResult(null)}>{t('Back')}</button>
            <button className="btn btn-primary" disabled={!picked.size || !deck.trim() || adding} onClick={add}>
              {adding ? t('Adding…') : picked.size ? tn(picked.size, 'Add {n} word', 'Add {n} words') : t('Add words')}
            </button>
          </>
        }
      >
        {result.words.length === 0 ? (
          <div className="ai-empty" role="status">
            <p><b>{t('No German words found.')}</b></p>
            {result.note && <p className="muted">{result.note}</p>}
            <p className="hint">{t('Try a sharper photo with the word list filling the picture, or type the words instead.')}</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ai-deck">{t('Topic (deck)')}</label>
              <input id="ai-deck" value={deck} onChange={(e) => setDeck(e.target.value)} list="ai-deck-list" autoComplete="off" />
              <datalist id="ai-deck-list">
                {deckNames(data.words).map((d) => <option key={d} value={d} />)}
              </datalist>
              <p className="hint">{t(shared ? 'These become lesson words for everyone in your class.' : 'These become your own words. Only you see them.')}</p>
            </div>
            <div className="ai-list-head">
              <span className="small">{tn(result.words.length, '{k} of {n} word selected', '{k} of {n} words selected', { k: picked.size })}</span>
              <button className="btn btn-quiet btn-sm" onClick={() => setPicked(all ? new Set() : new Set(result.words.map((_, i) => i)))}>
                {t(all ? 'Select none' : 'Select all')}
              </button>
            </div>
            <ul className="ai-list">
              {result.words.map((w, i) => (
                <li key={i}>
                  <label className={`ai-row${picked.has(i) ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                    <span className="ai-main">
                      <span className="ai-term" lang="de"><Term term={w.term} /></span>
                      {w.pronunciation && <span className="ai-ipa">{w.pronunciation}</span>}
                      <span className="ai-meaning">{w.meaning}</span>
                      {w.example && <span className="ai-example" lang="de">{w.example}</span>}
                    </span>
                    <span className="ai-side">
                      <span className="tag">{t(POS_LABEL[w.pos])}</span>
                      {known.has(norm(w.term)) && <span className="ai-dup">{t('You have it')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="hint">{t('The AI can make mistakes. You can edit any word later in Words.')}</p>
          </>
        )}
      </BottomSheet>
    );
  }

  /* ---------- step 1: photo or list ---------- */
  return (
    <BottomSheet
      title={t('Add words with AI')}
      footer={
        busy ? (
          <button className="btn" onClick={cancel}>{t('Cancel')}</button>
        ) : (
          <>
            <button className="btn" onClick={ui.closeSheet}>{t('Close')}</button>
            <button className="btn btn-primary" disabled={!ready} onClick={run}>
              <Icon name="sparkle" /> {t(mode === 'photo' ? 'Find the words' : 'Make flashcards')}
            </button>
          </>
        )
      }
    >
      <div className="form" aria-busy={busy}>
        <span className="seg ai-modes" role="group" aria-label={t('Add from')}>
          <button type="button" className="seg-btn" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')} disabled={busy}><Icon name="camera" />{t('Photo')}</button>
          <button type="button" className="seg-btn" aria-pressed={mode === 'text'} onClick={() => setMode('text')} disabled={busy}><Icon name="table" />{t('Type words')}</button>
        </span>

        {mode === 'photo' ? (
          <div className="ai-photo">
            <p className="lede">{t('Take a photo of a word list: a textbook page, a worksheet, the whiteboard or your notes. The AI finds the German words and fills in the rest.')}</p>
            {photo ? (
              <figure className="ai-preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview */}
                <img src={photo.preview} alt={t('The photo you chose')} />
                <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)} disabled={busy}>{t('Choose another')}</button>
              </figure>
            ) : (
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}><Icon name="camera" /> {t('Take a photo')}</button>
                <button type="button" className="btn" onClick={() => galleryRef.current?.click()}><Icon name="image" /> {t('Choose a picture')}</button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="ai-text">{t('German words, one per line')}</label>
            <textarea id="ai-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} spellCheck={false} autoCapitalize="off" data-autofocus
              placeholder={'Bahnhof\nder Zug\nfahren\numsteigen – to change trains'} />
            <p className="hint">{t('Just the German is enough. The AI adds the article, meaning, pronunciation, forms, an example and a memory hook. Meanings you type are kept.')}</p>
          </div>
        )}

        <div className="field">
          <label htmlFor="ai-lang">{t('Meanings in')}</label>
          <LanguageSelect id="ai-lang" value={lang} onChange={setLang} />
        </div>

        {busy && (
          <p className="ai-status" role="status">
            <span className="spinner" aria-hidden="true" />
            {t(mode === 'photo' ? 'Reading your photo… this can take up to a minute.' : 'Making your flashcards…')}
          </p>
        )}
        {error && <p className="err" role="alert">{t(error)}</p>}
        <p className="hint">{t(mode === 'photo' ? 'The photo is sent to Claude, Anthropic’s AI, to read the words. The app doesn’t keep it.' : 'Your list is sent to Claude, Anthropic’s AI.')}</p>
      </div>
    </BottomSheet>
  );
}
