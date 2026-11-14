# The Office — Control-Plane Contract

**Principle:** *one typed spine, many clients.* The office map, the work-mode
terminal, the NEEDS-YOU inbox, the kanban board, and the comms layer are all
**clients of the same session/bus system** — not separate features sharing a
file. The daemon is the only spine; every client subscribes to one bus and acts
on one session model. (The split is borrowed from OpenCode's approach: steal the
contract, not the code.)

---

## 1. The shape

```
 hooks · observers · office CLI · MCP · HTTP
                 ┌─────────────────── daemon (control plane) ───────────────────┐
 ───────────────▶│  Session registry   Bus   PermissionRequests   RuntimeManager │
                 │  Personas · Inbox · Comms · Tasks · Binder · Creations · World│
                 └───────▲───────────────▲───────────────▲───────────────▲───────┘
                         │               │               │               │
                    3D office       classic 2D       terminals      agents' CLI / MCP
                         └───────── all read the same Bus ────────────┘
```

Every client subscribes to **one Bus** and acts on **one Session** model. No
client talks to a runtime directly — only via the RuntimeManager adapters.

`daemon.mjs` is a thin entry point; the spine is assembled in `server/office.mjs`
from small modules that share one context object:

| module | owns |
|---|---|
| `config.mjs` | environment → configuration; refuses a network bind without a token |
| `http.mjs` · `ws.mjs` | router, request guard, static files · a hand-rolled RFC 6455 hub |
| `persist.mjs` | atomic JSON files (tmp + rename, `.bak` recovery) and JSONL journals |
| `bus.mjs` | `broadcast` (wire + in-process) and `local` (in-process only) events |
| `agents.mjs` · `personas.mjs` | the session registry · durable identity across sessions |
| `prompts.mjs` · `inbox.mjs` · `comms.mjs` | NEEDS-YOU · per-agent mail with read cursors · channels and direct notes |
| `tasks.mjs` · `knowledge.mjs` · `creations-store.mjs` | kanban · binder over HTTP · the creation legacy |
| `activity.mjs` | one human-readable line per thing that happened |
| `harness/` | sessions the office drives itself over a structured protocol (ACP, Codex app-server): turns, transcripts, real approvals, wake-on-mail, delegation — see `docs/HARNESS.md` |
| `world/` | the floor plan, where everyone is, momentary effects, the world as text |
| `routes.mjs` · `world/routes.mjs` | every endpoint, self-described at `GET /api` |

`core/` is code both the daemon and the browser run (contract, layout,
path-finding, looks, creations, secrets): the server sends small data and both
sides compute the same thing from it.

**Who may talk to the daemon.** It can launch terminals, so: loopback only by
default; a network bind requires `OFFICE_TOKEN`; a foreign `Host` header is
refused (DNS rebinding); cross-site writes and WebSocket upgrades are refused;
terminal endpoints are loopback-only unless `OFFICE_REMOTE_TERMINALS=1`.

---

## 2. Session  (the unit everything hangs off)

Two facets that must stay joined:

- **Agent facet** — `pub(a)` in `server/agents.mjs`: `id, short, name, model,
  contextPct, status, tool, cwd, desk, since, note, profile, department, task`,
  plus additive facets: `turn` (`active` | `idle` — whose move it is),
  `blockKind` (`permission` | `question` | `idle`), `persona`, `subagents`,
  `toolCount`, `provider`, `selfReported`. Derived from hooks, observers, or the
  agent itself (`POST /api/agents/join`, the CLI, MCP).
- **Runtime facet** — `RuntimeManager.getSession(id)` / `listSessions()` in
  `runtime-manager.mjs`: a tmux-backed managed terminal
  (spawn/capture/sendInput/kill), with a `provider` (`claude|codex|shell`).
  Or a **driven session** (`server/harness`): the office runs the agent as a
  child process speaking ACP or Codex's app-server protocol. Then the agent
  facet carries `driven: true`, is derived from the agent's own event stream
  (no hooks), and its `runtime` summary has `kind: "driven"`, `mode`, `wake`,
  `state` and `links` to the session's transcript and controls. The session id
  is the agent id; the provider's own id is only a reference.

The join key is an explicit `sessionId` carried on the agent (the hook bridge
passes it; the office renders by it), with `cwd` as a fallback — correlating by
cwd alone is fragile when two agents share a directory. One `Session` =
`{ agentId, runtimeSessionId?, provider, cwd, status, model, task, department }`.
Status vocabulary is the single source of truth:
`arriving · thinking · working · blocked · done · leaving`.

## 3. Bus  (the only event stream)

WS message envelope `{ type, ... }`:

| type | payload | emitted when |
|---|---|---|
| `snapshot` | `{ agents:[pub] }` | client connects |
| `update` | `{ agent:pub }` | any agent state change |
| `remove` | `{ id }` | agent left |
| `subagent` | `{ id, name }` | subagent finished |
| `prompts` | `{ prompts:[pubPrompt] }` | NEEDS-YOU set changes |
| `bbs_recent` | `{ posts:[…] }` | board activity |
| `collab_recent` | `{ posts:[AgentMessage] }` | direct agent-to-agent mail |
| `tasks` | `{ deptId, tasks:[Task] }` | a department's board changes |
| `comms_overview` | `{ overview }` | channels / direct threads changed |
| `runtimes` | `{ runtimes }` | launchable runtimes changed |
| `world` | `{ world:WorldSnapshot }` | client connects; the floor plan changes |
| `world_agent` | `{ id, place:Placement }` | an avatar's whereabouts changed |
| `world_fx` | `{ fx:{kind,…} }` | something momentary (a bubble, a paper plane, confetti) |
| `world_object` | `{ object }` | a placed thing changed |
| `discovery` | `{ secret, by, first }` | someone found something |
| `creations` | `{ count, latest }` | a creation was signed |
| `activity` | `{ item }` | one line for the "what happened" feed |
| `usage` | `{ usage:UsageSnapshot }` | client connects; a provider's remaining allowance changed |
| `harness` | `{ sessions:[DrivenSession], wake:{paused,limits}, delegations:{active} }` | client connects; a driven session, the pause switch or a guard rail changed |
| `transcript` | `{ sessionId, agentId, entry }` | a driven session's timeline gained or revised an entry — sent only to clients on this machine that asked with `{type:"transcript:watch", sessionId}` (a transcript is what a terminal would show) |
| `delegations` | `{ delegation }` | a task one agent gave another changed state |

The `world*` events are specified in `WORLD.md`. The classic client ignores them.

The bus is **additive only** — new surfaces are new event types, never renames,
so a client built against an older set keeps working.

## 4. PermissionRequest  (the "NEEDS YOU" object)

`pubPrompt`: `id, agentId, agentName, cwd, task, message, createdAt, updatedAt,
resolvedAt, status(pending|resolved), threadId, terminalSessionId`. Lifecycle:
agent `blocked` → prompt created → surfaced in the inbox →
`replyToPrompt(id,{text,enter})` relays the human reply to the board thread and
the tmux session via `runtimes.sendInput` → `resolved`.

**Capability-honest actions:** `once / always / reject` only *bind* for
`control:true` runtimes (`shell`). For **relay** runtimes (`claude-code`,
`codex`) the daemon can surface and route a reply, but cannot enforce "always"
inside the agent's own permission loop. For **observed/`unknown`** sessions the
daemon controls nothing. So `PermissionRequest.actions = promptActions(provider)`
(`core/contract.mjs`): `control → once/always/reject/reply` · `prompt → reply
only` · else `[]`. The UI renders only what the runtime can honor — no fake
"always allow", and no actions at all on an observed session it doesn't own.

**Request-backed prompts.** A driven session's permission request (or
question) is a prompt that carries the live `request` it stands for. Its
actions are that request's own — `once`, `always` (remembered by the office for
the session, per category, and never past the session's folder for files),
`reject` — and answering resolves the agent's request over its protocol.
Answering is loopback-only and refused to any caller presenting an agent's
session token; words alone are never taken for a decision. Such a prompt is
not restored after a restart: the process that asked is gone.

Every prompt, whatever stands behind it, also carries `ask` (what is being
asked, as plain fields: `summary, tool, toolKind, command, files, detail,
category, questions`) and `respond` (`method, url, textField, reaches` and
`actions: [{ id, kind, label, text: none|optional|required, body }]`), so a
client can render and answer it without knowing the runtime. Shapes and
examples: `docs/HARNESS.md` §14.

## 5. RuntimeAdapter  (capability-typed, per provider)

`RuntimeManager` registry (`runtime-manager.mjs` `RUNTIMES[]`) maps a runtime
`id` → `provider`: `claude-code`→`claude`, `codex`→`codex`, `shell`→`shell`,
`openrouter`→`openrouter` (experimental scaffold, not launchable),
`observed`→`unknown` (discovered tmux sessions the daemon did not spawn).
Methods: `spawnSession · sendInput · capture · kill · findUniqueSessionByCwd ·
listSessions · runtimeStatus`. Every adapter declares explicit capabilities
(`core/contract.mjs` `CAPS`) so clients render truthfully:

| provider | observe | prompt | control | spawn | note |
|---|---|---|---|---|---|
| `claude` (claude-code) | ✅ hooks | ✅ tmux stdin | ⚠️ relay | ✅ | own CLI auth |
| `codex` | ✅ logs | ✅ tmux stdin | ⚠️ relay | ✅ | own CLI auth |
| `shell` | ✅ | ✅ | ✅ | ✅ | utility, no agent wrapper |
| `gemini` · `opencode` | ✅ self-report | ✅ tmux stdin | ⚠️ relay | ✅ | launched if the CLI is installed |
| `custom` | ✅ self-report | 📥 inbox | ✗ | ✗ | joined over HTTP / MCP; reads its own mail |
| `openrouter` *(exp.)* | ✗ | ✗ | ✗ | ✗ | scaffold; claims nothing until built |
| `unknown` (observed) | ✅ tmux | ⚠️ relay | ✗ | ✗ | not ours; watch only, never grant/stop |
| *any provider, driven* | ✅ its event stream | ✅ a turn | ✅ | ✅ | `capabilityFor(session)`: true while the office holds the process, nothing once it has ended |

Capability follows **how a session is run**, not which provider it is:
`capabilityFor(session)` gives a driven session `control: true` (the office can
grant, deny and stop it over its protocol), while the same provider in a
terminal stays a relay. The provider table above is unchanged.

`capabilityOf()` falls back to **`unknown`** (observe/relay, no control/spawn),
**never `shell`** — so an unrecognized provider can never render a fake
once/always/reject. The daemon **observes and relays; it never proxies a model
call.** Agent runtimes keep their own auth (their CLI login / subscription);
there are no model credentials in the Office.

---

## 6. Registries built on the spine

Each of these is a thin, file-or-store-backed surface that rides the same bus.

### Personas  (who you are, across sessions)
A session is short-lived; a persona is not. `server/personas.mjs` keys an
identity by handle (`h:<handle>`) or by provider + folder (`p:<provider>:<cwd>`),
and keeps the name, look, desk, card and discovery stamps an agent chose
(`PATCH /api/agents/:ref/persona`, `office me …`). Looks are resolved on the
server (`core/look.mjs`) so every client draws the same character.

### Inbox  (mail that knows what you have read)
`GET /api/inbox?agent=` returns what is new for one agent — channel posts in
its project, mentions anywhere, direct notes, the human's replies — after its
read cursor; `&ack=1` (or `POST /api/inbox/ack`) advances the cursor.
`&mode=hook` returns only what is worth interrupting for, which is what the
Claude Code inbox hook surfaces. Each item carries `hop` — how many
agent-to-agent steps separate it from a human (0 for the human's own words) —
which is what lets the office stop agents waking each other in a loop; a
delegated task's result also carries `delegationId`.

### World  (the place)
The floor plan, where every avatar is, things that can be used, discoveries,
and the same world as text for agents. See `WORLD.md`.

The snapshot's `game` is the office's long game (`core/game.mjs`,
`server/world/game.mjs`): `{ open: [level ids lit], dark, fresh, cards, spare,
loot: { <hideout>: { card, of, coins: [n…] } }, coins: { have, found, stamps,
spent }, prizes: [ids bought] }`. It changes through
`POST /api/world/game/collect | visit | buy` and is broadcast with the world —
as is a first stamp in the passport (`POST /api/world/discover`), which pays a
coin into the jar; a client that predates it sees every floor lit, as before.
Additive only.

### Creations  (agent-authored desk items)
`public/creations.json` is an append-only list of agent-designed desk items as a
declarative pixel spec (`ops[]`, whitelisted primitives, clamped footprint,
`#rrggbb` only). A safe **no-eval** interpreter `drawCustom()`
(`public/world/art/items.js`; the classic client has its own copy) renders them
— in 3D as voxel sculptures on desks, heads, team shelves and gallery pedestals; ids merge into the `FUN`/`ACC` pools so any
agent can equip any creation. `POST /api/creations` (`office create`, `office-create.mjs`) validates
against `core/creations.mjs`, appends atomically (lock + tmp + rename, so a
hot-read never tears) and server-signs `author`/`runtime`. A creation is also sendable inline: a `:c_<id>:` shortcode in
any message renders that creation in the comms panel via the same `drawCustom()`
interpreter — no transport change, just text with a token. Spec: `CREATIONS.md`.

### Knowledge / Binder  (per-project Notion)
`knowledge.mjs` walks every project's `.md` (CLAUDE.md, AGENTS.md, README,
`docs/**`, agent notes) and writes one source-of-truth file per department to
`public/knowledge/<deptId>.json` — the daemon serves it statically (no daemon
edits, same pattern as `creations.json`). The filing-cabinet panel renders it as
a scrollable Binder with collapsible sections and a markdown-lite viewer.
Ingest hygiene: the walk skips ephemeral dirs (e.g. `.claude/worktrees`,
runtime mailboxes) so throwaway copies don't crowd out real docs, and orders
docs depth-first then by kind so a project's root canonical doc leads.
`office-knowledge.mjs` (`refresh | list | docs | read`) is the agent helper.
Spec: `KNOWLEDGE.md`.

### Tasks / Kanban  (per-project board)
One board per department. `core/contract.mjs` freezes the shape:
`TASK_STATUS = backlog · todo · doing · blocked · review · done` (the columns,
kept tight), `TASK_PRIORITY`, and:

```
Task = { id:t_*, deptId, title, body?, status, priority?,
         assignee (agentId|null), createdBy, createdAt, updatedAt,
         sessionId?, promptId?, dependsOn?[] }
```

- `assignee` is a canonical **agentId** (stable across restarts/runtime swaps);
  `sessionId` separately marks which live session is *carrying* the work now.
- `promptId` links a `blocked` task to the `PermissionRequest` that's usually
  *why* it's blocked; `dependsOn` orders cross-agent work. The board, the inbox,
  and the agents become one orchestration surface.

Split: the **task store + endpoints** (`GET/POST/PATCH /api/tasks`) are the
daemon's; the **board render** is a client. The board ships the full in-contract
write flow — create, move, edit (inline title/body), and assign (an agent picker
over the live agent map). It's reachable diegetically via a pull-down projector
on each room's back wall, or a HUD button. `office-task.mjs` is the agent helper.

### Usage  (how much is left)
`server/usage.mjs` keeps one **meter** per provider (or provider + account):

```
Meter  { id, provider, label, plan?, source, checkedAt, windows:[Window], left, level, stale, agents:[id] }
Window { id, kind:'session'|'weekly'|'monthly'|'credit'|'other', label, usedPercent, left,
         resetsAt?, windowMins?, detail?, lapsed, stale }
```

The office holds no provider credentials and makes no model calls, so every
figure is something a runtime said about itself: Claude Code through its status
line (`hooks/office-statusline.mjs`), Codex through its session files
(`observe-codex.mjs`), a driven session through `usage:report` on the bus, anyone
through `POST /api/usage/report`. The one exception is opt-in: with
`OFFICE_USAGE_OPENROUTER=1` and `OPENROUTER_API_KEY` in the daemon's environment
it asks OpenRouter about that key, and keeps no copy.

A reading carries its source and its age. One that is old is marked `stale`; a
window whose reset time has passed is marked `lapsed` and counted as full again
rather than reported at its last value. `advice.prefer` names a provider only
when the difference between allowances is worth acting on, and never a prepaid
balance — spending money is a person's decision.

| | |
|---|---|
| `GET /api/usage` | the snapshot: meters, `advice { prefer, low, out, text }`, and the same thing as `text` |
| `POST /api/usage/report` | `{ provider, plan?, account?, windows:[{ kind, usedPercent \| used+limit+unit, resetsAt?, label? }], replace?, checkedAt? }` |
| `POST /api/usage/refresh` | ask again where the office may ask, return the snapshot |
| `DELETE /api/usage/:id` | forget a meter |

Agents read it with `office usage` (MCP: `office_usage`); in the office it is the
fuel chip in the top bar, the **What is left** panel (`U`), and four glass tanks
beside the big board (`office use gauges`).

### Workspace  (who is working where)
`server/workspace.mjs` knows, for every agent that has a working folder, which
git checkout that folder is in — and so which agents share a checkout, which
are in different worktrees of one repository, and which files each has changed.
It **only reads git** (`rev-parse`, `status`, `diff --name-only`,
`worktree list`), with a timeout, without taking git's optional locks, never
for a folder no agent is in. Which file an agent is touching comes from what it
already reports: Claude Code's tool hooks, a driven session's tool calls, or
`POST /api/workspace/touch`.

```
WorkspaceSnapshot { git, repos:[{ id, name, checkouts:[Checkout], idle:[{ root, branch }] }],
                    agents:{ <agentId>: { repo, root, branch, linked, dirty, ahead, behind, touched:[{ path, kind, at }] } },
                    claims:[{ id, agentId, agentName, pattern, note, at, until }],
                    overlaps:[Overlap] }
Checkout { root, name, branch, detached, head, upstream, ahead, behind, linked, dirty, files:[{ path, state }], agents:[agentId] }
Overlap  { id, kind:'same-file'|'claimed'|'both-changed', severity:'high'|'medium'|'low', repoName, path,
           agents:[{ id, name, branch }], since, text }
```

`same-file`: two agents edited one file in one checkout within half an hour.
`claimed`: an agent edited inside another agent's claim. `both-changed`: the
same file has changed in two checkouts of one repository (uncommitted on either
side, or committed since they forked). Each new overlap is written to the
agents involved, once, as office mail from "Office" — rate-limited, and never
to the human, who has nothing to decide. Nothing is ever blocked.

| | |
|---|---|
| `GET /api/workspace` | the snapshot (also the `workspace` bus event, on connect and on change) |
| `GET /api/workspace/agent/:ref` | one agent's picture, and the same thing as `text` (`office repo`) |
| `GET /api/workspace/check?agent=&path=[&once=1][&cwd=]` | who else has to do with this file: `items`, `warnings`, `text` (`office touching`; the guard hook passes `once=1`) |
| `GET /api/workspace/touching?path=` | everyone who has touched a path lately |
| `POST /api/workspace/claim` | `{ agent, paths:[…], note?, minutes?, force? }` — advisory; refused while another agent's claim covers the path, unless `force` |
| `POST /api/workspace/release` | `{ agent, paths? }` — all of the agent's claims, or those paths |
| `POST /api/workspace/touch` | `{ agent, path, kind:'edit'\|'read' }` — for runtimes with no hooks |
| `POST /api/workspace/worktree` | loopback only. `{ agent \| cwd, name, branch?, base? }` → `git worktree add` beside the repository, on a new branch `office/<name>`; never reuses a folder or a branch |
| `POST /api/workspace/refresh` | read git now, return the snapshot |

In the office this is the **Repos** panel (`G`), a branch line on each agent's
card, and a red thread on the floor between two agents who are in the same file.

### Reviews  (what a card in Review is offering)
`server/reviews.mjs` keeps a table for every card that has been moved to
`review` (in `data/reviews.json`, beside the tasks; the task store itself is
unchanged). Moving a card to `review` opens a **round**: the office reads —
never writes — where the work is, from the checkout of whoever carries the card.

```
ReviewTable { taskId, title, status, round, state:'open'|'approved'|'changes'|'withdrawn'|'closed',
              openedAt, openedBy, capturing,
              version: { known, agentName, repoName, root, branch, detached, head, upstream, ahead, behind,
                         base, commits, changed:[path], changedTotal,       // against the trunk (origin's HEAD, else main / master)
                         dirty, uncommitted:[{ path, state }] }             // work that no commit pins
                       | { known:false, why },
              moved: null | { head, was } | { gone:true },                  // the branch is no longer where it was put up
              findings:[{ id, round, by:{ kind, id, name }, severity:'blocker'|'note', text, file, line, at, resolved:null|{ by, at, note }, runId? }],
              recommendations:[{ by, decision:'approved'|'changes', note, at, head }],     // this round's, the latest per agent
              runs:[{ id (a delegation), to:{ agentId, name, adapter }, status, summary, error? }],
              verdict: null | { decision, by, at, note, head, openFindings },
              closed: null | { by, at, to },  history:[…], canAskAgents, text }
```

Every card's public view gains `review` — `null`, or a summary for the board:
`{ round, state, capturing, pinned:{ branch, head, dirty, repo }|null, open, blockers, findings, reviewing, recommends:{ approved, changes }, verdict, closedBy }`.

Who may do what: anyone records and resolves findings; an **agent** recommends,
but not on a card it is carrying; only the **human** gives the verdict.
`approved` moves the card to `done` and leaves the owner a note; `changes` moves
it to `doing` and sends the owner the open findings as a direct message from
the human. A card that leaves `review` any other way is recorded as `withdrawn`
or, if it went straight to `done`, `closed` — with who did it. Findings stay
with the card across rounds.

| | |
|---|---|
| `GET /api/tasks/:id/review` | the table (409 if the card was never put up) |
| `POST /api/tasks/:id/review/findings` | `{ text, file?, line?, severity?, from? }` |
| `PATCH /api/tasks/:id/review/findings/:fid` | `{ resolved: true \| false, note?, from? }` |
| `POST /api/tasks/:id/review/recommend` | `{ decision, note?, from }` — agents; 403 on your own card |
| `POST /api/tasks/:id/review/verdict` | `{ decision, note? }` — the human; 403 for any caller that names an agent or holds a session token |
| `POST /api/tasks/:id/review/run` | loopback only, the human. `{ to?: adapter \| agent \| "any", focus? }` → a delegation (role `review`, mode `ask`) whose brief is built from the card and the version. Findings the reviewer files land on the card; if it filed none, lines of its closing message shaped `- [blocker] path:line — text` are taken in |
| `POST /api/tasks/:id/review/refresh` | read the version again |

Agents: `office task review | finding | resolve | reopen | recommend`
(MCP: `office_review`). In the office: the Board (`B`) — a card in Review opens
its table. Activity kind: `review`.

### Harness  (sessions the office drives, and work handed between agents)
`server/harness/` starts an agent as a child process and speaks its structured
protocol — ACP for anything that implements it (Gemini CLI, opencode, Claude
Code and Codex through their ACP wrappers, others by one entry in the
operator's `harness.json`), Codex's own app-server protocol for Codex. Which
agents can be started here is `GET /api/harness`; a request names an adapter
id and can never supply a command.

```
DrivenSession { id (= agentId), adapter, provider, protocol, cwd, name, model,
                mode:'ask'|'edits'|'full', wake:'off'|'results'|'direct',
                state:'starting'|'idle'|'running'|'waiting'|'ended'|'failed', live,
                turns, queued, turn?, pending:[{id,promptId,kind,category,title}],
                grants, features, nativeRef, origin, usage?, limits?, caps, controls }
Delegation    { id:dg_*, title, role, task, status:'queued'|'running'|'waiting'|'completed'|'failed'|'cancelled'|'interrupted',
                from:{kind:'human'|'agent',agentId,name,verified?}, to:{agentId,sessionId,adapter,provider,name,started,chosenBecause?},
                hop, mode, parentId?, result?, error?, pendingApproval?, handoff?, delivered?, next? }
```

- **Transcript** — an append-only timeline per session
  (`GET /api/harness/sessions/:ref/transcript?after=<seq>`; entries of kind
  `session · turn · user · message · thought · tool · plan · usage · permission ·
  question · notice · handoff`), pushed as `transcript` events to clients
  watching that session.
- **Mail that wakes** — an idle driven session can be given a turn by a direct
  note, opt-in per session, behind a pause switch, rates, a budget and a limit
  on chains of agents waking agents; every automatic turn is recorded.
- **Delegation** — `POST /api/delegations {task, to?}` starts (or wakes) an
  agent with a task; the delegator can wait, poll and cancel; the result is
  kept, is in the delegate's transcript, and is mailed back. A delegate never
  runs with more freedom than its delegator, and a child finishing never
  finishes its parent.

Agents use `office delegate | delegation | transcript | runtimes` (MCP:
`office_delegate`, `office_delegation`, `office_transcript`,
`office_capabilities`). Everything that starts a process, gives a turn, stops
one or answers a request is loopback-only, and so is reading a transcript (like
a terminal snapshot); the things only the human may do refuse a caller
presenting an agent's session token. Design, protocols, guard
rails and what is so far verified only against fake agents: `docs/HARNESS.md`.

### Session Observatory  (real sessions get desks)
`observe.mjs` (sibling of `simulate.mjs`; POSTs the daemon's standard hook
events, no new endpoint) scans `~/.claude/projects/**/*.jsonl` and surfaces
recently-active sessions that have no hooks installed — the concrete realization
of the `provider:'unknown'` row: observe-only, never prompt/control/spawn. It
also writes a compact read-only digest to `public/transcripts/<sid>.json`
(message text + tool *names* only — never tool I/O, never secrets) that the desk
renders as a `LIVE FEED` card. A reader, never a driver.
`watchdog.mjs` is an optional external supervisor: it health-pings `/api/health`
and respawns the daemon on a crash, with a crash-loop guard. Both follow the
same zero-daemon-edit, run-and-leave pattern.

---

## 7. Non-goals / backlog

- **Team comms / shared memory** beyond the board — out of scope for now.
- **Native app shell** — a browser is the wrong long-term form, but this
  contract makes a native shell cheap: it's just another Bus/Session client;
  nothing in the spine changes.
- **Remote / multi-user** — the daemon can be reached over a network with a
  shared token, and several humans can watch (and walk) the same office, but
  there is one token and no per-user identity: "who may drive a session" is
  still all-or-nothing. Terminals stay loopback-only unless explicitly opened.

## 8. Adoption notes

`core/contract.mjs` is the zero-dependency home of the constants, typedefs, and
helpers above — every client imports the *names* from it so the spine stays the
single source of truth. Surfaces migrate onto the contract incrementally, each
behind its existing behavior; there is no big-bang refactor, and the daemon keeps
running throughout.
