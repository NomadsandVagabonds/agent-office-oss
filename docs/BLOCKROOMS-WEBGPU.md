# BlockRooms on WebGPU

The plan for moving BlockRooms from three.js's `WebGLRenderer` to `WebGPURenderer`. The new renderer uses node
materials, written in TSL. This is task R-5 of the Steam plan, D3 Rendering (`docs/BLOCKROOMS-STEAM-PLAN.md` on
`claude/backrooms-cast`). It is also the ground the Ultra tier (R-3) and "light that behaves" (R-4) can be built on.

**Status (phase 3 — Steps 2, 3 & 4 complete):**
- The switch is in, behind an opt-in flag (`?gpu=webgpu` on the play page and `/world/dev/backrooms.html`).
- **Phase 1 (done):** the switch, room surface Classic core (`kit.js` / `kit-node.js`), voxel material (`vox/material.js`), and camcorder at Classic (`vhs.js` / `vhs-node.js`).
- **Step 2 (done):** composable `patchNode` hooks on `kit-node.js`, `kit.points` instanced quads (`the-grotto` snow), held-item `depthNode` sliver (`setHeldInFront` on `hand.js` + `hand-notes.js`), `pool-optics.js`, all Classic room shader patches, extinguisher spray & white-out (`spray.js`), paper-fire floor spill (`inventory-fire.js`), forest water/caustics/shafts (`forest-fx.js`), forest mist veils (`forest-maze.js`), and `the-sets` CCTV feed verified live.
- **Step 3 (done):** `locker-showers/water.js` planar floor mirror via `ReflectorNode` (oriented `+Y`, `bounces: false`, zeroing camera-space lamps during the mirror draw), visually verified live at Classic and Medium.
- **Step 4 / Medium tier (done):** `vhs-node.js` supersample (`sw > iw` 4-tap tent downsample), `kit-node.js` light maps (`LIGHTMAP` / `TUBESHADOW` / `DOORLIGHT`) and floor sheen (`SHEEN` with blocky texel derivatives and per-draw `onObjectUpdate`), plus single-pass MRT emissive glow (`EmissiveMrtNode` + `kit.glowing` `MeshBasicNodeMaterial` + 6-step down / 5-step up bloom pyramid in `vhs-node.js` — replacing `glow.js`'s twin scene redraw).
- **Next:** Step 5 (`liquid.js` refracted/reflective water view) and Step 6 (`beam-shadows.js` flashlight shadows — currently guarded on `WebGPURenderer` so `graphics=high` stays crash-free).
- Without the flag, nothing changes: the same renderer, the same shaders, the same pixels.

## The switch

| | |
|---|---|
| Turn it on | `?gpu=webgpu` on the play page or `/world/dev/backrooms.html` (the office does not read it yet), or `localStorage['blockrooms.renderer'] = 'webgpu'` (for the Steam shell to set before the page loads) |
| Force it off | `?gpu=webgl` (the address wins over the stored value) |
| The rule | `public/world/engine/gpu.js` `rendererChoice()`, tested in `test/blockrooms-webgpu-flag.test.mjs` |
| What it does | `engine/stage.js` `openStage()` fetches `vendor/three.webgpu.min.js` and makes a `WebGPURenderer`, then `await renderer.init()`. If there is no WebGPU adapter, three.js falls back to its own WebGL 2 backend: node materials still, compiled to GLSL ES 3.0. If even that fails, `openStage` falls back to the old `createStage`. The console says which one it got: `[stage] WebGPURenderer on its WebGPU backend` or `… WebGL 2 backend`. |
| How code tells | `gpu.nodes` (`engine/gpu.js`) is the WebGPU build's module while the flag is on, and `null` otherwise. Every node path in the code is `if (gpu.nodes) …`, and the old code runs untouched otherwise. No module imports the WebGPU build. Only the stage loads it, and only under the flag. |
| Vendored | `public/vendor/three.webgpu.min.js` is three.js r180, the same release as the vendored `three.module.min.js`. It comes from the npm package `three@0.180.0`, unchanged, under the MIT licence already in `vendor/LICENSE-three.txt` (and `NOTICE`). It imports `./three.core.min.js`, the very file `three.module.min.js` imports, so a `Mesh` made with `three` is the same class the WebGPU renderer draws. `three.tsl.min.js` is not vendored: it needs an import-map entry for `three/webgpu`, and the WebGPU build already exports the whole of TSL as `TSL`. |
| Size | 580 KB (159 KB gzipped). Fetched only under the flag. The site build copies it (`tools/backrooms-sample/stage.mjs`) and never preloads it (`test/blockrooms-site.test.mjs`). |
| Office | `createStage` under `opt.nodes` switches off the office's bloom and tilt-shift composer (WebGL only). The office's `main.js` does not read the flag yet. |

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
| The room surface | `backrooms/kit-node.js`, hooks in `kit.js surface()`, `glowing()` & `points()` | Baked light (steady, flicker, banks) × dimmer × tint, light maps (`LIGHTMAP` / `TUBESHADOW` / `DOORLIGHT`), anisotropic floor sheen (`SHEEN`), flashlight and camcorder-lamp cones, voxel grain and seams, texture with cut-outs, wet glint, and MRT emissive descriptor (`userData.emissiveMrt`). Exposes `m.patchNode({ init?, position?, uv?, wetNormal?, color?, replaceFragment? })`, `m.setHeldInFront(sliver)`, `glowingNode`, and `pointsNode` (`kit.points`). Keeps `uniforms`, `defines`, `vertexShader` and `fragmentShader` on the material. Under the flag, byte-triplet attributes are padded to 4 bytes and float attributes are interleaved (`packSurfaceAttributes`, at most 5 vertex buffers). |
| The voxel material | `vox/material.js` `nodeVoxel` | `MeshLambertNodeMaterial` with the same grain, seam and glow as the `onBeforeCompile` patch; `voxelUniforms` are read every frame. |
| The camcorder | `backrooms/vhs-node.js`, one hook in `vhs.js createVhs` | Full Classic & Medium pipeline in TSL: supersample target (`sw > iw`) + 4-tap tent downsample, single-pass MRT emissive glow (`EmissiveMrtNode`, 2-attachment `RenderTarget` named `'output'` / `'emissive'`, 6-step down / 5-step up bloom pyramid combined in resolve), SIGNAL (grade + depth haze + VHS), and SCREEN. The same `uniforms` object, so battery fade, snow, red, white and tracking work. |
| Held things | `hand.js`, `hand-notes.js`, `kit-node.js` `setHeldInFront` | Under the flag, every held mesh (torch, scissors, extinguisher, balloon + glove, pink slip, shove hands, stuck notes) writes `clamp(viewZToPerspectiveDepth(positionView.z, cameraNear, cameraFar), 0, 1) * HELD_DEPTH_SLIVER` to `depthNode`: renders cleanly in front of walls without clipping, preserves self-occlusion and sticky-note ordering, and leaves room depth intact for haze. |
| Classic room patches & floor mirror | `pool-optics.js`, `rooms/kiddie-lagoon.js`, `rooms/locker-showers/{glaze,fold-screen,assets,water}.js`, `rooms/return-pool/art.js`, `rooms/bellmouth/art.js`, `rooms/flume-connector/water.js`, `rooms/whirlpool-flume/siphon.js`, `spray.js`, `inventory-fire.js`, `forest-fx.js`, `forest-maze.js`, `rooms/the-grotto.js` | Every Classic-tier shader, room patch, and the locker-showers planar floor mirror (`ReflectorNode`) run on TSL `NodeMaterial`s behind `gpu.nodes` / `mat.patchNode`. Tested by `test/blockrooms-webgpu-step2.test.mjs` and `test/blockrooms-webgpu-step3-4.test.mjs`, and visually verified live under `?gpu=webgpu` at Classic, Medium, and High (`kiddie-lagoon`, `bog-boardwalk`, `locker-showers`, `whirlpool-flume`, `mall`, `the-grotto`, `the-sets`, `office` + VHS, held flashlight against wall, paper fire). Note: `spray.js` is unit-tested under `gpu.nodes` but was not triggered live in the browser pass. |

## What looks wrong under the flag

Everything still unported falls back cleanly without crashing:

**Any tier:**
- **The inventory's icons:** unaffected. They are drawn by their own second WebGL renderer with their own Lambert material, onto PNGs.
- **Co-op:** its client makes its own WebGLRenderer and does not read the flag.

**Medium, High, Auto:**
- **Water view (`liquid.js`, Step 5):** not ported yet; pool/flooded rooms render their Classic water surface instead of the refracted/reflective `liquid.js` pass.
- **Flashlight shadows (`beam-shadows.js`, High only, Step 6):** guarded on `WebGPURenderer` so High stays crash-free; flashlight illuminates without shadow maps yet.
- **Host threshold bloom (Classic office only):** off under the flag; Medium/High use the MRT emissive glow chain.

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
| Showers mirror | `locker-showers/water.js` | a floor sheet reflecting the room (oblique clip), drawn from `onBeforeRender` | `ReflectorNode` (`resolutionScale: 0.5, bounces: false`, target rotated `-π/2` around X) | L | nested render inside a render; `renderer.state`, `renderer.xr` | **done** (verified live at Classic & Medium) |
| Forest water | `forest-fx.js` WATER and CAUSTIC (a kit material with its shaders replaced) | voxel ripples, footstep rings, depth tint, Fresnel, foam; caustic web | `mat.patchNode({ position, replaceFragment })` (6 unrolled ripple uniforms) | M, S | uniform arrays (`uRipples[6]`) | **done** |
| Forest mist | `forest-maze.js` veils | drifting translucent sheets fading near the eye | `NodeMaterial` | S | `discard` | **done** |
| Forest shafts | `forest-fx.js` | god-ray cones and pollen | `NodeMaterial` | S | none: not reached (no room asks for it) | **done** |
| The Sets TV | `rooms/the-sets.js` | live CCTV into a 160 × 120 target, 5 fps | `RenderTarget`, works as is | S | the target is sRGB | **verified live** |
| `PointsMaterial` | `rooms/the-grotto.js` | 4.5 cm points | `kit.points()` → instanced camera-facing quads (`pointsNode`) | S | WebGPU draws points 1 px | **done** |

### The game, Medium and High only

| What | Where | What it does | Port to TSL | Size | Risk | Status |
|---|---|---|---|---|---|---|
| Light maps | `kit.js` LIGHTMAP, TUBESHADOW, DOORLIGHT | tube shadows and doorway light from a baked texture | `kit-node.js` (`flat` varying `vKitLmReg`, 6 `uLm` + 4 `uDoorL` uniforms, `uLmA/B/C`) | M | flat varying, `uniform vec4 uLm[6]`, region per vertex | **done** |
| Floor sheen | `sheen.rule.js` | the ceiling tubes caught on lino, terrazzo and pool tile | `kit-node.js` (`dFdx`/`dFdy`, `textureSize`, per-draw `onObjectUpdate`) | M | `dFdx`/`dFdy`, `textureSize`, uniforms set per draw in `onBeforeRender` | **done** |
| Supersample | `vhs.js` SupersamplePass | scene at up to 2×, tent down to the tape | `drawTarget` (`sw × sh`) + 4-tap tent in `vhs-node.js` `resolvePass` | S | MSAA plus depth | **done** |
| Bloom | `vhs.js` UnrealBloomPass | the host's threshold bloom (the office's Classic only) | `BloomNode` (three.js addon, TSL) | M | the addon needs `three/webgpu` and `three/tsl` in the import map; `vhs.bloom` is reached into by look2.js | not started |
| Glow | `glow.js`, `glow.rule.js` | bloom from what shines: twin materials, a 6-level blur chain, depth-tested lamps | Single-pass MRT (`EmissiveMrtNode` + `kit.glowing` `MeshBasicNodeMaterial`) + 6-step down / 5-step up TSL pyramid in `vhs-node.js`, replacing twin redraw | L | named MRT attachments, single-target Classic compatibility | **done** |
| Water | `liquid.js`, `liquid.rule.js` | refraction of a copy of the scene, absorption, caustics, Fresnel, swell; underside; colour and depth copy; two-part draw; mirror (High) | `viewportSharedTexture`, `viewportDepthTexture` and `ReflectorNode` replace the copy and the mirror | L (the biggest) | `gl_FragDepth`, `fwidth`, layers, shared torch uniforms rewritten during the mirror | not started |
| Flashlight shadows | `beam-shadows.js`, `.rule.js` | 1024² depth map from the torch, 9-tap PCF | a `SpotLight` with a shadow, or a depth pass plus `textureCompare` | L | `MeshDepthMaterial` swap, `sampler2DShadow`, `renderer.state` | **guarded** (Step 6) |

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
2. **Done (`baf48c1`):** the hook points in `kit-node` (`position`, `uv`, `wetNormal`, `color`, `replaceFragment`),
   `kit.points()` instanced quads (`the-grotto`), `setHeldInFront` depth-sliver (`hand.js` + `hand-notes.js`), all Classic
   room string patches, `pool-optics.js`, `spray.js`, `inventory-fire.js`, forest mist/shafts/water/caustics, and live
   verification of The Sets' CCTV TV.
3. **Done (this commit):** `locker-showers/water.js` planar mirror via `ReflectorNode`.
4. **Done (this commit) — Medium:** supersample (4-tap tent in `vhs-node.js`), light maps (`LIGHTMAP` / `TUBESHADOW` /
   `DOORLIGHT` in `kit-node.js`), floor sheen (`SHEEN` in `kit-node.js`), and single-pass MRT emissive glow (`EmissiveMrtNode`
   + `kit.glowing` + 6-step down / 5-step up bloom pyramid in `vhs-node.js`, replacing the twin redraw).
5. **Next — Water, L, the biggest single piece:** `viewportSharedTexture` and `viewportDepthTexture` replace the copy pass;
   `ReflectorNode` replaces the mirror.
6. **High:** flashlight shadows (L).
7. **The office, co-op, dev tools:** M each. These are not needed for the Steam build, which is BlockRooms.

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
