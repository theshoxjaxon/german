# Karteikasten (germanApp)

A mobile-first vocabulary app for learning centers. Students study German or English words with spaced-repetition flashcards, each with their own private progress, and see how their classmates are doing. Teachers manage their course's words and see who is active on an admin dashboard.

- **Courses**: one app, several courses: **German · Momente** and **English** (A1–B2) are built in, and an admin can start more. Each course has its own words, class, leaderboard, teachers and current lesson; one login works for all of them, and progress in each course is kept. Each course has its own address, `/german` and `/english`: whoever opens it studies that course, and signing up puts them in its class (old `/c/<course>` links still work). Switch courses from the pill in the top bar; the address follows. The front page `/` greets visitors (*Hallo! Hello! Salom!*) and lets them pick a course, with **Continue** for the one they already study; the home-screen icon and logins open `/app`, which goes straight to your course.
- **Try it without an account**: anyone can open the app, practise the flashcards and browse the word list as a guest. Progress is kept in that browser, and moves into their profile when they sign up.
- **Accounts**: sign up free with **Continue with Google** or with name, email and password. Forgot your password? An emailed link (via Resend) lets you choose a new one. Everyone who signs up is in their course's class and on its leaderboard (no class code for now). Email addresses are private: students never see one, not even their own; only the admin does.
- **Study**: Anki-style flashcards (SM-2): tap to flip, swipe or tap Again / Hard / Good / Easy (keys: Space, 1–4, Z to undo). For German nouns, a **der / die / das quiz** comes first. A **daily goal** ring and your **streak** sit on the home screen; ending a session early shows what you did first. Every student's progress is private.
- **Oʻzbekcha / English**: the whole student app speaks Uzbek or English (switch in Study settings, or on the login and sign-up pages). The admin pages stay in English.
- **Class**: Snapchat-style daily streaks, each classmate's active-word count, a leaderboard per course, and cheers you can send each other.
- **Words**: an Airtable-style table and card gallery: search, filter, sort. Teachers manage the shared lesson words; every student can also add **their own words**, which only they see and study.
- **AI word helper** (optional): take a photo of a word list (textbook page, worksheet, whiteboard, notes) or type words, and Claude turns them into finished flashcards in the course's language: meaning, IPA, forms (German: with the article), an example sentence and a memory hook. You tick the ones to keep and pick the topic. In the word form, **Fill in the rest with AI** completes a single word.
- **Mock tests** (German course), by level (A1.1 open, the later levels "opens soon"): a **Wiederholungstest** for each Modul (Grammatik 25 + Lesen 5 = 30 points, like the class's paper tests) and the **Abschlusstest** (Grammatik, Lesen, Schreiben, Sprechen, 25 points each; passed with 18 in every part). Automatic parts are scored the moment you hand in; the AI scores writing and speaking and explains each mistake in Uzbek or English. Teachers see every student's results at `/admin/tests`.
- **Let's study together**: students mark the hours they're free next week and press **I want to study**. Every Sunday at 18:00 the app makes **groups of 3** who share a free hour, each with a suggested time, a speaking task and a **private chat** that only the group can read. Teachers see when the class is free (counts only), plan speaking clubs, and see reports, never chats. Share it as `/lets-study-together`.
- **Telegram reminder** (optional): students connect Telegram from **Settings → Telegram** (or the card on the home screen after their first session). Each evening, if they haven't practised that day, the bot sends one message: their streak and how many cards wait, with an **Open** button. `/stop` or the Stop button turns it off.
- **Daily quiz channel** (optional): every evening the bot posts a der/die/das quiz (a Telegram quiz poll) with a German noun from the lessons to a public channel, with a button into the app. It brings in German learners outside the class.
- **Share a result**: after a mock test (or from the streak in Progress) **Share** makes a link to a card with your first name and the score. In Telegram it shows as a picture; whoever opens it gets **Try it too**, straight into the same course.
- **Admin dashboard** at `/admin`, per course: members, new sign-ups, daily / weekly / monthly active students, 30-day charts, a member table, the course's invite link, its name and note, and **which lesson the class is on**. Admins also see emails, reset passwords, make teachers and start new courses.

**German · Momente** comes with all twelve Momente lessons, German → Uzbek, 653 words in all, each with IPA, an example sentence, plural or verb forms and a memory hook:

| Lektion | Words | Topics |
| --- | --- | --- |
| 1 | 43 | hello, names, how are you, where from |
| 2 | 61 | age, family status, jobs |
| 3 | 34 | family, languages |
| 4 | 48 | home, furniture, shopping and prices |
| 5 | 59 | things, colours, asking how to say and spell words |
| 6 | 52 | the office, appointments, on the phone |
| 7 | 46 | hobbies, compliments, *können* |
| 8 | 47 | free time, making plans, weekdays, telling the time |
| 9 | 85 | food, café and restaurant, the working day |
| 10 | 62 | travel: airport, station, phoning |
| 11 | 38 | the weekend, errands, opening times, the doctor |
| 12 | 78 | trips, seasons and months, festivals, invitations at work |

Lektion 1, 2, 4, 6 and 8–12 follow the class's own word lists, with their Uzbek meanings checked and corrected. Words tagged `extra` aren't in those lists: useful words for the topic (the weekdays and months, furniture, bread and tea, the bus stop …). Austrian and Swiss variants (*Hendl*, *Schlagobers*, *Perron* …) are in the notes of the standard word rather than cards of their own. A word is never in two lessons.

**English** comes with four level decks, English → Uzbek, 1,306 words, marked *More words coming soon*. Every word has its Uzbek meaning, British IPA, irregular forms (*go · went · gone*, *child · children*, *good · better · best*), an example sentence with its Uzbek translation, and notes in Uzbek on the usual slips (*I'm 19*, not *I have 19 years*; *bored* vs *boring*; *borrow* vs *lend*). Memory hooks and notes are in Uzbek, so beginners can read them:

| Deck | Words | Topics |
| --- | --- | --- |
| A1 | 375 | greetings, family, numbers and time, days and months, food, the home, first verbs, adjectives and colours, question words, the body, clothes, town and travel, weather, school, free time |
| A2 | 327 | travel and directions, health and feelings, personality, home life, shopping and eating out, school, jobs, technology, nature, time words, phrasal verbs |
| B1 | 304 | work and money, relationships, agreeing and arguing, environment, society and law, culture and news, education and ideas, lifestyle, sport, travel, linking words |
| B2 | 300 | analysing and arguing, change and problems, character and strong feelings, economy and law, science, health and media, essay linking words, formal verbs |

A word is never in two decks of a course. New built-in lists are added to an existing database once, on the next start (`SEED_PACKS` and `SEED_COURSES` in `src/lib/seed.ts`); words a teacher deleted don't come back, and words already typed in by hand aren't doubled.

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

## Mock tests

The German course has its tests in a **Tests** tab, by level: **A1.1** is open (Momente A1, Lektion 1–12); A1.2, A2.1, A2.2, B1.1, B1.2, B2.1, B2.2, C1.1, C1.2, C2.1 and C2.2 show as "opens soon". Courses without tests don't show the tab; guests see it locked. The format is the class's own:

**Sprechen üben** (top of A1.1): the class's 60 speaking cards ("Frag mich was!", Lektion 1–10, 6 each, `src/lib/tests/sprechkarten.ts`). **Get your speaking topic** draws one (never the same twice in a row; the *Hilfe* line stays hidden until asked). **Copy & open Gemini** copies a ready message and opens `gemini.google.com/app`, where the student pastes it (Gemini doesn't fill in a message from a link; four steps under the card say what to do, and **Show the message** / **Copy again** are there if the clipboard was overwritten). The message starts with the topic, makes Gemini the student's A1 exam partner and teacher, asks for short feedback after **every** answer (mistake → correction and why, the corrected answer, a follow-up question), and a summary when they say **"finish"** ("Fertig", "tugadi"): a score out of 10, all mistakes by type, a model answer and two tips, explained in the student's interface language.

| Test | Lessons | Parts | Points |
| --- | --- | --- | --- |
| Wiederholungstest Modul 1 | 1–3 | Teil A Grammatik (25 a–d dialogue questions) · Teil B Lesen (a text, 5 richtig/falsch) | /30 |
| Wiederholungstest Modul 2 | 4–6 | same | /30 |
| Wiederholungstest Modul 3 | 7–9 | same | /30 |
| Wiederholungstest Modul 4 | 10–12 | same | /30 |
| Abschlusstest | 1–12 | Grammatik · Lesen · Schreiben · Sprechen, 25 each | /100, **passed with 18 in every part** |

- **Wiederholungstests** are scored at once, like the paper (no pass mark; the score turns green from 22/30, the final's 72% bar).
- **Abschlusstest**: Grammatik (25 a–d), Lesen (an email, ads, signs), Schreiben (a form, auto-scored, and a short letter scored by the AI), Sprechen with the four class tasks: *sich vorstellen*, *mit Partner sprechen* (the phone asks 3 questions aloud), *Gestern (Perfekt)* and *Fragen (Kärtchen)*. Each part is scaled to 25. The result shows each part with the 18 mark and says *Bestanden* only when all four reach it, otherwise which part is short.
- **Taking a test**: one part at a time, a timer (no cut-off), answers kept on the device until handed in. Speaking uses the phone's speech recognition, or typing.
- **Scoring**: the answer key never leaves the server (`src/lib/server/tests/`); the browser gets the questions only. Typed answers forgive case, spaces, a final dot and *ae / oe / ue / ss* for *ä / ö / ü / ß*. Writing and speaking left empty score 0.
- **AI examiner** (needs `ANTHROPIC_API_KEY`): one request per attempt scores the writing (3 points per content point + 1 for greeting and closing) and each speaking task by its own rubric, with corrections, a short explanation in the student's interface language and a tip. 8 checks per hour per student. Without a key, the result shows the model answers and those parts stay unscored.
- **Teachers**: `/admin/tests` shows each student's best score per test, the average (and for the final, how many passed), and the latest attempts with points per part; any score opens the whole attempt. Names only.
- **Adding a test or a level**: write it in `src/lib/server/tests/` (see `german-a1.ts`: `level`, `kind: 'unit' | 'final'`, each part's `points` and `pass`) and add it to `TESTS`. `npm test` checks every test: the class format, unique ids, valid answers, and that a perfect attempt gets full marks. A level opens in the app as soon as it has a test.

## Let's study together

A card at the top of the **Class** tab (or the link `/lets-study-together`) opens it.

- **Students** tap the hours they're free next week (Monday to Sunday, 8:00–22:00, in `APP_TIMEZONE`) and press **I want to study**. Hours can change until **Sunday 18:00**; after that, sign-ups count for the week after.
- **Sunday 18:00**: groups of 3 are made at random among students who share at least one free hour (2 or 4 when the numbers don't divide evenly). People who blocked each other are never grouped. Each group gets the earliest shared hour as its suggested time, a speaking task (the speaking cards of the mock tests for German, a short list for English) and a chat. Nobody free at the same time as anyone else gets "no group", with a tip to pick more hours.
- **The chat**: plain text, 500 characters; **no links, email addresses, phone numbers or usernames**, so nobody is lured elsewhere or contacted privately. New messages show within about 3 seconds while it's open. A student can **leave**, **block** a member (never grouped together again) or **report** one with a reason (this also blocks). The chat is read-only once its week ends and deleted, with the group, **14 days later**.
- **Teachers** (`/admin/study`): next week's best times as a heatmap (how many are free each hour, never who; it appears once 3 students have signed up and shows only hours at least 2 share, so no one's hours stand out), sign-up and group counts, **speaking clubs** (pick an hour, a room or an https link; students tap *I'll come*), and **reports**: who reported whom and why. **Teachers and admins can't read any chat**: no page, route or query exists for it. Teachers are never put in groups.
- **How it's kept private**: every group route checks membership in the same SQL query that reads or writes, and answers anyone else (other students, former members, teachers, admins) with the same 404. Group ids are 128-bit random. Members see each other as a name and a key that only means something inside that group, never a user id or email. The teachers' counts include every student's sign-up, so nothing a teacher can switch (like the class board) singles a student out. All the tables have row-level security, like the rest.
- **What this can't stop**: messages are stored in the database like all app data, so whoever runs the database (you, on Supabase) could read them there; and an admin who resets a student's password could sign in as that student. Keep `ADMIN_EMAILS` to the people who run the app.
- **When the groups are made**: Vercel Cron calls `/api/cron/study` on Sunday at 13:00 UTC (18:00 in Tashkent; `vercel.json`) with your `CRON_SECRET`. If that hasn't happened, the first visit after 18:00 makes them. Either way it happens once per course and week (the claim and all groups are written in one statement). If you change `APP_TIMEZONE`, change the hour in `vercel.json` too.
- Limits: 20 messages a minute and 300 a day per student, 10 reports a day.

## Telegram reminder

The app only reaches students who open it. The Telegram bot reaches the ones who forgot: one message in the evening, only on days they haven't practised.

**Set it up (5 minutes):**
1. In Telegram, open **@BotFather**, send `/newbot` and follow the steps. It gives you a token like `123456789:AA…`.
2. In Vercel → Project → **Settings → Environment Variables**, add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (the bot's name without @) and `TELEGRAM_WEBHOOK_SECRET` (any 20+ letters, digits, `_` or `-`; e.g. `openssl rand -hex 24`). `CRON_SECRET` must be set too. Redeploy.
3. Open `/admin` → **Telegram reminders** → **Connect the bot**. That checks the token, points the bot at `/api/telegram/webhook` with your secret, and sets its `/start` and `/stop` commands. Then connect your own Telegram from Settings and press **Send me a test reminder**.

**How it works:**
- **Connecting**: Settings makes a one-time link `t.me/<bot>?start=<code>` (256 random bits, 15 minutes, used once; only its SHA-256 is stored). Pressing **Start** in Telegram ties that chat to the profile; the Settings page notices within a few seconds. One Telegram chat belongs to one profile: connecting it from another profile moves it there.
- **The evening job**: Vercel Cron calls `/api/cron/daily` at 14:00 UTC (19:00 in Tashkent; on the Hobby plan it runs some time in that hour). Everyone with reminders on who hasn't answered a card that day gets one message, in their interface language: their streak and how many reviews and new words wait in their current course, counted exactly like the home screen. Nobody gets two in a day: the day is claimed before sending. If Telegram says someone blocked the bot, their reminders go off.
- **Privacy**: the webhook only accepts requests carrying `TELEGRAM_WEBHOOK_SECRET` (Telegram sends it back with every update). The bot never repeats what anyone writes and ignores groups and channels. No page shows a chat id, admins included; `/admin` shows counts only. Disconnecting, or deleting the profile, deletes the link.

**If the bot doesn't answer `/start`:** it answers every message (even "Salom!" to strangers), so silence means Telegram isn't delivering to the site. Open `/admin` → Telegram → **Check the bot**: it asks Telegram and lists each problem with its fix. The usual ones:
- **Connect the bot wasn't pressed**, so no webhook is set. Press it, then send `/start` again (messages from before are dropped).
- **The settings aren't live yet**: they must be set for **Production**, and Vercel only uses new values after a **redeploy**.
- **`TELEGRAM_BOT_USERNAME` is the display name** (e.g. "GermanStudy") instead of the username (`karteikasten_bot`).
- **The secret changed** after connecting: Telegram gets 401. Redeploy, then press Connect the bot again. A 401 can also come from Vercel's Deployment Protection if it covers your live address.
- Never post the bot token anywhere. If it leaks, **Revoke** it in @BotFather and put the new one in Vercel.

## Daily quiz channel

A public Telegram channel where the bot posts one der/die/das quiz every evening: "Qaysi artikl? ___ Hund (it)", with der / die / das as a Telegram **quiz poll** (tap an answer and Telegram shows right or wrong, then the explanation: the word, its meaning and an example). A button under it opens the German course. Anyone can join the channel, so it reaches German learners outside the class.

**Set it up:** create a public channel in Telegram, add the bot (the one from *Telegram reminder* above) as an **admin that may post messages**, and set `TELEGRAM_CHANNEL` to the channel's `@name` (or its numeric `-100…` id). Redeploy, then press **Post today's quiz now** in `/admin` → Telegram to see the first one.

- **Which word**: a shared noun of the German course with der, die or das, from the lesson the class is on while it has words left, else any lesson. A word doesn't come back for 120 days. The choice is fixed for the day, so a retry posts the same quiz.
- **When**: from the same evening job as the reminders (`/api/cron/daily`, 19:00 in Tashkent), at most once a day: the day is written down before posting, and if Telegram refuses (e.g. the bot isn't an admin), it's freed again so the button or the next run can retry.

## Sharing a result

**Share** under a mock test result (or next to the streak in Progress, from 2 days) makes a public link `/s/<id>` and opens the phone's share sheet, or copies the link where there is none.

- **What it shows**: a snapshot taken when you pressed Share: your first name, the test (or the streak), the score and, for the Abschlusstest, *bestanden*. No email, no answers, no other names. Sharing the same result again gives the same link. The page has **Try it too**, which opens the same course.
- **The preview**: `/s/<id>/opengraph-image` draws the card (1200×630) for Telegram, WhatsApp and the like. The image font has no ʻ, so names and Uzbek text use the look-alike ‘ there.
- **Privacy**: only your own complete attempts can be shared (anyone else's gets the same 404). The page is `noindex`, ids are 96 random bits, and deleting the profile deletes its links. 30 shares a day per person.

## Sign in with Google

1. [Google Cloud Console](https://console.cloud.google.com) → pick or create a project → **APIs & Services → OAuth consent screen**: app name *Karteikasten*, your support email; audience **External**; publish it (*In production*) so anyone can sign in. The app only asks for the basic scopes (`openid`, `email`, `profile`), which need no Google review.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized JavaScript origins** add `http://localhost:3000`, `http://localhost` and `https://german-roan.vercel.app` (plus your own domain if you add one). **Authorized redirect URIs** can stay empty: the button uses Google's popup and hands the app an ID token directly.
3. Copy the **Client ID** (`….apps.googleusercontent.com`) into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. There is no client secret to set.

The server checks every Google ID token with `google-auth-library` (signature, audience = your client ID, issuer, expiry) before using it. The first Google sign-in creates the profile, or links the profile that already has that email (only when Google says the address is verified). Changes in Google Cloud can take a few minutes to apply.

**"Error 400: origin_mismatch"** means the address the app was opened at isn't in **Authorized JavaScript origins**. It must match exactly: `https://german-roan.vercel.app`, with no trailing `/` and no path. Each Vercel preview address (`german-abc123-….vercel.app`) is a different origin, so test Google sign-in on the production address (or add the preview one too).

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
| `ANTHROPIC_API_KEY` | – | Turns on the AI word helper and the AI examiner for mock tests. Without it the AI buttons don't appear. |
| `AI_MODEL` | `claude-opus-5-5` | The Claude model the AI helper uses. |
| `AI_ENABLED` | auto | `false` hides the AI helper even with a key; `true` turns it on with other Anthropic credentials (e.g. `ant auth login`). |
| `ADMIN_EMAILS` | – | Your email (comma-separated for several). It becomes admin once proven: via Google, or a password reset link. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | – | Google OAuth Web client ID. Turns on **Continue with Google**. Public; needs a rebuild to change. |
| `RESEND_API_KEY` | – | Sends the password emails. Secret. Without it, development prints the link in the terminal. |
| `EMAIL_FROM` | `Karteikasten <onboarding@resend.dev>` | The sender of password emails; its domain must be verified in Resend. |
| `APP_URL` | Vercel's production domain | The site's address for links in emails. |
| `APP_TIMEZONE` | `Asia/Tashkent` | When a "day" starts for streaks and daily active users, and the hours of *Let's study together*. |
| `CRON_SECRET` | – | Any long random value. Vercel sends it to `/api/cron/study`, the Sunday job that makes the study groups, and `/api/cron/daily`, the evening Telegram reminders. Without it the groups are made on the first visit after Sunday 18:00, and no reminders go out. |
| `TELEGRAM_BOT_TOKEN` | – | From @BotFather. Turns on the Telegram reminder (with the two below). Never sent to the browser. |
| `TELEGRAM_BOT_USERNAME` | – | The bot's name, without @, for `t.me` links |
| `TELEGRAM_WEBHOOK_SECRET` | – | 20+ letters, digits, `_` or `-`. Telegram sends it back with every update, so forged updates are refused. |
| `TELEGRAM_CHANNEL` | – | The public channel for the daily der/die/das quiz: its `@name` or numeric `-100…` id. The bot must be an admin there. |
| `COOKIE_SECURE` | auto | Force `true`/`false`. By default the session cookie is Secure whenever the site is on HTTPS. |

## Roles and privacy

| | Guest (no profile) | Student | Course teacher | Admin |
| --- | --- | --- | --- | --- |
| Study the flashcards, settings | ✓ (saved in this browser) | ✓ | ✓ | ✓ |
| Browse the word list | ✓ (read-only) | ✓ | ✓ | ✓ |
| Progress, streak, daily goal | goal and streak on this device | ✓ | ✓ | ✓ |
| Add, edit, import, delete **your own** words (only you see them) | – | ✓ | – | – |
| Class leaderboard: classmates' streaks, active words, answers; send cheers | – | ✓ | ✓ | ✓ |
| AI word helper (costs the center API credit; hourly limit) | – | ✓ | ✓ | ✓ |
| See email addresses (anyone's, or your own) | – | – | – | ✓ |
| See anyone else's cards | – | – | – | – |
| Add, edit, import, delete the shared lesson words | – | – | their course | every course |
| Take mock tests, see your own results | – | ✓ | ✓ | ✓ |
| `/admin/tests`: everyone's mock-test results and answers | – | – | their course | every course |
| Study groups: sign up, chat in your own group, leave, block, report | – | ✓ (on the class board) | – | – |
| Read a study group's chat | – | its members only | – | – |
| `/admin/study`: free-time heatmap (counts), speaking clubs, reports (no messages) | – | – | their course | every course |
| `/admin` and `/admin/analytics`: stats, the class lesson, the course's name and note, take people off the leaderboard | – | – | their course | every course |
| Reset passwords, make teachers and admins, delete profiles, start new courses | – | – | – | ✓ |

**Courses.** Each course is its own class: its words, members, leaderboard, cheers, teachers and current lesson. Everyone joins a course when they sign up (the one whose link they followed, else the one they picked as a guest, else German) and can join more from the course pill; their progress, own words and lesson choice in each course stay. Answers, streaks and the daily goal count all of a person's courses together. A new guest picks a course on the welcome page at `/`; a course's own address such as `/english` skips that. An admin starts a course in `/admin` → **New course** (name, link, language studied, note for students); its words come from the importer, the AI helper or a built-in list.

**Cards follow the course's language.** German has the der/die/das quiz, gender colours and German voices; English has none of that, British (or American) voices, and English dates on the study page. The AI helper writes cards for the course's language, and "All decks" understands both *Lektion N* / *Unit N* and levels (*A1* … *C2*) when a class lesson is set.

**No class code (for now).** Everyone who signs up is on their course's leaderboard and can use the AI helper. A course's teacher can take someone off the leaderboard in `/admin` (they keep studying, but aren't listed and can't send cheers).

**The class lesson.** In `/admin`, set *The class is on* to the lesson or level the class has reached. Studying “All decks”, everyone in that course (guests too) then gets new words from that lesson first, then the lessons before it, newest first (10, 9, 8 … or B1, A2, A1), so nobody starting today is sent back to the beginning. Later lessons wait until you move the setting on; anyone can still tap a lesson to study it early, and words already started keep their reviews. The lesson is marked *class* on the Study screen. Not set: new words come in book order.

**Admins and teachers.** Nobody becomes admin by signing up first. An address in `ADMIN_EMAILS` becomes admin once it's proven to be theirs: a Google sign-in (Google verified the address) or a password reset link sent to it. Admins run every course. In `/admin` → Manage, an admin makes a member **teacher of this course** (they then edit that course's lesson words in the app and open its dashboard, without seeing emails) or makes someone admin.

**Email privacy.** Students and course teachers see names and photos, never email addresses: not classmates', and not their own (the menu and `/account` show only name and photo). The server leaves emails out of everything it sends them; only admins get them.

**Language.** Each person picks Oʻzbekcha or English in Study settings; it is saved with their settings, so it follows them to every device, and the browser remembers it for the login page. Before anyone chooses, Uzbek phones get Uzbek. The translations live in `src/lib/i18n-uz.ts`, keyed by the English text; `i18n.test.ts` fails if any text the app shows is missing there. The built-in memory hooks are content, not interface: the German ones are in English, the English course's are in Uzbek.

**Guests.** `/` opens straight to the flashcards. Guest progress stays in the browser; guests never show up in the admin numbers or the Class tab. For the funnel on `/admin/analytics` the browser sends one anonymous count a day: a random id it made up (kept in `localStorage` as `kk.visitor`), the course and whether it has answered a card. No name, no IP address is stored. The course a guest picked is remembered in a `kk_course` cookie (only the course id), so signing up or logging in lands them in it; it is cleared once a profile has taken it over, so on a shared computer the next person keeps their own course. If that browser later signs up, the id is linked to the new profile, so the funnel can tell who tried the app first. The word list itself is public, because guests need it to study. On sign-up, the guest's progress and settings move into the new profile. A guest who logs in to a profile that already has progress is asked first (*Add to my profile* / *No, discard it*), because on a shared classroom computer that guest may have been someone else. Words the profile already studied always keep the profile's progress.

Only counts are shared on the Class tab. Nobody, the admin included, sees another person's individual cards, answers or own words.

**Words.** One `words` table holds both kinds, each in a course (`course_id`): `owner_id` is empty for a shared lesson word and holds the student's id for their own word. The server only ever returns your course's shared words plus your own words in it, and only lets the owner (or, for lesson words, that course's teachers and admins) change or delete a word. Each person can have up to 2,000 own words. Deleting a profile deletes their own words and progress with it.

**Forgotten password?** *Forgot password?* on the login page emails a link (it always answers "If that email exists, we've sent a link", so nobody can test which addresses have profiles). Google-only profiles use the same link to set a password. A teacher can also open the student in `/admin` → **Reset password** for a temporary password like `tante-fest-4821`; they change it under *Your profile → Account and password*.

## What the admin numbers mean

| Number | Definition |
| --- | --- |
| Members | Everyone in the course, its teachers included |
| New this week | Joined the course in the last 7 days |
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
                   google.ts · mail.ts · admins.ts · ai.ts · ai-grade.ts (AI examiner) · tests/ (mock tests with their answer keys)
                   study.ts (study groups: matching, chats, clubs, reports)
src/lib/           auth-schemas.ts (zod: the same rules in the browser and on the server) · tests/ (test types and scoring)
Postgres/Supabase  courses · course_members · users · sessions · password_reset_tokens · rate_limits · words · cards · prefs
                   · activity · cheers · visitors · settings · test_attempts · study_* (sign-ups, groups, members,
                   messages, blocks, reports, clubs, runs)
```

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/state` | anyone | Signed in: you, your course and the list of courses, its words, your progress, settings, new cheers. Guest: `{ me: null, words, course }` (no course yet: `course: null`, no words) |
| `POST /api/course` | anyone | `{ id }` switches course: signed in, you join it; guests: remembered in this browser |
| `GET /api/courses` | anyone | The courses for the welcome page (name, language, word and test counts), the one you study now (`current`) and `signedIn` |
| `GET /:course` | anyone | A course's page (`/german`, `/english`): the app in that course (signed in: join it) |
| `GET /app` | anyone | Goes to the course you study, else the welcome page `/` |
| `GET /c/:course` | anyone | Old invite link: redirects to `/:course` |
| `GET /api/me` | signed in | Who you are: name, photo, role, how you log in (email for admins only); 401 when signed out |
| `POST /api/auth/google` | anyone | `{ credential }` from the Google button → verifies it, signs in (creates or links the profile) |
| `POST /api/cards/import` | signed in | Add progress made as a guest (never overwrites existing progress) |
| `GET /api/health` | anyone | Is the database reachable, and if not, why (no secrets shown) |
| `POST /api/visit` | anyone | Anonymous guest count for the funnel: `{ id, tried, course }`, at most once a day per browser (rate limited) |
| `POST /api/ai/words` | signed in | AI word helper: photo or typed list → suggested flashcards (nothing is saved) |
| `GET /api/tests` | signed in | Your course's mock tests and your attempts |
| `GET /api/tests/:id` | signed in | A test's questions, without the answers |
| `POST /api/tests/:id/submit` | signed in | `{ answers, startedAt }` → scored and saved (30 an hour) |
| `GET /api/tests/attempts/:id` | signed in | One attempt with the answer key: yours, or your course's as its teacher |
| `POST /api/tests/attempts/:id/feedback` | signed in | `{ lang }` → the AI scores the writing and speaking of your attempt (8 an hour) |
| `GET /api/study` | signed in | Your study week: sign-up, groups (names only), clubs; makes due groups first |
| `PUT/DELETE /api/study/signup` | students | `{ slots }` → your free hours for next week, or withdraw |
| `GET/POST /api/study/groups/:id/messages` | group members | Read newer messages (`?after=`), or post `{ body }`; anyone else gets 404 |
| `POST /api/study/groups/:id/leave` · `/block` · `/report` | group members | Leave; `{ member }` block; `{ member, reason }` report (and block) |
| `POST /api/study/clubs/:id/rsvp` | course members | `{ going }` for a speaking club of your course |
| `GET /api/cron/study` | Vercel Cron (`CRON_SECRET`) | Makes the due study groups, deletes expired ones |
| `GET /api/cron/daily` | Vercel Cron (`CRON_SECRET`) | Sends the evening Telegram reminders and posts the day's quiz in the channel |
| `POST /api/share` | signed in | `{ kind: 'test', attemptId }` (your own, complete) or `{ kind: 'streak' }` → `{ url }` of the public card |
| `GET /s/:id` | anyone | A shared result, with "Try it too"; its preview picture at `/s/:id/opengraph-image` |
| `GET/POST/DELETE /api/telegram` | signed in | Your reminder state; `{ action: 'link' }` → a one-time t.me link (10 an hour); `{ reminders }` on/off; DELETE disconnects |
| `POST /api/telegram/webhook` | Telegram (`TELEGRAM_WEBHOOK_SECRET`) | The bot's updates: `/start <code>` connects, `/start` and `/stop` switch reminders |
| `POST /api/logout` | signed in | Sign out; a plain form post, so the full page reload clears the old profile from memory |
| `PUT/DELETE /api/words/:id`, `POST /api/words` | signed in | Add, edit, delete, import words in your course: its teachers the shared lesson words, everyone else their own |
| `PUT/DELETE /api/cards/:wordId`, `DELETE /api/cards` | signed in | Save or reset **your** progress (reset: this course only) |
| `PUT /api/prefs` | signed in | Your settings |
| `GET /api/class` | signed in | Your course's leaderboard: classmates' streaks and counts (no emails) |
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
3. In Vercel → Project → **Settings → Environment Variables**, add `DATABASE_URL` (the pooler string with your password, no quotes, for the **Production** environment), `ADMIN_EMAILS`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_TIMEZONE`, `CRON_SECRET` (for the Sunday study groups) and, for the AI helper, `ANTHROPIC_API_KEY` (and `APP_URL` if you use your own domain). `.env.local` is never uploaded, so this step is required.
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
- Pronunciation uses the voices installed on the device. On iPhone, German and English voices are under Settings → Accessibility → Spoken Content → Voices.
- **Several centers on one app.** Vercel's free Hobby plan is meant for non-commercial use; once paying centers rely on it, move to Vercel Pro. Supabase's free tier holds thousands of students.
- `npm audit --omit=dev` finds 0 vulnerabilities in what the app runs. The advisories `npm audit` shows are in dev tools (the Vitest 3 test runner and Next.js's ESLint config). Vitest 4+ fixes its part, but npm 10's installer crashes on it; if `npm -v` shows 11 or newer, run `npm i -D vitest@latest`.
