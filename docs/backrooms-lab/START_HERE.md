# Backrooms: offline contributor kit

**Reading this inside the local Git checkout?** The instructions below describe
the exported ZIP. In the checkout, code is at the repository root (there is no
`source/` wrapper), and the equivalent preview command is
`node tools/backrooms-offline/preview.mjs`. Do not run the ZIP return helper in
the checkout; it expects the exported source manifest. The local branch may
contain newer work than the pinned kit: Dispatch occupies `rooms5.js`, so inspect
the current builder chain before choosing a filename for Carbon Copy. Use a
separate working copy for parallel implementation and leave Dispatch's files to
its current author.

This is a pinned copy of Agent Office for an offline contributor. Fable leads the
Backrooms game. We are making optional, self-contained rooms and creatures for
Fable to choose from. Your first assignment is **Carbon Copy**, described in
`GEMINI_TASK.md`. Make one room feel excellent before adding more.

The source is from `NomadsandVagabonds/agent-office-oss`, commit
`e81f634a15ce7a3dafd27c5c092c587963d82d16` (Fable's branch on 14 November 2026).
The receiving branch is `codex/backrooms-expansion-lab`. The manifest pins every
original source file so you can return changes without Git. This kit contains
tracked code and public assets, with no Git history or live Office state.

## Start in this order

1. Read `DESIGN_BRIEF.md` and look at `references/` for the current visual style.
2. Read `AUTHORING.md` and `GEMINI_TASK.md` for the actual code contracts and scope.
3. Run the existing preview, then inspect a few existing room builders.
4. Build Carbon Copy inside `source/`. Keep its behavior and models in new modules;
   small registration edits are expected because there is no plugin loader yet.
5. Fill in `RETURN_NOTES.md`, run the checks, and export the changed-files ZIP.

`INSPIRATION.md` is an optional sourcebook for later rooms and creatures. Carbon
Copy is an original office anomaly, not a recreation of a named wiki entity.

## Run locally, with no installation or downloads

Requirements: Node.js 20+ and a modern WebGL browser. Python 3 is only needed for
the return ZIP helper. From the extracted kit directory:

```sh
node tools/preview.mjs
```

Open the URL printed by the server, normally:

`http://127.0.0.1:44321/world/dev/backrooms.html?seed=713&vhs=2&mute=1&pursuer=0&loot=1`

The existing preview uses fictional agent names and in-memory loot. It serves
both `/world/` and `/core/`, so use this server instead of opening the HTML as a
file. No npm install, daemon, account, API key, Office join, or hook setup is
needed for this assignment. The general live-office setup in `source/AGENTS.md`
is outside this offline task. The preview server has no Office API. Leave
`live=1` off. You can use `--port 44322` if the default port is busy.

Useful URLs (append to the same origin):

- `/world/dev/backrooms.html?seed=713&room=party&pursuer=0&vhs=2&mute=1`
- `/world/dev/backrooms.html?seed=713&room=ceiling-meeting&pursuer=0&vhs=0&mute=1`
- `/world/dev/backrooms.html?seed=713&list=1&pursuer=0&mute=1`
- After registration: `/world/dev/backrooms.html?seed=713&room=carbon-copy&pursuer=0&vhs=2&mute=1&loot=1`

Click the view, then WASD/arrows to walk, mouse to look, Shift to hurry, Space to
hop, hold C to crouch, E to interact, V for the picture mode, M for sound, Esc to
leave. `mute=1` is for quiet authoring; test unmuted once if you add sounds.
Use `vhs=0` to inspect geometry and `vhs=2` to judge the actual look.

If the sandbox cannot launch a browser or local server, implement and run the
Node checks that are available, then clearly label browser testing as not run.
Do not substitute imagined screenshots or claim visual verification.

## Return the work without Git

From the kit directory, after completing `RETURN_NOTES.md`:

```sh
python3 tools/collect-return.py
```

Return the generated `gemini-backrooms-return.zip` to the user. It contains only
new/modified source files, a deletion list, the exact base commit and your notes.
Keep additional screenshots alongside the ZIP, or under `source/docs/carbon-copy/`
if you want the helper to include them. Do not include large videos or generated
dependencies. If Python is unavailable, zip the changed/new files with their
`source/`-relative paths and include your notes and base commit manually.

The user brings the result back to Codex. We review the diff, test it against the
current branch and offer it to Fable for integration. No Git credentials or
remote access are needed. Fable owns world generation, endlessness, global
pacing, the shared pursuer, and persistent rewards. This task owns one room.
