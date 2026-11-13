// The Office — the prop catalogue.
//
// One entry per kind of thing the floor plan (core/layout.mjs) can place.
// An entry says how to sculpt it and, where it matters, how it differs from
// its siblings. Adding furniture to the office is: write a function that
// returns a Vox, add a line here.
//
//   make(o)     → Vox          o is the layout object ({id, type, room, …}); may be {}
//   variant(o)  → string       objects with the same variant share one mesh
//   wall        → true         hangs on a wall (and folds away with it)
//   y           → metres       height of the origin above the floor
//   seat        → voxels       height of the seat top, if you can sit on it
// How to write one: README.md in this folder.
import { voxObject } from '../vox/material.js';
import { hashId } from '/core/look.mjs';
import * as O from './office.js';
import { CATALOGUE as KITCHEN } from './kitchen.js';
import { CATALOGUE as LOUNGE } from './lounge.js';
import { CATALOGUE as WORKS } from './works.js';
import { CATALOGUE as FUN } from './fun.js';
import { CATALOGUE as LIFT } from './lift.js';

const nth = (o, n) => hashId(String(o?.id || o?.type || '')) % n;

export const PROPS = {
  desk: { make: () => O.desk() },
  chair: { make: (o) => O.chair({ color: o.color }), variant: (o) => o.color || '' },
  crt: { make: () => O.crt() },
  keyboard: { make: () => O.keyboard() },
  mouse: { make: () => O.mouse() },
  desklamp: { make: (o) => O.desklamp({ color: o.color }), variant: (o) => o.color || '' },
  cabinet: { make: () => O.cabinet() },
  credenza: { make: () => O.credenza() },
  taskboard: { make: () => O.taskboard(), wall: true, y: 0.95 },
  whiteboard: { make: () => O.whiteboard() },
  plant: { make: (o) => O.plant({ seed: 5 + nth(o, 4) }), variant: (o) => String(nth(o, 4)) },
  planttall: { make: (o) => O.planttall({ seed: 9 + nth(o, 4) }), variant: (o) => String(nth(o, 4)) },
  floorlamp: { make: () => O.floorlamp() },
  bookshelf: { make: (o) => O.bookshelf({ seed: 3 + nth(o, 5) }), variant: (o) => String(nth(o, 5)) },
  sofa: { make: () => O.sofa(), seat: 17 },
  pedestal: { make: () => O.pedestal() },
  hottable: { make: () => O.hottable() },
  ...KITCHEN, ...LOUNGE, ...WORKS, ...FUN, ...LIFT,
};

export const hasProp = (type) => Object.prototype.hasOwnProperty.call(PROPS, type);

/**
 * A ready-to-place object for a layout object (or just a type name).
 * @returns {THREE.Group|null}  in metres, origin on the floor, front toward +z
 */
export function buildProp(type, o = {}) {
  const entry = PROPS[type];
  if (!entry) return null;
  const variant = entry.variant ? entry.variant(o) : '';
  const object = voxObject(() => entry.make(o), { key: `${type}:${variant}` });
  object.userData.prop = type;
  return object;
}
