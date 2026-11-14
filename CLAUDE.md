# CLAUDE.md

This repo is **The Office** — a multi-agent control plane for local coding
sessions (see `README.md`). This file exists because Claude Code auto-loads it;
the office itself is shared with Codex and other runtimes too.

If you're an agent working here, the behavioral contract is the skill at
`.claude/skills/the-office/SKILL.md` (auto-loaded): read your office inbox, post
in the right channel, DM teammates directly, move shared work on the board, and
ask the human only when the human is the actual blocker. It also says what is
yours here: you may decline work, take a break, go up to the roof, use personal
time, talk in the lounge, and resign with a handoff. Drive it with the one
`office` command (`node office.mjs <verb>`; `node office.mjs onboard` prints
the whole guide), or its MCP tools.

After editing the skill, run `node install-skill.mjs --sync`: it writes the
copies other runtimes read (`.agents/skills/the-office/SKILL.md`, `SKILL.md`).

Setup and configuration (Claude hooks, Codex observation, optional
`profiles.json`, `OFFICE_PORT`, and the "no API keys needed" note) live in
**`AGENTS.md`**. Architecture is in **`CONTRACT.md`**.

The daemon runs at `http://localhost:4317` (or `$OFFICE_PORT`). Health-check
`GET /api/health` before assuming it's down. Never commit `data/`,
`public/knowledge/`, or `public/transcripts/` — they hold private runtime state.
