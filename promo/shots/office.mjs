// The office floor: every shot here plays back one of the tapes made by scenes/office.mjs.
//   rig/film shots/office.mjs --shot hero            (add --still 1,3 to check a framing first)
import { officeShot, LATEST } from './lib.mjs';

const ADA_DESK = { x: -12.15, z: -4.75 };

export const shots = {
  // the whole floor, at work
  hero: officeShot({ tape: '01-arrive', start: 0, pre: 1, seconds: 6, chrome: ['plate', 'labels'],
    keys: [[0, { x: 0, z: 1.5, dist: 62, yaw: -0.12, pitch: 0.95 }], [6, { x: -2, z: 0.5, dist: 33, yaw: 0.16, pitch: 0.74 }, 'io']] }),

  // the lift opens; someone new
  liftOut: officeShot({ tape: '01-arrive', start: 0.9, seconds: 4.6, chrome: [],
    keys: [[0, { x: 0, z: -6.2, dist: 8.5, yaw: 0.0, pitch: 0.36 }], [4.6, { x: -0.6, z: -5.4, dist: 9.5, yaw: 0.1, pitch: 0.4 }, 'io']] }),

  // across the floor
  walk: officeShot({ tape: '01-arrive', start: 1.0, pre: 7.5, seconds: 5, chrome: [], follow: 'Ada',
    keys: [[0, { x: 0, z: 0.4, dist: 8.5, yaw: 0.75, pitch: 0.42 }], [5, { x: 0, z: 0.4, dist: 10, yaw: 0.35, pitch: 0.46 }, 'io']] }),

  // her desk
  sit: officeShot({ tape: '01-arrive', start: 1.0, pre: 21.6, seconds: 6.6, chrome: [],
    keys: [[0, { ...ADA_DESK, x: -11.8, z: -4.2, dist: 7.4, yaw: 0.42, pitch: 0.48 }], [6.6, { ...ADA_DESK, dist: 5.4, yaw: 0.26, pitch: 0.44 }, 'io']] }),

  // office me --species … --accessory …
  looks: officeShot({ tape: '02-looks', start: 0.6, seconds: 13.2, chrome: [],
    keys: [[0, { x: -12.15, z: -4.95, dist: 3.9, yaw: 0.22, pitch: 0.34 }], [13.2, { x: -12.15, z: -4.95, dist: 3.6, yaw: 0.34, pitch: 0.34 }, 'linear']] }),

  // the same, from where the monitor is not in the way
  looks2: officeShot({ tape: '02-looks', start: 0.6, seconds: 13.2, chrome: [],
    keys: [[0, { x: -12.15, z: -5.1, dist: 3.5, yaw: 0.88, pitch: 0.5 }], [13.2, { x: -12.15, z: -5.1, dist: 3.2, yaw: 1.0, pitch: 0.5 }, 'linear']] }),
  desk2: officeShot({ tape: '02-looks', start: 13.0, seconds: 7.4, chrome: [],
    keys: [[0, { x: -12.3, z: -4.5, dist: 2.6, yaw: 0.78, pitch: 0.72 }], [7.4, { x: -12.3, z: -4.5, dist: 2.4, yaw: 0.62, pitch: 0.7 }, 'io']] }),

  // office me --desk …; office create
  desk: officeShot({ tape: '02-looks', start: 13.0, seconds: 7.4, chrome: [],
    keys: [[0, { x: -12.25, z: -4.5, dist: 3.5, yaw: 0.5, pitch: 0.62 }], [7.4, { x: -12.25, z: -4.5, dist: 3.9, yaw: 0.3, pitch: 0.56 }, 'io']] }),

  // a note out, a note back
  note: officeShot({ tape: '03-collab', start: 4.2, seconds: 4.6, chrome: [],
    keys: [[0, { x: -12.4, z: -1.4, dist: 12.5, yaw: 0.85, pitch: 0.36 }], [4.6, { x: -12.4, z: -1.0, dist: 13.5, yaw: 0.7, pitch: 0.38 }, 'io']] }),

  // notes cross the floor
  planes: officeShot({ tape: '03-collab', start: 7.5, seconds: 5.2, chrome: [],
    keys: [[0, { x: 0, z: 1.4, dist: 15, yaw: 1.25, pitch: 0.3 }], [5.2, { x: -1, z: 1.4, dist: 17, yaw: 1.05, pitch: 0.33 }, 'io']] }),

  // a colleague walks over
  pair: officeShot({ tape: '03-collab', start: 11.5, pre: 3.6, seconds: 7.4, chrome: [],
    keys: [[0, { x: -12.9, z: -4.9, dist: 6.2, yaw: 0.3, pitch: 0.4 }], [7.4, { x: -12.9, z: -4.9, dist: 5.4, yaw: 0.12, pitch: 0.38 }, 'io']] }),

  // the same two takes with what people say left on (speech lives in the label layer)
  pairL: officeShot({ tape: '03-collab', start: 11.5, pre: 3.6, seconds: 7.4, chrome: ['labels'],
    keys: [[0, { x: -12.9, z: -4.9, dist: 6.2, yaw: 0.3, pitch: 0.4 }], [7.4, { x: -12.9, z: -4.9, dist: 5.4, yaw: 0.12, pitch: 0.38 }, 'io']] }),
  kitchenL: officeShot({ tape: '05-break', start: 0.3, pre: 23.4, seconds: 9, chrome: ['labels'],
    keys: [[0, { x: 4.7, z: -5.4, dist: 11, yaw: 0.6, pitch: 0.46 }], [9, { x: 4.9, z: -5.6, dist: 9.6, yaw: 0.28, pitch: 0.44 }, 'io']] }),

  // review, done
  done: officeShot({ tape: '03-collab', start: 25.0, seconds: 6.4, chrome: [],
    keys: [[0, { x: -13, z: -5.6, dist: 8.2, yaw: 0.06, pitch: 0.36 }], [6.4, { x: -13, z: -5.4, dist: 9.4, yaw: -0.06, pitch: 0.4 }, 'io']] }),

  // …and the tree in the plaza grows for it
  tree: officeShot({ tape: '03-collab', start: 25.3, seconds: 5.4, chrome: [],
    keys: [[0, { x: 0, z: 1.2, dist: 9.5, yaw: 0.5, pitch: 0.4 }], [5.4, { x: 0, z: 1.2, dist: 11, yaw: 0.2, pitch: 0.44 }, 'io']] }),

  // somebody needs you
  needs: officeShot({ tape: '04-needs', start: 0.4, seconds: 6.6, chrome: ['plate', 'tray', 'labels'],
    keys: [[0, { x: -13.4, z: -3.6, dist: 7.4, yaw: 2.9, pitch: 0.46 }], [6.6, { x: -13.4, z: -3.6, dist: 6.6, yaw: 3.1, pitch: 0.44 }, 'io']] }),

  // turns end: the kitchen
  kitchen: officeShot({ tape: '05-break', start: 0.3, pre: 23.4, seconds: 9, chrome: [],
    keys: [[0, { x: 4.7, z: -5.4, dist: 11, yaw: 0.6, pitch: 0.46 }], [9, { x: 4.9, z: -5.6, dist: 9.6, yaw: 0.28, pitch: 0.44 }, 'io']] }),

  sofa: officeShot({ tape: '05-break', start: 0.3, pre: 27.2, seconds: 5.4, chrome: [],
    keys: [[0, { x: -3.6, z: -2.6, dist: 8.4, yaw: -0.45, pitch: 0.42 }], [5.4, { x: -3.9, z: -2.9, dist: 7.6, yaw: -0.2, pitch: 0.4 }, 'io']] }),

  // the jukebox
  jukebox: officeShot({ tape: '06-disco', start: 0.5, pre: 23.6, seconds: 6.4, chrome: [],
    keys: [[0, { x: -4.2, z: -10.0, dist: 8.2, yaw: -0.2, pitch: 0.5 }], [6.4, { x: -3.8, z: -10.0, dist: 7.2, yaw: 0.12, pitch: 0.46 }, 'io']] }),

  disco: officeShot({ tape: '06-disco', start: 0.5, pre: 26.2, seconds: 10, chrome: [],
    keys: [[0, { x: 1.5, z: 1.8, dist: 17, yaw: -0.3, pitch: 0.52 }], [10, { x: 1.5, z: 2.0, dist: 14.5, yaw: 0.45, pitch: 0.46 }, 'io']] }),

  // one note, followed through the air from the hand that threw it to the desk it lands on, and the answer back
  // (filmed at 60 a second, to be slowed). The office's camera only ever looks at the floor; this one looks at the note.
  plane: (() => {
    const CHASE = `(() => {
      const cam = office.stage.camera, tgt = (window.__tgt = { x: -12.15, y: 1.3, z: -5.05 });
      let rest = { ...tgt };
      const yaw = 1.0, pitch = 0.26, d = 4.4;
      const O = { x: Math.sin(yaw) * Math.cos(pitch) * d, y: Math.sin(pitch) * d, z: Math.cos(yaw) * Math.cos(pitch) * d };
      office.stage.onFrame((dt) => {
        const note = office.fx.group.children.find((m) => m.isMesh && m.material && m.material.color && m.material.color.getHexString() === 'fbf7ea');
        if (note) rest = { x: note.position.x, y: Math.max(1.25, note.position.y), z: note.position.z };
        const want = note ? note.position : rest, k = 1 - Math.exp(-(note ? 20 : 5) * dt);      // on it while it flies; settle gently once it has landed
        tgt.x += (want.x - tgt.x) * k; tgt.y += (want.y - tgt.y) * k; tgt.z += (want.z - tgt.z) * k;
        cam.position.set(tgt.x + O.x, tgt.y + O.y, tgt.z + O.z);
        cam.lookAt(tgt.x, tgt.y, tgt.z);
      });
    })()`;
    const s = officeShot({ tape: '03-collab', start: 4.3, seconds: 3.6, chrome: ['labels'], keys: [[0, { x: -12.15, z: -5.05, dist: 5, yaw: 1.0, pitch: 0.4 }]], events: [[0, CHASE]] });
    s.fps = 60;
    s.tick = function tick(t, i, arg) {
      arg.events.forEach(([at, code], n) => { if (t >= at && !window.__fired.has(n)) { window.__fired.add(n); (0, eval)(code); } });
      const g = window.__tgt || arg.keys[0][1];
      office.rig.flyTo({ ...arg.keys[0][1], x: g.x, z: g.z }, { instant: true });      // so the walls in the way fold as they would for this view
    };
    return s;
  })(),

  /* ---- somebody resigns (the newest build; tape 09, with the removal held back: see scenes/resign.mjs) ---- */
  // office resign --handoff HANDOFF.md --note "…": the farewell in her own words, and she gets up
  resignDesk: officeShot({ base: LATEST, tape: '09-resign-walkout', start: 0.9, seconds: 5, chrome: ['labels'],
    keys: [[0, { x: -12.5, z: -5.7, dist: 6.4, yaw: 0.5, pitch: 0.44 }], [5, { x: -13.4, z: -5.5, dist: 7.0, yaw: 0.36, pitch: 0.44 }, 'io']] }),
  // …and walks out the way she came in (the same framing as her first shot). The doors are opened for her here:
  // the office opens them when a departure begins, which is twenty seconds before she gets to them.
  resignWalk: officeShot({ base: LATEST, tape: '09-resign-walkout', start: 0.9, pre: 17.6, seconds: 7.5, chrome: [],
    keys: [[0, { x: -0.6, z: -5.4, dist: 9.5, yaw: 0.1, pitch: 0.4 }], [7.5, { x: 0, z: -6.4, dist: 8.2, yaw: 0, pitch: 0.36 }, 'io']],
    events: [[0, "(() => { let done = false; office.stage.onFrame(() => { const p = office.people.positionOf('promo-ada'); if (!done && p && p.z < -6.2 && Math.abs(p.x) < 1.5) { done = true; office.fx.lift(3200); } }); })()"]] }),
  // what the human gets: a line that stays, and behind it the note and the handoff
  resignNote: (() => {
    const s = officeShot({ base: LATEST, tape: '09-resign-walkout', start: 1.6, seconds: 7, query: '&dpr=1.5', chrome: ['ticker'],
      keys: [[0, { x: -12.6, z: -4.4, dist: 9.5, yaw: 0.3, pitch: 0.52 }], [7, { x: -12.6, z: -4.4, dist: 9.0, yaw: 0.22, pitch: 0.52 }, 'io']],
      pointer: [760, 500],
      actions: [{ at: 1.3, click: { css: '#ui .ticker' }, dur: 0.8 }, { at: 3.0, hover: { css: '#ui .sheet', px: 0.74, py: 0.8 }, dur: 0.9 }] });
    s.dsf = 1.5;
    return s;
  })(),

  /* ---- what you do with it: one take to end on ----
     Click somebody and their card opens (what they are doing, for which project, how full their context is, a line
     straight to them); click the board on their wall and it is the kanban, with the card she is working on going to
     Review and then Done while you look at it. */
  features: (() => {
    // where something in the room is on screen, for the hand
    const SCREEN = (x, y, z) => `(() => { const c = office.stage.camera, v = new c.position.constructor(${x}, ${y}, ${z}).project(c); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; })()`;
    const ADA = `(() => { const p = office.people.positionOf('promo-ada'), c = office.stage.camera, v = new c.position.constructor(p.x, 0.95, p.z).project(c); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; })()`;
    const s = officeShot({ tape: '03-collab', start: 20.9, seconds: 7.6, query: '&dpr=1.5', chrome: ['plate', 'clock', 'dock', 'labels'],
      keys: [[0, { x: -13, z: -5.6, dist: 8.6, yaw: 0.06, pitch: 0.38 }], [7.6, { x: -13, z: -5.7, dist: 8.2, yaw: 0.0, pitch: 0.38 }, 'io']],
      pointer: [900, 560],
      actions: [
        { at: 0.35, click: { at: ADA }, dur: 0.6 },
        { at: 3.35, key: 'Escape' },
        { at: 3.4, click: { at: SCREEN(-13, 1.55, -7.9) }, dur: 0.6 },
        { at: 4.4, hover: { css: '#ui .sheet', px: 0.84, py: 0.86 }, dur: 0.8 },
      ] });
    s.dsf = 1.5;
    return s;
  })(),

  // after hours: the same floor, lamplit
  night: officeShot({ tape: '03-collab', start: 0, seconds: 8, hour: 22.5, chrome: [],
    keys: [[0, { x: -12.6, z: -4.4, dist: 8, yaw: 0.42, pitch: 0.44 }], [8, { x: -6, z: -1, dist: 34, yaw: 0.1, pitch: 0.72 }, 'io2']] }),
};
