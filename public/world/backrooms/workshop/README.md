# Backrooms Workshop — Candidate Rooms, Entities & Items

Self-contained expansion slate designed for **Fable** to cherry-pick or merge whole into `public/world/backrooms/`. Every file is zero-dependency ES module code using `Vox` (2.5 cm voxels), procedural canvas textures, vertex-baked lighting, and synthesized WebAudio cues from `sound.js`.

## Integration Footprint

Everything lives inside `public/world/backrooms/workshop/`, wired into the live deck through **two tiny seams** so individual rooms or creatures can be toggled in seconds:

- `public/world/backrooms/gen.js` — imports `WORKSHOP_DECK` & `WORKSHOP_STASH` from `./workshop/deck.js`.
- `public/world/backrooms/rooms5.js` + `rooms4.js` — registers `MORE4` builders (`wellness-pool`, `pipe-dreams`, `night-shift`, `exit-interview`).

---

## Candidate Slate (Wave 1)

### 1. Item — Almond Water (`items/almond-water.js` + `state.js`)
- **Lore inspiration:** Object 1 (*Almond Water*), reimagined as *Complimentary Almond Beverage*.
- **Visuals & HUD:** 2.5 cm `Vox` cream-and-slate gable-top carton (`almondCartonVox`, `almondEmptyVox`). Carried state lives in a per-visit `WeakMap` (`getWorkshop(env)`) and renders a wordless picture-only carton icon (`.br-almond`) in `.br-frame` without touching `.br-carry`.
- **Cross-entity utility:**
  1. **Tames the Paper-Wing Desk Moth** (`E`) to guide you to the doorway leading shortest toward `Way out`.
  2. **Passive one-hit sanity/splash shield** against **The Smiler** (shatters on contact, blinding and banishing it instead of ending the run).
  3. **Giftable (`E`) to The Night Porter** to earn a polite bow and unlock the custodial supply locker.

### 2. Friendly Creature — Paper-Wing Desk Moth (`creatures/desk-moth.js`)
- **Lore inspiration:** Entity 4 (*Male Deathmoths*).
- **Behavior:** Cat-sized fuzzy moth with articulated `DoubleSide` manila-envelope wings stamped in red and glowing amber compound eyes. Startles to another sconce if sprinted at; press `E` empty-handed and it chirps (`'squeak'`) and flutters over to hint at nearby Almond Water; offer Almond Water (`E`) and it drinks (`'glug'`) and flies across the room to perch above the shortest exit-ward doorway, fanning its wings.

### 3. Hostile Creature — The Smiler (`creatures/smiler.js`)
- **Lore inspiration:** Entity 3 (*Smilers*).
- **Behavior:** Inverse of Capt. Legacy. Dual-material `Vox` rig: un-dimmed `glow()` crescent eyes and jagged grin blaze in pitch darkness while its coiled black phone-cord body and crooked tie stay invisible until hit by your camcorder `LIGHT` or room lamps. Shining your camcorder `LIGHT` at it while standing agitates it (`interfere` + `'seek'` hiss) into lunging (`3.35 m/s`).
- **Counterplay:** Look away and crouch (`C`), open a **Steam Release Valve** (`E`), throw the **Utility Breaker** (`E`) to flood the tunnel with light and banish it into its ceiling hole, or carry **Almond Water**.

### 4. Neutral Creature — The Night Porter (`creatures/faceling.js`)
- **Lore inspiration:** Entity 9 (*Facelings*).
- **Behavior:** Tall featureless custodian in slate coveralls with a blank nametag, endlessly mopping dry carpet beside a tippable yellow caster `mopBucketVox`. Politely nods if you walk past; sprint into its bucket (`speed > 2.85`) and it tips over (`'thunk'` + `'wade'`), snapping the Faceling's blank head toward you as it marches over with raised mop to herd/slow you (`slow = 0.58`, non-lethal). Righting the bucket (`E`) or offering Almond Water (`E`) earns a deep bow and fires `onReward()`.

---

## Candidate Rooms (`rooms/`)

| Archetype ID | Name | Lore Inspiration | Highlights & Gameplay |
|---|---|---|---|
| `wellness-pool` | **Wellness Suite** | Level 37 (*The Poolrooms*) | Glazed seafoam/white tile walls, sunken turquoise shallow pool (`wade` footsteps, `sinkTo = 0.24`, expanding ankle ripples), 4 tiled columns with warm brass sconces, spa bench + towels + Almond Water, and **Paper-Wing Desk Moth**. |
| `pipe-dreams` | **Pipe Dreams** | Level 2 (*Pipe Dreams*) | Stained concrete tunnel, overhead & wall pipe banks with stenciled corporate labels (`LIQUID SYNERGY`, `DO NOT VENT`), 2 interactive spinning **Steam Valves** (`E`), timed **Utility Breaker** (`E`) that lights overhead worklamps & turns off camcorder `LIGHT`, and **The Smiler**. |
| `night-shift` | **Night Custodial** | Level 4 (*Abandoned Office*) | Dim late-night office with rain-streaked nocturnal windows, chairs stacked upside-down on desks, `CAUTION / DRY FLOOR` sign, **The Night Porter** + tippable mop bucket, and a locked steel **Supply Locker** that swings open on reward (Almond Water + exact room distance & landmark to `Way out`). |
| `exit-interview` | **Exit Interview** | *Fake Exits / Retention Loops* | Partition styled identically to the real `exit` (warm under-door glow, frosted pane, doormat, green sign) — except the sign reads `EXIT INTERVIEW` / `EXIT (TRIAL)`. Opening it reveals an **HR Retention Booth** with consolation Almond Water; stepping blindly inside warps you (`player.warp`) into a deeper plain room once per visit. |

---

## Standalone Preview URLs

Start the daemon (`npm run dev`) and open:

- `/world/dev/backrooms.html?seed=7&room=wellness-pool&pursuer=0&loot=1`
- `/world/dev/backrooms.html?seed=7&room=pipe-dreams&pursuer=0&loot=1`
- `/world/dev/backrooms.html?seed=7&room=night-shift&pursuer=0&loot=1`
- `/world/dev/backrooms.html?seed=7&room=exit-interview&pursuer=0&loot=1`
- Full visit with all 4 workshop rooms dealt in:
  `/world/dev/backrooms.html?seed=12&only=wellness-pool,pipe-dreams,night-shift,exit-interview&loot=1`
