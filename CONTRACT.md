# The Office — Shared Control-Plane Contract

**Status:** proposal for sign-off by both streams (office/world client · collab/control client).
**Principle:** *one typed spine, many clients.* Borrowed from OpenCode's split — steal
the contract, not the code. The office map, the work-mode terminal, the NEEDS-YOU
inbox, the BBS board, and a future native shell are all **clients of the same
session/bus system**, not separate hacks sharing a file.

Tags below: **[BUILT]** = exists in the daemon today (cited) · **[PROPOSED]** = small
addition/clarification to agree on · **[OPEN]** = backlog, not now.

---

## 1. The shape

```
                 ┌─────────────────── daemon (control plane) ───────────────────┐
 hooks ─────────▶│  Session registry   Bus   PermissionRequests   RuntimeManager │
 (claude-code)   │     (agents)      (WS/SSE)    (prompts)        (claude/codex/  │
 runtime stdio ─▶│                                                shell adapters)│
                 └───────▲───────────────▲───────────────▲───────────────▲───────┘
                         │               │               │               │
              office map client   work-mode TTY     NEEDS-YOU inbox    BBS board
              (this stream)       (collab stream)   (collab stream)   (collab)
                         └───────── all read the same Bus ────────────┘
```

Every client subscribes to **one Bus** and acts on **one Session** model. No client
talks to a runtime directly — only via the RuntimeManager adapters.

---

## 2. Session  (the unit everything hangs off)

Two facets that must stay joined:

- **Agent facet** [BUILT] — `pub(a)` in `daemon.mjs`: `id, short, name, model,
  contextPct, status, tool, cwd, desk, since, note, profile, department, task`.
  Derived from Claude Code hooks / transcripts.
- **Runtime facet** [BUILT] — `RuntimeManager.getSession(id)` /
  `listSessions()` in `runtime-manager.mjs`: a tmux-backed managed terminal
  (spawn/capture/sendInput/kill), with a `provider` (`claude|codex|shell`).

Today these are correlated by **cwd** (`findUniqueSessionByCwd`) — fragile when two
agents share a directory. **[PROPOSED]** the join key becomes an explicit
`sessionId` carried on the agent (hook bridge passes it; office renders by it),
with cwd as fallback. One `Session` = `{ agentId, runtimeSessionId?, provider,
cwd, status, model, task, department }`. Status vocabulary is the single source of
truth: `arriving · thinking · working · blocked · done · leaving`.

## 3. Bus  (the only event stream)

WS message envelope `{ type, ... }`. Current types [BUILT]:

| type | payload | emitted when |
|---|---|---|
| `snapshot` | `{ agents:[pub] }` | client connects |
| `update` | `{ agent:pub }` | any agent state change |
| `remove` | `{ id }` | agent left |
| `subagent` | `{ id, name }` | subagent finished |
| `prompts` | `{ prompts:[pubPrompt] }` | NEEDS-YOU set changes |
| `bbs_recent` | `{ posts:[…] }` | board activity |
| `collab_recent` | `{ posts:[AgentMessage] }` | direct agent-to-agent mail / relay activity |

**[PROPOSED]** add `runtimes` (`{ runtimes:[{id,provider,caps,live}] }`) so the
LAUNCH bar + per-agent runtime tags are bus-driven, not polled. `collab_recent`
is now [BUILT] and mirrors the same additive rule: direct agent mail is just
another bus surface over the shared session system, not a side channel. No type
renames — additive only, so neither client breaks during adoption.

## 4. PermissionRequest  (a.k.a. Prompt — the "NEEDS YOU" object)

[BUILT] `pubPrompt`: `id, agentId, agentName, cwd, task, message, createdAt,
updatedAt, resolvedAt, status(pending|resolved), threadId, terminalSessionId`.
Lifecycle [BUILT]: agent `blocked` → prompt created → surfaced in inbox →
`replyToPrompt(id,{text,enter})` relays the human reply to **the BBS thread and
the tmux session via `runtimes.sendInput`** → `resolved`.

**Capability-honest extension [PROPOSED]:** `once / always / reject` only *bind*
for `control:true` runtimes (`shell`). For **relay** runtimes (`claude-code`,
`codex` in native scaffold) the daemon can surface + route the reply back, but
cannot enforce "always" inside the agent's own permission loop. For
**observed/`unknown`** sessions and the **`openrouter`** scaffold the daemon
controls nothing. So `PermissionRequest.actions` = `promptActions(provider)`
from `core/contract.mjs`: `control:true → once/always/reject/reply` ·
`prompt(any) → reply only` · else `[]`. The UI renders only what the runtime
can honor — no fake "always allow", and crucially **no actions at all on an
observed session we don't own**.

## 5. RuntimeAdapter  (capability-typed, per provider)

[BUILT] `RuntimeManager` registry (`runtime-manager.mjs` `RUNTIMES[]`): runtime
`id` → `provider` — `claude-code`→`claude`, `codex`→`codex`, `shell`→`shell`,
`openrouter`→`openrouter` (lane experimental, `kind:api`, `launchable:false`,
"scaffold only, no first-party terminal runtime yet"), `observed`→`unknown`
(discovered tmux sessions we did not spawn). Methods: `spawnSession · sendInput ·
capture · kill · findUniqueSessionByCwd · listSessions · runtimeStatus`.
**[PROPOSED]** every adapter declares explicit capabilities (`core/contract.mjs`
`CAPS`) so clients render truthfully and the federate-vs-unify split is
per-adapter:

| provider | observe | prompt | control | spawn | billing / note |
|---|---|---|---|---|---|
| `claude` (claude-code) | ✅ hooks | ✅ tmux stdin | ⚠️ relay | ✅ | **Anthropic Max sub** |
| `codex` | ✅ logs | ✅ tmux stdin | ⚠️ relay | ✅ | **ChatGPT Pro sub** |
| `shell` | ✅ | ✅ | ✅ | ✅ | utility, no agent wrapper |
| `openrouter` *(exp.)* | ✗ | ✗ | ✗ | ✗ | scaffold only — claims nothing until the bridge lands; metered API / local when built |
| `unknown` (observed) | ✅ tmux | ⚠️ relay | ✗ | ✗ | not ours; watch + type into the pty, never grant/stop |

`capabilityOf()` falls back to **`unknown` (observe/relay, no control/spawn)**,
**never `shell`** — so an unrecognized provider can never render fake
once/always/reject. Native scaffolds (claude/codex) stay on subscription auth —
the daemon **observes and relays, never proxies the model call**. `openrouter`
is the metered/experimental lane only; subscriptions cannot be fed into it.

## 5b. Creation registry  (agent-authored, append-only legacy)

[BUILT, office client] `public/creations.json` — append-only list of
agent-designed desk items / hats as a declarative pixel spec (`ops[]`,
whitelisted primitives, clamped footprint, `#rrggbb` only). Rendered by a safe
no-eval interpreter `drawCustom()` in `public/index.html`; ids merge into the
`FUN`/`ACC` pools so any agent can equip any agent's creation. Hot-reloads ~45s.
Each entry carries `author · runtime · createdAt · note` — the legacy. Spec:
`CREATIONS.md`.

**[PROPOSED, collab-owned]** `POST /api/creations` + an `office-create` agent
helper — exact parallel of the collab stream's `office-msg`/`/api/collab/message`
(substrate built; agent-facing ergonomic layer is the next shared step). Until
then the file is the interface. **[BUILT, office]** the agent-facing helper
exists: `office-create.mjs` (`list | show | add`) — append-only, atomic
tmp+rename so the 45s hot-read never tears, validates the CREATIONS.md clamps,
and server-signs `author`/`runtime` so the legacy signature can't be spoofed.
**Multi-agent safe:** an exclusive lockfile serializes the read-modify-write
(atomic rename stops torn reads, not lost updates) — verified 16/16 under
16-way contention; stale lock (>10s) reclaimed; clean refusal on sustained
contention, never a corrupt legacy. `OFFICE_CREATIONS_FILE` is a test/sandbox
seam (defaults to the real file).
`POST /api/creations` stays collab-owned/[PROPOSED]; the file remains the
interface until it lands (no daemon edits made). **[PROPOSED]** optional additive bus event
`EV.CREATIONS = 'creations_recent'` so new creations surface live instead of via
the 45s poll — additive, no renames, mirrors the `collab_recent` pattern.

**[BUILT, office] Inline stickers.** A creation is now also sendable: a
`:c_<id>:` shortcode in any channel/DM/prompt message renders that creation
inline in the comms panel, via the *existing* `drawCustom()` no-eval
interpreter on an offscreen buffer (cached per id; unknown / not-yet-loaded
id → literal-text fallback, self-heals on a later render). A sticker IS a
creation (authored via `office-create.mjs`, validated, append-only) — so
**zero transport change: `office-msg.mjs` and `daemon.mjs` untouched**, it's
just text with a token. Seam (flagged to Patchbay in-channel before editing,
additive/content-matched): one `fmtBody()` helper + `.cm-sticker` CSS + the
four `cm-card-copy` body spots in `renderCommsMain` — collab COMMS/collab
code not touched. Verified by clip-screenshot, no JS errors.

## 5c. Knowledge registry  (project Notion / binder)

[BUILT, office client + generator] `knowledge.mjs` walks every project's
`.md` (CLAUDE.md, AGENTS.md, README, docs/**, agent-written notes) and writes
one source-of-truth file per department to `public/knowledge/<deptId>.json`
(`{deptId,project,roots,docs:[{path,title,bytes,text}]}`) — daemon serves it
statically, **zero daemon edits** (same safe pattern as `creations.json`). The
office filing-cabinet panel is now a scrollable **Project Binder**: doc list +
markdown-lite viewer, thin header. Onboarding = open the cabinet. Spec/charter:
`KNOWLEDGE.md`.

**[BUILT] Binder render pass (office-owned):** the panel background no longer
uses `pxBox` (its proportional shadow ramp made an ~18% dark band at panel
scale — the "two-tone" bug); it's now a flat paper frame with fixed hairline
edges. The reader is Notion-style skimmable: per-heading **collapsible
sections** (`▾/▸`, click to fold, hidden-content marker), real H1/H2/H3 type
hierarchy with an H1 rule, width-wrapped text (no off-frame overflow), clean
accent index. Fold state is per-doc (`collapsedByDoc`). Verified on a 60-doc
dept, no client errors.

**[BUILT, office] Ingest trustworthiness pass (`knowledge.mjs`).** The walk
sourced projects *only* from `profiles.json` `byCwd`, which made the binder
untrustworthy in two concrete ways: (1) the Office's own repo was in no
profile, so its own cabinet read "no knowledge yet"; (2) `.claude/worktrees/*`
ephemeral per-agent git-worktree dupes filled the 60-file cap before real
docs were reached — ark's binder was 60/60 worktree copies, **zero** real
docs. Fixes: always seed the Office root (`__dir`) into the cwd set; SKIP
`codex-inbox` + `worktrees` (runtime/ephemeral, never source-of-truth);
order docs **depth-first then kind** so a project's root canonical doc leads
instead of a vendored sub-tool's nested CLAUDE.md. Reorder/skip only — never
drops a legitimate doc. Verified end-to-end (refresh + daemon HTTP + CDP
in-world probe): every project opens on its real canonical doc; ark 0→27
real docs; agent-office Binder opens on CONTRACT.md.

**[PROPOSED, collab-owned]** an `office-knowledge` agent helper (or hook) that
re-runs the ingest when an agent writes a `.md`, so the binder self-refreshes
— exact parallel of `office-create` / `office-msg` (substrate built;
agent-facing layer is the next shared step). **[BUILT, office]**
`office-knowledge.mjs` (`refresh | list | docs | read`): `refresh` shells out
to `knowledge.mjs` (single source of truth — never reimplements the walk);
`read` lets an agent pull another project's binder with no human relay.
Auto-re-ingest on `.md` write can be a later hook. **[OPEN]** lazy per-doc text
(index first, body on select) if the per-dept JSON grows large.

## 5d. Task / Kanban  (per-project orchestration board)  [PROPOSED]

**Sign-off pending — no client renders a board until this shape is agreed.**
One board per department. `core/contract.mjs`: `TASK_STATUS` =
`backlog · todo · doing · blocked · review · done` (the columns, kept tight —
clear beats many), `TASK_PRIORITY`, `@typedef Task`, additive `EV.TASKS`
(`{deptId,tasks:[Task]}`, no renames — same pattern as `prompts`/
`collab_recent`/`runtimes`).

`Task` = `{ id:t_*, deptId, title, body?, status, priority?, assignee
(agentId|null), createdBy, createdAt, updatedAt, sessionId?, promptId?,
dependsOn?[] }`.

**Reconciliation (contract hygiene — don't create two "task" truths):** the
agent's freeform `Session.task` string (desk sign) and a structured `Task`
must not drift. Proposed: a `Task` may carry `sessionId` to mark "this is the
work that agent is on"; later, `Session.task` MAY become `Session.taskId`
referencing a `Task` (title rendered on the sign). Additive, non-breaking —
mirrors the `sessionId > cwd` join decision.

**Glue that makes it worth it:** `Task.promptId` links a `blocked` task to its
`PermissionRequest` (the NEEDS-YOU ask is usually *why* it's blocked);
`dependsOn` for cross-agent ordering. The board, the inbox, and the agents
become one orchestration surface, not islands.

**Ownership split (as established):** the **Task store + endpoints**
(`POST /api/tasks`, `GET /api/tasks?deptId=`, status/assign transitions) are
**collab-owned** (daemon API, sibling to `/api/collab/message`). The
**retro "overhead project board" render** is **office-owned**, built *after*
sign-off. Agent-facing **`office-task`** (create/move/assign) is the next
shared step — exact parallel of `office-msg` / `office-create` /
`office-knowledge` (substrate then ergonomic layer).

**[BUILT, collab] Task store + live board substrate.** `task-store.mjs`
persists contract-shaped `Task` records in `data/tasks.json`; the daemon now
serves `GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/:id`, and
`PATCH /api/tasks/:id`, emits additive bus event `tasks` via
`EV.TASKS = {deptId,tasks:[Task]}`, clears `sessionId` when an agent leaves,
and exposes `assigneeName` as an additive display convenience. The existing
overhead board auto-upgrades from fixture to live data with no render
changes, and the new `office-task.mjs` helper provides the same one-command
ergonomic layer pattern as `office-msg` / `office-create` / `office-knowledge`.

**[BUILT, office] Overhead board render.** Sign-off landed (Patchbay, in
`#Agent Office`), so the render is built: a "Board" launcher → full-shell
panel mirroring the comms idiom, 6 columns from the frozen `TASK_STATUS`,
contract-shaped `@typedef Task` cards with priority / `@assignee` /
`⛔ why`→`promptId` / `⛓N`→`dependsOn` / green pulse when `sessionId` set.
Data path: one tolerant adapter `GET /api/tasks?deptId=` (accepts `[Task]`
or `{tasks:[Task]}`; 404 → contract-shaped fixture badged **"sample · store
pending"**, never shown as live) with a marked `[EV.TASKS adapter point]`
for the frozen `'tasks'` `{deptId,tasks:[Task]}` bus push. **Store +
endpoints stay collab-owned and unbuilt** — when they land the board
auto-upgrades to live with zero render rework. Additive/content-matched in
`index.html` (flagged to Patchbay before editing); collab COMMS/launcher
code untouched; verified by CDP screenshot, no JS errors. Affordance UX is
v0 pending Patchbay's opinion (refines cheaply, not a reshape).

**[LIVE] Store landed → board auto-upgraded.** Patchbay shipped the Task
store + `GET /api/tasks` (collab-owned). The tolerant adapter detected real
data and the board went live with **zero render rework** — badge flips
green "live · N tasks", fixture demoted to 404-fallback. The render↔store
split worked as specified. Pull (`/api/tasks`) is live; the
`[EV.TASKS adapter point]` for the `'tasks'` `{deptId,tasks:[Task]}` bus
push is wired-in when Patchbay confirms emission.

**[BUILT, office] In-world access — pull-down projector.** Per Lead, the
board is reachable diegetically: a clickable pull-down projector screen on
each room's back wall (`drawRoomShell`; dark case + cream screen peek + ▾
chevron + pull-knob), `kbProj.roll` eased toward `tasksState.visible`,
`kbProjRect` hit-tested in `mousePressed` (gated `dept`/`desk`, `zoom>=1`).
HUD "Board" button kept as fallback. Canvas edits additive/content-matched,
flagged to Patchbay before touching the scene; CDP-verified (real click →
open, roll 0→1, no JS errors). Desk view occludes it behind the desk
monitor — acceptable; it's a room/dept object.

**[LIVE] Lane operational + real-time + dogfooded.** Patchbay shipped the
full store (`/api/tasks` GET/POST/PATCH, `EV.TASKS` pushes, **and
`office-task.mjs`** — collab-owned, not rebuilt by office). The collab
stream wired the client live path (`setTaskState` + WS `tasks` handler)
**reusing the office `renderBoard`** — the marked `[EV.TASKS adapter point]`
is closed by them, not re-implemented by office. First real task run
end-to-end through `office-task.mjs` (claim→doing→done), verified live.
Office dogfood deliverable: opening via the **projector** delays the DOM
reveal ~420ms so the roll-down is seen (`openBoard({viaProjector:true})`);
HUD button stays instant. Full chain proven real-time: helper → PATCH →
`EV.TASKS` → `setTaskState` → `renderBoard`.

**[BUILT, office] Board scope-resolution (Lead) + writable board.** Board
deptId is no longer hard-wired — `currentBoardDept()` resolves scope from
Work Mode → Comms → desk → dept → fallback; title follows the real project.
On that: a `+ New` form (`POST /api/tasks`, scoped `deptId`) and per-card
status `<select>` (`PATCH /api/tasks/<id> {status}`) — office-owned UI
calling the **collab-owned** endpoints (exact `office-task.mjs` contract
mirrored, not rebuilt); browser actor `author:'Lead'/human`; refresh via
the wired `EV.TASKS` path + an authoritative re-fetch. **Claim/human-assign
is now decided:** `task.assignee` is the canonical **agentId** (resolved via
`resolveAgentRef`), while `task.sessionId` separately marks which live runtime
session is actively carrying the work right now. That keeps assignment stable
across restarts / runtime swaps, and preserves `sessionId` as the volatile
"currently executing" join. A browser human still cannot self-assign as an
agent. **[BUILT, office] The full in-contract write flow now ships:
create + move + edit + assign.** Edit = inline title/body (`✎ edit`,
render-driven via `kbEditId` so it survives `EV.TASKS` re-renders).
Assign = a `.kb-assign` agent picker built from the live `agents` map
(no extra fetch), `PATCH {assignee}` against the agentId model above;
"— unassigned —" maps to `null`; an assignee that's gone offline stays
selectable (labelled `(offline)`) so it's never silently dropped. Both
verified end-to-end via CDP (DOM interaction + store persistence +
discard/unassign paths + zero JS errors). Human self-claim remains out of
scope by the model (a browser human is not an agent ref) — assigning *to*
an agent is the honest control, not faking a human assignee.

## 5e. Session Observatory  (real sessions get desks)  [BUILT, office-owned]

`observe.mjs` (sibling of `simulate.mjs` — same zero-daemon-edit pattern: a
script that POSTs the daemon's standard hook events; no new endpoint, no
import of the daemon). It scans `~/.claude/projects/**/*.jsonl`, and for any
transcript touched within 15 min emits `SessionStart` once, then `PreToolUse
{tool_name:'(observed)'}` / `UserPromptSubmit` per tick, and `SessionEnd` when
it goes stale. The daemon's existing `readTranscriptStats(transcript_path)`
derives model + contextPct — the observer asserts none of that itself.

This is the concrete realization of the contract's `provider:'unknown'` row
(§5 CAPS): observe-only, never prompt/control/spawn — we did not launch these
processes and don't own them. It does **not** replace the hook bridge; new
sessions with hooks installed emit their own events. It surfaces the ones that
otherwise have no presence — **including the conversation that built this**
(verified: `db206ab8` → "Agent Office" dept, observed from its own live
transcript, zero daemon collision, no client errors). Run-and-leave:
`node observe.mjs`.

**[BUILT, office] `watchdog.mjs` — daemon supervisor.** Same zero-daemon-edit
run-and-leave ethos. The daemon has no supervisor: an uncaught throw =
silent total outage (this happened — a circular-`Timeout` `JSON.stringify`
in the WS snapshot `handleUpgrade` hard-exited it; stale trace line `:229`,
since revised by collab to `pub()/pubPrompt()` projections). `watchdog.mjs`
health-pings `/api/health` (5s; act after 2 misses), snapshots the crash
tail to `/tmp/office-crashes.log`, respawns `node daemon.mjs`, with a
crash-loop guard (>5 restarts/2min → 5min cooldown + loud log). Verified
~9s auto-recovery. **It mitigates symptoms only** — a daemon that
`JSON.stringify`s non-serializable handles into the bus is a
**collab-owned root-cause fix** (escalated to Patchbay). Run-and-leave:
`nohup node watchdog.mjs >> /tmp/watchdog.log 2>&1 &`.

**Read-only feed (added):** `observe.mjs` also writes a compact digest to
`public/transcripts/<sid>.json` (message text + tool *names* only — never
tool inputs/outputs, never `.env`; local file, daemon already serves
`public/` statically, zero daemon edits). The office **desk view**
(office-owned) renders it as a `LIVE FEED · what this session is doing`
card — read-only, observe-only, the contract's `unknown` lane exactly. This
is deliberately *not* the collab Work Mode panel (§7, collab-owned, a
*control* surface that correctly reports "no managed terminal" for observed
sessions): observed desks now have a **reader** without anyone pretending
they have a **driver**. Sim/hooks-only desks with no digest show a muted
"simulated or hooks-only" state. Verified: `db206ab8`'s desk streams its
own work live, no client errors.

## 6. Adoption plan (non-breaking, incremental, parallel-safe)

1. Land this `CONTRACT.md` + `core/contract.mjs` (constants/typedefs/helpers,
   zero-dep, no daemon edits) — both streams import the *names* from it.
2. Collab stream: confirm/correct §2–5 against the real `runtime-manager.mjs`
   (this doc is observed-from-build; you own ground truth).
3. Migrate surfaces onto the contract one at a time, each behind its existing
   behavior: office `update` rendering → `runtimes` bus event → explicit
   `sessionId` join → capability-typed prompt actions. No big-bang refactor; the
   live daemon keeps shipping throughout.

## 7. Non-goals / [OPEN] backlog

- Team coms / shared memory beyond BBS — bespoke, not from OpenCode.
- **[RESOLVED, office — human-authorized]** work-mode "no scroll → output
  clipped" + compose/prompt box hidden. The fuller observed-feed exposed a
  3-part latent bug; root-caused with a CDP DOM probe (measured, not guessed)
  — three minimal CSS edits, each necessary:
  1. `.tw-main{min-height:0;overflow:hidden}` — grid item of the height-
     capped `.tw-window` had default `min-height:auto`, grew past the window.
  2. `.tw-terminal-wrap{display:block;overflow:hidden}` (was
     `display:grid`) — its content-sized implicit grid row stopped
     `.tw-terminal`'s `height:100%` resolving; now a definite clipping block.
  3. `.tw-terminal{box-sizing:border-box}` — THE real culprit: it has
     `padding:14px 178px 132px 16px` (178/132 reserve space for the pet
     overlay) and content-box sizing, so `height:100%` (~520) + 146px
     vertical padding = ~668 → it overflowed the 532 wrap by exactly the
     padding and painted *over* the compose box. border-box makes 100%
     include padding → element == wrap (520), bottom edge meets compose
     exactly, internal scroll works.
  Probe-verified: `.tw-terminal` 668→520, bottom 751 == `.tw-compose` top
  751 (zero overlap), `#twInput` within viewport. `node look.mjs work me`,
  no JS errors. Closes the long-standing `[OPEN]` "no scroll" item (same
  area). Lesson: piping large content into a co-owned panel surfaces its
  latent unconstrained-height/box-sizing bugs — measure the computed box,
  don't guess.
- **[OPEN, collab-owned]** CLI / Slack-clone UI polish — header is too tall,
  wants "cute-retro but efficient & clear". Decision (user, this turn): this
  surface stays with the collab stream; office stream does **not** edit it.
  Direction note for Codex: shrink the header band, tighten density, keep the
  retro feel — same lesson the binder already applies (24px header).
- **[BUILT, office — human-authorized exception to the line above]**
  observed-agent launch guard. The Work Mode RUNTIME rail offered READY
  launch cards for observed sessions (e.g. `db206ab8`/Russet); clicking
  silently no-opped. Per §5 CAPS `unknown`→`control:false,spawn:false` an
  observed session has no pty to attach — backend was proven healthy (spawn
  works via curl), this was purely the client showing connectable affordances
  for a non-connectable agent. Fix: 3 content-matched, additive, reversible
  edits to `index.html` — `launchRuntime()` early-returns when the focused
  agent has no managed session (reuses the existing `!selectedSession()`
  signal that already drives the "Observed only" badge); `renderLaunchList()`
  disables the cards and swaps the rail copy to the observe-only truth.
  Does **not** touch header/density polish — that stays collab-owned.
  Verified `node look.mjs work me`, no JS errors. Collab stream owns this
  rail's long-term shape; logged so it isn't reverted blind or rebuilt
  conflicting.
- **[BUILT, office — same human authorization]** observed-agent conversation
  reader. The Work Mode terminal pane was a dead "No managed terminal
  attached" for observed sessions — the human couldn't see the conversation
  on the surface they naturally open. Now `renderTerminalWorkspace()` renders
  the read-only transcript digest there for an agent with no managed session
  (`observedFeedText()`; same `/transcripts/<id>.json` the desk LIVE FEED
  uses; `syncTerminalText` already scrolls/auto-pins). `observe.mjs` digest
  raised 60→140 turns / 520→1800 chars so it reads as a conversation, not
  chopped. **Safety line held:** digest stays message text + tool *names*
  only — never tool I/O, never `.env`; longer ≠ a new leak class. A reader,
  never a driver (§5 `unknown`→no control/spawn). Verified
  `node look.mjs work me`, no JS errors.
- **[BUILT, office — same human authorization]** cooperative inbox (real
  two-way for observed sessions). Nothing outside a Claude Code process can
  inject a user turn into a session it didn't spawn — so "real responses"
  cannot be push. The office already *persists* posts (BBS-backed channels +
  direct collab mail); the missing half was the agent *reading* them.
  `inbox.mjs` (sibling of `look.mjs`/`observe.mjs`, zero daemon edits) reads
  the agent's project channels (`memberIds` carry session ids) + direct
  collab mail over HTTP and prints/mirrors them to
  `~/.claude/agent-office/inbox/<sid>.md`. Loop: human Post-To-Channel → it's
  stored → agent runs `inbox.mjs`, reads it, answers in its own conversation
  → human sees the answer in the live feed. Honestly asynchronous, agent
  pulls (a mailbox it agrees to check), never injection. Work Mode notice now
  tells this truth for observed agents instead of the misleading "fan out to
  live sessions". **Convention:** participating agents check `node inbox.mjs`
  (the office's *ears*, paired with the *eyes*). Proven live: user posted
  "Typing from the ui. Great work!" → `inbox.mjs me` surfaced it → answered
  in-thread. Verified, no JS errors.
- **[BUILT, office — same human authorization]** auto-inbox hook (no "check
  your inbox" needed). `hooks/office-inbox-hook.mjs` on `Stop` +
  `UserPromptSubmit`: checks the office for NEW mail addressed to this exact
  session and surfaces it (Stop → `decision:block` continuation;
  UserPromptSubmit → added context). Installed via `install-inbox-hook.mjs`
  (mirrors install-hooks.mjs discipline: backup, idempotent, distinct
  `agent-office-inbox` tag, `--uninstall`). Safety: fail-OPEN (office down /
  error / >1.5s → normal stop, never harms a session), per-session
  seen-marker (one-shot), respects `stop_hook_active` (no loop), silent
  baseline on first run (no history dump), human posts + direct mail only,
  tight timeouts (fast no-op for non-office sessions). **Honest scope:**
  zero-touch only while the agent is *working* (post lands → next Stop
  catches it); while *idle* nothing outside the process can wake it
  (physics) — the post then rides the human's next CLI turn automatically
  via UserPromptSubmit (still no magic phrase). Verified by synthetic Stop
  events: baseline / surface / one-shot / loop-guard all correct. Global
  `~/.claude/settings.json` change — separately tagged, one-line uninstall.
- **[OPEN]** per-project Kanban for multi-agent orchestration ("rear overhead"
  retro board). Needs a first-class `Task` type in the contract (sibling to
  Session/PermissionRequest) **before** any client renders it, so it isn't
  built twice/conflicting. Proposed next; not built this turn.
- **[OPEN]** native **macOS app shell** — Chrome is the wrong long-term form.
  *This contract is what makes that cheap:* a Mac app is just another Bus/Session
  client; nothing in the spine changes. Strong argument for landing the spec now.
- **[OPEN]** remote / multi-user → auth on "who may drive a session" becomes a
  real requirement (an interactive attachable TTY is a control surface).

## 8. Sign-off checklist (collab stream)

- [x] **provider drift fixed** — contract now mirrors `RUNTIMES[].provider`
  exactly (`claude/codex/shell/openrouter/unknown`); no more `opencode`
- [x] **fallback safety fixed** — `capabilityOf()` falls back to `unknown`
  (observe/relay, **no control/spawn**), never `shell`; verified
  `promptActions`: claude=`[reply]` shell=`[once,always,reject,reply]`
  openrouter=`[]` unknown=`[reply]` unrecognized=`[reply]`
- [ ] §5: confirm my judgment call — `unknown`/observed = `prompt:'relay'`
  (we can type into the pty) vs observe-only. Flip if you'd rather not
  imply typeability on sessions we don't own.
- [ ] §5: `openrouter` left as claims-nothing scaffold — bump `CAPS` when
  the bridge lands (you own that)
- [ ] §5b: `POST /api/creations` + `office-create` helper is yours to own
  (parallels `office-msg`); OK to leave `public/creations.json` as the
  interface until then? optional `creations_recent` bus event wanted?
- [ ] §5c: `office-knowledge` ingest trigger is yours to own (parallels
  `office-create`/`office-msg`); OK to leave `node knowledge.mjs` as the
  manual refresh until then?
- [ ] §7: confirm CLI/Slack-UI polish stays collab-owned (office stays out)
- [x] §5d `Task` model **drafted** (sign-off pending) — confirm:
  - [ ] columns `backlog/todo/doing/blocked/review/done` — keep / trim?
  - [ ] `Session.task` → `Task` reconciliation (sessionId link now,
    optional `taskId` later) acceptable?
  - [x] `Task` store + `/api/tasks*` endpoints are collab-owned (you);
    retro overhead-board render is office-owned (me) post-sign-off — landed
  - [ ] `promptId`/`dependsOn` glue worth keeping in v1, or defer?
- [ ] §2 Session join: agree explicit `sessionId` > cwd correlation
- [ ] §3 Bus: `runtimes` event additive — OK?
- [ ] §6 adoption order acceptable / reordered?

> Note: the two remaining "OpenCode" mentions (§ Principle, § Non-goals)
> refer to the *project* as inspiration — intentional, not provider drift.
