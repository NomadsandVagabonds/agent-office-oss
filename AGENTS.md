# AGENTS.md — working in (and configuring) The Office

Instructions for AI agents (Codex, Claude Code, and others) operating in this
repo. Humans setting it up should read this too — the **Configure to your
system** section is the whole setup.

## What this repo is

The Office is an event-driven control plane for multi-agent coding work: a
zero-dependency Node daemon (`daemon.mjs`) plus an offline-first p5 client
(`public/index.html`) that renders every agent session as a character at a desk,
with a shared kanban, project binder, and Slack-style comms. See `README.md`
for the tour and `CONTRACT.md` for the architecture contract.

## Run it

```bash
npm run demo           # daemon + fictional demo roster
npm run dev            # daemon only
npm run simulate       # just the fictional roster
npm run doctor         # environment / hooks check
open http://localhost:4317/
```

## Configure to your system

There are **no API keys to add.** The Office is a control plane, not a model
client — it never calls an LLM and stores no credentials. Your agents keep
their own existing auth; the Office just *observes* or coordinates them through
hooks, observers, and helper commands. Setup is four optional steps:

**1. Connect real Claude Code sessions (hooks).**
```bash
node install-hooks.mjs          # adds the office hook bridge to ~/.claude/settings.json
node install-inbox-hook.mjs     # surfaces office mail back into your sessions
# both are idempotent, back up settings.json first, and support --uninstall
```
This registers `SessionStart/End`, `PreToolUse/PostToolUse`, `UserPromptSubmit`,
`Notification`, `Stop`, `SubagentStop` → `POST /hook`. Once installed, every
Claude Code session you run shows up at a desk automatically.

**2. Connect real Codex sessions (observer + helpers).**
```bash
node observe-codex.mjs
```
This tails real Codex rollout JSONL files and publishes a truthful read-only
desk feed into the office. Inside a Codex thread, the `office-*.mjs` helpers
pick up `CODEX_THREAD_ID` automatically, so presence, channel posts, DMs, task
moves, and desk-item authorship all resolve to the right desk without extra
flags.

Other local runtimes can still participate through managed shell sessions or
the shared `office-*.mjs` helpers even if they do not have a bespoke observer
yet.

**3. Map your projects to departments (optional).**
Create `~/.claude/agent-office/profiles.json` to control which working
directories group into which rooms:
```json
{
  "departments": [
    { "id": "web", "name": "Web", "color": "#3f7f9a", "match": ["/my-webapp"] }
  ],
  "byCwd": { "/abs/path/to/my-webapp": {} }
}
```
Without it, a session's department falls back to its working-directory basename,
which is enough to get a populated office. The daemon tolerates the file being
absent.

**4. Environment knobs (all optional).**

| Env var | Effect |
|---|---|
| `OFFICE_PORT` | Daemon/clients port (default `4317`). |
| `OFFICE_HOST` | Address(es) the daemon listens on, comma-separated. Default: loopback only (`127.0.0.1` and, where available, `::1`). Anything wider, e.g. `0.0.0.0`, is an explicit opt-in — read "Who the daemon answers" below first. |
| `OFFICE_AUTHOR` | Override the display name a helper posts under. |
| `OFFICE_MODEL` | Label the model shown on your desk. |
| `OFFICE_CREATIONS_FILE` | Point desk-item writes at a sandbox file (testing). |

`CLAUDE_SESSION_ID` / `CODEX_THREAD_ID` are read automatically from the runtime
environment to resolve your identity — you don't set these yourself.

**Who the daemon answers.** The office can start terminals and type into them,
so by default it is reachable from this machine only, and it refuses (`403`)
any request that isn't from its own page or a local tool:

- The `Host` header must be `localhost`, `127.0.0.1` or `[::1]` on the office
  port. That stops DNS rebinding — and it means a port-forward has to keep the
  same port number on both ends.
- A request that carries an `Origin` must come from the office's own page. The
  WebSocket is held to the same rule.
- Cross-site requests other than `GET` (`Sec-Fetch-Site`) are refused, and
  there is no CORS.

curl, the hooks and the `office-*.mjs` helpers send no `Origin`, so none of
this affects them.

Setting `OFFICE_HOST` past loopback (say `0.0.0.0`, which a published container
port needs) lets other machines reach the office by IP address; a hostname is
accepted only if `OFFICE_HOST` names it. There is **no authentication**:
anything that can connect can drive the office, including its terminals. Only
do that on a network you trust; otherwise leave the default and tunnel in, e.g.
`ssh -L 4317:localhost:4317 <host>`. The hooks and helpers always talk to
loopback, so keep `127.0.0.1` covered (`0.0.0.0` does, or list it:
`OFFICE_HOST=127.0.0.1,192.168.1.20`).

## How to behave as an agent here

The full behavioral contract lives at `.claude/skills/the-office/SKILL.md`.
Claude Code auto-loads it; other runtimes can read the same shared skill
directly. In short:

- Read your office inbox; post status in the right **channel**; DM a teammate
  when it's for one person; ask the human only when the human is the blocker.
- Drive shared work on the board (`office-task.mjs`), set your presence
  (`office-presence.mjs`), read project docs (`office-knowledge.mjs`).
- Don't fake-close work; `task.assignee` is a resolvable agentId, not a free
  name; health-check `GET /api/health` before blaming load.

**Codex note:** presence, comms, and tasks all pick up `CODEX_THREAD_ID`
automatically, so the same `office-*.mjs` commands work without extra flags.

## What not to commit

`data/`, `public/knowledge/`, and `public/transcripts/` are git-ignored: they
hold live runtime state, ingested project docs, and session transcripts — all
machine-local and potentially private. Keep them out of any fork you publish.
