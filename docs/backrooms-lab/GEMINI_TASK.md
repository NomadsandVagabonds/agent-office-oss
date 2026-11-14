# Gemini starter task: Carbon Copy

Build one polished, playable **optional Backrooms room** in the supplied source snapshot. Read `DESIGN_BRIEF.md` beside this file first. Fable is the lead integrator; your deliverable is a candidate room and a small reviewable patch. This task does not authorize publishing, contacting other agents, connecting to the live office, changing live state or sending anything externally. Return your work to the person who gave you the package. Git access, commits and a pull request are not required.

## The encounter

**Carbon Copy** looks like a tired office print room. Most equipment is silent. One ordinary printer has a warm indicator, an output tray and a small scattering of folded scraps. Preserve enough empty carpet and shadow for the room to feel quiet.

1. Approaching the working printer exposes the normal short `print` interaction. Pressing **E** starts a restrained printer sound and a visible paper-feed motion.
2. A small folded-paper creature comes out. Give the paper a legible sequence: a flat or compressed sheet, a pause, then an unfolding into a blocky little animal-like form. Its design is original, made from cream paper planes or voxel slabs, dark fold edges and perhaps a staple. No smooth imported monster model or cartoon face is needed.
3. The creature pauses to orient toward the player. It is **neutral**: it never damages, catches, blocks or penalizes them. A close approach makes it recoil and skitter to a safe patch or paper nest; giving it space lets it cautiously emerge again.
4. The player can leave at any time. A later print can vary one small detail, such as fold posture or paper shade. Bound the number of live creatures and output scraps; repeated E presses must not build an unlimited pile of meshes or stack conflicting animations.

The fun should be apparent without a sign explaining it. Aim for the moment when a familiar printer produces something that quietly decides to leave. Use the actual office printer as the visual starting point; if its output or moving parts need a small companion model, keep the original silhouette recognizable. Use existing synthesized foley rather than downloading audio.

## Scope and technical shape

- Add the room builder in `rooms5.js`, with a single-line `MORE4` export as shown in `AUTHORING.md`, so the existing registration test can discover it. A separate model/behavior module such as `paper-creature.js` is optional.
- Make only the minimal registration edits needed in `gen.js` and the current `BUILDERS` export chain. Use an archetype id of `carbon-copy`. Follow the real descriptor and context APIs; do not invent a plugin loader or rewrite generation.
- Supply a clear `STASH['carbon-copy']` region for existing coin placement, as required for every archetype. This describes safe floor space; it does not add a new reward or change persistence.
- Roll layout and appearance choices deterministically from the existing seeded random source. Keep the room readable across its declared width/depth range and rotation. A small family of intentional variants is enough.
- Use the existing voxel catalogue, `Batch`, baked lighting and disposal conventions. Animation should preserve obvious folded-paper construction. Prefer a few moving pieces over many independent meshes.
- Use `c.use()` and `c.tick()` for the encounter. Reserve space around the printer and every doorway. Keep the player route clear before, during and after printing. The paper creature must stay on reachable floor in its room and must not pass through solid furniture or wander into other rooms.
- Make state changes and repeated interaction reliable: printing, emerging, idle, startled, retreating and ready again should not conflict. Do not start another print while the printer is busy; expose that through the existing interaction predicate rather than a new message overlay.
- Do not alter coins, keycards, banking, progression, the main pursuer, player controls, exit rules or the normal presentation. No new dependency installation, downloaded assets or external service is needed.

The source bundle is editable so you can complete and preview the room end to end. Small development-page adjustments are allowed if necessary, but list them separately from the candidate room's required integration edits. Do not change production behavior simply to make an inspection screenshot easier.

## Preview and verification

Use the offline preview instructions supplied with the package. The browser needs `public/` served at the site root and the repository's `core/` modules available at `/core/`. Serving only `public/` with a generic static server is not enough. All Three.js code is vendored. The existing development page supplies fictional office state; **omit `live=1`**.

After registering the room, use the existing page on your local preview origin:

```text
/world/dev/backrooms.html?seed=7&room=carbon-copy&pursuer=0&vhs=2
/world/dev/backrooms.html?seed=29&room=carbon-copy&pursuer=0&vhs=0
/world/dev/backrooms.html?seed=101&room=carbon-copy&pursuer=0&vhs=2
```

Controls are WASD/arrows, mouse look, Shift to hurry, Space to hop, held C to crouch, E to use, V to change picture treatment, M to mute and Esc to leave. Click the view if pointer capture needs a user gesture. `window.__backrooms` is the existing debug handle; its `goto()`, `where()`, `level` and `world` can help inspect placements.

Check the following and report what you actually observed:

- The intended room builds in several seeds and remains recognizably part of this Backrooms, in both VHS and clean views. Capture an establishing view and the creature encounter if your environment supports it.
- All connected doorways remain reachable during every encounter state. The creature respects furniture and room boundaries. There are no builder-fallback or disabled-furniture warnings hiding a placement error.
- Printing, approaching, backing away and printing again work repeatedly. Rapid E input does not duplicate jobs. Leaving and revisiting the room does not strand its state.
- No new console errors, sustained unbounded object growth or abandoned resources after leaving the level. Check more than one visit if the environment permits it.
- Run the existing Backrooms test when included: `node --test test/backrooms.test.mjs`. If you have the full repository, also run its required `npm test` before declaring the change ready for integration. Add focused automated coverage only for meaningful new state or geometry logic; do not replace hands-on visual checks with tests that merely mirror your code.

If a browser, dependency, file or test runner is missing, explain the limitation and return the source anyway. Separate verified results from assumptions. Do not claim a playtest, screenshot or passing test that you could not perform.

## Return package

Return **only new/changed files with their repository-relative paths**, or a unified diff plus the new files. Do not return a full copy of the repository, runtime data, transcripts, credentials or generated dependency folders. Include:

- A short change manifest listing each file, why it changed, which edits are required for integration, and any preview-only edits.
- The base snapshot (`e81f634`), preview URLs/seeds, test commands and their observed results, and remaining limitations.
- A source/assumptions manifest: original models you made, existing assets reused, outside references if any, licenses for any added asset, and important implementation assumptions. State explicitly if there were no third-party assets.
- A brief account of the creature's behavior, the resource/count limit, how movement stays clear of obstacles, and how resources are disposed.

Suggested filenames are `CHANGE_MANIFEST.md` and `SOURCES_AND_ASSUMPTIONS.md`. Screenshots may accompany the response as review evidence; do not add large binaries to source control. Fable will decide whether and how to incorporate the candidate. A finished handoff is a playable, understandable contribution with honest evidence, not a claim that it has shipped.
