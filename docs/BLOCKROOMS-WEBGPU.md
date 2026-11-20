# BlockRooms on WebGPU

The plan for moving BlockRooms from three.js's `WebGLRenderer` to `WebGPURenderer`. The new renderer uses node
materials, written in TSL. This is task R-5 of the Steam plan, D3 Rendering (`docs/BLOCKROOMS-STEAM-PLAN.md` on
`claude/backrooms-cast`). It is also the ground the Ultra tier (R-3) and "light that behaves" (R-4) can be built on.

**Status (Steps 1–6 complete + GPU/WGSL optimization pass landed — ready for lead review):**
- **WebGPU is the renderer for everybody since 20 Nov** (the owner's word; see "WebGPU for everybody, and the graphics screen" below). `?gpu=webgl` is the escape hatch. Before that it was opt-in (`?gpu=webgpu`). There is also a live side-by-side split-wipe showcase at `/world/dev/webgpu-demo.html`.
- **Phase 1 (done):** the switch, room surface Classic core (`kit.js` / `kit-node.js`), voxel material (`vox/material.js`), and camcorder at Classic (`vhs.js` / `vhs-node.js`).
- **Step 2 (done):** composable `patchNode` hooks on `kit-node.js`, `kit.points` instanced quads (`the-grotto` snow), held-item `depthNode` sliver (`setHeldInFront` on `hand.js` + `hand-notes.js`), `pool-optics.js`, all Classic room shader patches, `spray.js`, `inventory-fire.js`, `forest-fx.js`, `forest-maze.js`, and WebGPU-safe `the-sets` CCTV feed (`THREE.RenderTarget` with MRT/liquid guard).
- **Step 3 (done):** `locker-showers/water.js` planar floor mirror via `ReflectorNode` (hiding `liquid:surface` meshes & guarding MRT).
- **Step 4 (done):** Medium supersampling, light maps (`kit-node-light.js`, with smooth soft-penumbra `blurLightmap`), MRT glow (`glow-node.js`), and floor sheen (`kit-node-sheen.js`).
- **Step 5 (done):** Complete one-pass `liquid-node.js` water — refraction, absorption, caustics, wave-pool swell (`swellGeometry` interleaved repack), underwater underside (Snell's window + overhead refraction), and High planar mirror (`ReflectorNode`, sized to `mirrorSize(sceneTarget)`).
- **Step 6 (done):** High flashlight shadows (`kit-node-shadow.js` + `beam-shadows.js`, 9-tap hardware PCF in uniform WGSL control flow, `uTorch` & `uK.y` uniform skip gates, `warm()` pre-patching).
- **GPU & WGSL Optimization Pass (done, verified at 104–120 fps on real Chromium WebGPU & WebGL 2):** full sheen-floor WGSL shrunk 13.1× (`292 KB → 22 KB`, lightmap fetches `41 → 4`), VHS Signal texture ops `118 → 22` (`14` runtime fetches/px with focus locked), flat water depth loads `9 → 2/px`, unused Retina 4× MSAA swapchain disabled on standalone BlockRooms, `test/blockrooms-webgpu-perf.test.mjs` guards compiled WGSL budgets.
- **Next:** Step 7 (the office, co-op, dev tools — not needed for Steam BlockRooms), and the F-5 hardware benchmark matrix (WebGL vs WebGPU-WebGL2 vs WebGPU), which now also says what the launch screen's Auto picks on real machines.
- With `?gpu=webgl`, Classic is as it was (`antialias: false` on the unused swapchain only; same shaders and scene targets).

## WebGPU for everybody, and the graphics screen (20 Nov)

The owner: "I would rather some percentage of people not be able to play than to lower the experience for those that
do." So `engine/gpu.js` now picks WebGPU unless `?gpu=webgl` (or a stored `webgl`) asks for the old renderer, and the
play page preloads the WebGPU build.

**A machine that can draw nothing** (no WebGPU adapter and no WebGL 2) gets a screen of tape static, `NO SIGNAL` and
"THIS MACHINE CAN'T RUN BLOCKROOMS" (`backrooms/launch.js` `cantRun`), not a broken page. The same screen shows if the
stage cannot be opened.

**The graphics screen** (`backrooms/launch.js`, rules in `launch.rule.js`, tests in `test/blockrooms-launch.test.mjs`):
- **On first launch:** tape static, then Auto, Low, Medium, High, with Auto chosen.
- **Auto measures, it does not guess.** Behind the static the level itself is drawn: a quiet visit to a fixed building
  (tape 7, Floor 1), built at High. Once it has landed, High is measured for 2 s while the view turns round the room,
  after 0.8 s to settle. Medium is measured the same way only if High did not hold.
  - A tier holds when half its frames take at most 25 ms (40 fps) and nine in ten at most 40 ms.
  - The first tier that holds is Auto's pick; if neither does, Low.
  - Measuring High first and stopping there is the upward bias the owner asked for.
  - A machine that has not built and landed in 20 s gets Low.
  - If nothing could be measured, Auto falls back to the in-game Auto setting, which starts at Medium and steps down.
- Auto shows what it picked (`AUTO · HIGH`). The player can take it or another tier, by key, click or tap.
- The choice becomes the Graphics setting and is remembered (`localStorage['blockrooms:graphics']`), so the screen does
  not come back.
- **Settings offers it again:** a Test button beside Graphics. It is measured on the paused picture of the visit, and
  the choice applies at once.
- **Classic** stays in Settings.
- **No words** but the tiers' names and what Auto chose.
- **Not shown** for `?debug&bench=1`, or under `?debug` unless `&launch=1` asks for it, which shows it every time. The
  dev page shows it with `&launch=1`.
- **Ultra**, once `graphics.js` has it (Gemini, `gemini/steam-webgpu-ultra`), is offered on the end and measured
  first, with the benchmark's floor built at Ultra; nothing in the screen needs changing for it.
- Each tier measured is logged to the console: `[graphics] high: median … ms, 9 in 10 under … ms, … fps`.

Shots, on this container's software renderer, which picks Low (about 1 fps; it never lands in 20 s):
`docs/webgpu/launch-measuring.jpg`, `launch-picked.jpg`, `launch-phone.jpg`, `launch-settings-test.jpg`,
`launch-cant-run.jpg`. What Auto picks on real GPUs has not been seen yet; the owner's laptop is the first real check.

## The switch

| | |
|---|---|
| Default | WebGPU (`WebGPURenderer`, on its WebGL 2 backend where there is no WebGPU adapter), on the play page and `/world/dev/backrooms.html` (the office does not read it) |
| Force it off | `?gpu=webgl`, or `localStorage['blockrooms.renderer'] = 'webgl'` (for the Steam shell to set before the page loads); the address wins over the stored value |
| The rule | `public/world/engine/gpu.js` `rendererChoice()`, tested in `test/blockrooms-webgpu-flag.test.mjs` |
| What it does | `engine/stage.js` `openStage()` fetches `vendor/three.webgpu.min.js` and makes a `WebGPURenderer`, then `await renderer.init()`. If there is no WebGPU adapter, three.js falls back to its own WebGL 2 backend: node materials still, compiled to GLSL ES 3.0. If even that fails, `openStage` falls back to the old `createStage`. The console says which one it got: `[stage] WebGPURenderer on its WebGPU backend` or `… WebGL 2 backend`. |
| How code tells | `gpu.nodes` (`engine/gpu.js`) is the WebGPU build's module while the flag is on, and `null` otherwise. Every node path in the code is `if (gpu.nodes) …`, and the old code runs untouched otherwise. No module imports the WebGPU build. Only the stage loads it, and only under the flag. |
| Vendored | `public/vendor/three.webgpu.min.js` is three.js r180, the same release as the vendored `three.module.min.js`. It comes from the npm package `three@0.180.0`, unchanged, under the MIT licence already in `vendor/LICENSE-three.txt` (and `NOTICE`). It imports `./three.core.min.js`, the very file `three.module.min.js` imports, so a `Mesh` made with `three` is the same class the WebGPU renderer draws. `three.tsl.min.js` is not vendored: it needs an import-map entry for `three/webgpu`, and the WebGPU build already exports the whole of TSL as `TSL`. |
| Size | 580 KB (159 KB gzipped). Fetched only under the flag. The site build copies it (`tools/backrooms-sample/stage.mjs`) and never preloads it (`test/blockrooms-site.test.mjs`). |
| Office | `createStage` under `opt.nodes` switches off the office's bloom and tilt-shift composer (WebGL only). The office's `main.js` does not read the flag yet. |

### A lost device
- A WebGPU device can be lost at the start (a driver or software adapter that cannot show a picture on the page, as
  here) or at any time after (a driver reset, a GPU switch). Either way the visit goes on.
- `engine/stage.js` stops drawing (the game keeps running) and tries `engine/gpu-recover.js RECOVERY_STEPS` in order:
  1. a fresh WebGPU device on the same canvas;
  2. the WebGL 2 backend on a new canvas put under the old one;
  3. that once more.
- The renderer object, its materials and the visit stay the same: only the renderer's backend is swapped. The old canvas
  stays on top, unseen, because the game's input and pointer lock are bound to it.
- If nothing holds at the start, it is today's renderer instead. If nothing holds mid-visit, the picture stays black
  and the console says to reload with `?gpu=webgl`.
- Checked:
  - unit tests (`test/blockrooms-webgpu-device-lost.test.mjs`);
  - in a browser, at the start: SwiftShader's adapter loses its device at the first frame, and it recovers onto WebGL 2
    with the same picture as the plain fallback.
- Mid-visit has not been seen in a browser yet.

## What renders under the flag today

Shots are side by side, today on the left and the flag on the right, in `docs/webgpu/`. All were taken in headless
Chromium on this machine, in **software** (SwiftShader), at 960 × 720, with the same seed and the same spot.

| Shot | What it shows |
|---|---|
| `start-clean.jpg` | The landing room, Picture level 0 (clean). The flag is on the WebGL 2 backend. 0.9 % of pixels differ by more than 16 levels (99th percentile 14 of 255), all at texel and polygon edges. No colour or light differs. |
| `start-clean-webgpu.jpg` | The same, on the **real WebGPU backend** (SwiftShader's WebGPU adapter). 1.6 % by more than 16, 99th percentile 28, edges only. The HUD is missing on the right because that frame was read back from the GPU (see "How the shots were taken"). |
| `start-vhs.jpg`, `start-vhs-webgpu.jpg` | Full VHS (level 2) on each backend. The tape's noise is new each frame, so pixels cannot be matched, but the look is the same: the softness, the late chroma, the wobble, and the torn lines at the foot of the picture. |
| `avatars.jpg`, `avatars-webgpu.jpg` | `vox/material.js`: three visitors' figures, WebGL against the flag. The voxel material's only use in BlockRooms is the visitor's own figure. On the figures, the mean difference is 7 levels; 10 % of pixels differ by more than 16, at the edges. The background differs: WebGPURenderer tone-maps the clear colour and WebGL does not. That matters to the office, not to BlockRooms, where both renderers clear the camcorder's own target the same way. |
| `rooms-copiers.jpg`, `rooms-cubicle-grid.jpg`, `rooms-the-sets.jpg` | Voxel props through `kit.js` and plain rooms: they match (0.8 % to 2.3 % of pixels by more than 16, at edges). The Sets' CCTV TV was not in view. |
| `rooms-kiddie-lagoon.jpg` | **Wrong under the flag:** the mushroom fountain's falling streams are a flat milky dome, and the impact rings are flat discs. The rest of the room matches. |
| `rooms-bog-boardwalk.jpg`, `…-webgpu.jpg` | **Wrong under the flag:** the bog water is a dark see-through sheet, not rippled water. The trees, boardwalk and props match on both backends. |

**Without the flag** (today's commit against this one, both built as the site, same seed and spot):
- the landing room is pixel-identical (maximum difference 0);
- the copier room differs by 1.5 % of pixels between the two, but it differs by exactly as much between two runs of today's code alone (something in it animates).

**Two things only the real WebGPU backend showed**, both fixed under the flag in `kit.js geometry()`:
- 3-byte vertex attributes are invalid (the stride must be a multiple of 4);
- more than 8 vertex buffers in one draw are invalid (a kit geometry with four lamp banks had 10). WebGPU's default
  limit is 8 on real GPUs too.

**Frame time:** not measured in any way that means anything. Every number here is from software rendering, and the WebGL
figures include the screenshot read-back stalls. For the record, the clean landing room took about 300 to 390 ms a frame
on WebGL (SwiftShader GL), the same on the flag's WebGL 2 backend, and about 20 ms a frame on WebGPU (SwiftShader
Vulkan). The WebGPU frame was never shown on a
screen, though, so the two are not alike, and neither says anything about a GPU. The first real numbers are D9's (F-5):
the shell, on the three hardware classes.

### How the shots were taken (and what could not be seen)
- Headless Chromium here has a WebGPU adapter only with `--enable-unsafe-webgpu` (SwiftShader). Without the flag there is
  none, which exercises the WebGL 2 fallback.
- With the adapter, presenting to a page canvas loses the device ("A valid external Instance reference no longer
  exists"). That happens with plain WebGPU too, a clear and nothing else. Rendering into textures works.
- So the WebGPU shots use a **test-only** stand-in for the canvas's `webgpu` context, injected by the shot script and not
  shipped. Its "current texture" is an ordinary GPU texture, read back after the frame. That is the real WebGPU backend
  drawing the real frame, minus the page's HTML (the HUD and the camcorder's lettering).
- Not seen: a real GPU; any browser but Chromium; Safari's or Firefox's WebGPU; the Steam shell.

## What is ported

| Piece | File | Notes |
|---|---|---|
| The renderer switch | `engine/stage.js` `openStage`, `engine/gpu.js` | `site.js` calls `openStage` with the page's choice. Off: `createStage`, exactly as before. |
| The room surface | `backrooms/kit-node.js`, hooks in `kit.js surface()` & `kit.points()` | Baked light (steady, flicker, banks) × dimmer × tint, the flashlight and camcorder-lamp cones, voxel grain and seams, texture with cut-outs, the wet glint. Exposes `m.patchNode({ position?, uv?, wetNormal?, color?, replaceFragment? })` for room shader extensions and `m.setHeldInFront(sliver)` for held-item depth-sliver rendering, plus `pointsNode` (`kit.points`) for world-sized instanced billboard quads. Keeps `uniforms`, `defines`, `vertexShader` and `fragmentShader` on the material, so `uTint` and the rest keep working. Uniforms are read every frame; defines are read at build and on `needsUpdate`. Under the flag, byte-triplet attributes are padded to 4 bytes and float attributes are interleaved (`packSurfaceAttributes`, at most 5 vertex buffers). |
| The voxel material | `vox/material.js` `nodeVoxel` | `MeshLambertNodeMaterial` with the same grain, seam and glow as the `onBeforeCompile` patch; `voxelUniforms` are read every frame. |
| The camcorder | `backrooms/vhs-node.js`, one hook in `vhs.js createVhs` | SIGNAL and SCREEN in TSL, with grade and haze (from the scene's depth). The same `uniforms` object, so the battery fade, snow, red, white and tracking from `index.js` and the rooms work. The output colour transform is off while it runs, because the tape does its own gamma, as the GLSL does. |
| Held things | `hand.js`, `hand-notes.js`, `kit-node.js` `setHeldInFront` | Under the flag, every held mesh (torch, scissors, extinguisher, balloon + glove, pink slip, shove hands, stuck notes) writes `clamp(viewZToPerspectiveDepth(positionView.z, cameraNear, cameraFar), 0, 1) * HELD_DEPTH_SLIVER` to `depthNode`: renders cleanly in front of walls without clipping, preserves self-occlusion and sticky-note ordering, and leaves room depth intact for haze. |
| Classic room patches & effects | `pool-optics.js`, `rooms/kiddie-lagoon.js`, `rooms/locker-showers/{glaze,fold-screen,assets,water}.js`, `rooms/return-pool/art.js`, `rooms/bellmouth/art.js`, `rooms/flume-connector/water.js`, `rooms/whirlpool-flume/siphon.js`, `spray.js`, `inventory-fire.js`, `forest-fx.js`, `forest-maze.js`, `rooms/the-grotto.js` | Every Classic-tier shader and room patch runs on TSL `NodeMaterial`s behind `gpu.nodes` / `mat.patchNode`. Tested by `test/blockrooms-webgpu-step2.test.mjs` and visually verified under `?gpu=webgpu` in Chromium (`kiddie-lagoon`, `bog-boardwalk`, `locker-showers`, `whirlpool-flume`, `the-grotto`, `the-sets`, held flashlight against wall, paper fire). Note: `spray.js` is unit-tested under `gpu.nodes` but was not triggered live in the browser pass; `locker-showers/water.js` renders rippled non-mirror water and guards `onBeforeRender` until Step 3 (`ReflectorNode`). |

## Medium and High: what is ported since phase 1

- **Supersampling** (`vhs-node.js`): the scene is drawn at the tier's size and brought down with vhs.js's tent.
- **Light maps** (`kit-node-light.js`, hooked from `kit-node.js`): tube shadows and doorway light, with kit.js's sums.
- **Glow** (`glow-node.js`, used by `vhs-node.js`): there is no second draw of every mesh with stand-in materials.
  - The one scene pass writes what shines into a second output (MRT): a kit surface's self-lit voxels, a lamp or sign's
    own colour, and black for the rest. The depth test does the hiding.
  - Then comes glow.js's chain, number for number.
  - three.js r180 caches a material's shader by a key that ignores the MRT. While the glow pass draws, every
    material's key gets a suffix, so each material gets a shader for that pass.
- `medium-glow.jpg` (WebGL 2 fallback) and `medium-glow-webgpu.jpg` (WebGPU, no HUD) compare Medium on the landing
  room: 0.2 % and 1.9 % of pixels differ by more than 16 levels, at edges. The glow round the tubes matches.

- **Floor sheen** (`kit-node-sheen.js`, hooked from `kit-node.js`): anisotropic GGX tube streaks, Fresnel, reach fade, environment wax, soft-knee compression, and shared lightmap `floorShade()` in uniform WGSL control flow (`22 KB` compiled WGSL, 4 lightmap fetches/px).
- **Water (Medium & High)** (`liquid-node.js`): full one-pass water including wave-pool swell, underwater underside (Snell's window + overhead refraction), and High planar mirror (`ReflectorNode`).
- **Flashlight shadows (High)** (`kit-node-shadow.js` + `beam-shadows.js`): 9-tap hardware PCF depth comparison in uniform WGSL control flow, zero taps when torch is off.
- **Smooth baked shadows & Floor 1 polish** (`shadowmap.js` `blurLightmap()`, `office-textures.js`, `office-wear.js`, `office-lighting.js`): active on Medium & High (`gfx().shadows > 0`), with Classic/Low untouched.
- **1980s camcorder adaptation** (`camcorder-adapt.js` + `vhs.js` / `vhs-node.js`): gradual blown-white auto-iris bloom, slow white-balance drift, and motorized lens focus glide across dark/bright room transitions on both WebGL and WebGPU.

## One renderer (the owner's decision, 19 Nov)

- The web moves to WebGPURenderer too, once it matches, so there is one code base, not two. The switch-over waits
  until water is ported and checked.
- The audience this must not lose: every browser without WebGPU (Firefox, Safari, older machines). For them,
  WebGPURenderer's WebGL 2 backend has to give today's look at today's speed.
  - **The look:** the shots here are already taken on that backend.
  - **The speed is not known yet.** WebGPURenderer's WebGL 2 backend has more CPU work per draw than
    WebGLRenderer, and BlockRooms has many draws.
  - The gate for the switch-over is F-5: frame time, WebGL against WebGL 2-backend against WebGPU, on the three
    hardware classes. It is measured on real GPUs, never in software.
- Water and glow are redone on nodes, not translated (the owner: "we can both make big gains and make it more
  efficient for water etc on the new system").
  - Glow: the scene pass writes what shines (MRT); there is no second draw.
  - Water: one pass; the water reads three.js's copies of the picture (`liquid-node.js`).

## Water (Medium and High), redone

- `liquid-node.js`, driven from `vhs-node.js`, does one pass. The water is drawn after everything opaque and reads
  what is behind it from `viewportSharedTexture` and `viewportDepthTexture`. There is no copy pass, no layers moved
  and no materials swapped for the draw.
- Kept from liquid.js, number for number (liquid.rule.js): the ripple, the wake rings (the visitor's and a room's
  `disturb`), refraction by depth, absorption in the sheet's own tint, scatter, caustics on the bed, the stirred light
  in a fresh ring, the Fresnel flat tint, the contact line, and a ring's crest and trough.
- Completed since initial water port: the wave pool's swell (`swellGeometry` interleaved repack), the underwater underside (`UNDERSIDE` / Snell's window + overhead refraction, flat & swelled), High's shared planar mirror (`ReflectorNode` sized to `mirrorSize(sceneTarget)`), `water.renderOrder = -1` draw ordering, and `.toVar()` depth-load compaction (`9 → 2` depth loads/px on flat water).
- Seen: `kiddie-lagoon`, `wave-pool`, `deep-end`, and `locker-showers` side-by-side in Chromium (`1720×960`, WebGL High vs WebGPU High at `104–115 fps`, `0 err`).
- Glow: a material with a fragment of its own (water, points, spray, the paper fire, the forest's water and mist) gets
  the glow's second output from `glow-node.js` (black that hides, or nothing where it is see-through), so Medium's
  glow pass draws every material.

## Flashlight shadows (High, Step 6)

- `kit-node-shadow.js` (hooked from `kit-node.js`), `beam-shadows.rule.js` (`receivesBeamShadow` recognises `m.isKitSurface`),
  and `beam-shadows.js`:
  - `beam-shadows.js` allocates a `RenderTarget` + comparison `DepthTexture` (`LessEqualCompare`, `LinearFilter`) on
    `WebGPURenderer`, swaps casters to `MeshBasicNodeMaterial` (`colorWrite: false`, `polygonOffset`, preserving `map` and
    `alphaTest` for cutouts), syncs `cam.coordinateSystem`, uses WebGPU `[0, 1]` clip-Z `toPictureGPU` when on
    `WebGPUCoordinateSystem`, clears MRT during the depth pass, and restores everything in `finally`.
  - `kit-node-shadow.js` reproduces `BEAM_SHADOW_GLSL` number for number (normal + slope bias, `uBeamShadowMatrix`,
    border fade, and 9-tap hardware PCF depth comparison in uniform control flow for WGSL validation). Only the
    flashlight's share is shadowed, never the camcorder lamp.
  - `kit-node.js` exposes `m.rebuildNode()` so runtime `BEAM_SHADOWS` toggles (`patch` / `off`) build a fresh
    `fragmentNode` cache key while preserving `glow-node.js`'s `|glow-mrt` prototype suffix.
- Checked: unit tests (`test/blockrooms-webgpu-step6.test.mjs`) and live browser side-by-side at High in a dark
  ceiling-off room (`&lighting=1&lightstudy=1`, WebGL vs `?gpu=webgpu` + runtime High → Medium → High toggle, plus
  `copiers`, `cubicle-grid`, and `kiddie-lagoon` at High with zero HUD console errors).

## Two ports of the same pieces, judged (19 Nov)

Two agents ported Medium's supersample, light maps and glow separately (this branch, and `gemini/steam-webgpu-phase3`).
The owner asked for a judge.
- **The renders:** `docs/webgpu/judge-*.jpg`. Each is today's WebGL | this branch | the other, at Medium built from
  the start, the same seed and spot, on the WebGL 2 backend.
- **The judge:** an independent reviewer, blind to which was whose.
- **Supersample:** the two are the same filter. Combining the glow's add with it saves a pass, but it was taken out
  again: with it on, the copier room measured differently from run to run.
- **Light maps:** near-equal. Skip the map's reads off the map, as kit.js does. Taken, read at level 0 so that WGSL
  allows it (the maps have no mipmaps, so this is the same picture). The region is flat, as kit.js's GLSL has it
  (an earlier reading here that flat looked worse was within the run-to-run noise below).
- **Glow: this branch's.**
  - The other's chain starts one level finer than glow.js, so its halo is half as wide and its core brighter.
  - It also renders black after a tier switch in-game: its shaders' key does not know the MRT.
  - Fixed here from the judge's finding: a lamp's or sign's mark and strength are read per object drawn (three.js r180
    leaves userData out of a shader's key, so two materials could share one). The grotto sign was washed out; now
    1.5 % of pixels >16 against today's, down from 4.8 %.
- **Open:**
  - Runs of the same code in the copier room differ by 0.7 to 1.5 % of pixels. Shader compile order varies from run to
    run, and materials alike but for what the key leaves out share a shader.
  - Real-GPU timing of either chain.

## What looks wrong or remains unported under the flag

BlockRooms itself (Classic, Low, Medium, High, Auto) is now at full feature parity on WebGPU. Only non-Steam / edge pieces remain:

- **The inventory's icons:** unaffected. They are drawn by their own second WebGL renderer with their own Lambert material, onto PNGs.
- **Co-op:** its client makes its own WebGLRenderer and does not read the flag.
- **Held things:** only kit surfaces are drawn into the nearest sliver of depth (`setHeldInFront`). A held item's other
  parts (plain three.js materials) are drawn as they are and can dip into a wall.
- **The Office & look-dev pages:** still on WebGL (`createStage` under `opt.nodes` switches off the office's WebGL post composer).

## Inventory

Every GLSL shader, `onBeforeCompile` patch, render target, post pass and WebGL-only call under `public/world/`.

Sizes:
- **S:** under an hour, a direct translation.
- **M:** about half a day, some restructuring.
- **L:** a day or more, needs new structure (several passes, juggling targets, mirrors, shadows).

"Tier" is `graphics.js`'s profile: Classic has every switch at 0.

### The game, every tier

| What | Where | What it does | Port to TSL | Size | Risk | Status |
|---|---|---|---|---|---|---|
| Room surface | `kit.js` VERT/FRAG, `surface()` | baked light × albedo × texture, dimmer, flicker, banks, flashlight and camcorder-lamp cones, voxel grain and seams, cut-out, wet glint | `NodeMaterial.fragmentNode`, attributes and varyings | L in all, M for the Classic core | defines toggled at runtime (`world.js`, `beam-shadows.js`, `liquid.js`); patched and recognised by its text (§ string patches) | **Classic core done** |
| Flashlight cones | `flashlight.js` `FLASHLIGHT_GLSL` | cone, fade and incidence for the torch and the camcorder lamp | plain TSL function | S | none | **done (in kit-node)** |
| Camcorder chain | `vhs.js` EffectComposer, RenderPass, targets | the picture pipeline | own render targets plus `QuadMesh` passes | M | MSAA sample count changed at runtime: WebGPU knows 1 and 4 only (2 → 4 under the flag) | **done (Classic)** |
| SIGNAL | `vhs.js` | the VHS signal, the floor's grade, haze from depth | TSL `Fn`, 10 taps | M | depth texture from an MSAA target | **done** |
| SCREEN | `vhs.js` | 4:3 picture, bars, scan lines, vignette | TSL | S | none | **done** |
| Held things | `hand.js` `holdInFront`, `hand-notes.js`, `kit-node.js` `setHeldInFront` | held items in front of the room: mid-pass depth clear, or `gl.depthRange` | `depthNode` sliver (`viewZToPerspectiveDepth * HELD_DEPTH_SLIVER`) | M | no mid-pass clears in WebGPU | **done** |
| Extinguisher spray | `spray.js` (two materials) | instanced soft puffs; full-screen white-out | `NodeMaterial` with `vertexNode` + `fragmentNode` and instanced attributes | S | instancing | **done** (unit-tested; spray not triggered live in browser pass) |
| Paper-fire glow | `inventory-fire.js` | additive orange pool | `NodeMaterial` with radial alpha | S | co-op finds it by name | **done** |
| Inventory icons | `inventory-icons.js` | its own WebGLRenderer and its own Lambert material, rendered to PNGs | keep WebGL (separate canvas), or port to save a context | S | none: it shares no material with the stage | **unaffected** |
| Pool optics | `pool-optics.js` | patch: rippled pool texture plus the ceiling's lamps at grazing angles | `mat.patchNode({ uv, color })` in `kit-node` | S | exact kit text | **done** |
| Room string patches | locker-showers (`glaze`, `fold-screen`, `assets`, non-mirror `water.js`), `flume-connector/water.js`, `whirlpool-flume/siphon.js`, `kiddie-lagoon.js`, `bellmouth/art.js`, `return-pool/art.js` | moving water, glaze, curtains, fountains, UV drift | `mat.patchNode({ position, uv, wetNormal, color })` hooks in `kit-node` | S each, M together | each is written against kit's GLSL text | **done** |
| Showers mirror | `locker-showers/water.js` | a floor sheet reflecting the room (oblique clip), drawn from `onBeforeRender` | `ReflectorNode` (three.js ships one in TSL) | L | nested render inside a render; `renderer.state`, `renderer.xr` | **guarded** (rippled non-mirror water drawn; Step 3) |
| Forest water | `forest-fx.js` WATER and CAUSTIC (a kit material with its shaders replaced) | voxel ripples, footstep rings, depth tint, Fresnel, foam; caustic web | `mat.patchNode({ position, replaceFragment })` (6 unrolled ripple uniforms) | M, S | uniform arrays (`uRipples[6]`) | **done** |
| Forest mist | `forest-maze.js` veils | drifting translucent sheets fading near the eye | `NodeMaterial` | S | `discard` | **done** |
| Forest shafts | `forest-fx.js` | god-ray cones and pollen | `NodeMaterial` | S | none: not reached (no room asks for it) | **done** |
| The Sets TV | `rooms/the-sets.js` | live CCTV into a 160 × 120 target, 5 fps | `RenderTarget`, works as is | S | the target is sRGB | **verified live** |
| `PointsMaterial` | `rooms/the-grotto.js` | 4.5 cm points | `kit.points()` → instanced camera-facing quads (`pointsNode`) | S | WebGPU draws points 1 px | **done** |

### The game, Medium and High only

| What | Where | What it does | Port to TSL | Size | Risk |
|---|---|---|---|---|---|
| Light maps | `kit.js` LIGHTMAP, TUBESHADOW, DOORLIGHT | tube shadows and doorway light from a baked texture | more nodes in `kit-node` | M | flat varying, `uniform vec4 uLm[6]`, region per vertex |
| Floor sheen | `sheen.rule.js` | the ceiling tubes caught on lino, terrazzo and pool tile | node block in `kit-node` | M | `dFdx`/`dFdy`, `textureSize`, uniforms set per draw in `onBeforeRender` |
| Supersample | `vhs.js` SupersamplePass | scene at up to 2×, tent down to the tape | one more target and quad in `vhs-node` | S | MSAA plus depth |
| Bloom | `vhs.js` UnrealBloomPass | the host's threshold bloom (the office's Classic only) | `BloomNode` (three.js addon, TSL) | M | the addon needs `three/webgpu` and `three/tsl` in the import map; `vhs.bloom` is reached into by look2.js |
| Glow | `glow.js`, `glow.rule.js` | bloom from what shines: twin materials, a 6-level blur chain, depth-tested lamps | MRT (an emissive output from `kit-node` itself) plus `BloomNode`, in place of the twin redraw | L | it swaps every mesh's material, uses `gl_FragCoord` and depth, and `renderer.state` |
| Water | `liquid.js`, `liquid.rule.js` | refraction of a copy of the scene, absorption, caustics, Fresnel, swell; underside; colour and depth copy; two-part draw; mirror (High) | `viewportSharedTexture`, `viewportDepthTexture` and `ReflectorNode` replace the copy and the mirror | L (the biggest) | `gl_FragDepth`, `fwidth`, layers, shared torch uniforms rewritten during the mirror |
| Flashlight shadows | `beam-shadows.js`, `.rule.js` | 1024² depth map from the torch, 9-tap PCF | a `SpotLight` with a shadow, or a depth pass plus `textureCompare` | L | `MeshDepthMaterial` swap, `sampler2DShadow`, `renderer.state` |

### Not the game (the office, co-op, dev pages)

| What | Where | Size | Notes |
|---|---|---|---|
| Office post (bloom, tilt-shift, output) | `engine/stage.js` | M | `PostProcessing` with `bloom()` and a TSL tilt-shift. Off under the flag for now. |
| Voxel material | `vox/material.js` | S | **done**. The office's figures and furniture, and BlockRooms's visitor figure. |
| Night-shift beams | `levels/nightshift.js` | S | an office level |
| Co-op | `coop/client.js` (its own WebGLRenderer), `coop/lights.js` (patch), `coop/scene-sync.js` (recognises materials by shader text) | M | the wire protocol assumes ShaderMaterial's shape |
| Look-dev pages | `dev/lookdev/*` (cube cameras, SSR, AO, mirrors) | L in all | dev only. Leave them on WebGL, or retire them once Ultra exists. |
| Perf and info | `dev/perf.js`, `dev/backrooms.js`, `lookdev/lab.js` | S | `renderer.info` differs in WebGPURenderer (`info.render.calls`, `info.render.triangles`); `WEBGL_debug_renderer_info` has no counterpart (use `adapter.info`) |

### Shared uniforms a port must keep alive

- `kit.shared` (the torch, the lamp, their origin and direction): set every frame by `index.js`.
- Each room's `flick`, `dim`, `banks` and `moreBanks`: `world.js` replaces the holders on built materials.
- Each material's `uTint`: about 30 places set it.
- The camcorder's `uniforms`: `index.js`, all-hands and co-op set them.
- `voxelUniforms`, `beamShadows.uniforms`, the glow's depth uniforms, the water view's `shared`, the sheen's per-room
  set.

The node ports read the holders every frame (`onRenderUpdate`), which keeps all of these working without changing the
callers.

## What the WebGL 2 fallback covers

`WebGPURenderer` with no WebGPU adapter runs its WebGL 2 backend. It is the same node materials, compiled to GLSL
ES 3.0.

It covers everything phase 1 needs:
- every node material;
- render targets, half-float, MSAA (4), depth textures;
- `QuadMesh` passes;
- `PostProcessing`;
- shadows.

It does not cover:
- compute shaders (only a small transform-feedback subset);
- storage textures;
- timestamp queries everywhere.

Nothing in this inventory needs those, so a material ported once runs on both backends. That is the plan's "WebGPU in
the shell, the WebGL fallback on the web". It does **not** run old GLSL `ShaderMaterial`s: the fallback is not the old
renderer.

Measured on this machine (software): the landing room on the fallback matches today's WebGL as closely as the WebGPU
backend does (see the shots).

## Port order

1. **Done:** the switch, `vox/material.js`, the Classic core of `kit.js`, and the camcorder at Classic.
2. **Done:** the hook points in `kit-node` (`position`, `uv`, `wetNormal`, `color`, `replaceFragment`),
   `kit.points()` instanced quads (`the-grotto`), `setHeldInFront` depth-sliver (`hand.js` + `hand-notes.js`), all Classic
   room string patches, `pool-optics.js`, `spray.js`, `inventory-fire.js`, forest mist/shafts/water/caustics, and
   WebGPU-safe `the-sets` CCTV (`THREE.RenderTarget` with MRT/liquid guard).
3. **Done:** The showers mirror (`rooms/locker-showers/water.js` via `ReflectorNode`).
4. **Done:** Medium — supersample, light maps (with smooth soft-penumbra `blurLightmap`), floor sheen (`kit-node-sheen.js`), and MRT glow (`glow-node.js`).
5. **Done:** Water (`liquid-node.js`) — one-pass refraction/absorption/caustics, wave-pool swell, underwater underside, and High `ReflectorNode` mirror.
6. **Done:** High — flashlight shadows (`kit-node-shadow.js` + `beam-shadows.js`), plus the full WGSL/VRAM optimization pass (`test/blockrooms-webgpu-perf.test.mjs`).
7. **Remaining (non-Steam):** The office, co-op, dev tools — M each. Not needed for the Steam BlockRooms build.

Then R-3's Ultra (SSAO via three.js's `ao()` node, light shafts, more shadow casters) is written once, in TSL, on top.

**Estimate for the whole game port, steps 2–6:**
- about 4 S;
- about 8 S-sized patches (M together);
- 5 M;
- 5 L.

That is roughly two to three weeks of one agent's focused work, plus side-by-side checks per room. Most of the risk is
in water and glow, which are also the two things most worth redoing rather than translating.

## Decisions for the owner

1. **Is WebGPU the Steam default once it matches?**
   - The plan says "WebGPU in the shell, the WebGL fallback on the web".
   - The fallback is WebGPURenderer's own WebGL 2 backend, not today's renderer, so the web would move too. That is one
     code path, not two.
   - Or the web keeps today's WebGLRenderer until the port is finished.
   - Recommended: one path (node materials everywhere) once step 5 is done; until then the flag stays opt-in.
2. **Redo, or translate, water and glow?** Translating keeps today's look exactly. Redoing them on three.js's own nodes
   is about the same work and is cheaper to run. Recommended: redo, with shots matched.
3. **The 580 KB WebGPU build** has to ship with the Steam build (fine) and with the site once the web moves. The site
   would then fetch it instead of `three.module.min.js` (which is 339 KB), not as well as it.
