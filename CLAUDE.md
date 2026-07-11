# Game Shelf — Claude Code Context

## Project
A cozy, fun family web app that catalogs the Klein family board-game collection, helps
everyone pick "what do we play tonight?" fairly, and tracks who played what. Built to make
recurring **Thursday Game Night** (or any night) easier and less rut-prone.

- **Live app:** https://ourgameshelf.netlify.app  (React + Vite, deployed on Netlify)
- **Phase 1 prototype** (design reference, voting engine demo): https://ourgameshelf.netlify.app/prototype/
- **Repo:** its own git repo at `/Users/kevin/Desktop/Projects/gameshelf`, remote
  `github.com/kevinmklein/gameshelf`, branch `main`. Isolated from the accidental
  home-folder repo at `/Users/kevin/.git` — always run git from inside this folder.
- **Owner:** Kevin (Dad) — *novice web dev*: knows basic git/CLI/Netlify but needs explicit,
  step-by-step CLI + console instructions. Never assume tooling knowledge.

## Current state (2026-07-11) — full prototype live, in QA/polish
**All four tabs are built, wired to Firestore, and live.** Shelf (browse + search + filters +
real box art + edit/remove), Game Time (real-time async voting), Stats (log + core stats),
Add a Game. ~20 real games in the DB with a few real cover photos. Cloud-connected: silent
anonymous auth + strict Firestore rules working on desktop + mobile. Now iterating on
features/bugs; BGG auto-fill still pending the API token.

2026-07-08 architecture pass: fixed two voting bugs (room-code collisions could resurrect a
dead session's votes → host now re-rolls via `sessionExists()`; the freshness nudge could
crown a zero-vote game → `tally()` now only scores voted games) and de-duplicated shared
code (`FAMILY`/`colorFor` → `src/lib/family.js`; `Seg`/`Meeple` → `gameNightBits.jsx`;
`agoLabel` + `FALLBACK_COVER` → `catalog.js`). Verified end-to-end in the browser.

2026-07-09 branding pass: real logo wired into the header (fixed off-white plate, same in
both themes — see Branding below); generated favicon/apple-touch-icon/manifest icons from the
logo's book-shelf mark, retiring the placeholder `icon.svg`.

2026-07-09 QA pass: dropped the Evening/dark theme entirely (see Locked Decisions) and the
header's cloud-synced badge, freeing up header space for the tagline. Fixed the iOS PWA status
bar overlapping header content (`apple-mobile-web-app-status-bar-style` → `default` +
`safe-area-inset-top` padding), the edit-game modal not scrolling on mobile (`.modal` now has
`max-height` + `overflow-y:auto`), a `.grid2`/`.field` CSS bug that misaligned the Type field
against Typical Play Time, and removed the Add-a-Game name field's `autoFocus` (was popping the
iOS keyboard on tab switch). Added a **Word Game** kind (Scrabble + Boggle reclassified in
Firestore) and a "Game Types Played" bar chart on Stats, grouped by kind from the play log.

2026-07-09 Game Time UX pass: after voting, voters no longer stare at a dead end. Added a
**shared `Lobby` component** (`gameNightBits.jsx`) used by both the host (`GameNight.jsx`,
full controls) and voters (`Join.jsx`, read-only + their own vote button) — everyone now sees
the same live vote count + who's-voted list. Voters get a **"Go to lobby →"** button next to
"Change my vote"; the host's existing Lobby now also gets the browsable ballot (previously
host-only ballot count pill, no browsing). Added **`BallotBrowseList` + `GameInfoModal`**
(`gameNightBits.jsx`) — tapping any ballot game (in "While you wait" or the Lobby) pops a
read-only detail card (cover art, time/players/where/attention, last-played) reusing
`locLabel`/`attLabel` (moved to `catalog.js` so Shelf and Game Night share them) — this will
get much more useful once BGG descriptions land. Ballot snapshots (`night.js` `snapshot()`)
now also carry `image` so real box art shows up in the popup, not just the gradient strip.
**Set the Table gained a player-count constraint** (`c.players`, Seg of 2–8+/Any) — `eligible()`
now filters on it via a new `seatsPlayers(g, n)` helper in `night.js` (moved from `Shelf.jsx`,
which now imports it — same seat-count logic, one definition), and `constraintPills()` shows a
"👥 N playing" pill. Verified end-to-end in the browser as both host and voter.

2026-07-09 second Game Time/Shelf pass: five more fixes/features. (1) The host's Share screen
(`GameNight.jsx`) now has a **"Cast my vote →"** button that jumps straight into `VoteFlow`,
so the host doesn't have to detour through the lobby just to vote themselves. (2) Fixed a real
dead end: `App.jsx` used to hide the tab nav entirely on the `#/join/CODE` voter route, so a
voter who'd just submitted had no way back into the app. The nav now **always renders**; tapping
a tab while on a join link clears the hash (`window.location.hash = ''`) and switches tabs in
one click. (3) Added **pull-to-refresh** on the Shelf tab: new `src/components/PullToRefresh.jsx`
(touch-drag while `scrollTop` is 0 triggers `window.location.reload()`) wraps `<Shelf>` in
`App.jsx` — mainly for standalone/PWA mode, which has no native browser pull-to-refresh chrome.
(4) **Photo upload for box art** (`GameForm.jsx`): a file input resizes + compresses the chosen
photo client-side (canvas, max 700px edge, JPEG q=0.82) into a data URL stored directly in the
game's existing `image` field — comfortably under Firestore's 1MiB doc limit, so no Firebase
Storage product/rules were needed. The old "paste a URL" text field is kept as a fallback
(hidden once a photo's been uploaded, since editing a data-URL string isn't useful) with a
thumbnail preview + Remove button. (5) **Captain of the Night is now visible**: it was computed
in `night.js`'s `captainFor()` but only ever shown inline in `RevealResults`' tiebreak note.
`captainFor` gained an optional `weekOffset` param; Play Stats now has a small panel showing
this week's captain (computed over the full `FAMILY` roster, not just tonight's voters) plus
"Next up". Verified end-to-end in the browser (including simulating a file upload and a
touch pull-gesture via injected DOM events).

2026-07-11 BoardGameGeek integration (LIVE, steps 1+2 of 3): the approved BGG XML API is
wired in end-to-end. A **Netlify Function proxy** (`netlify/functions/bgg.js`) is the ONLY
place the bearer token is used — it adds `Authorization: Bearer`, solves CORS, parses BGG's
XML → clean JSON, retries BGG's 202 "queued" responses, and exposes `?op=search` +
`?op=thing`. (An *authorized* request works from any IP, including this Lambda; the old
"datacenter IPs are blocked" note only applied to anonymous traffic.) The Add/Edit form
(`GameForm.jsx`) gained **search → pick → auto-fill** via a new `BggAutofill.jsx` + client
`src/lib/bgg.js` (base games ranked above fan-expansions). Picking fills players/time and
stashes rich metadata (weight/complexity, rating, rank, minAge, description, year,
categories, mechanics, best/recommended player counts) onto the game doc for upcoming
filters. **Cover protection:** BGG art is stored in a SEPARATE `bggImage` field and
`coverImageFor` resolves `image` (curated/uploaded) → `bggImage` → gradient, so hand-curated
covers are never overwritten by a sync. Verified against live BGG (search ranking, auto-fill,
a Carcassonne re-sync that kept its curated cover) and confirmed live in production (function
+ UI). Local dev needs `netlify dev` (port 8888), not `npm run dev` (plain Vite doesn't serve
functions). **Step 3 (next session):** surface the metadata — complexity / best-at-N /
kid-friendly (minAge) filters, descriptions in the detail modal + Game Night's `GameInfoModal`,
best-at-N into voting eligibility — and **backfill** BGG data onto the existing catalog (a
reviewable bulk re-sync), since only games added/re-synced since 2026-07-11 carry the new fields.

2026-07-11 BGG step 3 (search features — LIVE, backfill in progress): surfaced the captured
metadata across the app, minus min-age (Kevin's call — Sara & Sophia can play anything and the
family skips mature themes, so an age filter is a no-op). (1) **Shelf filters:** a new
**Complexity** select (Light/Medium/Heavy from `weight`, via `complexityBucket`/`complexityLabel`
in `catalog.js`) and a **"★ Plays well at N"** checkbox that appears once a player count is chosen
(filters on `playsBestAt`/`playsWellAt` in `night.js`). (2) **Descriptions + complexity + best-at**
now show in the Shelf detail modal AND Game Night's `GameInfoModal` (both hide the specs when a
game has no BGG data). `night.js` `snapshot()` now freezes `description/weight/bestPlayers/
recommendedPlayers/bggImage` onto the ballot so the popup has them. (3) **Game Night shortlist:**
`buildBallot` seeds a couple of best-at-N games (community best, then recommended) before the
random variety fill when a player count is set. (4) **Backfill tool** — a reviewable, NON-DESTRUCTIVE
`#/backfill` route (`Backfill.jsx`, linked from the Add-a-Game tab): walks games with no `bggId`,
auto-matches each to BGG, previews the data (with a manual-search override), and on approve writes
ONLY the BGG_META fields (so curated covers/tags/specs are never touched). The BGG field mapping is
now shared: `BGG_META_KEYS` + `bggMetaFromThing` live in `src/lib/bgg.js` (GameForm + Backfill both
import them). Verified end-to-end in the browser (filters, both modals, backfill approve→write→live
update). **Backfill is only ~1/50 done** — Anarchy Pancakes was approved as the write-path proof;
Kevin runs the rest at `#/backfill` (needs `netlify dev`). Until then, complexity/best-at filters and
descriptions populate only for synced games.

Security note: the Firebase web API key is public by design (it ships in the client bundle);
it was once committed in git history and flagged by GitHub. It's now **restricted in Google
Cloud** to the site's referrers, so the alert is dismissible. Never paste the key value into
tracked files — it belongs only in `.env.local` and Netlify env vars.

Lessons kept for reference: Vite needs env names in exact UPPERCASE; Netlify env-var changes
require a manual "Clear cache and deploy site"; copy API keys with the copy icon, not
double-click (which truncates at the first `-`).

## The Family (default profiles)
| Profile | Who | Notes |
|---|---|---|
| Kevin | Dad | Likes strategy: Catan, Carcassonne |
| Stacey | Mom | |
| Sara | Daughter, turns 13 wk of 2026-07-18 | Family win leader in prototype sample data |
| Sophia | Daughter, turns 13 wk of 2026-07-18 | Invents wacky Uno variants |
Refer to them by name — **Sara** and **Sophia**, not "the twins". At 13 they can play anything the
family owns; the family doesn't play mature-themed games at all, so **age never gates** — do NOT
build a min-age / kid-friendly filter (BGG's `minAge` may stay on docs, just don't surface it).
Guests/extended family add a lightweight profile on the fly (planned: on the Game Night join screen).

## The Three Features
1. **The Shelf** — visual library. Games shown as boxes on wooden shelves. ✅ Built: browse,
   **search + filter bar** (players / where / length / type), click a box → **detail modal**
   (specs, tags, play history) with **Edit** + remove-from-shelf inside it. Add and Edit share
   `GameForm.jsx`; edit calls `updateGame(id, patch)`.
2. **Game Night** — the voting engine (see rules below). ✅ Built & wired to the real catalog
   with **real-time Firestore rooms**. Host: Set the Table (constraints) → session created +
   ballot built from the live shelf → Share (real scannable QR + `#/join/CODE` link) → live
   Lobby (votes stream in) → Reveal (Borda 3/2/1 + freshness nudge + Captain tiebreak). Voters
   open the link on their own phones, pick who they are (or add a guest), rank top-3, submit —
   fully async, no device-passing. Reveal's "log the night" writes a play → feeds Stats.
3. **Stats** — log nights, show aggregate + per-person stats. ✅ Built (v0.1 = **log + core
   stats**): a "Log a game night" form (game, date, who-played chips + on-the-fly guests,
   winner, minutes) and a dashboard — nights logged, time at the table, most-played, a
   wins-per-person leaderboard, the Dusty Shelf, and a recent-nights log. Logging a play
   also freshens the game's `lastPlayed`/`plays`, seeding Game Night's future freshness math.
   Not yet built: editing/removing a logged play (removal needs a `lastPlayed` recompute).

## Naming (UI copy vs. code)
The feature is branded **"Game Time"** in the UI (tab label, headings, "Log a Game Time",
"Recent Game Times", etc.). The only place "Game Night" survives on purpose is the header
tagline **"Thursday Game Night HQ"**. In code + this doc the feature is still called *Game
Night* (component `GameNight.jsx`, `night.js`, tab id `'night'`) — don't rename those.

## PWA / install
The app is installable: `public/manifest.webmanifest` (display `standalone`, theme `--felt`)
+ apple-mobile-web-app meta in `index.html`. Real branding is wired in: `public/favicon.ico`
+ `favicon-16/32/48.png` (transparent, browser tab), `public/apple-touch-icon.png` (180×180,
opaque felt-green — iOS fills transparent PNGs with black otherwise), `public/icon-192.png` /
`icon-512.png` (manifest, opaque felt-green for Android's maskable crop). All four generated
from `public/brand/logo.png`'s book-shelf mark (see Branding below); the old placeholder
`icon.svg` is gone. No service worker yet (avoids stale-cache surprises), so the automatic
install *prompt* won't fire — family "Add to Home Screen" from the browser menu works and
launches standalone. A scanned QR always opens the browser first; that's inherent to the web.

## Branding
Real logo lives at `public/brand/logo.png` (947×363, transparent bg, wordmark + a book-shelf
icon mark). The header (`App.jsx`) shows it directly via `<img class="brand-logo">` — no more
meeple placeholder, and the "Klein family collection" tagline sits to its right (where the
old cloud-synced badge / theme toggle used to be — see Locked Decisions). Header is a **fixed
off-white plate** (`--header-bg` etc. in `styles.css`) with `padding-top:env(safe-area-inset-top)`
so it doesn't collide with the iPhone status bar in standalone/PWA mode. Favicon/apple-touch-icon/
manifest icons are cropped from the logo's icon mark (left ~427px) — see PWA / install above. If
the logo changes, regenerate those with the same crop-and-pad approach (icon mark trimmed to its
bbox, centered on a square canvas; opaque felt-green `#2f4a3a` background for apple-touch-icon +
manifest icons, transparent for favicons).

## Locked Decisions
- **Aesthetic: Cozy tabletop** — felt green (`--felt #2f4a3a`), walnut, brass (`--brass #c6902f`),
  warm parchment. Display = Iowan/Georgia serif; body = system-ui; tabular-nums. **Daylight only**
  — the Evening/dark toggle and the `prefers-color-scheme` auto-switch were removed (low value,
  ate header space); `:root` in `styles.css` is now the single source of truth for all colors.
  Design system lives in `src/styles.css`.
- **Voting model: everyone on their own phone, async.** Host sets the table (constraints) →
  gets a QR + shareable link → others open it, pick who they are (or add a player) → submit
  top-3 whenever → reveal. No device-passing. (Demonstrated in the prototype.)
- **Adding players** happens on the Game Night join screen.
- **Stats depth:** log + core stats.
- **Storage: Firestore from the start** (see Architecture).

## The Voting Engine (rules to preserve)
1. **Set the Table** — host picks hard constraints (player count, max time, couch/table,
   focus). Produces the "Eligible Tonight" set. Non-negotiable gate.
2. **Smart shortlist / ballot** — ~8 games, deliberately mixed: some favorites, some
   dusty/unplayed, variety of kinds. Stops the ballot being all short/familiar games.
3. **Ranked approval vote** — each player picks top 3, ranked. Borda points **3 / 2 / 1**.
4. **Freshness nudge (anti-rut)** — dusty (≥30d) **+1.5**, (14–29d) **+0.5**, just-played
   (≤3d) **−1**. Rotates the group out of ruts automatically. **Applies only to games with
   at least one vote** — the nudge reorders the voted set; a zero-vote game can never win.
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
| Type (kind) | Card / Strategy / Party / Dice / Dominoes / Abstract / Family / Word Game | BGG + tag |
First four are the hard "rule things out" constraints; the rest are soft preferences.

## Architecture (implemented)
- **React + Vite** app at repo root. `npm run dev` (port 5173), `npm run build` → `dist/`.
- **Firestore** for data; **anonymous auth** (silent, no login — fits passwordless model).
- Key files:
  - `src/lib/firebase.js` — Firebase init from `VITE_FIREBASE_*` env; `ensureAuth()` does
    silent `signInAnonymously`. `hasFirebase` = are env vars present.
  - `src/lib/catalog.js` — the data layer. ONE interface, TWO backends: **Firestore when
    configured, localStorage fallback otherwise** (auto-switch). `subscribeGames`, `addGame`,
    `deleteGame`, `coverFor(name)` (gradient cover from name hash); also `locLabel`/`attLabel`
    (human labels for a game's location/attention fields — shared by Shelf's detail modal and
    Game Night's `GameInfoModal`).
  - `src/App.jsx` — header (logo + tagline, no theme toggle or connectivity badge — see
    Locked Decisions), tabs, auth-then-subscribe.
  - `src/components/Shelf.jsx` — browse/search/detail-modal.
  - `src/components/AddGame.jsx` — manual intake form.
  - `src/components/Stats.jsx` — log-a-night form + core-stats dashboard.
  - `src/lib/night.js` — pure voting-engine logic (`eligible`, `buildBallot`, `tally`,
    `captainFor`, `makeRoomCode`, `joinUrl`, `constraintPills`, `seatsPlayers`). No
    Firestore/React. `seatsPlayers(g, n)` is the single definition of "does this game seat n
    players" — `Shelf.jsx`'s player filter imports it too, don't redefine locally.
  - `src/lib/family.js` — single source of truth for the family roster + player colors
    (`FAMILY`, `colorFor`). Used by Game Night UI and Stats.
  - `netlify/functions/bgg.js` — the server-side BGG proxy (the ONLY place `BGG_API_TOKEN`
    is used). Netlify v2 function; `?op=search`/`?op=thing` → clean JSON. Also exports
    `parseThing`/`parseSearch` for local unit-testing (Netlify ignores the extra exports).
  - `src/lib/bgg.js` — thin client for the proxy: `bggSearch(q)`, `bggThing(id)`, plus the
    result ranking that floats base games above fan-expansions. Calls `/.netlify/functions/bgg`
    only (never BGG directly — token stays server-side, and BGG sends no CORS headers).
  - `src/components/BggAutofill.jsx` — debounced BGG search box + picker at the top of
    `GameForm` (add + edit). `onPick(thing)` hands full details up; the form applies them and
    protects curated art. In edit mode the label is "Re-sync from BoardGameGeek".
  - `src/components/GameNight.jsx` — host flow (Set the Table → Share → Lobby → Reveal).
    On open it re-rolls the room code if `sessionExists()` (codes recycle; reusing a live
    one would resurrect the old session's votes subcollection in the new lobby). Renders the
    shared `Lobby` with `isHost`.
  - `src/components/Join.jsx` — the `#/join/CODE` voter view. After voting, a local `view`
    state (`wait` | `lobby`) toggles between the short "your vote's in" summary and the
    shared `Lobby` (no `isHost`, so no reveal/start-over/show-link — just the live vote count,
    the browsable ballot, and their own "Edit my vote").
  - `src/components/gameNightBits.jsx` — shared UI: `BallotPicker`, `VoteFlow`,
    `IdentityPicker`, `RevealResults`, `Avatar`, `Meeple`, `Seg`, `Lobby`, `BallotBrowseList`,
    `GameInfoModal`. `Seg` + `Meeple` live ONLY here — GameNight, GameForm, and App import
    them; don't re-define locally. `Lobby` is host/voter-agnostic (`isHost` prop switches the
    controls) — it's the one place the live vote-count/who's-voted UI is defined, used by both
    `GameNight.jsx` and `Join.jsx`. `BallotBrowseList` + `GameInfoModal` are the tap-a-game-for-
    details popup, used in the Lobby and in Join's "while you wait" panel.
  - `catalog.js` also exports: `subscribePlays`, `logPlay(play)`, `playedDaysAgo(game)`
    (live days-since; falls back to legacy static `last`); `agoLabel(d)` (human label,
    handles null = "never played"); `FALLBACK_COVER` (the one gradient fallback — never
    hand-write `{c1:'#3a3a3a',…}`); `getUid(user)` (stable per-device id); and the session
    API `createSession`, `sessionExists`, `subscribeSession`, `subscribeVotes`,
    `submitVote`, `revealSession`.
- **Routing:** tiny hash router in `App.jsx`. `#/join/CODE` → voter view (tabs hidden);
  everything else → the normal tabbed app. Hash routing needs no Netlify redirect config.
- **Dependencies added:** `qrcode.react` (scannable QR for the join link); `fast-xml-parser`
  (BGG XML→JSON inside the Netlify function).
- **Box art:** `coverImageFor(game)` resolves with precedence **`image` (curated `/covers/*`
  path or uploaded data URL) → `bggImage` (BoardGameGeek CDN url from auto-fill) → name-hash
  gradient `cover`**. Auto-fill only ever writes `bggImage`, so hand-curated art in `image` is
  never overwritten by a sync. Curated photos live in `public/covers/`; games with no curated
  art now get BGG box art automatically once linked.
- **Game doc shape** (`games` collection): `name, kind, time, minPlayers, maxPlayers, players,
  loc, att, setup, cover{c1,c2}, image, last, lastPlayed, plays, source, createdAt`. `lastPlayed` is a
  real millis timestamp set by `logPlay`; the older `last` (static "days ago") is legacy —
  prefer `playedDaysAgo()`. **BGG-linked games also carry** (from auto-fill, 2026-07-11+):
  `bggId, bggImage, weight (complexity 1–5), rating, rank, minAge, description, year,
  categories[], mechanics[], bestPlayers, recommendedPlayers[]`. These are absent on games not
  yet synced — step-3 features should treat them as optional / backfill first.
- **Play doc shape** (`plays` collection, implemented): `gameId, gameName, players[], winner,
  minutes, playedAt (millis), createdAt`. `winner` is null for co-op / no-winner nights.
- **Session doc shape** (`sessions/{code}`, implemented): `phase ('voting'|'revealed'),
  constraints{players,maxTime,loc,att}, ballot[frozen game snapshots incl. image], host (uid),
  createdAt`, with a
  `votes/{voterId}` subcollection: `{name, color, ranking:[gameId×3], updatedAt}`. voterId =
  `getUid()`. The `/{document=**}` rule already covers sessions + the votes subcollection.
- Planned collections: `players` (persistent profiles).

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
- **`BGG_API_TOKEN`** (7th var, **no `VITE_` prefix**) is server-side only — used by
  `netlify/functions/bgg.js`. Set in `.env.local` (local, gitignored) + Netlify env vars (prod).
  Do NOT add it to `SECRETS_SCAN_OMIT_KEYS`: it's genuinely secret and never lands in the client
  bundle, so the scanner correctly leaves it alone. Local function testing needs `netlify dev`.

## Intake / BoardGameGeek
- BGG XML API (since late 2025) **requires a registered app + bearer token** on every request.
  It blocked *anonymous* datacenter traffic, but an **authorized** request (bearer token) works
  from any IP — including the Netlify Function — so the proxy approach works. The proxy's real
  jobs: keep the token secret, solve CORS, and parse XML→JSON. Base endpoint
  `https://boardgamegeek.com/xmlapi2/` (`/search?type=boardgame&query=`, `/thing?stats=1&id=`).
- **Status (2026-07-11): LIVE.** Token approved and in use. `netlify/functions/bgg.js` proxies
  `?op=search` / `?op=thing` (clean JSON); `GameForm.jsx` does name→search→pick→auto-fill
  (players/time/weight/box art + rich metadata) — the ~15s-from-a-name goal, for BGG-listed games.
  Token lives in `.env.local` (local) + Netlify env var `BGG_API_TOKEN` (prod) — **no `VITE_`
  prefix**, and deliberately **not** in `SECRETS_SCAN_OMIT_KEYS` (genuinely secret; never lands
  in the client bundle). Local dev needs `netlify dev` (port 8888). Manual intake still works.
  See the 2026-07-11 entry above for the full design (cover protection, stored fields, step 3).

## Deploy Workflow
Work on `main`. `git add … && git commit && git push` → Netlify auto-builds from `main`
(command `npm run build`, publish `dist`; prototype served from `public/prototype/`).
**Never push without Kevin explicitly asking.** Give exact CLI commands every time.
Verify deploys via the live JS bundle (curl the `/assets/index-*.js` and grep) or the
Netlify MCP reader.

## Next up — full prototype is built (Shelf + Add + Game Night + Stats). Now: polish & bugs.
Known gaps / follow-ups surfaced while building Game Night:
1. **Host session isn't resumable.** The active room code lives in `GameNight.jsx` component
   state — if the host refreshes or leaves the tab mid-night, the lobby is lost (the Firestore
   session still exists). Persist the code to localStorage + offer "resume or start new."
2. **Reveal logs `winner: null`** — it records that the winning game was played, but who won is
   set later on the Stats tab. Consider a quick winner-picker on the reveal screen.
3. **Stats:** edit/remove a logged play (needs `lastPlayed` recompute); per-game "log a play"
   shortcut from the Shelf detail modal.
4. **BGG auto-fill — steps 1+2 DONE (2026-07-11); step 3 shipped same day** (complexity + best-at-N
   filters, descriptions in both modals, best-at-N shortlist nudge; min-age deliberately skipped).
   **Remaining: run the backfill.** The reviewable `#/backfill` tool exists but only ~1/50 games are
   linked (Anarchy Pancakes, as a write-path test) — Kevin should work through the queue (needs
   `netlify dev`) so the new filters/descriptions populate across the whole shelf. Optional polish:
   surface `categories`/`mechanics` as tags; a "best-fit" hint on the Shelf when a bad player-count
   filter empties the list; consider whether the complexity filter should keep or drop unsynced games.
5. Verified in cloud mode — left a few throwaway test sessions (`CROW-*`, `LYNX-*`, `OWL-748`,
   `HARE-849`) in the `sessions` collection; harmless (random codes, not shown anywhere), clear anytime.
   Better: set a Firestore **TTL policy** on `sessions` keyed to `createdAt` so old rooms
   self-delete (also shrinks the room-code collision window).
6. Optional: draft a "add ~100 games fast" bulk-intake workflow.
7. Bundle is ~665 kB (Firebase + qrcode). Fine for now; code-split later if load feels slow.
8. "Export my shelf" JSON-download button — cheap backup insurance, since the open anonymous
   rules mean anyone with the URL could write/delete data.
9. One-time cleanup: migrate remaining legacy `last` fields to `lastPlayed` timestamps, then
   drop the fallback branch in `playedDaysAgo()`.
