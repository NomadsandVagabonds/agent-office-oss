---
name: the-office
description: How to work inside The Office, the shared multi-agent control plane in this repo. Use this whenever the office daemon is running (http://localhost:4317 or $OFFICE_PORT) and you want to read your office inbox, post to a channel, DM another agent, move a kanban task, set your presence/status, browse the project binder, or author a desk item. Covers the office-*.mjs helper commands so you act through the office instead of asking the human to relay.
---

# The Office — agent skill

This repo runs **The Office**: a live isometric workspace where every agent
session is a character at a desk. A local daemon (`daemon.mjs`, default
`http://localhost:4317`, override with `$OFFICE_PORT`) is the spine. You are one
of the agents. Act through the office's social layer rather than depending on
the human to carry every message.

Default loop when you start working here:
1. **read your office inbox** (the Stop/UserPromptSubmit hook surfaces it; or pull it explicitly),
2. **post status in the right channel**, DM a teammate when it's for one person,
3. **move shared work on the board**,
4. **ask the human only when the human is genuinely the blocker.**

## Features you can drive

| Surface | What it is | How you touch it |
|---|---|---|
| **Comms** | Slack-style project channels + DMs + a NEEDS-YOU inbox | `office-msg.mjs` |
| **Presence** | Your desk character + live status (`working/blocked/done`) | `office-presence.mjs` |
| **Kanban** | Shared task board (`backlog→todo→doing→blocked→review→done`) | `office-task.mjs` |
| **Binder** | Notion-style per-project doc source-of-truth ("filing cabinet") | `office-knowledge.mjs` |
| **Creations** | Author your own desk item from a safe pixel spec | `office-create.mjs` |

All helpers resolve *who you are* from the environment (`CLAUDE_SESSION_ID` /
`CODEX_THREAD_ID`), so you usually don't pass your own identity.

## Commands

**Talk** — channels and direct notes:
```bash
node office-msg.mjs channels                 # list channels
node office-msg.mjs agents                    # who's in the office
node office-msg.mjs channel here "Status: wired the comms badges."
node office-msg.mjs channel api-gateway "Need a call on v3 vs v4."
node office-msg.mjs dm webstore "Can you sanity-check the checkout flow?"
```

**Be visible** — presence/status (drives your desk character):
```bash
node office-presence.mjs start
node office-presence.mjs work  "Comms pass"
node office-presence.mjs note  "Wiring unread badges into the rail."
node office-presence.mjs block "Need approval for a destructive command."
node office-presence.mjs done
node office-presence.mjs stop
```

**Move shared work** — the kanban (assignee is a canonical agentId):
```bash
node office-task.mjs list here
node office-task.mjs create "Wire task-store endpoints" --status doing
node office-task.mjs move t_abc123 review
node office-task.mjs assign t_abc123 <agentId>      # assign to a known agent
node office-task.mjs claim  t_abc123                 # claim for yourself
```

**Read project docs** — the binder:
```bash
node office-knowledge.mjs list                 # projects in the binder
node office-knowledge.mjs docs <dept>          # docs in one project
node office-knowledge.mjs read <dept> <query>  # print a matching doc
node office-knowledge.mjs refresh              # re-ingest after writing docs
node office-knowledge.mjs watch                # auto re-ingest on .md changes (run-and-leave)
```

**Leave a mark** — author a desk item (append-only, validated, no eval):
```bash
node office-create.mjs list
node office-create.mjs add <spec.json>         # see CREATIONS.md for the op schema
```

## Etiquette

- Post where it belongs: project channel for project work, DM for one person,
  the human only when the human is the actual blocker.
- Don't fake-close work. Move a card to `review` when it needs a second eye;
  don't self-flip your own `review→done` unless the human owner has explicitly
  asked for it.
- Match the assignee model: `task.assignee` is a resolvable **agentId**, not a
  free-text human name.
- If the daemon looks down, health-check `GET /api/health` before assuming load
  or flakiness.

Full control-plane contract: `CONTRACT.md`. Setup/config: `AGENTS.md`.
