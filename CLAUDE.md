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

2026-07-11 bug-bash pass: **backfill is done** — checked the live catalog directly (all 50 games'
weight/bestPlayers/recommendedPlayers) rather than guessing; 48/50 carry a `bggId`, and the only two
that don't (Netflix Games, Liar's Dice) aren't real BGG catalog entries, so there's nothing left to
match. Four fixes off that same data pull: (1) **Complexity filter removed** from the Shelf — BGG's
absolute 1–5 weight scale put 45/50 games in "Light" (only Catan/Scrabble hit Medium, only Chess hit
Heavy), so it never narrowed anything for this collection. Kevin's call — dropped rather than retuned.
`complexityLabel`/`complexityBucket` (`catalog.js`) stay; weight still shows as a spec in the Shelf
detail modal, `GameInfoModal`, and the Backfill preview. (2) **"★ Plays well at N" toggle removed**
from the Shelf — `recommendedPlayers` (BGG's poll) is almost always the game's entire supported player
range, so the toggle (best-at OR recommended) rarely excluded anything. `playsBestAt`/`playsWellAt`
(`night.js`) stay — still used by `buildBallot`'s best-at-N ballot seeding, and "Best at" still shows
as a spec. (3) **GameForm image field** no longer requires the full `/covers/filename.jpg` path — a
bare filename is auto-prefixed with `/covers/` on save (`expandCoversPrefix` in `GameForm.jsx`), and
stripped back to just the filename for display when editing (`stripCoversPrefix`); full URLs and
`data:` URIs pass through untouched. (4) **Modal close button (`.x`) made sturdier** — bumped
32px→40px hit target, raised background opacity + added a white ring + drop shadow so it stays
legible over any box art (it was nearly invisible on light covers like Balderdash, since the hero's
darkening gradient only covers the bottom ~65%), plus a small top-right radial scrim behind it on
image heroes. Shared by the Shelf detail modal, GameForm's edit hero, and `GameInfoModal`.

2026-07-11 follow-up: two more fixes to the same close button + a new spec field, caught by Kevin
using the app. (1) **Close button no longer overlaps the kind/title text.** Root cause was a
pre-existing bug, not something introduced in the pass above: `.modal .hero.hasimg .x` (a
higher-specificity selector meant to lift the `kind`/`h3` text above the `::after` darkening
overlay via `z-index`) was also silently forcing the button's `position` from `absolute` back to
`relative` whenever a game had real box art — pulling it into the flex flow right above the title
instead of floating in the corner. Fixed by dropping `.x` from that selector and giving `.modal .x`
its own `z-index:2` directly (so it stays absolutely positioned *and* above the overlay). Also gave
`.kind`/`h3` `padding-right:52px` so long two-line titles reserve space and never render text under
the button either. (2) **Min age added as a spec** in both detail overlays (Shelf's `GameDetail`
and Game Night's `GameInfoModal`) — new `minAgeLabel(minAge)` helper in `catalog.js` (e.g. "12+",
null if BGG has no rating). Display-only, sits between Complexity and Where — this does NOT
contradict the "age never gates" rule under **The Family** below; it's surfaced so Kevin can spot
which games skew young, not used to filter or exclude anything. `night.js`'s `snapshot()` now also
freezes `minAge` onto ballot snapshots so it shows in Game Night's popup too.

Also shipped in the same pass — **Game Time polish**: dropped "tonight" from the eligible-games note
in Set the Table; added a "See the list ▾" toggle that expands to the actual eligible games via
`BallotBrowseList` + `GameInfoModal` (same tap-for-details popup used in the Lobby), so hosts can
browse — not just count — while adjusting constraints. `GameNight.jsx` now computes `eligibleGames`
(not just a count) and passes it to `SetTable`. Verified live in the browser throughout.

2026-07-11 Game Time ballot rebuild (LIVE): fixed the core fairness bug and deepened the shortlist.
**The bug:** `buildBallot`'s old deterministic top-N (top-3 by `plays`, top-3 by dustiness) collapsed
to **alphabetical** whenever play history was sparse — with almost every game at `plays:0`/no
`lastPlayed`, both sorts tied and JS's stable sort preserved the incoming `orderBy('name')` order, so
slots 1–6 were locked to "the first 6 games A→Z" every session, and the display order was fixed too
(primacy bias). **The fix — a weighted lottery** (`ballotWeight` + rewritten `buildBallot` in
`night.js`): each eligible game gets a weight (base 1 + freshness/anti-rut + BGG `rating` quality +
sleeper + best-at-N + soft-pref matches), then we **sample 8 without replacement**, shrinking a
kind's odds by ×0.45 per already-picked game of that kind (soft variety), and **shuffle the final
display order**. Verified against the live 50-game catalog: 300 runs → all 50 games appear, first
slot is 50 distinct games, and the once-100%-locked early-alphabet games now sit at 11–24%.
**Two new SOFT axes** in Set the Table (nudges, NOT gates — `eligible()` is untouched, so the "N on
the table" count still reflects only the hard gates): **Effort/brain-burn** (Chill/Medium/Big
strategy) and **Vibe/energy** (Calm/Lively), plus **Setup time** (Instant/Quick/Involved) off the
existing per-game `setup` tag. Key design principle established: **hard gates for objective
constraints (players/time/loc/att), soft weights for fuzzy preferences** — this is why the removed
absolute Complexity *filter* isn't coming back as a gate. Effort is graded **relative to your own
shelf** (`effortThresholds`/`effortBucketOf` split the collection's `weight` values into terciles —
14 light/18 medium/16 heavy on the real catalog, vs the absolute scale's dead 45/50-Light), which
rescues the metric the old filter couldn't use. Vibe is **auto-derived** (`vibeOf`) from BGG
`categories`/`mechanics` + our `kind` (loud/social → lively, thinky/quiet → calm; tie/no-data →
null) — no manual tagging. **Sleeper hit** (`isSleeper`: BGG `rating`≥7 + dusty ≥30d) gets a lottery
boost and a **💎 Sleeper hit** badge on the ballot cards (Carcassonne/Chess/Hot Streak/Ticket to
Ride qualify today). `constraintPills` appends the soft prefs when set; `buildBallot` snapshots now
carry `sleeper`/`effort`/`vibe`, surfaced in `GameInfoModal` (Effort + Vibe specs; Effort shows the
relative "for your shelf" label). Files: `night.js` (engine), `GameNight.jsx` (SetTable controls +
`c` now has `effort`/`vibe`/`setup`), `gameNightBits.jsx` (badge + modal specs), `styles.css`
(`.sleeper-badge`, `.soft-head`). Verified end-to-end in the browser (engine distribution stats,
soft-pref discrimination, pills, badge render, modal specs). Left one throwaway session in Firestore.

2026-07-11 Set-the-Table follow-up (LIVE, Kevin's feedback): (1) **Moved the "That leaves N games on
the table" count above the "Set the mood" section** — the soft axes don't change it (they only weight
the lottery), so it now sits with the hard gates that DO move it, instead of below them where the
static number looked broken. (2) **Longer time buckets** — the time gate no longer implies "Full =
60m" (Kevin wants to encourage 90–120m games); options are now Quick·15m / A bit·30m / An hour /
**Long haul · 2hr (120)** / No limit. (3) **Two new BGG-powered HARD gates** so the eligible count
visibly narrows instead of hovering in the opaque 20–30s: **"What kind of game?"** (`c.kind` — Any +
every kind on the shelf; `eligible()` filters `g.kind !== c.kind`) and **"Which games shine at N?"**
(`c.bestAtN`, a two-option toggle that only appears once a player count is set; gates on
`playsBestAt` — BGG's community best-count poll, treating no-BGG-data as "doesn't qualify"). Both
feed `eligible()`, so the count reacts live: on the real catalog, players=4 → 48, +Best-at-4 → 22,
+Card → 13. `constraintPills` shows a `🎲 {kind}` pill and a `★ Best at N` pill when set. Note this is
a deliberate exception to "complexity-style fuzzy axes stay soft": kind and best-at-N are objective
enough to gate on, and Kevin specifically wanted more *visible* narrowing. `c` now also carries
`kind`/`bestAtN`. Verified end-to-end in the browser (order, time options, live count narrowing, pills).

2026-07-11 Set-the-Table ordering/defaults follow-up (LIVE, Kevin's feedback): (1) **"What kind of
game?" moved up to second** (right under player count) and **"Which games shine at N?" moved down**
below the movie question — kind is the more impactful/useful narrower, so it leads. (2) **Changing the
player count now resets `bestAtN` to false** ("Any that fit") — the players Seg's onChange sets
`{ players: v, bestAtN: false }` instead of the generic `set('players')`. Without this, toggling
"Best at 4" then dropping to 2 players left the strict best-at gate on and stranded you at ~1 game
(the "1/2 games on the table" defect Kevin hit — it was a persisted test-state carryover, not a bad
default; fresh defaults were always permissive: 2 players → 42 games, kind → Any, best-at → Any that
fit). Both gates default permissive and only narrow when the host opts in. Verified in the browser
(field order, the reset clearing the strand, 42-game permissive default at 2 players).

2026-07-11 attention 3-way + Shelf 2hr filter (LIVE, Kevin's feedback): (1) **Shelf "Length" filter
gained an "Under 2 hr" (120) option** (`Shelf.jsx`), matching Game Time's new time buckets — the
existing `g.time <= Number(f.time)` logic handles it, no other change. (2) **Game Time's attention
control is now 3-way.** The `att` field is a curated **family tag** (set in `GameForm`'s "Attention
needed": background/semi/focus — NOT from BGG; BGG has no attention/engagement metric, and the nearest
proxy `weight` is already spent on the Effort axis). It always stored three levels, but the old
"Half-watching a movie?" Seg only exposed background/focus/null, so `semi` games were invisible and
the gate felt binary. Relabeled **"How much focus tonight?"** with 👀 Half-watch / 🙂 Light focus /
🧠 All-in / Any, and made `eligible()` symmetric: added `if (c.att === 'semi' && g.att === 'focus')
return false` alongside the two existing lines — so background=mindless-only, semi=rules out
full-focus games, focus=rules out mindless games (semi is the flexible middle). `constraintPills`
shows a 🙂 Light focus pill for semi. Verified live: the three levels now narrow distinctly on the
real catalog (Any 50 / Half-watch 5 / Light focus 32 / All-in 45).

2026-07-12 focus → 3-tier Focus scale (LIVE, replaces the `att` metric): reworked "how much attention
does a good game demand?" into a robust, mostly-programmatic **3-tier Focus scale: Background · Casual
· Focused** (in `src/lib/focus.js`; `FOCUS_LABELS`/`FOCUS_BLURB` 1–3). **Key design insight: focus ≠
complexity** — a silent word race (Boggle) is light on rules but genuinely heads-down, while a heavy
game with lots of downtime you can half-watch. So it's **derived from BGG mechanics/categories
(attention continuity) as much as weight (cognitive load)**: `derivedFocus(g)` computes a fine 1–5
score (weight backbone — this collection is weight-compressed, so weight alone dumps most games at the
bottom, the failure that killed the Complexity filter — then mechanics adjust: real-time/speed/
dexterity +2 "can't look away", memory +1, deduction/bluffing bumps; party/children/roll-and-move/
player-judge penalties let attention wander) and **collapses 1–5 → 1–3** ({1:1,2:2,3:2,4:3,5:3}).
**No migration:** `focusOf(g)` derives live for all 50 (a hand-pinned integer `focus` 1–3 on the doc
overrides it). The Add/Edit form's old "Attention needed" Seg is now a **"Focus level"** picker (Auto
+ Background/Casual/Focused) with a live "Auto → … from BGG data" hint — the hand-classify escape
hatch. Pinned outliers: **Obama Llama → Background** (party game; derives Focused); Life/Tapple/Here to
Slay derive to sensible tiers on the coarser scale so their earlier pins are redundant-but-correct.
**Game Time gate is a TARGET tier (not a ceiling):** control "What focus are we after?" → Background /
Casual / Focused / Any; `eligible()` keeps games where `focusOf(g) === c.focus` (each pick = games AT
that tier, a distinct mood). **Why target, not ceiling** (the design fork Kevin resolved): a *ceiling*
("at most this focus") makes the top tier == Any — that's the redundancy Kevin flagged (old "All-in"
== "Any") and it's inherent (nothing on a bottom-heavy shelf demands more than the top tier). Target
gives 4 *distinct* buttons (Background 18 / Casual 20 / Focused 12 / Any 50 on the real catalog) and a
real "Focused / brain-burner night" option, at the cost that a pick shows only that tier (Casual won't
also include Background games). **Journey (don't re-litigate):** first shipped as a 5-point distraction
ladder (🍿 TV on…🧠 All-in) with a ceiling gate, but that had a redundant top button and behavior-guessy
labels — collapsed to 3 focus-descriptor tiers + switched ceiling→target to kill the redundancy for
good. Files: `src/lib/focus.js` (labels + `derivedFocus`/`focusOf`), `night.js` (target gate on
`c.focus`, snapshot `focus`, pill), `GameNight.jsx` (4-way target control, `c.focus` replaces `c.att`),
`gameNightBits.jsx` + `Shelf.jsx` (Focus spec replaces Attention), `GameForm.jsx` (Focus-level picker).
Legacy `att` field stays on docs (harmless, unused by the gate); `attLabel` in `catalog.js` is dead
but left in place. **Classifier is a heuristic first pass — Kevin pins outliers via the Edit form.**

2026-07-12 mobile/iOS optimization pass (CSS-only, `styles.css` + no logic changes): (1) **iOS
input auto-zoom killed** — any focused control under 16px makes iOS Safari zoom the page in and
leave it zoomed; a `@media (hover:none) and (pointer:coarse)` block bumps every text control
(`.field` inputs/selects, `input.search`, `.filt select`, `.linkbox input`, `.guest-add input`)
to 16px on touch devices only, so desktop keeps the tighter sizes. Same block grows tap targets
(Seg buttons, chips, BGG result rows) toward Apple's 44px guideline. (2) **Sticky-hover fix** —
the `.gbox:hover` lift transform is now wrapped in `@media(hover:hover)` (on iOS, :hover sticks
after a tap, so game boxes stayed floating after closing the modal); added a subtle `:active`
scale for touch feedback instead. (3) **`touch-action:manipulation`** on buttons/controls/gbox/
bcard — kills the double-tap-zoom delay and accidental page-zoom on fast repeated taps (voting
Segs); buttons also get `user-select:none` + no long-press callout. (4) **Tab nav scrolls
sideways** under 560px (nowrap + hidden scrollbar) — 4 tabs overflowed 375px screens; "Add a
Game" peeking off-edge is the scroll affordance. (5) **Safe-area insets everywhere `viewport-fit=
cover` needs them** — `.wrap`/`.brand`/`nav.tabs` left+right (landscape notch), `.wrap` + `.toast`
+ `.scrim` bottom (home-indicator bar). (6) Misc: `#root` min-height 100dvh fallback (URL-bar
resize), `-webkit-text-size-adjust:100%` (landscape font inflation), transparent tap highlight,
`overscroll-behavior:contain` on `.modal` + `.bgg-results` (no background scroll-chaining),
search box full-width on phones, `.wrap` side padding 20→14px under 560px. Verified at 375×812
in the browser (shelf, detail modal, Game Time Set-the-Table, Add-a-Game form, tab-bar scroll,
zero horizontal overflow, CSSOM confirms the coarse-pointer rules parsed; the 16px/tap-target
block itself needs a real touch device — the desktop preview doesn't emulate coarse pointers).

2026-07-12 UX cleanup pass (Kevin's feedback): (1) **Neutral Seg options are now uniformly
rightmost.** Every Set-the-Table control (`GameNight.jsx`) already ended with its neutral
option (Any/No limit/Either); the "What kind of game?" Seg was the odd one with `Any` leading —
moved to the end. Same fix applied to the Add/Edit form (`GameForm.jsx`): Focus level's `Auto`
and Time-to-set-up's `Any` moved rightmost. (2) **Time bucket "Long haul · 2hr" → "Committed ·
2hr".** (3) **Time-to-set-up now defaults to `Any` (null)** — new games no longer force a
`quick` setup tag; `eligible()`/`ballotWeight` already treat a null setup as "unset" (no gate,
no weight), and editing preserves any existing value. (4) **"Add a Game" removed from the top
nav** — the three headline features (Our Shelf · Game Time · Play Stats) own the tab bar now.
Add-a-Game is a focused sub-view (`tab==='add'`, not in the `tabs` array) reached from a CTA at
the bottom of Play Stats (`Stats` gets an `onAddGame` prop) and the Shelf's existing add button;
it gained a "← Back to the shelf" link. (5) **Backfill buried** — the `#/backfill` route still
works but its link is demoted to a subtle "Admin ·" line at the bottom of Add-a-Game. (6) **BGG
picked-cover lightbox** — new `src/components/ImageLightbox.jsx` (full-screen image preview,
closes on scrim/✕/Escape). Tapping the BGG picked cover in `BggAutofill.jsx` (or the box-art
thumb in `GameForm.jsx`) opens it full-size — the "is this the right box?" moment before saving.
NOTE: BGG's `/search` returns only name+year (no images), so a cover only exists after you pick a
result (the per-game `thing` fetch); showing thumbnails on every search row would need 10× the
API calls, so it's intentionally left off. (7) **Shelf "N matches ↓" jump widget** — appears
beside Clear when a dropdown filter is active, shows the live match count, and click-scrolls the
first result to the top (`shelfRef.scrollIntoView`); zero matches render "No matches", no jump.

2026-07-12 aesthetic + mobile-polish pass (four batches, Kevin-directed; the muted cozy-tabletop
base is unchanged — this is "flair as decorative pillows"). **Batch 1 — per-section tab identity:**
each tab is its own "room" — **Our Shelf=brass, Game Time=felt green, Play Stats=walnut** (all
existing tokens). Subtle treatment on the bar: accent stripe + a whisper of tint on the active tab
(`nav.tabs button[data-tab=…][aria-selected]`), stripe grows in on select (`@keyframes stripe-in`).
New per-section vars **`--accent`/`--accent-ink` scoped on `.wrap[data-section]`** (App.jsx sets
`data-section={tab}`); the section `.eyebrow` adopts `--accent-ink` as the first content-level
identity cue. **Design rule: accent = identity chrome; brass stays the universal data color**
(leaderboard/results bars unchanged). **Batch 2 — mobile comfort:** Play Stats stat cards go 2-up
on phones (numeric pair side-by-side, "most played" full-width); Set-the-Table's soft "Set the mood"
axes (effort/vibe/setup) collapse under a disclosure (`showMood`, collapsed by default, felt "N on"
badge when prefs set); **sticky "Open the table →" CTA** on mobile (`.setup-actions`); the stepper
shows only the active step's label on phones (`.step-label`); comfier tap targets on small text
links. **Batch 3 — fun & delight:** the winner reveal fires a **one-shot CSS confetti burst**
(`Confetti` in `gameNightBits.jsx`) + the winner name pops in (`@keyframes winner-pop`), both
skipped under reduced-motion; **the winner is a button — tap/Enter to replay the confetti** (Sara &
Sophia favorite); Play Stats headline numbers **count up** from zero (`useCountUp` in `Stats.jsx`);
press feedback (scale-down) on Segs & chips; empty states get a glyph + warmer copy; logo wiggles on
hover / squishes on tap. **Batch 4 — legibility + texture:** the shelf box-art meta plate got a
deeper/taller bottom scrim + text-shadow so time/players read on light covers (Boggle/Catan/
Balderdash were washing out); the winner-hero gets a whisper of felt-weave texture. Follow-up fixes:
(a) **Shelf header push-down** — `.h-row` used `align-items:baseline`, which aligned the short search
box's baseline with the big title and shoved the eyebrow/title down ~12px → `align-items:center`.
(b) **Confetti replay bug** — `<Confetti>` and `<h2>` were both `key={burst}` (sibling key
collision), so each tap STACKED a new confetti layer instead of replacing (3 taps → 84 orphan
spans); distinct keys (`confetti-${burst}` / `name-${burst}`) → clean replace, 1 layer. (c) **Logo
→ home** — the header logo is now a `.brand-home` button that returns to Our Shelf (clears any
`#/join`/`#/backfill` hash). (d) **Mobile filter-result** — the "N matches"+Clear pair spans the row
50/50 on phones (`margin-left:0`, buttons `flex:1`) instead of a tiny right-aligned Clear. (e) **Set-
the-Table expander arrows** — the tiny `▾` (rendered dot-like on iOS) → full `▼` on both "Set the
mood" and "See the list", matching the `▲` collapse glyph. **Confetti + count-up + the coarse-pointer
tap-target/16px rules can't be seen in the desktop preview (it doesn't capture fast overlays or
emulate touch) — verify on a real device.** All new motion honors `prefers-reduced-motion`.

2026-07-12 edit/delete logged plays (LIVE): closed the long-standing gap (Next-up #2/#3) — you can
now **edit or delete a Recent Game Time**. Each recent-log row is a button (subtle ✎, brightens on
hover) that opens an **`EditPlay` modal** (`Stats.jsx`) — the same `.scrim`/`.modal` pattern as the
Shelf, reusing the log form's fields pre-filled (game, date, minutes, who-played chips + guests,
winner); **Save changes** + a **🗑 Delete** with a Yes/Keep confirm. Rows now also show the play
**date** (`playDateLabel`, e.g. "Jul 12") so entries are distinguishable. **The hard part — stats
recompute** (CLAUDE.md had flagged this as the blocker for edit/delete): a new `reconcileGame(gameId,
countDelta, remaining)` in `catalog.js` recomputes the game's `lastPlayed` from its *remaining* logged
plays (null → falls back to legacy `last`) and deltas the `plays` counter (−1 on delete; moves the +1
between games when an edit changes the game; 0 when only date/details change) — deltas rather than
overwrites so any seeded counts survive. Kept in `catalog.js` (not pushed through `updateGame`)
because `increment()` is a Firestore sentinel meaningless to the localStorage backend, same as
`logPlay`. New public API: `updatePlay(prev, patch, allPlays)` + `deletePlay(play, allPlays)` (callers
pass the live log so the affected game(s) reconcile without waiting for the subscription round-trip).
**Compaction:** the recent list was already capped at `slice(0, 8)`; kept 8 as the default preview and
added a **"Show all N"** toggle (`showAll` state) to expand/collapse the full history, so the page
never grows unbounded. The deeper scaling limit is the *data* read — `subscribePlays` pulls every play
doc (the aggregate stats need them all) — fine into the low thousands (~52 plays/yr); revisit with a
`limit()` + pagination only once the log passes a few hundred rows (years out). Verified against the
live app (rows render as edit buttons with dates; the popup opens and fully pre-populates game/date/
minutes/players/winner; closes cleanly; no console errors) — **the actual Save/Delete round-trip was
NOT run against the real 4-play family log** to avoid mutating it; the recompute paths are sound by
construction (create→edit→delete a throwaway entry to confirm count/`lastPlayed` restore if desired).
Files: `Stats.jsx` (EditPlay modal + clickable rows + Show-all + date label), `catalog.js`
(`reconcileGame`/`updatePlay`/`deletePlay`), `styles.css` (`.plrow-btn`/`.pledit`/`.show-all`/
`.del-confirm`/`.btn.danger`). Still open (Next-up #3): a per-game "log a play" shortcut from the
Shelf detail modal.

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
build a min-age / kid-friendly *filter* or exclusion rule. BGG's `minAge` IS shown as a display-only
spec ("12+") in the Shelf and Game Night detail overlays (added 2026-07-11, Kevin's call) — it's
informational (spotting games that skew young, e.g. sentimental ones the family's since outgrown),
not a gate; nothing filters or excludes on it.
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
| Focus | 3 tiers: Background / Casual / Focused | BGG-derived (`derivedFocus`) + per-game override; target-tier gate |
| Players | min–max | BGG (auto) / manual |
| Type (kind) | Card / Strategy / Party / Dice / Dominoes / Abstract / Family / Word Game | BGG + tag |
First four are the hard "rule things out" constraints; the rest are soft preferences. Complexity
(BGG `weight`, 1–5) is captured and shown as a spec, but isn't a Shelf filter — removed 2026-07-11,
see Current state — the absolute BGG scale didn't discriminate well across this collection.

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
  - `src/components/ImageLightbox.jsx` — full-screen box-art preview (closes on scrim/✕/Escape).
    Used by `BggAutofill` (the picked BGG cover) and `GameForm` (the box-art thumb) so you can
    judge a cover full-size before saving.
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
4. **BGG auto-fill — steps 1+2 DONE (2026-07-11); step 3 shipped same day; backfill DONE (2026-07-11
   bug-bash pass)** — 48/50 games carry a `bggId` (the 2 without one, Netflix Games and Liar's Dice,
   aren't real BGG catalog entries). The Complexity and "Plays well at N" Shelf filters were later
   **removed** (same pass) — the data didn't discriminate well enough on this collection to be useful
   as filters; `weight`/`bestPlayers` still show as specs. Optional polish still open: surface
   `categories`/`mechanics` as tags.
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
