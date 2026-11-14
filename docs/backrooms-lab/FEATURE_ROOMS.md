# Horror feature room candidates

Three independent authoring previews follow the quiet-maze study. They are
rare feature candidates for Fable to assess, not a change to the production
room deck or the proposed 60–80% repetitive connective space.

| Study | Main experience | Room card |
| --- | --- | --- |
| `underfloor` | Crawl beneath a shadow inhabitant that peers and reaches through damaged grates. | [Underfloor Walker](UNDERFLOOR.md) |
| `flood-mark` | Read the receding water to follow a crooked path between dry islands. | [Flood-Mark Hall](FLOOD_MARK.md) |
| `window-court` | Navigate an immense enclosed court and choose whether to follow a neutral figure. | [Window Court](WINDOW_COURT.md) |

Start `node tools/backrooms-offline/preview.mjs --port 44324`. Open
`http://127.0.0.1:44324/world/dev/backrooms.html?study=underfloor&seed=713&vhs=2`
and change `study` to either other key. Each visit has an ordinary arrival
room, one feature room and the existing exit. Click to enable mouse look and
sound. The normal walking, crouching, interaction and picture controls apply.
No real Office agents, accounts or persistence are needed.

All three use original procedural geometry and the project's existing visual
and sound tools. They emphasize environmental horror, traversal and behavior;
none relies on an office joke, tutorial sign or written explanation in the
room. Specific community-wiki inspirations are recorded in their room cards.

## Integration

`feature-study.js` is a pure, seeded fixture generator. The standalone dev page
imports only the requested candidate and passes it through the existing
debug-only level-factory/builder hooks. Normal `gen.js`, `DECK`, pursuit and
collectible placement are unchanged. No new dependency or binary asset is
required. The builders and pure plans are separate so Fable can adopt a room
without adopting the preview layout or encounter frequency.

These are local, finite encounters. Multi-room streaming, save/load of encounter
state and production encounter selection remain integration work. The builders
must retain a traversable doorway route, preserve collision in the runtime
audit, and keep temporary effects local to their room.

## Verification of the first playable versions

- All 18 new tests pass (fixture, Underfloor, Flood-Mark and Window Court).
  The complete suite reports 267/268 passing with `TMPDIR=/private/tmp`.
  The remaining status-line test fails on the unchanged baseline too:
  `test/usage.test.mjs:197`, absent usage reading (`source` on undefined).
- Each feature builds at seeds 713, 22 and 41 with every doorway reachable,
  no isolated walkable floor cells, no flattened-room fallback, no disabled
  structural collider and no browser warning or error. The normal exit works
  for all three studies.
- Actual-controller checks cover the entire Underfloor crawl and its refuge
  recovery, both directions of the Flood-Mark zigzag and depth-dependent
  recovery, and both Window Court routes after the guide opens its shutter.
- Quiet Maze still builds with its four static anomalies, and the normal
  Dispatch preview still has a reachable crate route. These previews reported
  no warnings or errors after the dev-page wiring changed.
- Eye-level VHS screenshots were inspected. Timing, tension and whether the
  guide's offer feels uncanny still need human playtesting.

## Underfloor shadow encounter follow-up

The Underfloor prototype now has a continuous, articulated upstairs inhabitant
with grate-only sight, a telegraphed reach, dodging and refuge recovery. It also
replaces the overlapping deck/masonry surfaces and encloses the upper office.
The other two candidate rooms and production generator are unchanged.

All 12 Underfloor tests pass, including cover, warning time, catches, dodges,
frame-rate consistency and disjoint deck geometry. The full suite reports
275/276 passing; the same baseline status-line failure above remains.
Browser checks at seeds 713, 22 and 41 retain every structural collider,
reachable doorway and free floor cell without warnings or fallback. The
actual player completed the crawl through all refuges with zero recoveries,
dodged a committed reach, and deliberately triggered one correct checkpoint
recovery. Frozen timing, refuge safety, leaving during a pending grab and the
normal exit also passed. Clean and VHS views were inspected at crawl height.
