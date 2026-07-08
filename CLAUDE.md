# Game Shelf — Claude Code Context

## Project
A cozy, fun family web app that catalogs the Klein family board-game collection, helps
everyone pick "what do we play tonight?" fairly, and tracks who played what. Built to make
recurring **Thursday Game Night** (or any night) easier and less rut-prone.

- **Live app:** https://ourgameshelf.netlify.app  (React + Vite, deployed on Netlify)
- **Phase 1 prototype** (design reference, voting engine demo): https://ourgameshelf.netlify.app/prototype/
- **Repo:** its own git repo at `/Users/kevin/Desktop/Projects/gamenight`, remote
  `github.com/kevinmklein/gamenight`, branch `main`. Isolated from the accidental
  home-folder repo at `/Users/kevin/.git` — always run git from inside this folder.
- **Owner:** Kevin (Dad) — *novice web dev*: knows basic git/CLI/Netlify but needs explicit,
  step-by-step CLI + console instructions. Never assume tooling knowledge.

## ⚠️ Current blocker (open as of 2026-07-08 — resume here)
Adding games fails on the live site. Root cause: the **`VITE_FIREBASE_API_KEY` value in
Netlify is truncated to `AIzaSyD4`** (first 8 chars). The full key is 39 chars:
`AIzaSyD4z6SNgdD6kyzGaXFKo-t6aTMeaEulrTk` (ends in `EulrTk`).
Because the key is invalid → anonymous sign-in fails (`auth/api-key-not-valid`) → and since
the strict Firestore rules require auth, all reads/writes return `permission-denied`.

**Fix (Kevin, in Netlify):** Environment variables → `VITE_FIREBASE_API_KEY` → set the full
39-char value → **Deploys → Trigger deploy → Clear cache and deploy site** (env changes don't
auto-redeploy). Then verify: extract the key from the live JS bundle and confirm it's the full
value, and that adding a game works end-to-end. Everything else is confirmed working.

## The Family (default profiles)
| Profile | Who | Notes |
|---|---|---|
| Kevin | Dad | Likes strategy: Catan, Carcassonne |
| Stacey | Mom | |
| Sara | Twin, 13 | Family win leader in prototype sample data |
| Sophia | Twin, 13 | Invents wacky Uno variants |
Guests/extended family add a lightweight profile on the fly (planned: on the Game Night join screen).

## The Three Features
1. **The Shelf** — visual library. Games shown as boxes on wooden shelves. ✅ Built: browse,
   search, click a box → **detail modal** (specs, tags, play history), remove-from-shelf inside it.
2. **Game Night** — the voting engine (see rules below). ⏳ Stubbed in the live app; fully
   playable in the /prototype/. Needs wiring to the real catalog + real-time rooms.
3. **Stats** — log nights, show aggregate + per-person stats. ⏳ Stubbed. Scope for v0.1 =
   **log + core stats** (games played, total time, wins per person, most-played, Dusty Shelf).

## Locked Decisions
- **Aesthetic: Cozy tabletop** — felt green (`--felt #2f4a3a`), walnut, brass (`--brass #c6902f`),
  warm parchment. Display = Iowan/Georgia serif; body = system-ui; tabular-nums. Light + dark
  ("Daylight"/"Evening"). Design system lives in `src/styles.css`.
- **Voting model: everyone on their own phone, async.** Host sets the table (constraints) →
  gets a QR + shareable link → others open it, pick who they are (or add a player) → submit
  top-3 whenever → reveal. No device-passing. (Demonstrated in the prototype.)
- **Adding players** happens on the Game Night join screen.
- **Stats depth:** log + core stats.
- **Storage: Firestore from the start** (see Architecture).

## The Voting Engine (rules to preserve)
1. **Set the Table** — host picks hard constraints (max time, couch/table, focus). Produces
   the "Eligible Tonight" set. Non-negotiable gate.
2. **Smart shortlist / ballot** — ~8 games, deliberately mixed: some favorites, some
   dusty/unplayed, variety of kinds. Stops the ballot being all short/familiar games.
3. **Ranked approval vote** — each player picks top 3, ranked. Borda points **3 / 2 / 1**.
4. **Freshness nudge (anti-rut)** — dusty (≥30d) **+1.5**, (14–29d) **+0.5**, just-played
   (≤3d) **−1**. Rotates the group out of ruts automatically.
5. **Tiebreak** (top two within ~0.75): **Captain of the Night** (rotates weekly) decides;
   otherwise **Dusty Shelf rule** (longer-unplayed wins). **Wildcard token** planned.

## Filter / Tag Taxonomy (fields on every game)
| Axis | Values | Source |
|---|---|---|
| Play time | <15 / 15–30 / 30–60 / 60+ min | BGG (auto) / manual |
| Time-to-table (setup) | instant / quick / involved | family tag |
| Location | couch / table / either | family tag |
| Attention | background (half-watch) / semi / focus | family tag |
| Players | min–max | BGG (auto) / manual |
| Complexity | 1–5 weight | BGG (auto) |
| Type (kind) | Card / Strategy / Party / Dice / Dominoes / Abstract / Family | BGG + tag |
First four are the hard "rule things out" constraints; the rest are soft preferences.

## Architecture (implemented)
- **React + Vite** app at repo root. `npm run dev` (port 5173), `npm run build` → `dist/`.
- **Firestore** for data; **anonymous auth** (silent, no login — fits passwordless model).
- Key files:
  - `src/lib/firebase.js` — Firebase init from `VITE_FIREBASE_*` env; `ensureAuth()` does
    silent `signInAnonymously`. `hasFirebase` = are env vars present.
  - `src/lib/catalog.js` — the data layer. ONE interface, TWO backends: **Firestore when
    configured, localStorage fallback otherwise** (auto-switch). `subscribeGames`, `addGame`,
    `deleteGame`, `coverFor(name)` (gradient cover from name hash).
  - `src/App.jsx` — header (storage badge, theme toggle), tabs, auth-then-subscribe.
  - `src/components/Shelf.jsx` — browse/search/detail-modal.
  - `src/components/AddGame.jsx` — manual intake form.
- **Game doc shape** (`games` collection): `name, kind, time, minPlayers, maxPlayers, players,
  loc, att, setup, cover{c1,c2}, last, plays, source, createdAt`.
- Planned collections: `players`, `sessions` (per game night), `plays` (stats feed).

## Firebase project
- Project id: **game-shelf-81548**. Anonymous sign-in **enabled**. Firestore in **nam5**.
- **Security rules PUBLISHED** (`firestore.rules`): `allow read, write: if request.auth != null;`
  — only signed-in (anonymous) app users. Tighten later (per-collection, guest vs family).
- The Firebase web config is public by design; real security is the rules.

## Env vars (6, prefix `VITE_FIREBASE_`)
`API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID`.
- Local: `.env.local` (gitignored). Template in `.env.example`.
- Netlify: same 6 under Site configuration → Environment variables. **Vite requires exact
  UPPERCASE names**, and env-var changes need a manual "Clear cache and deploy site".
- `netlify.toml` sets `SECRETS_SCAN_OMIT_KEYS` for these (they're public and get inlined,
  else Netlify's secret scanner fails the build).

## Intake / BoardGameGeek
- BGG XML API (since late Oct 2025) **requires a registered app + bearer token**; it also
  blocks datacenter IPs, so calls must go through a **Netlify Function** proxy (keeps the
  token secret + solves CORS). Non-commercial registration at boardgamegeek.com/applications/create,
  approval ~a few days.
- **Status:** token pending (Kevin registering). Until then, **manual intake works** (Add a
  Game). When the token arrives: add a Netlify function + name→search→pick→auto-fill
  (players/time/weight/**real box art**). Goal: add a game in ~15s from just the name.

## Deploy Workflow
Work on `main`. `git add … && git commit && git push` → Netlify auto-builds from `main`
(command `npm run build`, publish `dist`; prototype served from `public/prototype/`).
**Never push without Kevin explicitly asking.** Give exact CLI commands every time.
Verify deploys via the live JS bundle (curl the `/assets/index-*.js` and grep) or the
Netlify MCP reader.

## Resume checklist (next session)
1. Confirm the API-key fix + redeploy; verify full key in live bundle and that adding a game
   works end-to-end on the live site (badge Cloud synced + no permission-denied).
2. Wire **Game Night** + **Stats** to the real Firestore catalog.
3. Add **BGG auto-fill** once the token lands.
4. Optional: draft a "add ~100 games fast" workflow for bulk intake.
