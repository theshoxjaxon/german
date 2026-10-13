# Karteikasten (germanApp)

A mobile-first vocabulary app for a learning center. Students study German words with spaced-repetition flashcards, each with their own private progress, and see how their classmates are doing. The teacher manages the words and sees who is active on an admin dashboard.

- **Try it without an account**: anyone can open the app and practise the flashcards as a guest. Progress is kept in that browser, and moves into their profile when they sign up.
- **Accounts**: sign up with the center's join code, log in, log out, change password. Signing up is optional and unlocks Words, Class and Progress.
- **Study**: Anki-style flashcards (SM-2): tap to flip, swipe or tap Again / Hard / Good / Easy. Every student's progress is private.
- **Class**: Snapchat-style daily streaks, each classmate's active-word count, a leaderboard, and cheers you can send each other.
- **Words**: an Airtable-style table and card gallery: search, filter, sort. Teachers edit and import; students read.
- **Admin dashboard** at `/admin`: profiles created, new sign-ups, daily / weekly / monthly active students, 30-day charts, a student table, password resets and the join code.

It starts with the 34 words of **Lektion 3** (German → Uzbek), with IPA, example sentences, plural/verb forms and memory hooks.

Built with Next.js 16 (App Router), React 19, TypeScript and SQLite (libSQL). No database server needed to start.

## Run it

You need **Node.js 20.9 or newer** (`node -v` to check).

```bash
npm install
npm run dev
```

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

## Settings (environment variables)

Copy `.env.example` to `.env.local` and change what you need. All are optional.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | `file:data/karteikasten.db` | Where the data lives. Use a `libsql://…turso.io` URL in production. |
| `DATABASE_AUTH_TOKEN` | – | Token for a Turso database. |
| `DATA_DIR` | `./data` | Folder for the local database file (when `DATABASE_URL` is not set). |
| `JOIN_CODE` | random | The first join code. You can change it later in `/admin`. |
| `APP_TIMEZONE` | `Asia/Tashkent` | When a "day" starts for streaks and daily active users. |
| `COOKIE_SECURE` | auto | Force `true`/`false`. By default the session cookie is Secure whenever the site is on HTTPS. |

## Roles and privacy

| | Guest (no profile) | Student | Admin (teacher) |
| --- | --- | --- | --- |
| Study the flashcards, settings | ✓ (saved in this browser) | ✓ | ✓ |
| Words table, Progress, streaks | – | ✓ | ✓ |
| See classmates' streaks, active words, answers | – | ✓ | ✓ |
| See anyone else's cards | – | – | – |
| Add, edit, import, delete words | – | – | ✓ |
| `/admin`: stats, reset passwords, make admins, delete profiles, change join code | – | – | ✓ |

**Guests.** `/` opens straight to the flashcards. Nothing is sent to the server except the request for the word list, so guests never show up in the admin numbers or the Class tab. The word list itself is public, because guests need it to study. On sign-up, the guest's progress and settings move into the new profile. A guest who logs in to a profile that already has progress is asked first (*Add to my profile* / *No, discard it*), because on a shared classroom computer that guest may have been someone else. Words the profile already studied always keep the profile's progress.

Only counts are shared on the Class tab. Nobody, the admin included, sees another person's individual cards or answers.

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
| `npm test` | Unit + database integration tests (Vitest) |
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
src/lib/server/    repo.ts (all SQL) · db.ts (schema, seed) · session.ts · password.ts · rate-limit.ts
SQLite / Turso     users · sessions · words · cards · prefs · activity · cheers · settings
```

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/state` | anyone | Signed in: you, the words, your progress, settings, new cheers. Guest: `{ me: null, words }` |
| `POST /api/cards/import` | signed in | Add progress made as a guest (never overwrites existing progress) |
| `POST /api/logout` | signed in | Sign out; a plain form post, so the full page reload clears the old profile from memory |
| `PUT/DELETE /api/words/:id`, `POST /api/words` | admin | Edit, delete, import words |
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

**Free option: Vercel + Turso**

1. Create a free database at [turso.tech](https://turso.tech), then copy its URL (`libsql://…`) and an auth token.
2. Import this GitHub repo on [vercel.com](https://vercel.com). Add the environment variables `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `JOIN_CODE` and `APP_TIMEZONE`.
3. Deploy, open `https://<your-app>/signup` and create the first (admin) profile with your `JOIN_CODE`.

**Or a server with a disk** (Render with a persistent disk, Railway, a VPS): `npm run build && npm start`, and keep `data/` (or set `DATA_DIR`) on the persistent disk. Free Render instances lose their files on every restart, so use Turso there.

## Your data

- Local: `data/karteikasten.db` (ignored by git). Stop the app and copy the file to back up.
- Turso: `turso db shell <name> .dump > backup.sql`.
- Table layout, sort, visible fields and the last open tab are remembered per device in `localStorage`.
- Guest progress lives in `localStorage` (`kk.guest.cards`, `kk.guest.prefs`) until it moves into a profile. Clearing the browser's site data deletes it.

## Notes

- `npm run build` prints "Failed to find font override values for Atkinson Hyperlegible …". That is harmless: Next.js has no fallback metrics for these newer fonts yet.
- Pronunciation uses the voices installed on the device. On iPhone, German voices are under Settings → Accessibility → Spoken Content → Voices.
- `npm audit --omit=dev` finds 0 vulnerabilities in what the app runs. The advisories `npm audit` shows are in dev tools (the Vitest 3 test runner and Next.js's ESLint config). Vitest 4+ fixes its part, but npm 10's installer crashes on it; if `npm -v` shows 11 or newer, run `npm i -D vitest@latest`.
