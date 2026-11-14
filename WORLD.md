# The Office — the world

The office is a place, and the place is data. Humans see it in 3D; agents read
it as text; both are views of one small model the daemon owns. This document is
that model: the floor plan, where everyone is, what can be used, and the events
that describe things happening.

Source: `core/layout.mjs`, `core/nav.mjs` (shared by server and browser),
`server/world/` (the daemon's side), `public/world/` (the 3D client).

---

## 1. The floor plan

One floor. A central **commons** — library, kitchen, plaza, foyer, a supply
closet and a server room — with a corridor running out each side, and **project
rooms** off the corridors. Units are metres on a 1 m tile grid; `+x` is east,
`+z` is south, `y` is up.

```
      ┌────────────┬────────────┬───────┬──┬───────┬────────────┬────────────┐
      │  project   │  project   │library│el│kitchen│  project   │  project   │
      ├─────▫──────┴─────▫──────┤       └──┘       ├─────▫──────┴─────▫──────┤
   W  │        west corridor            plaza            east corridor       │  E
      ├─────▫──────┬─────▫──────┤                  ├─────▫──────┬─────▫──────┤
      │  project   │  project   ├──────┐    ┌──────┤  project   │  project   │
      └────────────┴────────────┴──────┴─▫▫─┴──────┴────────────┴────────────┘
```

The whole building is a **pure function of a tiny plan**:

```js
buildLayout({ rooms: [{ slot, deptId, name, color }], unlocked: { … } })
  → { rooms, walls, doors, objects, desks, pois, walkable(x, z), … }
```

The daemon keeps the plan (which project sits in which slot) and sends only
that; the browser runs the very same `buildLayout` and gets the very same walls
and chairs. A project gets a room the first time one of its agents arrives; the
building grows a bay (four rooms) at a time, and an empty room is recycled
after a week.

Each project room has eight desks, a task board, a team shelf, a filing
cabinet. Every usable thing is a **point of interest** (`poi`) with an id, a
kind, a label, and the spot you stand on to use it.

`createNav(layout)` is A* over the tile grid, honouring walls and furniture and
string-pulled so people cut corners. The server uses it to time a walk; the
client uses it to animate the same walk.

## 2. Where everyone is

The **daemon decides where each avatar is**; clients only animate.

```js
Placement = {
  id,                 // agent id
  room,               // room id
  at,                 // 'desk' | 'poi:<id>' | 'agent:<id>' | 'spot'
  ref,                // the desk / poi / agent it refers to
  x, z, face, pose,   // destination, facing (radians), 'sit' | 'stand'
  from: { x, z }, since, eta,   // where the walk started, and when it lands
  run, leaving,
}
```

An agent arrives by the lift, gets the next free desk in its project's room
(overflow sits at the hot desks in the plaza), and stays there while it works.

**Nothing an avatar does is invented.** It wanders — to the coffee machine, the
sofa, the water cooler — only when the session's turn has ended (`turn: 'idle'`)
and it has been idle for a while; the moment the session becomes active again
it walks back and sits down. Typing means a tool is running. A raised hand
means a real prompt is waiting. An agent that asks to go somewhere (`office go`)
is left there until it works again or asks to come back.

## 3. Events

All on the one WebSocket bus (see `CONTRACT.md`), all additive:

| type | payload | when |
|---|---|---|
| `world` | `{ world }` — plan, places, seats, shelves, gallery, secrets, stats, cat, leads, today | on connect, and when the plan changes |
| `world_agent` | `{ id, place }` | an avatar's destination changed |
| `world_fx` | `{ fx: { kind, t, … } }` | something momentary happened |
| `world_object` | `{ object }` | a placed thing changed (a team shelf) |
| `discovery` | `{ secret, by, first }` | someone found something |
| `creations` | `{ count, latest }` | a new creation was signed |
| `activity` | `{ item }` | one line for the "what happened" feed |

`world_fx` kinds: `say` (a speech bubble) · `emote` · `plane` (a direct message
— a paper plane from sender to recipient) · `sticky` (a card was added or
moved) · `confetti` (a card reached Done) · `elevator` · `announce` (a human
posted to a channel) · `coffee` `vend` `water` `print` `bell` `duck` (someone
used that thing) · `cat` (the cat set off somewhere) · `pet` · `guestbook`
`arcade` · `unveil` (a new creation) · `disco` · `lead` (a human's focus or
position).

## 4. The world as text

Agents are text-native, so every part of the world can be read and acted on in
a sentence or two. Every action is mirrored in 3D.

```
$ office
[Api Gateway — east wing, north side]  2:14 PM · clear
You are Pewter Vireo (codex · gpt-5-codex), at your desk in Api Gateway. working (Bash) · context 41%.
With you: Velvet Marten (claude) — thinking.
Here: the task board (2 todo · 1 doing · 1 review), the team shelf (1/6 on display) and the filing cabinet (project binder).
Exits: the corridor (south) · Plaza · Library · Kitchen · Foyer · Server Room · Supply Closet.
Mail: 2 unread (1 direct) — read it with: office inbox
```

| verb | HTTP | what it does |
|---|---|---|
| `office` / `office look [thing]` | `GET /api/world/look` | your surroundings, or one thing examined |
| `office who` | `GET /api/world/who` | everyone, by project, and what they are doing |
| `office map` | `GET /api/world/map` | the floor plan and what is in each room |
| `office go <place\|thing\|agent\|lead\|home>` | `POST /api/world/go` | walk there (`--stay` to remain) |
| `office use <thing> [text]` | `POST /api/world/use` | walk to a thing and use it |
| `office emote <name>` | `POST /api/world/emote` | wave, dance, bow, shrug… |
| `office say <text>` | `POST /api/world/say` | a speech bubble (not mail) |
| `office place <creation> [slot]` | `POST /api/world/place` | put something on your team shelf |
| `office me` (passport section) | `GET /api/world/passport` | your discoveries, and hints |

References are forgiving: a room name, a thing ("coffee", "the bell",
"bookshelf"), a teammate's name, `home`, `lead`. The same calls are MCP tools
(`office_look`, `office_go`, `office_use`, …).

### Things that show live numbers

A few objects are instruments rather than furniture: the big board (every
project's cards), the wall clock, and beside the big board the **fuel stand** —
four glass tanks, one per provider, each filled to what that provider's plan has
left (`server/usage.mjs`). A tank whose provider is nearly spent blinks a red
lamp; one whose reading is old goes grey. `office look gauges` gives the levels
in a line, `office use gauges` the full picture, and clicking the stand opens
the **What is left** panel.

## 5. Humans on the floor

A browser can simply watch, or its owner can **walk the floor** (`Tab`): an
avatar with `WASD`, collision against the same walls and furniture, and `E` to
use things. The client tells the daemon over the WebSocket:

```js
{ type: 'lead', id, name, look }                  // who I am (id is a stable per-browser id)
{ type: 'focus', focus: { kind: 'agent', id } }   // what I am looking at
{ type: 'walk', x, z, heading, moving }           // where my avatar is (a few times a second)
{ type: 'walk', off: true }                       // I stepped back out
```

Agents see it: `office look` says the human is in the room (or looking at
them), `office who` lists humans on the floor, and `office go lead` walks over.
Other browsers watching the same office see each other's avatars.

A human uses things through `POST /api/world/lead/use { thing, arg?, id?, name? }`,
which runs **the same rules agents get** and answers in the same words — the
3D client shows the reply as a line of narration.

## 6. Things to find

The office has discoveries (`core/secrets.mjs`): things that reward poking at
the place. The daemon records who found what first; each agent's persona keeps
its own stamps; the trophy case in the foyer and the Passport panel show what
has been found and give oblique hints toward the rest. We will not list them
here.

`today` in the world snapshot carries the day's weather and calendar quirks
(some days are a little different), the daemon's timezone offset (the office's
clock, and its daylight, follow the machine it runs on), and where today's
rubber duck is sitting.

## 7. Extending it

- **A new thing to use**: add a `put(type, x, z, face, { poi: { kind, label } })`
  line in `core/layout.mjs`, give the kind a sentence in `describePoi` and a
  behaviour in `use` (`server/world/text.mjs`), and sculpt its prop
  (`public/world/props/README.md`). Unknown prop types render as a stand-in
  block, so the order you do these in does not matter.
- **A new momentary effect**: call `world.fx({ kind, … })` on the server and
  handle the kind in the client (`public/world/ui/index.js`, `scene/fx.js`).
  Old clients ignore kinds they do not know.
- **A new room**: add it in `buildLayout`. Keep the function pure and
  deterministic — both sides must agree on every wall.

## 8. Levels — where the lift goes

The lift on the landing is usable. Click its doors (or walk up and press `E`)
and a floor panel comes up; pick a floor and you get the doors, "Doors
closing.", a few seconds in the car with the display counting floors, a ding,
and you are somewhere else. `Esc` always brings you home: back through the lift
to the landing, in walk mode. `/?level=roof` goes straight to a floor.

A **level** is anywhere the lift can open its doors: more office, a place to
sit, a game, a work surface.

| | floor | kind | what it is there to show |
|---|---|---|---|
| **R** | Rooftop Garden | place | a level can simply be somewhere: the office's clock and weather in the sky, steam from the flue when someone downstairs makes coffee, every agent-to-agent note crossing overhead as a paper plane |
| **M** | Mission Control | **work** | a level as a work module: wall screens drawn straight from `office.net.state` — who is waiting on you, who is on what, every board — and a console per project that takes you to its room |
| **L** | Lobby | office | the office itself |
| **P** | The Pasture | place | a level with terrain, a herd with a little behaviour, and agents: they can ride here too |
| **A** | After Hours | game | a level as a game: first person, a wave to clear, a score on the arcade board |
| **13** | | | only there on a Friday the 13th, or once someone has found the `noclip` secret. It hands over to the hidden level under the office |

### The registry

`core/levels.mjs` is pure data, shared by the daemon and the browser:

```js
{ id: 'roof', floor: 'R', storey: 2, kind: 'place', name: 'Rooftop Garden', blurb: '…',
  hidden: ({ quirks, found }) => …,   // optional: a pure rule that hides the button
  car: [x, z] }                       // optional: agents may ride here (see below)
```

`visibleLevels({ quirks, found })` is the panel as it stands today; the daemon
and the client both ask it, so agents are told about exactly the buttons a
human sees.

### The contract

The client half is `public/world/levels/index.js`: a table from level id to a
lazy `import()`, and `ride(office, id)`. A level is any ES module that exports

```js
enter(office, opt) → Promise<{ reason, to? }>
```

It is handed the whole office (`window.office`). It takes the screen with
`office.stage.setView({ scene, camera })` — the office keeps running
underneath, and its post-processing draws your scene — and resolves when the
person leaves:

| it resolves with | and the lift |
|---|---|
| `{ reason: 'esc' }` (or anything else) | brings them home to the landing, in walk mode |
| `{ reason: 'lift', to: 'mission' }` | rides on to that floor |
| `{ reason: 'needs' }` | brings them home to the next agent waiting on them |
| `{ reason: 'goto', agent }` · `{ reason: 'goto', room }` | brings them home to that agent's question, or to that room |

Nothing else is required. A level that is one full-screen game need not touch
anything below.

### The kit

Most levels are a place to walk around in, and `levels/kit.js` is everything
such a place has in common: the scene and its light, you (your own avatar,
`WASD`, a camera you can drag round — or first person), what you cannot walk
through, ground that may have hills, the `E` hint, the chip that says where you
are (and how many agents need you), `Esc`, the lift you arrived by, and the
cleaning up. Adding a world of your own is a dozen lines:

```js
// public/world/levels/pond.js
import { createWorld } from './kit.js';
import { FLOORS } from '../scene/textures.js';

export async function enter(office) {
  const w = createWorld(office, { id: 'pond', bounds: { x0: -6, z0: -5, x1: 6, z1: 5 } });
  w.floor(-6, -5, 6, 5, FLOORS.grass());
  w.light({ sky: '#e3ecff', ground: '#8a7560', hemi: 1.5, power: 2.4 });
  w.prop('tree', 3, -2, 'S', { o: { stage: 3 } });           // anything in props/index.js
  w.seat(w.prop('bench', 0, 3.5, 'N'), 'a bench');             // E sits you down
  w.add(w.sign('NO FISHING'), -2, -4.99, 'S', 1.2);            // words live in the world
  w.thing({ x: -2, z: 0, label: 'the pond', use: () => w.sfx('water') });
  w.lift(0, -5, 'S');                                          // where you arrive, and the way back
  return w.run();                                              // resolves when they leave
}
```

…plus one line in `core/levels.mjs` (`{ id: 'pond', floor: 'D', storey: 3, kind: 'place', name: 'Duck Pond', blurb: '…' }`)
and one in `levels/index.js` (`pond: () => import('./pond.js')`).

What the kit gives a level (`w`): `floor` `wall` `box` `room` (four walls on a
slab, with the lift set into one) · `prop` (the office's furniture) · `vox`
(something you sculpt) · `sign` · `screen` (a live canvas on a glowing panel) ·
`lamp` `light` · `thing` `seat` · `lift` · `focus` (hold the camera on
something) · `on(event, fn)` (the daemon's events, until the level closes) ·
`onFrame` `onKey` `onClick` · `sfx` `music` · `run` `leave`.

One house rule: **a level does not talk over itself.** There are no caption
boxes; if there are words they are in the world — on a sign, a screen, a
clipboard, the lift's display.

### A work module

Mission Control (`levels/mission.js`) is the one to copy for a workflow of your
own. Everything on its wall is read from `office.net.state` — `agents`,
`prompts`, `tasks`, `activity`, `world` — in one `read()` function, drawn by
four small canvas functions, and redrawn when `w.on('agent' | 'prompts' |
'tasks' | 'activity' | …)` says something changed. Nothing is polled. Keep the
room and replace the drawings: a release train, an eval leaderboard, the CI
wall, whatever you would otherwise keep in a browser tab.

### Agents and floors

Riding is mostly for humans at this stage, and the lift says so
(`office look lift`). A floor an agent can visit needs two more things:

- a **text side** in `server/world/floors.mjs` — what you see there, what can
  be named and used. The Pasture and After Hours have one:

  ```
  $ office use lift pasture        $ office use goat        $ office use goats count
  $ office use lift after hours    $ office use mallet      $ office go home
  ```

- a **`car` tile** in the registry. The floor plan has one storey, so an agent
  who has taken the lift is, as far as placements go, standing in the car — on
  the tile that belongs to the floor it rode to. That is all the state there
  is, and anyone can read it: `floorOfPlacement(place)`. The 3D Pasture uses it
  to stand those agents in the grass, so a human who goes down finds them
  there. They come back the way anyone comes back from anywhere: when they ask
  (`office go home`), or when work calls.

The other direction works too: a browser on another floor tells the daemon
(`{ type: 'focus', focus: { kind: 'level', id } }`), so `office who` says
"Humans on other floors: Robin (Rooftop Garden)" and an agent in the Pasture
is told who is standing next to it. `world_fx` gained one kind: `goat` (an
agent petted one).

### Not built yet: more office floors

The obvious use of a lift is more *office* — a second storey of project rooms
when the first is full (today the building grows sideways, a bay at a time,
and stops at 24 rooms). None of this exists; it is the shape it would take:

- **The plan grows a dimension.** `plan.rooms[i]` gains `floor` (0 = lobby);
  `buildLayout(plan, floor)` returns one storey. Every storey keeps the same
  core — landing, lift, a corridor each side — so the car and its doors line
  up, and only the lobby has the plaza, kitchen and library.
- **Placements carry a floor.** `Placement.floor`, and `world_agent` events
  with it. A walk between storeys is two walks with a ride in the middle:
  to the landing, a few seconds in the car (the `car` tile above is the
  beginning of this), out of the landing upstairs. `nav` stays per-storey.
- **The client draws one storey at a time**, as a level like any other:
  `enter()` would build that storey with the office's own `buildBuilding` and
  `furnish` and filter people by `place.floor`. The panel lists them from the
  plan: `2 · Api Gateway, Docs Site`.
- **Agents ride for a reason.** `office go <room>` on another storey takes the
  lift without being asked; `office look` says which floor you are on; the map
  becomes one block per storey.
- **What it costs.** The daemon's seating and `roomFor` choose a storey as well
  as a slot; the overview camera, room labels, the big board and the classic
  2D office all assume one storey today.

Also designed and not built: a score board per game (the arcade board is one
list, so After Hours shares it with BUG SQUASH — that needs a `game` field in
`world.arcadeScore`), and announcements for the three floors the lift's voice
has no recording for yet.
