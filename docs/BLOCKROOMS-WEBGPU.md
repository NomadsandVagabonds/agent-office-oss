# BlockRooms on WebGPU

The plan for moving BlockRooms from three.js's `WebGLRenderer` to `WebGPURenderer`. The new renderer uses node
materials, written in TSL. This is task R-5 of the Steam plan, D3 Rendering (`docs/BLOCKROOMS-STEAM-PLAN.md` on
`claude/backrooms-cast`). It is also the ground the Ultra tier (R-3) and "light that behaves" (R-4) can be built on.

**Status (phase 1):**
- The switch is in, behind an opt-in flag.
- Three things are ported:
  - the room surface (`kit.js`);
  - the voxel material (`vox/material.js`);
  - the camcorder, at Classic (`vhs.js`).
- Everything else is listed below with a size and a port order.
- Without the flag, nothing changes: the same renderer, the same shaders, the same pixels.

## The switch

| | |
|---|---|
| Turn it on | `?gpu=webgpu` on the play page (the dev page and the office do not read it yet), or `localStorage['blockrooms.renderer'] = 'webgpu'` (for the Steam shell to set before the page loads) |
| Force it off | `?gpu=webgl` (the address wins over the stored value) |
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
| The room surface | `backrooms/kit-node.js`, one hook in `kit.js surface()` | Baked light (steady, flicker, banks) × dimmer × tint, the flashlight and camcorder-lamp cones, voxel grain and seams, texture with cut-outs, the wet glint. Keeps `uniforms`, `defines`, `vertexShader` and `fragmentShader` on the material, so `uTint` and the rest keep working. The uniforms are read every frame, so a holder that `world.js` swaps is followed too. The defines are read when the material builds, and again on `needsUpdate`. Under the flag, the two byte-triplet attributes (normal, albedo) are padded to four bytes, and kit's own float attributes are packed into one interleaved buffer (`packSurfaceAttributes`): at most 5 vertex buffers instead of up to 12. |
| The voxel material | `vox/material.js` `nodeVoxel` | `MeshLambertNodeMaterial` with the same grain, seam and glow as the `onBeforeCompile` patch; `voxelUniforms` are read every frame. |
| The camcorder | `backrooms/vhs-node.js`, one hook in `vhs.js createVhs` | SIGNAL and SCREEN in TSL, with grade and haze (from the scene's depth). The same `uniforms` object, so the battery fade, snow, red, white and tracking from `index.js` and the rooms work. The output colour transform is off while it runs, because the tape does its own gamma, as the GLSL does. |
| Held things | `hand.js holdInFront` | Under the flag, drawn as they are; no depth clear or depth-range squeeze (no GL to reach into). A held thing can dip into a wall it is pushed against. |

## What looks wrong under the flag

Everything not ported falls back to a blank node material: the right shape, flat colour or black, and a console error
(`NodeMaterial: Material "ShaderMaterial" is not compatible`). It cannot "stay WebGL" inside a WebGPU frame: one
renderer draws a frame, and WebGPURenderer cannot run GLSL `ShaderMaterial`s or `onBeforeCompile` patches on either
backend. String patches of `kit.js`'s GLSL are given the GLSL to patch (so nothing throws), but nothing draws it.

**Any tier:**
- **Waterpark and pool rooms:** their animated water, glaze, curtains and fountains are drawn as the plain surface under
  them, still. These rooms are locker-showers, office-beach-day, dive-tower, flooded-cubicles, flume-connector,
  whirlpool-flume, kiddie-lagoon, bellmouth-baths, return-pool, hanging-changing, channel-hall, nested-thresholds,
  lazy-river, wave-pool and deep-end.
  - The locker-showers floor mirror (also in office-beach-day, dive-tower and flooded-cubicles) is not drawn at all.
- **Forest rooms:** bog and puddle water and its caustics, and the mist veils, are flat or missing. These are
  burn-scar, tree-farm, clear-cut, old-growth, inverted-grove, timber-lot, windthrow, blaze-junction, hollow-tree,
  canopy-walk, fire-lookout, campfire-circle, bog-boardwalk and nursery-aisles.
- **The Sets:** the CCTV feed on the TV is not checked. It is a WebGLRenderTarget drawn mid-frame, which may work, since
  WebGPURenderer takes render targets.
- **The extinguisher's spray and white-out, and the glow under paper fires:** flat quads.
- **The inventory's icons:** unaffected. They are drawn by their own second WebGL renderer with their own Lambert material, onto PNGs.
- **Co-op:** its client makes its own WebGLRenderer and does not read the flag.

**Medium, High, Auto** (on top of the above): these draw as Classic plus their grade and haze. That means no
supersample, no bloom or glow, no light maps (tube shadows, doorway light), no floor sheen, no flashlight shadows, and
no water view.

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
| Held things | `hand.js` `holdInFront` | held items in front of the room: mid-pass depth clear, or `gl.depthRange` | a separate pass for held items, or squeeze their clip-space z in the vertex node | M | no mid-pass clears in WebGPU | **guarded** (drawn as is) |
| Extinguisher spray | `spray.js` (two materials) | instanced soft puffs; full-screen white-out | `SpriteNodeMaterial`-like node or `instancedBufferAttribute` | S | instancing | not started |
| Paper-fire glow | `inventory-fire.js` | additive orange pool | `MeshBasicNodeMaterial` with an opacity node | S | co-op finds it by name | not started |
| Inventory icons | `inventory-icons.js` | its own WebGLRenderer and its own Lambert material, rendered to PNGs | keep WebGL (separate canvas), or port to save a context | S | none: it shares no material with the stage | **unaffected** |
| Pool optics | `pool-optics.js` | patch: rippled pool texture plus the ceiling's lamps at grazing angles | a hook in `kit-node` (a `mapUv` and an `extra` node) | S | exact kit text | not started |
| Room string patches | locker-showers (`glaze`, `fold-screen`, `assets`, `water.js`), `flume-connector/water.js`, `whirlpool-flume/siphon.js`, `kiddie-lagoon.js`, `bellmouth/art.js`, `return-pool/art.js` | moving water, glaze, curtains, fountains, UV drift | give `kit-node` hook points (uv, colour, alpha, position) and port each patch as a small node | S each, M together | each is written against kit's GLSL text | not started |
| Showers mirror | `locker-showers/water.js` | a floor sheet reflecting the room (oblique clip), drawn from `onBeforeRender` | `ReflectorNode` (three.js ships one in TSL) | L | nested render inside a render; `renderer.state`, `renderer.xr` | not started |
| Forest water | `forest-fx.js` WATER and CAUSTIC (a kit material with its shaders replaced) | voxel ripples, footstep rings, depth tint, Fresnel, foam; caustic web | own NodeMaterial | M, S | uniform arrays (`uRipples[6]`) | not started |
| Forest mist | `forest-maze.js` veils | drifting translucent sheets fading near the eye | NodeMaterial | S | `discard` | not started |
| Forest shafts | `forest-fx.js` | god-ray cones and pollen | NodeMaterial | S | none: not reached (no room asks for it) | not started |
| The Sets TV | `rooms/the-sets.js` | live CCTV into a 160 × 120 target, 5 fps | `RenderTarget`, probably as is | S | the target is sRGB | **not checked** |
| `PointsMaterial` | `rooms/the-grotto.js` | 4.5 cm points | `SpriteNodeMaterial` or instanced quads | S | WebGPU draws points 1 px | not started |

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
2. **Every tier looks right, M in all:** the hook points in `kit-node` (uv, colour, alpha, position). Then the room
   string patches (each S), `pool-optics.js`, spray, the paper-fire glow, forest mist, forest water and its caustics.
   Then held things in their own pass. Then the-grotto's points, and checking The Sets' TV.
   After this the flag is playable everywhere at Classic, except the locker-showers mirror.
3. **The showers mirror, L:** `ReflectorNode`.
4. **Medium:** supersample (S), light maps (M), sheen (M), and glow (L). For the glow, an emissive MRT output from the
   surface replaces the twin redraw: cheaper than today, not just ported.
5. **Water, L, the biggest single piece:** `viewportSharedTexture` and `viewportDepthTexture` replace the copy pass;
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
