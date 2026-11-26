# Karteikasten API (NestJS)

The REST API behind the web app. Everything the browser used to get from Next.js route handlers
and `src/lib/server` lives here now.

```
src/
  main.ts, app.module.ts, app.setup.ts   start-up; the app is wired in one place
  common/        request context, rate limiter, error filter, response interceptor, validation helpers
  database/      the pool, the schema and built-in word lists (db.ts), the Database provider
  repositories.module.ts                 the data layer: one repository class per area
  auth/          sessions (cookie + guard), sign-up / log-in / password links, Google
  users/ courses/ words/ cards/ cheers/ classroom/ tests/ grammar/   a repository + controller each
  study/ telegram/ shares/ ai/ mail/     services for the features around them
  admin/ cron/ health/ state/            the dashboard, scheduled jobs, health check, GET /api/state
test/            HTTP-level tests (supertest on an in-memory Postgres)
```

How a request flows: `SessionGuard` (global) finds the person from the `kk_session` cookie, the
controller validates the input and calls a service or repository, errors leave as `{ "error": … }`.
Mark a route `@Public()`, `@OptionalUser()` or `@AdminOnly()`; otherwise it needs a signed-in person.

Shared code (the SRS, types, seed word lists, mock tests) stays in the web app's `src/lib` and is
imported as `@/lib/…`. `@api/…` is this package's `src`.

## Run

```bash
cd backend && cp .env.example .env     # fill in DATABASE_URL (or run with USE_LOCAL_DB=1: in-memory, nothing saved)
npm install
npm run dev        # http://localhost:4000/api/health
npm test           # unit + integration + HTTP tests, on PGlite (Postgres in WebAssembly)
npm run build && npm start
```

From the repository root, `npm run dev:api` and `npm run dev` start the API and the web app.
The web app reaches the API through `API_URL` (see `.env.example` at the root).

## Sign-in security

- **Passwords:** scrypt (OWASP setting, runs off the main thread). Older bcrypt hashes still work and are
  upgraded at the next login. New passwords can't be a famous one (`password123`), one repeated
  character, or contain the email name.
- **Sessions:** a random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie; only its SHA-256
  is stored. Sliding 30-day expiry, at most 10 devices per person, all other devices signed out on a
  password change or reset. Sign-out deletes the session on the server.
- **Brute force:** limits in the database (so they hold across instances): per address and per email on
  login, sign-up, resend, forgot and reset. Wrong email, no password and wrong password give the same answer in
  the same time. A coarse flood limit per address (300 requests a minute) covers everything else.
- **Cross-site:** a POST/PUT/DELETE with an `Origin` that isn't this site is refused, login included.
- **Headers:** `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, HSTS, and a locked-down CSP on the API.
- **Not covered:** the per-address limits trust the `X-Forwarded-For` the proxy sends. On Vercel that is
  set by the platform; behind anything else, put your own proxy in front that overwrites it.

## Load test: how many people at once?

```bash
npm run loadtest                      # 100 people at once, 10 s per scenario, on in-memory Postgres
CONNECTIONS=100 DURATION=20 npm run loadtest
```

It boots the real app, signs in 200 users and drives `/api/health`, `/api/me`, `/api/state` (what the app
loads when it opens) and wrong-password logins over real HTTP (`loadtest/`). For realistic numbers use a
real Postgres, a **throwaway one on this computer** (the test writes fake users, and it refuses any
host but localhost):

```bash
initdb -D /tmp/pg -U load --auth=trust && pg_ctl -D /tmp/pg -o "-p 5544" start && createdb -h localhost -p 5544 -U load loadtest
LOAD_DATABASE_URL=postgres://load@localhost:5544/loadtest DATABASE_POOL_MAX=10 npm run loadtest
```

Measured on a laptop, one API process, local Postgres, 100 people at once, no failures:

| Request | Throughput | Median | p99 |
|---|---|---|---|
| `GET /api/health` | ~5,900/s | 15 ms | 39 ms |
| `GET /api/me` (signed in) | ~4,000/s | 24 ms | 32 ms |
| `GET /api/state` (app opening, 362 KB) | ~290/s | 337 ms | 454 ms |
| `POST /api/auth/login` | ~30/s | 640 ms | 717 ms |

Read it as: one instance can open the app for about 290 people a second, and sign about 30 in a second;
Vercel runs more instances when there is a crowd, and the database pool is shared. A classroom of 30 all
pressing "log in" in the same second takes about a second. Past ~120 connections at once this laptop
(macOS: `kern.ipc.somaxconn` 128) resets new connections; that is the test machine, not the API. To test
the deployed site use a machine other than your own, e.g. `npx autocannon -c 100 -d 20 https://<your-api>/api/health`
against a preview deployment, and never run the signed-in scenarios against a production database.

## Scaling to a crowd

**The load balancer is Vercel.** Every request enters through its edge network and is handed to a function
instance; when traffic grows it starts more instances by itself (Fluid compute reuses an instance for many
simultaneous requests). The API is stateless (sessions, rate limits and reset links live in the database), so
any instance can answer anyone. You don't run or pay for a separate load balancer.

What decides how many people fit is the **database**, not the API:

1. **Use Supabase's pooler for `DATABASE_URL`** (Connect → *Transaction pooler*, port 6543), never the direct
   connection. Each instance keeps a few connections; fifty instances on a direct connection use up Postgres.
   Keep `DATABASE_POOL_MAX` small (3-5): the pooler multiplexes them.
2. **Put the API next to the database.** Pick the Vercel function region of the Supabase region (Project →
   Settings → Functions → Region). Every query otherwise pays an ocean crossing (about 100 ms each).
3. **Size the Supabase compute for the crowd** (Settings → Compute). An app open is 5 small queries per
   person: 100,000 people opening it in one minute is about 8,000 queries a second, which needs a large
   instance, not the free tier.
4. **Shared words are cached per instance** for 30 s (`SHARED_WORDS_TTL_MS`), so the biggest part of the app
   load is one database read per course, not one per person. Measured: app opens went from 290 to 560
   a second on one instance, p99 454 → 188 ms. A teacher's edit shows for everyone within 30 s.
5. **Things that stay cheap on purpose:** sign-in limits are one database round trip each; the flood limit is
   in memory; sessions are one indexed lookup.

Rough sizing from the load test: one instance opens the app for ~560 people a second and signs ~30 in a
second (password hashing is deliberately slow). 100,000 people opening it within a minute is ~1,700 a
second: a handful of instances, and a database sized as in point 3. 100,000 people pressing "log in" in the
same second is not realistic for a class app and would queue on password hashing; spread logins out (sessions
last 30 days, so most people never log in again).

Before a big day (an exam, a launch), rehearse it: deploy a preview, point it at a copy of the database,
and run `npx autocannon -c 100 -d 30 https://<preview>/api/health` and the signed-in scenarios from a machine
other than your own, watching Supabase's *Reports → Database* for connections and CPU.

## Deploy (Vercel)

Two projects from this repository: the web app (root directory `.`) and the API (root directory
`backend`, with "Include source files outside of the Root Directory" on, since it imports `src/lib`).
Set `API_URL` on the web project to the API project's address, and `APP_URL` on the API project to
the web project's address. The scheduled jobs are in `backend/vercel.json`; set `CRON_SECRET`.
