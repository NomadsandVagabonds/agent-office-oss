// Under the office. Every shot is the level's own camcorder; the hand holding it is scripted.
//   rig/film shots/backrooms.mjs --shot standees
import { backroomsShot, TRUNK, LAB, WORKSHOP, LATEST } from './lib.mjs';

export const shots = {
  // you fall in
  fall: backroomsShot({ seed: 7, settle: 0, seconds: 5.5,
    path: [[0, { yaw: 0, pitch: 0.1, fwd: 0 }], [1.6, { yaw: 0, pitch: 0, fwd: 0 }], [3.2, { yaw: 0.5, pitch: 0.02, fwd: 0 }, 'io'], [5.5, { yaw: -0.25, pitch: 0, fwd: 0.5 }, 'io']] }),

  // the cardboard people only move when you are not looking
  standees: backroomsShot({ room: 'cutouts', at: { yaw: 0.1, pitch: 0 }, seconds: 7.5,
    path: [[0, { yaw: 0.12, pitch: 0, fwd: 0 }], [1.6, { yaw: 0.12, pitch: 0, fwd: 0 }], [2.15, { yaw: -1.5, pitch: 0.02, fwd: 0 }, 'io'], [4.3, { yaw: -1.55, pitch: 0.02, fwd: 0 }], [4.7, { yaw: 0.12, pitch: 0, fwd: 0 }, 'io'], [7.5, { yaw: 0.16, pitch: 0, fwd: 0 }]] }),

  // the meeting on the ceiling
  ceiling: backroomsShot({ room: 'ceiling-meeting', at: { yaw: 0, pitch: 0 }, seconds: 5.5,
    path: [[0, { yaw: 0, pitch: -0.05, fwd: 0.5 }], [1.6, { yaw: 0, pitch: 0.02, fwd: 0.5 }], [3.4, { yaw: 0.05, pitch: 0.62, fwd: 0.3 }, 'io'], [5.5, { yaw: -0.1, pitch: 0.72, fwd: 0 }, 'io']] }),

  // the stress pool
  pool: backroomsShot({ room: 'stress-pool', at: { yaw: 0, pitch: -0.12 }, seconds: 6.5,
    path: [[0, { yaw: 0, pitch: -0.1, fwd: 0.85 }], [2.5, { yaw: 0.05, pitch: -0.3, fwd: 0.85 }, 'io'], [6.5, { yaw: -0.2, pitch: -0.22, fwd: 0.8 }, 'io']] }),

  // the floor is a keyboard
  keyboard: backroomsShot({ room: 'keyboard-floor', at: { yaw: 0, pitch: -0.05 }, seconds: 6.5,
    path: [[0, { yaw: 0.06, pitch: -0.1, fwd: 0.7 }], [3.5, { yaw: -0.06, pitch: -0.02, fwd: 0.7 }, 'io'], [6.5, { yaw: 0, pitch: 0.06, fwd: 0.5 }, 'io']] }),

  // the corridor that gets smaller
  tiny: backroomsShot({ room: 'tiny-door', at: { yaw: 0, pitch: 0 }, seconds: 7,
    path: [[0, { yaw: 0, pitch: 0, fwd: 1 }], [7, { yaw: 0, pitch: -0.04, fwd: 1 }]] }),

  // please use the correct door
  doors: backroomsShot({ room: 'many-doors', at: { yaw: 0.6, pitch: 0.02 }, seconds: 5,
    path: [[0, { yaw: 0.7, pitch: 0.02, fwd: 0.25 }], [5, { yaw: -0.7, pitch: 0.04, fwd: 0.25 }, 'io']] }),

  // the party
  party: backroomsShot({ room: 'party', at: { yaw: 0, pitch: 0.02 }, seconds: 5,
    path: [[0, { yaw: 0.1, pitch: 0, fwd: 0.45 }], [5, { yaw: -0.04, pitch: 0.1, fwd: 0.45 }, 'io']] }),

  // hydration
  coolers: backroomsShot({ room: 'coolers', at: { yaw: 0, pitch: 0 }, seconds: 6,
    path: [[0, { yaw: -0.3, pitch: -0.06, fwd: 0.35 }], [2.5, { yaw: -0.05, pitch: 0, fwd: 0.4 }, 'io'], [6, { yaw: 0.02, pitch: 0, fwd: 0.45 }]] }),

  // team photo: stand on the cross
  photo: backroomsShot({ room: 'photo', at: { yaw: 0, pitch: 0 }, seconds: 7.5,
    events: [[0, "(() => { const h = __backrooms, d = h.level.rooms.find((r) => r.arch === 'photo'); h.goto('photo', 0, -d.D / 2 + 1.3, Math.PI, 0); })()"]],
    path: [[0, { yaw: 3.14, pitch: 0, fwd: 0 }], [2.0, { yaw: 3.14, pitch: 0, fwd: 0 }], [2.9, { yaw: 4.5, pitch: 0, fwd: 0 }, 'io'], [4.2, { yaw: 4.5, pitch: 0, fwd: 0 }], [5.6, { yaw: 1.8, pitch: 0, fwd: 0 }, 'io'], [7.5, { yaw: 1.8, pitch: 0, fwd: 0 }]] }),

  // employee of the month
  portraits: backroomsShot({ room: 'hall-of-fame', at: { yaw: 0, pitch: 0 }, seconds: 5.5,
    path: [[0, { yaw: 0.35, pitch: 0.02, fwd: 0.9 }], [2.5, { yaw: -0.4, pitch: 0.02, fwd: 0.9 }, 'io'], [5.5, { yaw: 0.3, pitch: 0.02, fwd: 0.9 }, 'io']] }),

  // the fire exit: down the stairs, and the floor at the bottom is a ceiling
  stairs: backroomsShot({ room: 'exit', at: { z: 2.9, yaw: 0, pitch: -0.1 }, seconds: 10,
    path: [[0, { yaw: 0, pitch: -0.18, fwd: 0.9 }], [10, { yaw: 0, pitch: -0.1, fwd: 0.9 }]] }),

  // the party, with the banner I like best: seed 37 hangs CONGRATULATIONS / ON YOUR INCIDENT over a cake that says SORRY
  // (stood to one side: from the middle, the cake's own little sign covers half the banner)
  cake: backroomsShot({ base: LATEST, seed: 37, room: 'party', at: { x: 2.1, yaw: 0.3, pitch: 0.0 }, seconds: 5,
    path: [[0, { yaw: 0.4, pitch: -0.04, fwd: 0.22, side: 0 }], [5, { yaw: 0.27, pitch: 0.02, fwd: 0.22, side: 0.08 }, 'io']] }),

  // further down: the floors are not the same floor
  archive: backroomsShot({ seed: 7, room: 'start', query: { depth: 1 }, at: { yaw: 0, pitch: 0 }, seconds: 5.5,
    path: [[0, { yaw: 0.7, pitch: 0, fwd: 0.15 }], [5.5, { yaw: -0.7, pitch: 0.02, fwd: 0.15 }, 'io']] }),
  night: backroomsShot({ seed: 5, room: 'plain', query: { depth: 1 }, at: { yaw: 0, pitch: 0 }, seconds: 5.5,
    path: [[0, { yaw: 0.5, pitch: 0, fwd: 0.4 }], [5.5, { yaw: -0.4, pitch: 0, fwd: 0.4 }, 'io']] }),
  exec: backroomsShot({ seed: 6, room: 'plain', query: { depth: 1 }, at: { yaw: 0, pitch: 0 }, seconds: 5,
    path: [[0, { yaw: 0.3, pitch: 0, fwd: 0.8 }], [5, { yaw: -0.3, pitch: 0, fwd: 0.8 }, 'io']] }),
  fitout: backroomsShot({ seed: 9, room: 'start', query: { depth: 1 }, at: { yaw: 0, pitch: 0 }, seconds: 5.5,
    path: [[0, { yaw: 0.7, pitch: 0.05, fwd: 0.15 }], [5.5, { yaw: -0.7, pitch: 0.05, fwd: 0.15 }, 'io']] }),

  // the team mascot. It was not standing there a moment ago.
  mascot: backroomsShot({ seed: 7, pursuer: 1, query: { depth: 1, wake: 1 }, settle: 0.1, aim: 'pursuer', seconds: 13,
    path: [[0, { yaw: 0, pitch: 0, fwd: 0 }], [2.4, { yaw: 0, pitch: 0, fwd: 0 }], [2.8, { yaw: 1.7, pitch: 0, fwd: 0 }, 'io'], [3.7, { yaw: 1.7, pitch: 0, fwd: 0 }], [4.1, { yaw: 0, pitch: 0, fwd: 0 }, 'io'],
      [5.6, { yaw: 0, pitch: 0, fwd: 0 }], [6.0, { yaw: -1.7, pitch: 0, fwd: 0 }, 'io'], [7.0, { yaw: -1.7, pitch: 0, fwd: 0 }], [7.4, { yaw: 0, pitch: 0, fwd: 0 }, 'io'],
      [8.8, { yaw: 0, pitch: 0, fwd: 0 }], [9.2, { yaw: 1.9, pitch: 0, fwd: 0 }, 'io'], [13, { yaw: 1.9, pitch: 0, fwd: 0 }]] }),

  // Dispatch (the lab branch): crates, a landslide of graphics cards, and two people packing them
  dispatch: backroomsShot({ base: LAB, seed: 713, room: 'freight', query: { only: 'freight' }, at: { x: 0, z: 11.5, yaw: 0.81, pitch: 0 }, seconds: 7,
    path: [[0, { yaw: 0.3, pitch: 0.02, fwd: 0.6 }], [3.5, { yaw: 0.9, pitch: 0.04, fwd: 0.6 }, 'io'], [7, { yaw: 1.2, pitch: 0, fwd: 0.3 }, 'io']] }),
  hoard: backroomsShot({ base: LAB, seed: 713, room: 'freight', query: { only: 'freight' }, at: { x: -3.6, z: 8.6, yaw: 0.75, pitch: 0.05 }, seconds: 6,
    path: [[0, { yaw: 0.6, pitch: -0.1, fwd: 0.4 }], [6, { yaw: 0.95, pitch: 0.16, fwd: 0.4 }, 'io']] }),
  workers: backroomsShot({ base: LAB, seed: 713, room: 'freight', query: { only: 'freight' }, at: { x: -1.5, z: 11.2, yaw: 1.19, pitch: 0 }, settle: 0.6, seconds: 12,
    path: [[0, { yaw: 1.19, pitch: 0, fwd: 0.25 }], [12, { yaw: 1.25, pitch: 0, fwd: 0 }, 'io']] }),

  // the workshop branch
  wellness: backroomsShot({ base: WORKSHOP, room: 'wellness-pool', at: { yaw: 0, pitch: -0.05 }, seconds: 6,
    path: [[0, { yaw: 0.2, pitch: -0.05, fwd: 0.6 }], [6, { yaw: -0.25, pitch: -0.12, fwd: 0.6 }, 'io']] }),
  pipes: backroomsShot({ base: WORKSHOP, room: 'pipe-dreams', at: { yaw: 0, pitch: 0 }, seconds: 10,
    path: [[0, { yaw: 0.15, pitch: 0, fwd: 0.7 }], [2.6, { yaw: 0.5, pitch: 0, fwd: 0.5 }, 'io'], [10, { yaw: 0.55, pitch: 0, fwd: 0.12 }, 'io']] }),
  porter: backroomsShot({ base: WORKSHOP, room: 'night-shift', at: { yaw: 0, pitch: 0 }, seconds: 6,
    path: [[0, { yaw: 0.3, pitch: 0, fwd: 0.5 }], [6, { yaw: -0.3, pitch: 0, fwd: 0.5 }, 'io']] }),
  interview: backroomsShot({ base: WORKSHOP, room: 'exit-interview', at: { yaw: 0, pitch: 0 }, seconds: 5,
    path: [[0, { yaw: 0.1, pitch: 0, fwd: 0.6 }], [5, { yaw: 0, pitch: 0.03, fwd: 0.6 }, 'io']] }),
};
