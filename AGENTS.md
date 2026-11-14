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

**Several agents in one repository (optional).** The office already notices
when two agents edit the same file and tells them both. To have Claude Code ask
*before* each edit:
```bash
node install-guard-hook.mjs     # or: npm run install-guard
```
Just before an `Edit`/`Write`, the agent is told if somebody else edited that
file in the last half hour, changed it on another branch, or claimed it. It is
context for the agent, said once per file and person; it never blocks an edit,
never prompts you, and stays silent if the office is not running. Same
discipline as the other installers: a backup first, idempotent, `--uninstall`.

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

**Driven sessions and delegation (optional).** The office can also *run* an
agent itself, as a child process speaking a structured protocol, instead of
watching one you started. Then its permission prompts become NEEDS-YOU requests
with real allow / reject actions, what it does is a transcript, a teammate's
note can start its next turn (if you opt that session in), and agents can hand
each other tasks. Nothing to configure for agents that are already installed
and signed in — `office runtimes` (or `GET /api/harness`) lists what can be
started here:

| adapter | needs on `PATH` | protocol |
|---|---|---|
| `codex` | `codex` | Codex app-server |
| `gemini` | `gemini` | ACP (`gemini --acp`) |
| `opencode` | `opencode` | ACP (`opencode acp`) |
| `claude` | `claude` | its own stream-json mode: the CLI itself, no wrapper |
| `claude-acp` | `claude-agent-acp` (`npm i -g @agentclientprotocol/claude-agent-acp`) | ACP, for when Claude's own mode is not wanted |
| `codex-acp` | `codex-acp` | ACP |

Any other agent that speaks ACP is one entry in
`~/.claude/agent-office/harness.json` (or `$OFFICE_HARNESS_FILE`):
```json
{ "adapters": [ { "id": "goose", "label": "Goose", "protocol": "acp", "command": "goose", "args": ["acp"] } ] }
```
The office only runs what is already installed (it never downloads an agent),
each agent keeps its own login, and every launched agent is handed the office's
MCP tools automatically. Start one from the office, or:
```bash
curl -s -X POST localhost:4317/api/harness/sessions -H 'content-type: application/json' \
  -d '{"adapter":"gemini","cwd":"/abs/path/to/repo","mode":"ask","wake":"off"}'
```
`mode` is how much it may do without asking (`ask` · `edits` · `full`); `wake`
is whether office mail may start a turn for it (`off` · `results` · `direct`).
The design, the guard rails and **what has so far only been verified against
fake agents** are in `docs/HARNESS.md` — read its section 16 before relying on
a real CLI.

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
| `OFFICE_HARNESS=0` / `OFFICE_DELEGATE=0` | Switch off driven sessions / delegation between agents. |
| `OFFICE_HARNESS_FILE` | Your own adapter entries (default `~/.claude/agent-office/harness.json`). |
| `OFFICE_HARNESS_MAX_SESSIONS` | How many agents the office drives at once (default `8`). |
| `OFFICE_HARNESS_MCP=0` | Do not hand launched agents the office MCP tools. |
| `OFFICE_HARNESS_TRACE=1` | Keep the raw protocol frames beside each transcript (debugging a real CLI). |
| `OFFICE_WAKE_DEFAULT` | `off` (default) · `results` · `direct`: whether mail may start a turn for a new driven session. |
| `OFFICE_WAKE_MAX_HOPS` / `OFFICE_WAKE_MAX_PER_HOUR` / `OFFICE_WAKE_BUDGET` | Guard rails on turns the office starts by itself (defaults `3` / `12` / `20`). |
| `OFFICE_DELEGATE_MAX_MODE` | The broadest mode delegated work may run with (default `ask`). |
| `OFFICE_GIT=0` | Do not read git at all. (The office only ever reads: branch, status, changed files.) |
| `OFFICE_GIT_EVERY_MS` | How often each checkout is looked at (default `20000`). |
| `OFFICE_OVERLAP_NOTES=0` | Notice overlaps but do not write to the agents about them. |
| `OFFICE_WORKTREE_DIR` | Where `office worktree` puts new checkouts (default: `<repo>.worktrees/` beside the repository). |
| `OFFICE_USAGE_OPENROUTER=1` | Ask OpenRouter how much credit `OPENROUTER_API_KEY` has left. Off by default; nothing else is ever asked of a provider. |

The full list, with what each guard rail does, is in `docs/HARNESS.md` §14.

Agent side (the `office` CLI, the MCP server, the helpers):

| Env var | Effect |
|---|---|
| `OFFICE_URL` | Where the office is (default `http://127.0.0.1:$OFFICE_PORT`). |
| `OFFICE_TOKEN` | The token, when the office is on another machine. |
| `OFFICE_AGENT_ID` | Pin your identity (otherwise taken from `CODEX_THREAD_ID` / `CLAUDE_SESSION_ID`, or remembered per folder). |
| `OFFICE_PROVIDER` / `OFFICE_MODEL` / `OFFICE_AUTHOR` | How you are labelled. |
| `OFFICE_SESSION_TOKEN` | Set by the office for an agent it launched; tells the office which session is calling. Never set it yourself. |

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
- When a piece of work belongs with another agent or another provider, hand it
  over instead of asking the human to relay it: `office delegate <adapter|agent|any>
  <task>` starts (or wakes) an agent with the task and brings the result back
  to your inbox; `office delegation <id>` follows it, `office transcript <agent>`
  shows the full work. Permission requests always go to the human — never try
  to answer one for another agent.
- Work that needs a second eye goes to `review`: the card then carries the
  branch and commit you put up. Reviewers record findings
  (`office task finding`) and recommend; the human gives the verdict.
- Several agents in one repository step on each other. `office repo` says who
  shares your checkout; `office touching <path>` says whether somebody else is
  in a file; `office claim` / `office worktree` keep you apart. When the office
  tells you that you and another agent overlap, sort it out with them directly.
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
- **Tests never run a real agent.** The harness is tested against the fake
  agents in `test/fixtures/` (they speak ACP, Codex's app-server protocol and
  Claude Code's stream-json from the agent's side), so no test spends anyone's tokens. Keep it that way,
  and say in `docs/HARNESS.md` §16 what a change has only met fakes for.

## What not to commit

`data/`, `public/knowledge/`, and `public/transcripts/` are git-ignored: they
hold live runtime state, ingested project docs, and session transcripts — all
machine-local and potentially private. Keep them out of any fork you publish.
