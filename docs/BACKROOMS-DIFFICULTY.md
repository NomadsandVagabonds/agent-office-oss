# Difficulty sprint 1

Review branch: `codex/backrooms-difficulty`.
Base: `claude/determined-maxwell-ayvlut` at `3d9d477`.

The home page chooses a difficulty before ENTER. Easy is the recommended default;
the choice is remembered on this browser. Settings can change it while paused.
Changing it once permanently makes that recording unscored, even after changing
back. The menu explains this before the change. Discoveries and escaped tapes
still save. Tourist recordings are always unscored.

## First-pass balance

These numbers are centralized in `core/difficulty.mjs`. They are playtest values,
not a claim of measured equivalence between difficulties.

| Mode | Health and camera | Supplies | Mobile threats | Score |
| --- | --- | --- | --- | --- |
| Tourist | No damage or camera deadline; fatal pits return to the landing | Original supply density | Original seeded cast | Unscored |
| Training Wheels | Existing department kit; Standard Issue is 4 hearts / 5:00 | Live baseline: early battery, then one offered per 8 eligible rooms; original snack roll | Original seeded cast and speeds | ×0.5 |
| Easy (default) | Existing kit | Early battery, then one per 12 eligible rooms; occasional snack | One fresh roaming toner in each part, alongside the seeded cast | ×1 |
| Normal | Existing kit | About 30% fewer packs than Easy across seeds; no snacks | Up to two toners, separated; faster/stronger creatures | ×1.5 |
| Hard | All kits capped at 1 heart, no regeneration; 75% of kit's initial camera charge (3:45 for Standard Issue) | Normal scarcity; no snacks | Up to three separated toners; room targets 25% larger | ×2 |

Every mode retains the early refill opportunity. Supply entries offer fallback
positions, not guaranteed reachable inventory: the world still chooses valid
floor spots. Normal's thinning uses a separate seeded stream, so unrelated loot
stays where Easy put it. Paper, tools and creature-requested items retain their
existing rates. Normal/Hard also suppress room-authored snacks and replace the
Supply Clerk's starter snack with paper; old snacks carried across a mode change
cannot heal on those modes.

Training Wheels was checked against live `c9c3eab`: a frozen digest covers 60
complete supply plans, including item positions. That restores the live battery
spacing instead of taking the development branch's newer 28-room spacing. It
retains the working branch's bug fixes, rooms and department kit support; it is
not an old-code fork.

### Creature tuning

Only movement distance is scaled. Warning, fuse, bite-cooldown and door clocks
keep their timing; barricades, fire and stealth rules continue to apply.

| Creature | Training Wheels | Easy | Normal | Hard |
| --- | --- | --- | --- | --- |
| Pirate | Original speed / hit | 1× speed / 2 hearts | 1.12× / 3 hearts | 1.20× / 3 hearts |
| Toner | Original speed / hit | 1× / 1 heart | 1.08× / 1 heart | 1.12× / 2 hearts |
| Other Door | Original hit | 2 hearts | 3 hearts | 3 hearts |

Other species and authored-room hazards retain their own tuning. The conductor
reads speed and damage dynamically. A creature module can use `c.speedScale` for
movement without accelerating its entire state machine.

One toner patrols; additional toners begin in territories at least four doorways
from the landing and each other. Valid authored haunts get first choice when
that spacing permits. If a floor cannot fit the requested count safely, fewer
are placed; it does not crowd the landing to meet a quota. The existing brood
cap remains seven. This should be tested for audible encounters versus long
quiet stretches, especially with three toners on Hard.

## Changing mode during a visit

Health cap, immunity, snack use, movement scale and hit damage change immediately.
Changing modes does not heal or refill the camera. Map size, supply placements
and population apply from the next part. The occupied part is left intact.
A prebuilt next part is disposed; an in-flight build detects that it was replaced
and disposes itself when complete. The next part is generated for the new mode.

Tapes retain their launch mode for replay. A recording that changed modes is
unscored; replay uses its launch preset, not an exact history of mid-run changes.
Private co-op retains its existing balance in this sprint; it does not expose
this single-player mode selector.

## Scores and storage rollout

`scoreRun` computes the existing base points, then floors `base × multiplier`.
The scorecard shows the adjustment, and the API recomputes the total rather than
accepting a submitted total. Unscored cards retain counts but show no points.
They cannot enter the public book or increase the personal best.

Use the combined weighted table for a first comparison, and each mode's separate
table for a fair like-for-like comparison. Hard's higher room count also raises
its possible base points; revisit ×2 after measuring escape rate and typical
run score/duration. Start by collecting a few dozen runs per mode. Do not add
large bonuses for taking damage or farming recurring encounters.

Old entries keep their original scores and appear as **Original**. There is no
retroactive penalty. D1 retains the top 100 for each mode plus the latest 100
signatures, rather than letting Hard purge the Easy table. Filters are bound SQL
values. No new database, dependency or schema migration is needed.

Release order after review:

1. Deploy the updated `tools/blockrooms/cloudflare/worker.mjs` to the existing
   book Worker. Its `core/book.mjs` and difficulty dependency must go with it.
2. Release the Vercel app/API and static build together. An older Worker strips
   difficulty metadata and does not apply the new retention/filter rules.
3. Verify a newly escaped score in the combined table and its mode filter;
   confirm old scores still appear under Original. Never submit review scores
   to production.

The optional Redis adapter also writes per-mode tables. For an existing Redis
installation, seed `br:top:original` from legacy entries in `br:top` before
releasing. Production uses D1 and needs no such copy.

The score service still has the existing client-trust limits: sanity checks
catch mistakes and casual tampering, not a determined modified client. This
sprint is difficulty balancing, not a server-authoritative game rewrite.

## Review

Build/serve:

```sh
node tools/blockrooms/build.mjs dist
node tools/blockrooms/serve.mjs dist 44345
```

Check the home selector, Hard's displayed kit and one-heart HUD, Settings' warning,
a change away and back, and the unscored end card. Walk a fresh seed on each mode;
listen for toner patrols without filling every corridor with enemies. Normal's
packs should be scarcer in aggregate, not necessarily for every single seed.

Automated coverage includes live supply parity, thinning across 400 seeds,
separated territories, kit health caps, Tourist immunity, per-species damage and
speed, unchanged creature clocks, in-flight/completed prebuild replacement,
sticky score ineligibility, API rejection/filtering, D1 retention, old records,
menu/scorecard controls and standalone import paths.

Validation on this branch:

- Focused gameplay, UI, scoring and store suite: **85/85 passed**.
- Full `npm test` after the selector pass: **898/901 passed**. The three failures also reproduce on
  untouched base `3d9d477`: console's macOS `/var` versus `/private/var` path
  assertion (and its parent test), plus usage/status-line's missing `source`.
- Standalone build, import closure checks (including subdirectory hosting) and
  `git diff --check` pass. Site checks after the narrow-table styling: **7/7**.
- Browser smoke check: Easy default; Hard starts at 1/1 heart and 3:45; Settings
  warns before changing, changing away and back remains unscored, and Give Up
  reaches the result page. The home kit summary follows the difficulty.

### Selector style pass

The launch picker uses square Windows-style bevels and a navy selection; Settings
uses the same control in camcorder colours. Both have keyboard navigation,
type-ahead and outside dismissal. Arrow-key previews, Escape and Tab do not
commit a mode change (and therefore cannot accidentally void a run's score).
Only selecting an option or confirming with Enter/Space applies the change.

Tourist keeps its explanation. Every scored mode shows only its multiplier;
Settings also keeps the short permanent-score warning. Mechanics stay in this
review document rather than being revealed by the menu.

Latest targeted menu and standalone-build tests: **14/14 passed**. Browser
checks cover launch selection, Tourist copy, settings cancellation/commit and
sticky unscored state. No production deployment was made.
