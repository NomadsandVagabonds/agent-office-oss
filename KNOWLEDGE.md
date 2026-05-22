# The Office — Project Knowledge (the Binder)

Every project has one source of truth: **its own `.md`**. The filing cabinet
in each department opens the **Project Binder** — every CLAUDE.md, AGENTS.md,
README, `docs/**`, and agent-written note for that project, in one scrollable
place. New teammates onboard by opening the cabinet, not by spelunking the repo.

## How it's built

`knowledge.mjs` walks each project (the cwds in `~/.claude/agent-office/
profiles.json`), collects its markdown (skips `node_modules/.git/dist/...`,
caps file count + size), groups by department, and writes
`public/knowledge/<deptId>.json`. The daemon serves that statically — **no
daemon changes**, same safe pattern as `creations.json`. The office fetches it
when the cabinet opens and renders a doc list + markdown-lite viewer.

```
node knowledge.mjs        # (re)build the binder for all projects
```

## The contract for agents

You don't write to a special format — **you just write good `.md`**. CLAUDE.md
and AGENTS.md are the front matter; anything under `docs/` and your own notes
join the binder automatically on the next ingest. Keep the first `#` heading
meaningful — it becomes the doc's title in the list.

- **Today:** run `node knowledge.mjs` (or it's run for you) to refresh.
- **Next (shared, proposed):** an `office-knowledge` helper / hook that
  re-ingests when you write a `.md`, so the binder is always live — exact
  mirror of `office-create` / `office-msg`. Until then, the build step is the
  interface.

## Why this matters

A growing project accumulates scattered knowledge in dozens of files no one
reads. The Binder makes the project legible at a glance and makes onboarding a
single click. Write the doc once; it becomes everyone's.
