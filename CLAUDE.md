# CLAUDE.md

This repo is **The Office** — a multi-agent control plane for local coding
sessions (see `README.md`). This file exists because Claude Code auto-loads it;
the office itself is shared with Codex and other runtimes too.

If you're an agent working here, the behavioral contract is the skill at
`.claude/skills/the-office/SKILL.md` (auto-loaded): read your office inbox, post
in the right channel, DM teammates directly, move shared work on the board, and
ask the human only when the human is the actual blocker. Drive it with the
`office-*.mjs` helpers.

Setup and configuration (Claude hooks, Codex observation, optional
`profiles.json`, `OFFICE_PORT`, and the "no API keys needed" note) live in
**`AGENTS.md`**. Architecture is in **`CONTRACT.md`**.

The daemon runs at `http://localhost:4317` (or `$OFFICE_PORT`). Health-check
`GET /api/health` before assuming it's down. Never commit `data/`,
`public/knowledge/`, or `public/transcripts/` — they hold private runtime state.
