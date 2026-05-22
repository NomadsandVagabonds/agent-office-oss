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
                 ┌─────────────────── daemon (control plane) ───────────────────┐
 hooks ─────────▶│  Session registry   Bus   PermissionRequests   RuntimeManager │
 (claude-code)   │     (agents)      (WS/SSE)    (prompts)        (claude/codex/  │
 runtime stdio ─▶│                                                shell adapters)│
                 └───────▲───────────────▲───────────────▲───────────────▲───────┘
                         │               │               │               │
                  office map        work-mode TTY    NEEDS-YOU inbox    comms board
                         └───────── all read the same Bus ────────────┘
```

Every client subscribes to **one Bus** and acts on **one Session** model. No
client talks to a runtime directly — only via the RuntimeManager adapters.

---

## 2. Session  (the unit everything hangs off)

Two facets that must stay joined:

- **Agent facet** — `pub(a)` in `daemon.mjs`: `id, short, name, model,
  contextPct, status, tool, cwd, desk, since, note, profile, department, task`.
  Derived from Claude Code hooks / transcripts.
- **Runtime facet** — `RuntimeManager.getSession(id)` / `listSessions()` in
  `runtime-manager.mjs`: a tmux-backed managed terminal
  (spawn/capture/sendInput/kill), with a `provider` (`claude|codex|shell`).

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
| `openrouter` *(exp.)* | ✗ | ✗ | ✗ | ✗ | scaffold; claims nothing until built |
| `unknown` (observed) | ✅ tmux | ⚠️ relay | ✗ | ✗ | not ours; watch only, never grant/stop |

`capabilityOf()` falls back to **`unknown`** (observe/relay, no control/spawn),
**never `shell`** — so an unrecognized provider can never render a fake
once/always/reject. The daemon **observes and relays; it never proxies a model
call.** Agent runtimes keep their own auth (their CLI login / subscription);
there are no model credentials in the Office.

---

## 6. Registries built on the spine

Each of these is a thin, file-or-store-backed surface that rides the same bus.

### Creations  (agent-authored desk items)
`public/creations.json` is an append-only list of agent-designed desk items as a
declarative pixel spec (`ops[]`, whitelisted primitives, clamped footprint,
`#rrggbb` only). A safe **no-eval** interpreter `drawCustom()` in
`public/index.html` renders them; ids merge into the `FUN`/`ACC` pools so any
agent can equip any creation. The `office-create.mjs` helper appends atomically
(tmp+rename, so the hot-read never tears), validates the clamps, and server-signs
`author`/`runtime`. A creation is also sendable inline: a `:c_<id>:` shortcode in
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
- **Remote / multi-user** — once sessions are drivable across a network, "who
  may drive a session" becomes a real auth requirement (an attachable TTY is a
  control surface). Single-machine, single-operator today.

## 8. Adoption notes

`core/contract.mjs` is the zero-dependency home of the constants, typedefs, and
helpers above — every client imports the *names* from it so the spine stays the
single source of truth. Surfaces migrate onto the contract incrementally, each
behind its existing behavior; there is no big-bang refactor, and the daemon keeps
running throughout.
