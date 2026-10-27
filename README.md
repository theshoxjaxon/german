# Karteikasten (germanApp)

A mobile-first vocabulary app for a learning center. Students study German words with spaced-repetition flashcards, each with their own private progress, and see how their classmates are doing. The teacher manages the words and sees who is active on an admin dashboard.

- **Try it without an account**: anyone can open the app and practise the flashcards as a guest. Progress is kept in that browser, and moves into their profile when they sign up.
- **Accounts**: sign up with the center's join code, log in, log out, change password. Signing up is optional and unlocks Words, Class and Progress.
- **Study**: Anki-style flashcards (SM-2): tap to flip, swipe or tap Again / Hard / Good / Easy. Every student's progress is private.
- **Class**: Snapchat-style daily streaks, each classmate's active-word count, a leaderboard, and cheers you can send each other.
- **Words**: an Airtable-style table and card gallery: search, filter, sort. Teachers manage the shared lesson words; every student can also add **their own words**, which only they see and study.
- **AI word helper** (optional): take a photo of a word list (textbook page, worksheet, whiteboard, notes) or type German words, and Claude turns them into finished flashcards: article, meaning, IPA, forms, an example sentence and a memory hook. You tick the ones to keep and pick the topic. In the word form, **Fill in the rest with AI** completes a single word.
- **Admin dashboard** at `/admin`: profiles created, new sign-ups, daily / weekly / monthly active students, 30-day charts, a student table, password resets and the join code.

It comes with **Lektion 3** (34 words) and **Lektion 5** (59 words), German → Uzbek, with IPA, example sentences, plural/verb forms and memory hooks. New built-in lists are added to an existing database once, on the next start (`SEED_PACKS` in `src/lib/seed.ts`); words the teacher deleted don't come back, and words already typed in by hand aren't doubled.

Built with Next.js 16 (App Router), React 19, TypeScript and PostgreSQL (Supabase).

## Run it

You need **Node.js 20.9 or newer** (`node -v` to check) and a Postgres database. A free Supabase project is the easiest (2 minutes, see [Supabase](#supabase) below).

```bash
npm install
cp .env.example .env.local   # then paste your Supabase connection string into DATABASE_URL
npm run dev
```

The tables are created on the first start.

The terminal prints a line like:

```
Karteikasten: no profiles yet. Sign up with join code K7M2QX — the first profile becomes the admin.
```

1. Open http://localhost:3000/signup and create your profile with that code. **The first profile is the admin (teacher).**
2. Open http://localhost:3000/admin to see the dashboard and the join code.
3. Give the join code to your students. They sign up at `/signup` on their phones.

### Use it on phones in the classroom

Run it on your computer and open it from phones on the same Wi-Fi:

```bash
npm run dev -- -H 0.0.0.0
```

Find your computer's local IP (macOS: `ipconfig getifaddr en0`, Windows: `ipconfig`) and open `http://<that-ip>:3000`. **Share → Add to Home Screen** gives a full-screen app icon. To let students use it from home, deploy it (see below).

## Supabase

1. Create a free project at [supabase.com](https://supabase.com). Pick the region closest to your students and to where the app runs (for Uzbekistan, Frankfurt `eu-central-1` is a good choice). Save the database password it asks for.
2. In the project, press **Connect** and copy a connection string:
   - **Transaction pooler** (port 6543) when the app runs on Vercel or other serverless hosting.
   - **Session pooler** (port 5432) works for `npm run dev` and for a normal server.
3. Put it in `.env.local` as `DATABASE_URL`, with your password in place of `[YOUR-PASSWORD]` (brackets included). Passwords with special characters (`@ # / ? % +`) work as they are; the app encodes them. Keep the password only in `.env.local` (ignored by git), never in `.env.example`.
4. `npm run dev`. On the first start the app creates its tables, loads the Lektion 3 words and prints the join code.

Open **Table Editor** in Supabase to see the data: `users` (profiles; `password_hash` is a one-way scrypt hash, never the password), `words`, `cards` (each person's progress), and so on. The app talks to Postgres directly from the server, so you don't need Supabase's API keys or `supabase-js`. Row Level Security is switched on for every table with no policies, which keeps them closed to Supabase's public REST API.

**Why it stays fast**

- One connection pool per server process; with Supabase's pooler, many app instances share a few database connections.
- Every query is served by a primary key or an index (`words.owner_id`, `cards (user_id, word_id)`, `activity.day`, …).
- Opening the app costs 2 round trips to the database (session check, then words + progress + settings + cheers in parallel). Saving an answer is 2 round trips, and the screen never waits for them: the app updates instantly and saves in the background.
- Actions that touch several tables (save an answer and count it for today; move guest progress into a profile) are a single SQL statement.
- Keep the database and the app in the same region: each round trip then takes a few milliseconds instead of ~100.

## AI word helper

Set `ANTHROPIC_API_KEY` in `.env.local` (create a key at [console.anthropic.com](https://console.anthropic.com) → API keys) and restart. A ✨ button appears on the Words tab for everyone with a profile.

- **Photo** → Claude finds the German words on the page (with their translations, if the page has them) and fills in everything else. **Type words** does the same for a list you type; meanings you type are kept.
- Meanings and example translations can be in English, Uzbek or Russian (picker in the sheet, remembered per device).
- Nothing is saved until you press **Add**: you see every word first, untick mistakes, and pick the topic (deck). Words you already have start unticked.
- Teachers add lesson words for everyone; students add their own words.
- Limits: 20 uses per hour for students, 60 for admins. Photos are shrunk to 2000 px before upload, sent to Anthropic's API to be read, and not stored by the app.
- Cost estimate (Claude Opus 5.5 at $4 / $20 per million input / output tokens; the written-out flashcards are most of it): about 5–10 US cents for a photo of 20 words, about 1 cent for a single "Fill in". Check real spend in the Anthropic Console. Set `AI_MODEL` to use a different model.

How it works: `src/lib/server/ai.ts` makes one streamed request with the image (or list), a system prompt describing a good flashcard, and a JSON schema the answer must follow (`output_config.format`). If Claude's safety checks decline a request, `fallbacks: "default"` lets the API retry it on its recommended fallback model. The answer is validated like any user input before the client sees it.

## Settings (environment variables)

Copy `.env.example` to `.env.local`. Only `DATABASE_URL` is required.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | – (required) | Postgres connection string (Supabase → Connect). |
| `DATABASE_CA_CERT` | – | Supabase's CA certificate, to also verify the server's identity. Without it the connection is still encrypted. |
| `DATABASE_POOL_MAX` | `5` | Database connections per server process. |
| `ANTHROPIC_API_KEY` | – | Turns on the AI word helper. Without it the AI buttons don't appear. |
| `AI_MODEL` | `claude-opus-5-5` | The Claude model the AI helper uses. |
| `AI_ENABLED` | auto | `false` hides the AI helper even with a key; `true` turns it on with other Anthropic credentials (e.g. `ant auth login`). |
| `JOIN_CODE` | random | The first join code. You can change it later in `/admin`. |
| `APP_TIMEZONE` | `Asia/Tashkent` | When a "day" starts for streaks and daily active users. |
| `COOKIE_SECURE` | auto | Force `true`/`false`. By default the session cookie is Secure whenever the site is on HTTPS. |

## Roles and privacy

| | Guest (no profile) | Student | Admin (teacher) |
| --- | --- | --- | --- |
| Study the flashcards, settings | ✓ (saved in this browser) | ✓ | ✓ |
| Words table, Progress, streaks | – | ✓ | ✓ |
| Add, edit, import, delete **your own** words (only you see them) | – | ✓ | – |
| See classmates' streaks, active words, answers | – | ✓ | ✓ |
| See anyone else's cards | – | – | – |
| Add, edit, import, delete the shared lesson words | – | – | ✓ |
| `/admin`: stats, reset passwords, make admins, delete profiles, change join code | – | – | ✓ |

**Guests.** `/` opens straight to the flashcards. Nothing is sent to the server except the request for the word list, so guests never show up in the admin numbers or the Class tab. The word list itself is public, because guests need it to study. On sign-up, the guest's progress and settings move into the new profile. A guest who logs in to a profile that already has progress is asked first (*Add to my profile* / *No, discard it*), because on a shared classroom computer that guest may have been someone else. Words the profile already studied always keep the profile's progress.

Only counts are shared on the Class tab. Nobody, the admin included, sees another person's individual cards, answers or own words.

**Words.** One `words` table holds both kinds: `owner_id` is empty for a shared lesson word and holds the student's id for their own word. The server only ever returns the shared words plus your own, and only lets the owner (or, for lesson words, an admin) change or delete a word. Each person can have up to 2,000 own words. Deleting a profile deletes their own words and progress with it.

**Forgotten password?** In `/admin`, open the student → **Reset password**. You get a temporary password like `tante-fest-4821` to give them; they change it under *Your profile → Change password*.

## What the admin numbers mean

| Number | Definition |
| --- | --- |
| Profiles created | All accounts, admins included |
| New this week | Profiles created in the last 7 days |
| Studied today (daily active) | Answered at least one card today |
| Opened today | Opened the app today, whether or not they studied |
| Active this week / month | Studied on at least one of the last 7 / 30 days |
| Streak | Days in a row with at least one answer (today counts once you study) |
| Active words | Words a student has started learning and not paused |

"Today" follows `APP_TIMEZONE`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit + database integration tests (Vitest). The database tests run on PGlite, an in-memory Postgres, so they need no setup. `TEST_DATABASE_URL=postgres://… npm test` runs them on a real Postgres instead (use an empty database you can throw away). |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |

## How the scheduling works

All of it is in `src/lib/srs.ts` (pure functions, tested in `src/lib/srs.test.ts`).

1. **New cards** go through short learning steps: 1 minute, then 10 minutes.
2. When you get a card right, it **graduates** to a 1-day interval (Easy: 4 days).
3. **Review cards** grow by the card's ease factor (EF, starting at 2.5): Good `× EF`, Hard `× 1.2`, Easy `× EF × 1.3`.
4. After each review, EF is updated with the SM-2 formula, where Again = 2, Hard = 3, Good = 4, Easy = 5:

   `EF' = EF + 0.1 − (5 − q)(0.08 + (5 − q) · 0.02)`, never below 1.3

   Worked example, Hard (q = 3): 5 − 3 = 2 → 0.08 + 2 × 0.02 = 0.12 → 2 × 0.12 = 0.24 → 0.1 − 0.24 = **−0.14**.
5. **Again** on a review card halves the interval, drops EF by 0.32 and sends the card to a 10-minute relearning step. After 4 lapses a word is a **leech**.
6. A small ±5% seeded "fuzz" spreads words learned together over neighbouring days.

Pressing Good every time gives intervals of 1 → 4 → 10 → 24 → 60 → 144 days.

## Architecture

```
Browser
  /login, /signup ── Server Actions (src/app/actions/auth.ts) ── scrypt hash, session cookie
  /               ── client app ── useStore() ── fetch /api/*  (guests: localStorage for progress)
  /admin          ── Server Component behind <Suspense> ── Server Actions (src/app/admin/actions.ts)

src/proxy.ts       /admin without a session cookie → redirect to /login (fast first check only)
src/app/api/*      requireUser() on every route: valid session, role, same-origin
src/lib/server/    repo.ts (all SQL) · db.ts (pool, schema, seed) · session.ts · password.ts · rate-limit.ts
Postgres/Supabase  users · sessions · words · cards · prefs · activity · cheers · settings
```

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/state` | anyone | Signed in: you, the words, your progress, settings, new cheers. Guest: `{ me: null, words }` |
| `POST /api/cards/import` | signed in | Add progress made as a guest (never overwrites existing progress) |
| `GET /api/health` | anyone | Is the database reachable, and if not, why (no secrets shown) |
| `POST /api/ai/words` | signed in | AI word helper: photo or typed list → suggested flashcards (nothing is saved) |
| `POST /api/logout` | signed in | Sign out; a plain form post, so the full page reload clears the old profile from memory |
| `PUT/DELETE /api/words/:id`, `POST /api/words` | signed in | Add, edit, delete, import words: admins the shared lesson words, everyone else their own |
| `PUT/DELETE /api/cards/:wordId`, `DELETE /api/cards` | signed in | Save or reset **your** progress |
| `PUT /api/prefs` | signed in | Your settings |
| `GET /api/class` | signed in | Classmates' streaks and counts |
| `POST /api/cheers`, `POST /api/cheers/seen` | signed in | Send a cheer (1 per classmate per day), mark yours as read |

### Security

- Passwords: scrypt (N=2¹⁵) with a random salt; comparison in constant time; unknown usernames take the same time as wrong passwords.
- Sessions: a random 256-bit token in an **HttpOnly, SameSite=Lax** cookie (Secure on HTTPS). The database stores only its SHA-256, so a leaked database can't be used to log in. 30-day sliding expiry; a password change or reset signs out other devices.
- Every API route and Server Action checks the session and role on the server. Hiding a button is never the protection.
- Mutating requests from other sites are rejected (Origin check, on top of SameSite cookies and Next.js's own Server Action origin check).
- Login and sign-up are rate-limited per IP and username. This is in memory: with several server instances, use a shared store such as Redis.
- Sign-up needs the center's join code, so strangers can't create profiles. Make a new code in `/admin` if it leaks.

## Deploying

**Free option: Vercel + Supabase**

1. Create the Supabase project (see [Supabase](#supabase)) and copy the **Transaction pooler** connection string (port 6543). Not the "Direct connection": that one is IPv6-only and Vercel can't reach it.
2. Import this GitHub repo on [vercel.com](https://vercel.com). Set the function region to the one closest to your Supabase project (Project Settings → Functions).
3. In Vercel → Project → **Settings → Environment Variables**, add `DATABASE_URL` (the pooler string with your password, no quotes, for the **Production** environment), plus `JOIN_CODE`, `APP_TIMEZONE` and, for the AI helper, `ANTHROPIC_API_KEY`. `.env.local` is never uploaded, so this step is required.
4. **Redeploy** (Deployments → ⋯ → Redeploy): environment variables only reach new deployments.
5. Open `https://<your-app>/api/health`. It should say `"ok": true`. Then open `/signup` and create the first (admin) profile with your `JOIN_CODE`.

**"This page couldn’t load … A server error occurred"** when logging in or signing up means the server can't use the database. Open `https://<your-app>/api/health`: it names the problem (missing `DATABASE_URL`, wrong password, host not found, paused Supabase project, …) and what to do, without showing any secrets. Supabase pauses free projects after about a week without activity; restore it from the Supabase dashboard.

**Or any Node.js server** (Render, Railway, a VPS): set the same variables, then `npm run build && npm start`.

## Your data

- Everything lives in your Postgres database. Supabase backs it up daily (paid plans add point-in-time recovery). For your own copy: `pg_dump "$DATABASE_URL" > backup.sql`.
- Table layout, sort, visible fields and the last open tab are remembered per device in `localStorage`.
- Guest progress lives in `localStorage` (`kk.guest.cards`, `kk.guest.prefs`) until it moves into a profile. Clearing the browser's site data deletes it.

## Notes

- `npm run build` prints "Failed to find font override values for Atkinson Hyperlegible …". That is harmless: Next.js has no fallback metrics for these newer fonts yet.
- Pronunciation uses the voices installed on the device. On iPhone, German voices are under Settings → Accessibility → Spoken Content → Voices.
- `npm audit --omit=dev` finds 0 vulnerabilities in what the app runs. The advisories `npm audit` shows are in dev tools (the Vitest 3 test runner and Next.js's ESLint config). Vitest 4+ fixes its part, but npm 10's installer crashes on it; if `npm -v` shows 11 or newer, run `npm i -D vitest@latest`.
