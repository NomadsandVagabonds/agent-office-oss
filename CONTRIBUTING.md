# Contributing to The Office

Thanks for being here. The Office is a small, hackable, **zero-dependency**
project — it's meant to be easy to read, run, and extend. This guide gets you
from clone to PR.

## Run it locally

Requires **Node 18+**. No `npm install` — there are no dependencies (p5 is
vendored in `public/`).

```bash
npm run demo      # daemon + a fictional demo office, then open http://localhost:4317/
npm run doctor    # check Node / tmux / Claude / Codex / hooks / daemon
```

`npm run dev` runs just the daemon; `npm run simulate` just the fictional roster.
See the [README](README.md) for the full tour and [AGENTS.md](AGENTS.md) for
configuring it to your own sessions.

## How it's built (read this before a non-trivial PR)

The whole design is **one typed spine, many clients** — see
[`CONTRACT.md`](CONTRACT.md). The short version:

- **`daemon.mjs` is the only spine.** It ingests hooks, holds the session
  registry, broadcasts a WebSocket bus, and serves the office + the
  kanban/comms/knowledge APIs.
- Everything else is a **client** (`public/index.html`), a **producer**
  (`observe.mjs`, `simulate.mjs`, hooks), a **store** (`*-store.mjs`), or an
  **agent helper** (`office-*.mjs`).
- **No client talks to a runtime directly** — only through
  `runtime-manager.mjs`.
- The bus is **additive only**: add new event *types*, never rename existing
  ones, so older clients keep working.
- Shared types (the `Task` shape, status vocabulary, bus event names) are frozen
  in `core/contract.mjs`. Import the names from there; don't redefine them.

## Conventions

- **Stay zero-dependency.** Vendored, offline-first, no CDN at runtime. A PR that
  adds an npm dependency needs a strong reason — open an issue first.
- **ESM, `.mjs`, Node built-ins only.** Match the surrounding style; the code is
  deliberately terse and comment-light where it's obvious, denser where it isn't.
- **No daemon edits for new surfaces where avoidable.** Several features
  (`creations.json`, the knowledge binder) ride static files the daemon already
  serves — prefer that pattern.
- **Capability-honest UI.** Never render a control a runtime can't honor (see the
  `CAPS` table in `CONTRACT.md`). Don't show a "stop" button on a session the
  daemon doesn't own.

## Extending the office (good starting points)

- **A desk item / creation** — append a declarative pixel spec; see
  [`CREATIONS.md`](CREATIONS.md) for the op schema. No code, no `eval`.
- **A runtime adapter** — add an entry to `RUNTIMES[]` in `runtime-manager.mjs`
  and declare its capabilities in `core/contract.mjs` `CAPS`.
- **A theme color / department** — see "Customize it" in the README and
  `profiles.json`.

## Privacy rule (important)

The Office *observes* your sessions and *ingests* your project docs, so some
directories hold real, private content. **Never commit:**

- `data/` — runtime state (board, messages, sessions)
- `public/knowledge/` — ingested project docs
- `public/transcripts/` — session transcripts

They're git-ignored and ship as empty `.gitkeep` skeletons. If you add a feature
that writes machine-local or session data, git-ignore its output too, and never
hardcode a personal path, real name, or session id.

## Submitting a PR

1. Branch from `main`.
2. Keep it focused — small PRs review faster.
3. Run `npm run doctor` and sanity-check `npm run demo` still boots.
4. If you touched the rendering, include a screenshot.
5. Describe **what** changed and **why**; link the issue if there is one.

No CLA, no ceremony. Be kind in reviews. Open an issue if you're unsure whether
something's wanted — happy to talk it through before you build.
