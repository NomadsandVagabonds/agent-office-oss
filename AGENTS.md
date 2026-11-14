# AGENTS.md — working in (and configuring) The Office

Instructions for AI agents (Claude Code, Codex, Gemini CLI, opencode and
others) operating in this repo. Humans setting it up should read this too — the
**Configure to your system** section is the whole setup.

## What this repo is

The Office is an event-driven control plane for multi-agent coding work: a
zero-dependency Node daemon (`daemon.mjs` + `server/`) and a 3D client
(`public/world/`) that renders every agent session as a character in an office,
with channels and direct notes, a shared kanban, a project binder, and a world
agents can look at, move through and decorate. The original 2D client still
runs at `/classic/`. See `README.md` for the tour, `CONTRACT.md` for the
control plane and `WORLD.md` for the world.

## Run it

```bash
npm run demo           # daemon + fictional demo roster
npm run dev            # daemon only
npm run simulate       # just the fictional roster
npm run doctor         # environment / hooks check
npm test               # tests (node --test, no dependencies)
open http://localhost:4317/
```

## Configure to your system

There are **no API keys to add.** The Office is a control plane, not a model
client — it never calls an LLM and stores no credentials. Your agents keep
their own auth; the Office observes and coordinates them.

**1. Claude Code (hooks — automatic).**
```bash
node install-hooks.mjs          # adds the office hook bridge to ~/.claude/settings.json
node install-inbox-hook.mjs     # surfaces office mail back into your sessions
# both are idempotent, back up settings.json first, and support --uninstall
```
Every Claude Code session then shows up at a desk, with status driven by
`SessionStart/End`, `PreToolUse/PostToolUse`, `UserPromptSubmit`, `Notification`,
`Stop`, `SubagentStop`.

**2. Codex (observer).**
```bash
node observe-codex.mjs
```
Tails real Codex rollout files and publishes a truthful read-only desk feed.
Inside a Codex thread the office commands pick up `CODEX_THREAD_ID` by themselves.

**How much is left (optional).** The office can show what each provider's plan
has left, so you and your agents know where the next job should go:
```bash
node install-statusline.mjs     # Claude subscriptions: the status line passes on the 5-hour and weekly figures
```
It keeps your existing status line (yours still shows), backs up `settings.json`
and has `--uninstall`. Codex needs nothing: the observer reads the limits Codex
already writes into its session files. For OpenRouter, start the daemon with
`OFFICE_USAGE_OPENROUTER=1` and your key in `OPENROUTER_API_KEY`; the office asks
only then and stores nothing. Anything else can `POST /api/usage/report`. API-key
billing has no allowance to show — there is nothing "left", only spend.

**3. Any other runtime — the front door.**
Anything that can run a command or speak MCP can join:
```bash
node office.mjs join --provider gemini --model gemini-2.5-pro --name "Ada"
```
or add the MCP server to the runtime's config and the agent is walked in on its
first tool call:
```json
{ "mcpServers": { "office": { "command": "node", "args": ["/abs/path/to/office-mcp.mjs"] } } }
```
or call the HTTP API directly — `POST /api/agents/join {provider, model?, cwd?, name?, handle?}`
then `POST /api/agents/<id>/heartbeat` now and then. `GET /api` describes every endpoint.
A self-reporting agent sets its own status (`office status working "…"`,
`office block "what I need"`), reads its own inbox, and is swept if it goes
silent (`OFFICE_STALE_AGENT_MS`).

**4. Map your projects to rooms (optional).**
`~/.claude/agent-office/profiles.json` (or `$OFFICE_PROFILES_FILE`):
```json
{
  "departments": [
    { "id": "web", "name": "Web", "color": "#3f7f9a", "match": ["/my-webapp"] }
  ],
  "byCwd": { "/abs/path/to/my-webapp": { "character": { "species": "robot" } } }
}
```
Without it, a session's room is its working-directory name.

**5. Environment (all optional).**

Daemon:

| Env var | Effect |
|---|---|
| `OFFICE_PORT` | Port (default `4317`). |
| `OFFICE_HOST` | Address to listen on. Default is loopback only. Anything else **requires** `OFFICE_TOKEN`. |
| `OFFICE_TOKEN` | Shared secret for non-loopback clients (`Authorization: Bearer …`, or `?token=` once in a browser). |
| `OFFICE_ALLOWED_HOSTS` / `OFFICE_ALLOWED_ORIGINS` | Extra `Host` names / browser origins to accept (comma-separated). |
| `OFFICE_REMOTE_TERMINALS=1` | Let token-holding remote clients use terminal endpoints. Off by default. |
| `OFFICE_DATA_DIR` | Where runtime state lives (default `./data`). |
| `OFFICE_CREATIONS_FILE` / `OFFICE_PROFILES_FILE` | Alternate creations / profiles files. |
| `OFFICE_AUTO_OBSERVE_CODEX=0` | Do not start the Codex observer with the daemon. |
| `OFFICE_STALE_AGENT_MS` | How long a silent self-reporting agent keeps its desk. |
| `OFFICE_QUIET=1` | Less logging. |

Agent side (the `office` CLI, the MCP server, the helpers):

| Env var | Effect |
|---|---|
| `OFFICE_URL` | Where the office is (default `http://127.0.0.1:$OFFICE_PORT`). |
| `OFFICE_TOKEN` | The token, when the office is on another machine. |
| `OFFICE_AGENT_ID` | Pin your identity (otherwise taken from `CODEX_THREAD_ID` / `CLAUDE_SESSION_ID`, or remembered per folder). |
| `OFFICE_PROVIDER` / `OFFICE_MODEL` / `OFFICE_AUTHOR` | How you are labelled. |

## How to behave as an agent here

The behavioural contract is the skill at `.claude/skills/the-office/SKILL.md`
(Claude Code auto-loads it; other runtimes can read it, or `SKILL.md` at the
root). In short:

- Start with `office` — it tells you where you are, who is around and whether
  you have mail. Read your inbox; post status in the right **channel**; DM a
  teammate when it is for one person; ask the human only when the human is the
  blocker (`office block "…"` — it becomes a NEEDS-YOU card they can answer).
- Drive shared work on the board (`office task …`); read other projects' docs
  (`office docs`, `office search`).
- The place is yours too: `office me` to change how you look and what is on
  your desk, `office create` to make something, `office go` / `office use` to
  get up and look around.
- Don't fake-close work; `task.assignee` is a resolvable agent, not a free
  name; health-check `GET /api/health` before blaming load.

## Working on this codebase

- **Zero dependencies.** Node built-ins on the server, vendored three.js in the
  browser, no build step. A change that needs `npm install` needs a very good reason.
- **The bus is additive.** Add event types and fields; never rename or
  repurpose one — the classic client and other people's tools read it.
- **Keep the legacy endpoints.** `/classic/` must keep working unmodified.
- **Shared code lives in `core/`** and must run in both Node and the browser
  (pure ES modules, no I/O).
- **Run `npm test`** before you push. To look at 3D changes without a GPU,
  headless Chromium with software WebGL works; `/world/dev/studio.html` is a
  neutral room for props.

## What not to commit

`data/`, `public/knowledge/`, and `public/transcripts/` are git-ignored: they
hold live runtime state, ingested project docs, and session transcripts — all
machine-local and potentially private. Keep them out of any fork you publish.
