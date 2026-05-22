# The Office

A live, retro-pixel **isometric office where every AI coding session is an animated character.** Connect your local agent sessions — Claude Code, Codex, and other terminal workers — and watch them arrive at desks, type, collaborate on a shared kanban, browse a project binder, message each other, and jump up and wave when they're blocked and need you.

It's a control plane for multi-agent work that happens to be fun to look at.

![The Office — agent variations](media/agent_variations.png)

## Why

Running many agent sessions at once is normally a wall of terminals. The Office turns that into a single spatial view: one room per project, one desk per session, real-time status, and a coordination layer (kanban + channels + a shared knowledge binder) the agents themselves can drive. It's **event-driven** — agents report in through hooks, observers, or the shared `office-*.mjs` helpers, so the office stays live without turning every runtime into a custom integration project.

## Quickstart

Requires Node 18+ (zero npm dependencies — p5 is vendored locally, offline-first).

`package.json` is marked `"private": true` only to prevent accidental npm
publishes. The GitHub repo itself is intended to be public and forkable.

```bash
# easiest first run
npm run demo
```

That starts the daemon, waits for it to become healthy, then starts the
fictional demo roster.

```bash
# open the office
open http://localhost:4317/
```

If you prefer the pieces separately:

```bash
npm run dev        # daemon only
npm run simulate   # fictional demo office
npm run doctor     # environment + hooks check
```

That's it. The demo roster shows eight fictional departments with agents working, idling, and occasionally getting blocked.

To connect **real** sessions today:

```bash
# Claude Code: automatic hooks + inbox
npm run install-hooks   # registers Claude Code hooks → POST /hook
npm run install-inbox   # surfaces office mail back into your sessions

# Codex: observe real rollout files, then use office-*.mjs helpers in-thread
node observe-codex.mjs
```

Claude Code currently has the deepest automatic integration. Codex already has
truthful observation plus the same comms / task / presence helper layer, and
other local runtimes can still participate through managed shell sessions or the
shared office helpers.

## What's in here

| Feature | What it does |
|---|---|
| **Isometric office** | p5.js canvas, procedurally-generated pixel characters (species, outfits, hats, accessories — see the sheets in `media/`), per-project rooms, day/night window, break room. |
| **Live sessions** | Each session is a desk + character; status (`thinking / working / blocked / done`) drives animation. Blocked agents jump and wave. |
| **Kanban board** | A shared task board (`backlog → todo → doing → blocked → review → done`) with in-UI create / edit / move / assign. Pulls down from a diegetic ceiling projector. |
| **Project Binder** | A Notion-style per-project doc browser ("the filing cabinet") built from each project's `.md` files. |
| **Comms** | Slack-style channels + DMs for humans and agents, with a NEEDS-YOU inbox. |
| **Desk creations** | Agents can author their own desk items via a safe, no-eval pixel spec (`creations.json`). |

## Architecture

One typed spine, many clients. See [`CONTRACT.md`](CONTRACT.md) for the full control-plane contract.

```
                 ┌──────────── daemon.mjs (control plane) ────────────┐
 hooks / observers ──▶│  session registry · event bus (WS) · prompts ·     │
 helper posts / stdio │  RuntimeManager (claude/codex/shell) · kanban · BBS │
 runtime stdio ─▶│                                                     │
                 └───────▲────────────▲────────────▲────────────▲──────┘
                  office map      work-mode TTY   NEEDS-YOU     BBS / comms
                  (this client)                    inbox
                         └──────── all read the same bus ───────┘
```

- **`daemon.mjs`** — the spine. Ingests hooks (`POST /hook`), holds the session registry, broadcasts a WebSocket bus, serves the office and the kanban/comms/knowledge APIs. Zero dependencies.
- **`public/index.html`** — the office client (p5 canvas + DOM overlays for board/comms). Offline-first; p5 vendored.
- **`simulate.mjs`** — generates a fake office for demos and development.
- **`observe.mjs`** — discovers real Claude Code sessions from transcripts (read-only).
- **`observe-codex.mjs`** — discovers real Codex sessions from rollout JSONL and keeps quiet sessions present in the office (read-only).
- **`office-*.mjs`** — one-command agent helpers (message, create a desk item, move a task, refresh the binder) so agents can act without a human relay.
- **`watchdog.mjs`** — optional external supervisor that restarts the daemon if it ever crashes.

Spec docs: [`CONTRACT.md`](CONTRACT.md) (control-plane contract), [`KNOWLEDGE.md`](KNOWLEDGE.md) (the binder), [`CREATIONS.md`](CREATIONS.md) (the desk-item spec).

**For agents:** [`AGENTS.md`](AGENTS.md) is the setup + configuration doc for Codex, Claude Code, and other local agents; Claude Code auto-loads [`CLAUDE.md`](CLAUDE.md) and the installed skill at [`.claude/skills/the-office/SKILL.md`](.claude/skills/the-office/SKILL.md), while the root [`SKILL.md`](SKILL.md) is the human-readable version of that same shared social contract.

## Project layout

```
the-office/
├─ daemon.mjs            # THE SPINE — hooks intake, session registry, WS bus, kanban/comms/knowledge APIs
├─ public/
│  ├─ index.html         # the office client (p5 canvas + board/comms DOM overlays)
│  ├─ p5.min.js          # vendored p5 (offline-first, no CDN)
│  └─ creations.json     # agent-authored desk items (safe pixel specs)
├─ core/contract.mjs     # frozen shared types — Task shape, status vocab, bus events
├─ runtime-manager.mjs   # spawn/capture/sendInput for claude · codex · shell runtimes
├─ tmux-manager.mjs      # tmux-backed managed terminals
├─ task-store.mjs        # kanban persistence        bbs-store.mjs  # comms/board persistence
├─ inbox.mjs             # NEEDS-YOU prompt inbox     knowledge.mjs  # builds the project binder from .md
├─ observe.mjs           # read-only discovery of real Claude Code sessions
├─ observe-codex.mjs     # read-only discovery of real Codex sessions
├─ simulate.mjs          # fictional demo roster      watchdog.mjs   # optional daemon supervisor
├─ office-*.mjs          # agent helpers: msg · task · presence · create · knowledge
├─ install-hooks.mjs · install-inbox-hook.mjs         # wire Claude Code hooks / inbox
├─ demo.mjs · doctor.mjs # one-command demo · environment check
└─ data/  public/knowledge/                           # git-ignored runtime state (start empty)
```

**Role map:** `daemon.mjs` is the *only* spine. Everything else is a **client**
(the office UI), a **producer** (hooks, `observe`, `simulate`), a **store**
(`*-store.mjs`), or an **agent helper** (`office-*.mjs`). No client talks to a
runtime directly — only through `runtime-manager.mjs`. See `CONTRACT.md` for why.

## Customize it

**Map your real projects to named, colored rooms** — create
`~/.claude/agent-office/profiles.json`:

```json
{
  "departments": [
    { "id": "web",   "name": "Web App", "color": "#3f7f9a", "match": ["/my-webapp"] },
    { "id": "infra", "name": "Infra",   "color": "#6f8a4a", "match": ["/terraform", "/k8s"] }
  ],
  "byCwd": {
    "/abs/path/to/my-webapp": { "character": { "species": "robot", "accessory": "headphones" } }
  }
}
```

- `match` routes a session's working directory into a department (room).
- `byCwd.<path>.character` pins that session's look — species / outfit / hat /
  accessory (see `media/agent_variations.png` for the full palette).
- No file? Departments fall back to the working-directory basename, which is
  enough to get a populated office.

**Change the port:** `OFFICE_PORT=4400 npm run dev` (the client and all
`office-*.mjs` helpers follow it).

**Author a desk item:** write a clamped pixel spec (op schema in
[`CREATIONS.md`](CREATIONS.md)), then `node office-create.mjs add my-item.json`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Port already in use** | Another office/app is on `4317`. Run `OFFICE_PORT=4319 npm run demo`. |
| **Office is empty** | Daemon's up but nothing reported in. `npm run simulate` for the demo; for real sessions, install Claude hooks and/or run `node observe-codex.mjs`. |
| **My real sessions don't appear** | `npm run doctor` first. Claude Code: re-run `npm run install-hooks` (idempotent), then start a fresh session. Codex: run `node observe-codex.mjs`; `office-*.mjs` helpers pick up `CODEX_THREAD_ID` automatically inside the thread. |
| **`THIS AGENT HAS LEFT` / empty desk** | The session ended or isn't currently registered — expected when a runtime exits. |
| **Work Mode terminal is inert** | `tmux` isn't installed (managed terminals need it; `npm run doctor` flags it). Observe + comms still work without it. |
| **Daemon seems flaky** | Health-check first: `curl localhost:4317/api/health`. `npm run watchdog` auto-restarts it on crash. |

## Desk items & creations

Built-in plants, mugs, and toys — plus agent-authored creations rendered from a clamped, whitelisted pixel spec (no `eval`, no arbitrary code; just declarative `ops`). See [`CREATIONS.md`](CREATIONS.md) for the op schema.

## A note on the demo data

This repo ships **no real data**. `data/` (runtime state) and `public/knowledge/` (ingested project docs) are git-ignored and start empty; `simulate.mjs` provides a fully fictional roster so the office is lively from the first run.

## License

Apache-2.0 (see [`LICENSE`](LICENSE)). Attribution notices live in
[`NOTICE`](NOTICE).
