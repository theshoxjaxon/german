# Karteikasten (germanApp)

A mobile-first app for learning hard vocabulary. It combines two ideas:

- **Anki-style flashcards** with spaced repetition (SM-2): tap to flip, swipe or tap Again / Hard / Good / Easy.
- **An Airtable-style word database**: a table and a card gallery you can search, filter, sort and edit.

It starts with the 34 words of **Lektion 3** (German → Uzbek), with IPA, example sentences, plural/verb forms and memory hooks.

Built with Next.js 16 (App Router), React 19 and TypeScript. No database server needed: your words and progress are saved in `data/store.json`.

## Run it

You need **Node.js 20.9 or newer** (`node -v` to check).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Use it on your phone

Run the app on your computer and open it from your phone on the same Wi-Fi:

```bash
npm run dev -- -H 0.0.0.0
```

Find your computer's local IP (macOS: `ipconfig getifaddr en0`, Windows: `ipconfig`) and open `http://<that-ip>:3000` on the phone. Use **Share → Add to Home Screen** to get a full-screen app icon. Phone and computer share the same `data/store.json`, so progress follows you between them.

For a faster production server: `npm run build` then `npm start`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest): SRS engine, queue, parser, search |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |

## Features

- **Study tab**: today's New / Learning / To review counts, deck picker, a 7-day "coming up" strip, leech warnings.
- **Review mode**: full screen, index-card design, 3D flip, swipe left = Again, swipe right = Good, rating buttons that show the next interval, undo, pronunciation through the browser's German voice, keeps the screen awake.
  Keyboard: `Space` flip (then Good), `1–4` rate, `Z` undo, `P` play the word, `Esc` end.
- **Words tab**: table with a sticky header and word column, or a card gallery. Search (treats `o’ o' oʻ` and umlauts as equal), filter by deck / status / der-die-das / type / tag, sort (A–Z ignores the article), choose visible fields, copy as CSV.
- **Record sheet**: edit every field, see progress per card direction, pause or reset a word, delete it.
- **Import**: paste a list (`word – meaning`, tab, `=`, `;`, or meaning on the next line). A `Lektion 4` line becomes the deck name. Duplicates are skipped.
- **Progress tab**: streak, 30-day retention, the Leitner box ("Fach 1–5"), a 14-day forecast, the last 14 days of answers, and your hardest words.
- **Settings**: new cards per day, reviews per day, recognition and/or production cards, learning steps, voice language, auto-play, reset progress.

## How the scheduling works

All of it is in `src/lib/srs.ts` (pure functions, tested in `src/lib/srs.test.ts`).

1. **New cards** go through short learning steps: 1 minute, then 10 minutes. Ease is not changed here.
2. When you get a card right, it **graduates** to a 1-day interval (Easy: 4 days).
3. **Review cards** grow by the card's ease factor (EF, starting at 2.5):
   - Good: `interval × EF`
   - Hard: `interval × 1.2`
   - Easy: `interval × EF × 1.3`
4. After each review, EF is updated with the SM-2 formula, where Again = 2, Hard = 3, Good = 4, Easy = 5:

   `EF' = EF + 0.1 − (5 − q)(0.08 + (5 − q) · 0.02)`, never below 1.3

   Worked example, Hard (q = 3): 5 − 3 = 2 → 0.08 + 2 × 0.02 = 0.12 → 2 × 0.12 = 0.24 → 0.1 − 0.24 = **−0.14**.
5. **Again** on a review card is a lapse: the interval halves, EF drops by 0.32, and the card goes back to a 10-minute relearning step. After 4 lapses a word is flagged as a **leech**.
6. A small ±5% seeded "fuzz" spreads words you learned together over neighbouring days. Because it is seeded, the time on each button is exactly what you get.

Pressing Good every time gives intervals of 1 → 4 → 10 → 24 → 60 → 144 days.

## Architecture

```
Browser (React client components)
  useStore()  ── useSyncExternalStore ──►  src/lib/client/store.ts
                                             optimistic writes, rollback on error,
                                             one request at a time per document
        │ fetch
        ▼
Route handlers (src/app/api/*)  ── validate input (src/lib/server/validate.ts)
        │
        ▼
src/lib/server/db.ts  ── data/store.json (atomic write: temp file + rename, one write queue)
```

| Endpoint | Purpose |
| --- | --- |
| `GET /api/state` | All words, progress and settings |
| `PUT /api/words/:id` / `DELETE /api/words/:id` | Create/replace or delete a word (delete also removes its progress) |
| `POST /api/words` | Add many words at once (Import) |
| `PUT /api/cards/:wordId` / `DELETE /api/cards/:wordId` | Save or reset one word's progress |
| `DELETE /api/cards` | Reset all progress |
| `PUT /api/prefs` | Save settings |

Ids are created on the client, so creating a word is an idempotent `PUT`: a retried request can never create a duplicate.

```
src/
  app/            layout (fonts, viewport), page, manifest, icons, globals.css, api/
  components/     KarteikastenApp (shell), StudyView, ReviewSession, WordsView,
                  WordSheet, ImportSheet, WordsSheets, SettingsSheet, StatsView, BottomSheet, ui
  lib/            types, srs, queue (what to study next + stats), words-view (search/filter/sort),
                  text, time, import-parser, seed
  lib/client/     store, hooks (clock, localStorage state), speech
  lib/server/     db, validate, http
```

## Your data

- Everything lives in `data/store.json` (created on first start, ignored by git). Copy that file to back up.
- Delete it to start over with the Lektion 3 list.
- Set `DATA_DIR=/some/folder` to keep it somewhere else.
- Table layout, sort and visible fields are remembered per device in `localStorage`.

## Deploying

The JSON file needs a persistent disk, so this works on a VPS, Render or Railway, but not on serverless hosts like Vercel (their file system is read-only). To deploy there, replace `src/lib/server/db.ts` with a real database (Postgres, SQLite/Turso, etc.). The route handlers only use `readData()` and `mutate()`, so that is the only file to change. For several users you would also add sign-in and key progress by user id.

## Notes

- `npm run build` prints "Failed to find font override values for Atkinson Hyperlegible …". That is harmless: Next.js has no fallback metrics for these newer fonts yet.
- Pronunciation uses the voices installed on your device. On iPhone, German voices are under Settings → Accessibility → Spoken Content → Voices.
