## Clipping

The owner, from reference pictures: "assets clipping through walls … a design space we haven't done yet." Empty,
uniform rooms, each different by one small wrong thing: an ordinary object half inside the structure. Emptiness plus
one wrong thing, not office furniture. These are our own versions of the idea.

**Status: a preview.** Only with `&preview=clip` on the dev page. Without it the three rooms build exactly as before
(below), and nothing in the game passes the flag.

### What was built

- `public/world/backrooms/clipping.js`: `clip(c, what, x, z, opt)` puts an ordinary thing down (a catalogue type as
  `c.prop` takes, or any meshed voxel model) with part of it inside a wall, the floor or the ceiling.
  - **The cut** is made on the geometry once, at build time: every triangle is clipped against the room's shell (its
    four walls, floor and ceiling, each 1 cm behind its face), and against any planes the room adds (`cut`), with
    every vertex attribute carried along the cut edge. The shell's walls are one sheet each and rooms stand 20 cm
    apart, so nothing reaches the next room or the void. Nothing is done per frame.
  - What is left goes into the room's voxel batch through `c.place`, so it is baked and lit as everything else, on the
    half-voxel grid (positions snapped to 1.25 cm), with a contact blot on the carpet or on the ceiling tiles.
  - **Solid** only where it stands in open space at a body's height (as `c.place` decides), and never where it would
    meet the lane in front of a doorway (its width and 35 cm either side, 1.3 m in). Never `keep`, so the level's own
    no-trap check could still drop it. Never furniture: it cannot be dragged.
  - It reads no seeded stream: every choice is fixed, or taken from what the room already rolled.
- `world.js`: `c.propModel(type, o)`, what `c.prop` would put down without putting it down (six lines).
- `index.js`: `env.preview`, a Set from the dev page's `opt.dev.preview`; empty otherwise (two lines).
- `dev/backrooms.js`: `&preview=clip` → `opt.dev.preview` (two lines, and its line in the head of the file).

### The three rooms

Chosen from the first-floor audit's bottom five ("plain office"); their code confirms the play is thin: an empty room
with a phone that rings, a room whose doorway faces a blank wall, a dead end whose desk is out of view.

| room | the wrong thing |
|---|---|
| phone | the desk the phone was on has gone down into the carpet to its top, square to the room; its chair is down to the seat behind it. The phone sits on the desk top, its cord running off it. Walked over: nothing of it is solid but the chair's back |
| nested | an office chair coming out of the meeting room's blank wall at an angle, its back inside: the wall the way in looks at, or the right-hand one where the way in looks at its door. Cut at the middle of that wall, so nothing of it is in the meeting room. Its seat, in the corridor, is solid |
| cover | a filing cabinet coming down out of the ceiling upside down in front of the shutter, drawers to the room, the box that was on top of it hanging under it. Moved back a tile at a time from any ceiling light. Above anybody's head: not solid |

### Try it

```
/world/dev/backrooms.html?seed=7&room=phone&preview=clip&pursuer=0&mute=1
/world/dev/backrooms.html?seed=3&room=nested&preview=clip&pursuer=0&mute=1
/world/dev/backrooms.html?seed=7&room=cover&preview=clip&pursuer=0&mute=1
```

Drop `&preview=clip` for today's room. Pictures, each from the doorway, inside and close, at Classic and Medium, and
today from the doorway: `docs/previews/clip-<room>-<door|inside|close|today>-<classic|medium>.jpg`.

### Proof

- `test/backrooms-clipping.test.mjs`: the cut leaves nothing outside its planes; a chair through a wall, a desk in the
  floor and a cabinet out of the ceiling and a wall leave no vertex outside the room; solid only in open space and
  never in a doorway lane; on eight seeds with the three rooms dealt, every doorway is still reached, nothing had to
  stop being solid, and no cell reachable before is lost except next to the thing itself; without the flag (or with
  an empty one, or another preview's) the rooms hash the same as today's and have nothing clipped; the room's seeded
  stream is at the same place after building whether the preview is on or not.
- A whole-floor comparison (every room's geometry, baked light, light maps and lamps, Classic and Medium, lighting off
  and dim) on yellow seeds 7 and 21, whole and with the three rooms dealt: the same to the byte as before this change
  without the flag.

### Not done

- Looked at only from the three views in the pictures, at Classic and Medium; Low and High, `vhs=2`, and a phone, not.
- No stash change: on a visit with loot, a coin could land on the sunk desk's top in phone.
- Other objects the references suggest (a door flat in the floor, a sign out of the floor, a light fitting low on a
  wall, words on a wall) are not placed; `clip` takes any of them.
