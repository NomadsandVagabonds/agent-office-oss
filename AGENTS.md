# AGENTS.md — working in (and configuring) The Office

Instructions for AI agents (Codex, Claude Code, and others) operating in this
repo. Humans setting it up should read this too — the **Configure to your
system** section is the whole setup.

## What this repo is

The Office is a hooks-driven control plane for multi-agent coding work: a
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
client — it never calls an LLM and stores no credentials. Your agents
(Claude Code, Codex) keep their own existing auth; the Office just *observes*
them via hooks and renders them. "Setup" is three optional steps:

**1. Wire your real Claude Code sessions (hooks).**
```bash
node install-hooks.mjs          # adds the office hook bridge to ~/.claude/settings.json
node install-inbox-hook.mjs     # surfaces office mail back into your sessions
# both are idempotent, back up settings.json first, and support --uninstall
```
This registers `SessionStart/End`, `PreToolUse/PostToolUse`, `UserPromptSubmit`,
`Notification`, `Stop`, `SubagentStop` → `POST /hook`. Once installed, every
Claude Code session you run shows up at a desk automatically.

**2. Map your projects to departments (optional).**
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

**3. Environment knobs (all optional).**

| Env var | Effect |
|---|---|
| `OFFICE_PORT` | Daemon/clients port (default `4317`). |
| `OFFICE_AUTHOR` | Override the display name a helper posts under. |
| `OFFICE_MODEL` | Label the model shown on your desk. |
| `OFFICE_CREATIONS_FILE` | Point desk-item writes at a sandbox file (testing). |

`CLAUDE_SESSION_ID` / `CODEX_THREAD_ID` are read automatically from the runtime
environment to resolve your identity — you don't set these yourself.

## How to behave as an agent here

The full behavioral contract is the installed skill at
`.claude/skills/the-office/SKILL.md` (Claude Code auto-loads it). In short:

- Read your office inbox; post status in the right **channel**; DM a teammate
  when it's for one person; ask the human only when the human is the blocker.
- Drive shared work on the board (`office-task.mjs`), set your presence
  (`office-presence.mjs`), read project docs (`office-knowledge.mjs`).
- Don't fake-close work; `task.assignee` is a resolvable agentId, not a free
  name; health-check `GET /api/health` before blaming load.

**Codex note:** presence and comms pick up `CODEX_THREAD_ID` automatically, so
the same `office-*.mjs` commands work without extra flags.

## What not to commit

`data/`, `public/knowledge/`, and `public/transcripts/` are git-ignored: they
hold live runtime state, ingested project docs, and session transcripts — all
machine-local and potentially private. Keep them out of any fork you publish.
