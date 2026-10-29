# Karteikasten (germanApp)

A mobile-first vocabulary app for a learning center. Students study German words with spaced-repetition flashcards, each with their own private progress, and see how their classmates are doing. The teacher manages the words and sees who is active on an admin dashboard.

- **Try it without an account**: anyone can open the app, practise the flashcards and browse the word list as a guest. Progress is kept in that browser, and moves into their profile when they sign up.
- **Accounts**: sign up free with **Continue with Google** or with name, email and password. Forgot your password? An emailed link (via Resend) lets you choose a new one. Everyone who signs up is in the one class and on its leaderboard (no class code for now). Email addresses are private: students never see one, not even their own; only the admin does.
- **Study**: Anki-style flashcards (SM-2): tap to flip, swipe or tap Again / Hard / Good / Easy (keys: Space, 1–4, Z to undo). For nouns, a **der / die / das quiz** comes first. A **daily goal** ring and your **streak** sit on the home screen; ending a session early shows what you did first. Every student's progress is private.
- **Oʻzbekcha / English**: the whole student app speaks Uzbek or English (switch in Study settings, or on the login and sign-up pages). The admin pages stay in English.
- **Class**: Snapchat-style daily streaks, each classmate's active-word count, a leaderboard, and cheers you can send each other.
- **Words**: an Airtable-style table and card gallery: search, filter, sort. Teachers manage the shared lesson words; every student can also add **their own words**, which only they see and study.
- **AI word helper** (optional): take a photo of a word list (textbook page, worksheet, whiteboard, notes) or type German words, and Claude turns them into finished flashcards: article, meaning, IPA, forms, an example sentence and a memory hook. You tick the ones to keep and pick the topic. In the word form, **Fill in the rest with AI** completes a single word.
- **Admin dashboard** at `/admin`: profiles created, new sign-ups, daily / weekly / monthly active students, 30-day charts, a student table with emails, password resets, the sign-up link to share, and **which lesson the class is on**.

It comes with eight lessons of Momente, German → Uzbek, 442 words in all, each with IPA, an example sentence, plural or verb forms and a memory hook:

| Lektion | Words | Topics |
| --- | --- | --- |
| 2 | 61 | age, family status, jobs |
| 3 | 34 | family, languages |
| 4 | 48 | home, furniture, shopping and prices |
| 5 | 59 | things, colours, asking how to say and spell words |
| 7 | 46 | hobbies, compliments, *können* |
| 8 | 47 | free time, making plans, weekdays, telling the time |
| 9 | 85 | food, café and restaurant, the working day |
| 10 | 62 | travel: airport, station, phoning |

Lektion 2, 4, 8, 9 and 10 follow the class's own word lists, with their Uzbek meanings checked and corrected. Words tagged `extra` aren't in those lists: useful words for the topic (the weekdays, furniture, bread and tea, the bus stop …). Austrian and Swiss variants (*Hendl*, *Schlagobers*, *Perron* …) are in the notes of the standard word rather than cards of their own. A word is never in two lessons. New built-in lists are added to an existing database once, on the next start (`SEED_PACKS` in `src/lib/seed.ts`); words the teacher deleted don't come back, and words already typed in by hand aren't doubled.

Built with Next.js 16 (App Router), React 19, TypeScript and PostgreSQL (Supabase).

## Run it

You need **Node.js 20.9 or newer** (`node -v` to check) and a Postgres database. A free Supabase project is the easiest (2 minutes, see [Supabase](#supabase) below).

```bash
npm install
cp .env.example .env.local   # then paste your Supabase connection string into DATABASE_URL
npm run dev
```

The tables are created on the first start.

**Become the admin (teacher).** Put your email in `ADMIN_EMAILS` in `.env.local`, then either:

- **Continue with Google** on http://localhost:3000/login with that address (needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, see [Sign in with Google](#sign-in-with-google)), or
- sign up at http://localhost:3000/signup with that email and a password, then prove the address once: **Forgot password?** → your email → open the link (without `RESEND_API_KEY` it is printed in the terminal) → choose a password → log in.

Then open http://localhost:3000/admin. Share the sign-up link with your students; everyone who signs up joins the class leaderboard.

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
4. `npm run dev`. On the first start the app creates its tables and loads the built-in word lists.

Open **Table Editor** in Supabase to see the data: `users` (profiles; `password_hash` is a one-way bcrypt hash, never the password), `words`, `cards` (each person's progress), `password_reset_tokens` and `rate_limits` (only hashes), and so on. The app talks to Postgres directly from the server, so you don't need Supabase's API keys or `supabase-js`. Row Level Security is switched on for every table with no policies, which keeps them closed to Supabase's public REST API.

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

## Sign in with Google

1. [Google Cloud Console](https://console.cloud.google.com) → pick or create a project → **APIs & Services → OAuth consent screen**: app name *Karteikasten*, your support email; audience **External**; publish it (*In production*) so anyone can sign in. The app only asks for the basic scopes (`openid`, `email`, `profile`), which need no Google review.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized JavaScript origins** add `http://localhost:3000`, `http://localhost` and `https://german-roan.vercel.app` (plus your own domain if you add one). **Authorized redirect URIs** can stay empty: the button uses Google's popup and hands the app an ID token directly.
3. Copy the **Client ID** (`….apps.googleusercontent.com`) into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. There is no client secret to set.

The server checks every Google ID token with `google-auth-library` (signature, audience = your client ID, issuer, expiry) before using it. The first Google sign-in creates the profile, or links the profile that already has that email (only when Google says the address is verified). Changes in Google Cloud can take a few minutes to apply.

## Password emails (Resend)

1. Create a free account at [resend.com](https://resend.com) → **API Keys** → create one → `RESEND_API_KEY`.
2. **Domains** → add your domain and set the DNS records it shows, then use an address on it as `EMAIL_FROM` (e.g. `Karteikasten <noreply@your-domain.uz>`). Until then, Resend's test sender `onboarding@resend.dev` only delivers to your own Resend account's email.
3. Set `APP_URL` if the app runs on your own domain (on Vercel it defaults to the production domain).

Without `RESEND_API_KEY`, `npm run dev` prints the reset link in the terminal so you can test the whole flow. Links work once, for 45 minutes; a new request replaces older links, and using one signs the profile out on every device.

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
| `ADMIN_EMAILS` | – | Your email (comma-separated for several). It becomes admin once proven: via Google, or a password reset link. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | – | Google OAuth Web client ID. Turns on **Continue with Google**. Public; needs a rebuild to change. |
| `RESEND_API_KEY` | – | Sends the password emails. Secret. Without it, development prints the link in the terminal. |
| `EMAIL_FROM` | `Karteikasten <onboarding@resend.dev>` | The sender of password emails; its domain must be verified in Resend. |
| `APP_URL` | Vercel's production domain | The site's address for links in emails. |
| `APP_TIMEZONE` | `Asia/Tashkent` | When a "day" starts for streaks and daily active users. |
| `COOKIE_SECURE` | auto | Force `true`/`false`. By default the session cookie is Secure whenever the site is on HTTPS. |

## Roles and privacy

| | Guest (no profile) | Student | Admin (teacher) |
| --- | --- | --- | --- |
| Study the flashcards, settings | ✓ (saved in this browser) | ✓ | ✓ |
| Browse the word list | ✓ (read-only) | ✓ | ✓ |
| Progress, streak, daily goal | goal and streak on this device | ✓ | ✓ |
| Add, edit, import, delete **your own** words (only you see them) | – | ✓ | – |
| Class leaderboard: classmates' streaks, active words, answers; send cheers | – | ✓ | ✓ |
| AI word helper (costs the center API credit; hourly limit) | – | ✓ | ✓ |
| See email addresses (anyone's, or your own) | – | – | ✓ |
| See anyone else's cards | – | – | – |
| Add, edit, import, delete the shared lesson words | – | – | ✓ |
| `/admin`: stats, emails, reset passwords, make admins, take people off the leaderboard, delete profiles | – | – | ✓ |
| `/admin/analytics`: North Star, funnel, retention | – | – | ✓ |

**One class, no code (for now).** Everyone who signs up is in the class and on its leaderboard, and can use the AI helper. A teacher can take someone off the leaderboard in `/admin` (they keep studying, but aren't listed and can't send cheers). A class code can come back later if the center grows to several classes.

**The class lesson.** In `/admin`, set *The class is on* to the lesson the class has reached. Studying “All decks”, everyone (guests too) then gets new words from that lesson first, then the lessons before it, newest first (10, 9, 8 …), so nobody starting today is sent back to Lektion 2 first. Later lessons wait until you move the setting on; anyone can still tap a lesson to study it early, and words already started keep their reviews. The lesson is marked *class* on the Study screen. Not set: new words come in book order.

**Admins.** Nobody becomes admin by signing up first. An address in `ADMIN_EMAILS` becomes admin once it's proven to be theirs: a Google sign-in (Google verified the address) or a password reset link sent to it. An admin can make others admin in `/admin`.

**Email privacy.** Students see names and photos, never email addresses: not classmates', and not their own (the menu and `/account` show only name and photo). The server leaves emails out of everything it sends a student; only admins get them.

**Language.** Each person picks Oʻzbekcha or English in Study settings; it is saved with their settings, so it follows them to every device, and the browser remembers it for the login page. Before anyone chooses, Uzbek phones get Uzbek. The translations live in `src/lib/i18n-uz.ts`, keyed by the English text; `i18n.test.ts` fails if any text the app shows is missing there. The built-in memory hooks are content, not interface, and are still in English.

**Guests.** `/` opens straight to the flashcards. Guest progress stays in the browser; guests never show up in the admin numbers or the Class tab. For the funnel on `/admin/analytics` the browser sends one anonymous count a day: a random id it made up (kept in `localStorage` as `kk.visitor`) and whether it has answered a card. No name, no cookie, no IP address is stored. If that browser later signs up, the id is linked to the new profile, so the funnel can tell who tried the app first. The word list itself is public, because guests need it to study. On sign-up, the guest's progress and settings move into the new profile. A guest who logs in to a profile that already has progress is asked first (*Add to my profile* / *No, discard it*), because on a shared classroom computer that guest may have been someone else. Words the profile already studied always keep the profile's progress.

Only counts are shared on the Class tab. Nobody, the admin included, sees another person's individual cards, answers or own words.

**Words.** One `words` table holds both kinds: `owner_id` is empty for a shared lesson word and holds the student's id for their own word. The server only ever returns the shared words plus your own, and only lets the owner (or, for lesson words, an admin) change or delete a word. Each person can have up to 2,000 own words. Deleting a profile deletes their own words and progress with it.

**Forgotten password?** *Forgot password?* on the login page emails a link (it always answers "If that email exists, we've sent a link", so nobody can test which addresses have profiles). Google-only profiles use the same link to set a password. A teacher can also open the student in `/admin` → **Reset password** for a temporary password like `tante-fest-4821`; they change it under *Your profile → Account and password*.

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
  /login, /signup, /forgot-password, /reset-password, /account
                  ── Server Actions (src/app/actions/auth.ts): zod, bcrypt, session cookie, Resend
                  ── Google button → POST /api/auth/google (google-auth-library checks the ID token)
  /               ── client app ── useStore() ── fetch /api/*  (guests: localStorage for progress)
  /admin          ── Server Component behind <Suspense> ── Server Actions (src/app/admin/actions.ts)

src/proxy.ts       /admin, /account without a session cookie → /login?next=… (fast first check only)
src/app/api/*      requireUser() on every route: valid session, role, same-origin
src/lib/server/    repo.ts (all SQL) · db.ts (pool, schema, seed) · session.ts · password.ts · rate-limit.ts
                   google.ts · mail.ts · admins.ts
src/lib/           auth-schemas.ts (zod: the same rules in the browser and on the server)
Postgres/Supabase  users · sessions · password_reset_tokens · rate_limits · words · cards · prefs · activity · cheers · settings
```

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/state` | anyone | Signed in: you, the words, your progress, settings, new cheers. Guest: `{ me: null, words }` |
| `GET /api/me` | signed in | Who you are: name, photo, role, how you log in (email for admins only); 401 when signed out |
| `POST /api/auth/google` | anyone | `{ credential }` from the Google button → verifies it, signs in (creates or links the profile) |
| `POST /api/cards/import` | signed in | Add progress made as a guest (never overwrites existing progress) |
| `GET /api/health` | anyone | Is the database reachable, and if not, why (no secrets shown) |
| `POST /api/visit` | anyone | Anonymous guest count for the funnel: `{ id, tried }`, at most once a day per browser (rate limited) |
| `POST /api/ai/words` | signed in | AI word helper: photo or typed list → suggested flashcards (nothing is saved) |
| `POST /api/logout` | signed in | Sign out; a plain form post, so the full page reload clears the old profile from memory |
| `PUT/DELETE /api/words/:id`, `POST /api/words` | signed in | Add, edit, delete, import words: admins the shared lesson words, everyone else their own |
| `PUT/DELETE /api/cards/:wordId`, `DELETE /api/cards` | signed in | Save or reset **your** progress |
| `PUT /api/prefs` | signed in | Your settings |
| `GET /api/class` | signed in | The leaderboard: classmates' streaks and counts (no emails) |
| `POST /api/cheers`, `POST /api/cheers/seen` | signed in | Send a cheer (1 per classmate per day), mark yours as read |

### Security

- Passwords: bcrypt (bcryptjs, cost 11) with a random salt, never stored or logged in plain text. At least 8 characters, at most 72 bytes (what bcrypt reads). Unknown emails take the same time as wrong passwords, and both get "Wrong email or password."
- Validation: every form is checked with zod on the server (`src/lib/auth-schemas.ts`); the browser runs the same schemas for instant feedback.
- Sessions: a random 256-bit token in an **HttpOnly, SameSite=Lax** cookie (Secure on HTTPS), never in `localStorage`. The database stores only its SHA-256, so a leaked database can't be used to log in. 30-day sliding expiry; a password change signs out other devices, a reset signs out all.
- Google: the ID token is verified on the server (signature, audience, issuer, expiry). An existing profile is linked only for a Google-verified email; if that profile's email was never proven, its password is removed and its sessions end, so whoever registered someone else's address first can't keep a way in.
- Password links: 256-bit random, only the SHA-256 stored, 45 minutes, single use, newest link only. The reset page sends no Referer.
- Every API route and Server Action checks the session and role on the server. Hiding a button is never the protection.
- Mutating requests from other sites are rejected (Origin check, on top of SameSite cookies and Next.js's own Server Action origin check).
- Rate limits live in Postgres (`rate_limits`, keys hashed), so they hold across all Vercel instances: login 30 per IP and 10 per email per 15 minutes; sign-up 20 per network per hour; password links 10 per IP and 3 emails per address per hour; Google sign-in 30 per IP per 15 minutes.
- Anyone can create a profile (rate limited per network). A teacher can take anyone off the leaderboard, or delete the profile, in `/admin`.

## Analytics (`/admin/analytics`)

The teacher's analysis page, built on the metrics from the product deck. Only students count (admins testing the app would blur the numbers), and a "week" is the last 7 days, then the 7 before, and so on.

| Section | What it shows |
| --- | --- |
| Users | Students, new this week, active today / week / month, **stickiness** (average daily actives ÷ monthly actives) and guests this week |
| **North Star: words mastered per week** | A word counts as mastered the first time one of its review gaps reaches 21 days. It only grows when students come back over weeks and still remember, so it measures habit and real memory, not app opens. 12-week chart, change vs last week, per active learner |
| What moves it (inputs) | Active learners, study days per learner, new words started, **recall rate** (reviews answered Good or Easy) |
| Student journey (funnel) | Guests: **Visit** (opened the app without a profile) → **Try** (answered a card) → **Join** (made a profile within 7 days). New profiles: **Join** → **Start** (20+ answers on day one) → **Return** (studied in week two) → **Habit** (3+ study days in a week). Each step shows its conversion, and the biggest drop-off is highlighted. Pick 30 days, 90 days or all time |
| Health checks | Recall rate, answers per study day, cheers per learner and number of reviews, this week vs the 4-week average |
| Retention by sign-up week | Of the people who joined in a week, the share who studied in week 1, 2, 3, … after joining |

Nothing extra is tracked for students: mastery and recall come from the review history every card already keeps (each card stores its last 30 answers), and older databases are filled in from that history once on the first start of this version. Guest visits are counted from this version on.

**Vercel Web Analytics** (page views, visitors, countries, devices) is in the Vercel dashboard → your project → **Analytics**. The app loads Vercel's script on Vercel deployments only; enable Web Analytics there once.

## Deploying

**Free option: Vercel + Supabase**

1. Create the Supabase project (see [Supabase](#supabase)) and copy the **Transaction pooler** connection string (port 6543). Not the "Direct connection": that one is IPv6-only and Vercel can't reach it.
2. Import this GitHub repo on [vercel.com](https://vercel.com). Set the function region to the one closest to your Supabase project (Project Settings → Functions).
3. In Vercel → Project → **Settings → Environment Variables**, add `DATABASE_URL` (the pooler string with your password, no quotes, for the **Production** environment), `ADMIN_EMAILS`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_TIMEZONE` and, for the AI helper, `ANTHROPIC_API_KEY` (and `APP_URL` if you use your own domain). `.env.local` is never uploaded, so this step is required.
4. **Redeploy** (Deployments → ⋯ → Redeploy): environment variables only reach new deployments, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is built into the page.
5. Open `https://<your-app>/api/health`. It should say `"ok": true`. Then **Continue with Google** with your `ADMIN_EMAILS` address, and `/admin` opens.

**"This page couldn’t load … A server error occurred"** when logging in or signing up means the server can't use the database. Open `https://<your-app>/api/health`: it names the problem (missing `DATABASE_URL`, wrong password, host not found, paused Supabase project, …) and what to do, without showing any secrets. Supabase pauses free projects after about a week without activity; restore it from the Supabase dashboard.

**Or any Node.js server** (Render, Railway, a VPS): set the same variables, then `npm run build && npm start`.

## Your data

- Everything lives in your Postgres database. Supabase backs it up daily (paid plans add point-in-time recovery). For your own copy: `pg_dump "$DATABASE_URL" > backup.sql`.
- Table layout, sort, visible fields and the last open tab are remembered per device in `localStorage`.
- Guest progress lives in `localStorage` (`kk.guest.cards`, `kk.guest.prefs`) until it moves into a profile. Clearing the browser's site data deletes it.
- The anonymous visit id lives in `localStorage` (`kk.visitor`). Clearing site data makes the browser count as a new visitor.

## Notes

- **Profiles from before email sign-in** (username only) can't log in any more: they have no email. `/admin` lists them as "no email (old profile)"; delete them there, and have those people sign up again.

- `npm run build` prints "Failed to find font override values for Atkinson Hyperlegible …". That is harmless: Next.js has no fallback metrics for these newer fonts yet.
- Pronunciation uses the voices installed on the device. On iPhone, German voices are under Settings → Accessibility → Spoken Content → Voices.
- `npm audit --omit=dev` finds 0 vulnerabilities in what the app runs. The advisories `npm audit` shows are in dev tools (the Vitest 3 test runner and Next.js's ESLint config). Vitest 4+ fixes its part, but npm 10's installer crashes on it; if `npm -v` shows 11 or newer, run `npm i -D vitest@latest`.
