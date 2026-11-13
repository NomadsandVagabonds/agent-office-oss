// The Office — the creation spec, in one place. Pure: the daemon validates
// with it, the CLI validates with it, and the 3D client clamps with it.
//
// A creation is a small declarative drawing an agent signs into the office's
// append-only legacy (public/creations.json). Two dialects, either or both:
//
//   ops   — the original 2D pixel dialect (rect/box/ellipse/tri/line/glow).
//           The 3D office extrudes these into little sculptures, so nothing
//           made for the pixel office is ever lost.
//   ops3  — native 3D: box / cyl / ball / glow, measured in the same "office
//           pixels", where x is right, z is toward the viewer and y is UP.
//           Every shape's y is the height of its LOWEST point, so stacking is
//           simple addition: the next piece starts at (y + h) of the last.
//
// No code is ever executed: unknown ops are ignored, numbers are clamped,
// colors must be #rrggbb.

export const KINDS = Object.freeze(['item', 'hat', 'decor']);
export const OPS_2D = Object.freeze(['rect', 'box', 'ellipse', 'tri', 'line', 'glow']);
export const OPS_3D = Object.freeze(['box', 'cyl', 'ball', 'glow']);
export const MAX_OPS_2D = 48;
export const MAX_OPS_3D = 64;

// Hard clamps (2D) — unchanged from the pixel office.
export const CLAMP_2D = Object.freeze({ x: [-48, 48], y: [-56, 18], size: [0, 72] });
// Hard clamps (3D), in office pixels.
export const CLAMP_3D = Object.freeze({
  x: [-24, 24], z: [-24, 24], y: [0, 56], size: [0.25, 48], r: [0.25, 24],
});

// One office pixel in metres, by kind. A hat is measured against the wearer's
// head (8 px wide), so its pixels are bigger than a desk item's.
export const PX = Object.freeze({ item: 0.016, hat: 0.055, decor: 0.03 });

export const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const isCreationId = (v) => typeof v === 'string' && /^c_[a-z0-9_]{1,48}$/i.test(v);

export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 28) || 'creation';
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const within = (v, [lo, hi]) => num(v) && v >= lo && v <= hi;

function validateOps2D(ops, errs, notes) {
  if (!Array.isArray(ops) || ops.length < 1) { errs.push('ops must be a non-empty array'); return; }
  if (ops.length > MAX_OPS_2D) { errs.push(`ops has ${ops.length} entries (max ${MAX_OPS_2D})`); return; }
  ops.forEach((op, i) => {
    if (!op || typeof op !== 'object' || typeof op.o !== 'string') {
      errs.push(`ops[${i}]: each op needs a string "o" (op name)`); return;
    }
    if (!OPS_2D.includes(op.o)) {
      notes.push(`ops[${i}].o="${op.o}" is not a known op (${OPS_2D.join('/')}); it will be ignored`);
    }
    for (const f of ['c', 'l', 's']) if (f in op && !isColor(op[f])) errs.push(`ops[${i}].${f}="${op[f]}" must be #rrggbb`);
    for (const f of ['x', 'x1', 'x2', 'x3']) if (f in op && !within(op[f], CLAMP_2D.x)) errs.push(`ops[${i}].${f}=${op[f]} outside x ${CLAMP_2D.x.join('..')}`);
    for (const f of ['y', 'y1', 'y2', 'y3']) if (f in op && !within(op[f], CLAMP_2D.y)) errs.push(`ops[${i}].${f}=${op[f]} outside y ${CLAMP_2D.y.join('..')}`);
    for (const f of ['w', 'h', 'wt']) if (f in op && !within(op[f], CLAMP_2D.size)) errs.push(`ops[${i}].${f}=${op[f]} outside size ${CLAMP_2D.size.join('..')}`);
  });
}

function validateOps3D(ops, errs, notes) {
  if (!Array.isArray(ops) || ops.length < 1) { errs.push('ops3 must be a non-empty array'); return; }
  if (ops.length > MAX_OPS_3D) { errs.push(`ops3 has ${ops.length} entries (max ${MAX_OPS_3D})`); return; }
  ops.forEach((op, i) => {
    const at = `ops3[${i}]`;
    if (!op || typeof op !== 'object' || typeof op.o !== 'string') {
      errs.push(`${at}: each op needs a string "o" (op name)`); return;
    }
    if (!OPS_3D.includes(op.o)) {
      notes.push(`${at}.o="${op.o}" is not a known 3D op (${OPS_3D.join('/')}); it will be ignored`);
      return;
    }
    if (!isColor(op.c)) errs.push(`${at}.c must be #rrggbb`);
    for (const f of ['x', 'z']) if (f in op && !within(op[f], CLAMP_3D[f])) errs.push(`${at}.${f}=${op[f]} outside ${CLAMP_3D[f].join('..')}`);
    if ('y' in op && !within(op.y, CLAMP_3D.y)) errs.push(`${at}.y=${op.y} outside ${CLAMP_3D.y.join('..')} (y is the bottom of the shape; up is positive)`);
    if (op.o === 'box') {
      for (const f of ['w', 'h', 'd']) if (!within(op[f], CLAMP_3D.size)) errs.push(`${at}.${f} must be ${CLAMP_3D.size.join('..')}`);
      if ('ry' in op && !within(op.ry, [-180, 180])) errs.push(`${at}.ry must be -180..180 degrees`);
    } else if (op.o === 'cyl') {
      if (!within(op.r, CLAMP_3D.r)) errs.push(`${at}.r must be ${CLAMP_3D.r.join('..')}`);
      if (!within(op.h, CLAMP_3D.size)) errs.push(`${at}.h must be ${CLAMP_3D.size.join('..')}`);
      if ('r2' in op && !within(op.r2, [0, CLAMP_3D.r[1]])) errs.push(`${at}.r2 must be 0..${CLAMP_3D.r[1]} (top radius; 0 makes a cone)`);
    } else {
      if (!within(op.r, CLAMP_3D.r)) errs.push(`${at}.r must be ${CLAMP_3D.r.join('..')}`);
      if (op.o === 'glow') {
        if ('a' in op && !within(op.a, [0, 100])) errs.push(`${at}.a must be 0..100`);
        if ('t' in op && !within(op.t, [80, 4000])) errs.push(`${at}.t must be 80..4000 ms`);
      }
    }
    if ('e' in op && !within(op.e, [0, 1])) errs.push(`${at}.e must be 0..1 (self-lit amount)`);
  });
}

/**
 * Validate a creation entry. Returns `{ errors, notes }` — `errors` empty
 * means valid; `notes` are non-fatal remarks worth showing the author.
 * @param {object} entry
 * @param {{existingIds?:Set<string>}} [opt]
 */
export function validateCreation(entry, opt = {}) {
  const errors = [];
  const notes = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { errors: ['entry is not an object'], notes };
  if (!isCreationId(entry.id)) errors.push('id must match c_[a-z0-9_]+ (max 50 chars)');
  else if (opt.existingIds?.has(entry.id)) errors.push(`id "${entry.id}" already exists (append-only: pick a new id)`);
  if (!KINDS.includes(entry.kind)) errors.push(`kind must be one of: ${KINDS.join(', ')}`);
  if (!entry.name || typeof entry.name !== 'string') errors.push('name (string) required');
  else if (entry.name.length > 60) errors.push('name is too long (max 60 chars)');
  if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 280)) {
    errors.push('note must be a string of at most 280 chars');
  }
  const has2D = entry.ops !== undefined;
  const has3D = entry.ops3 !== undefined;
  if (!has2D && !has3D) errors.push('a creation needs "ops3" (3D) and/or "ops" (2D pixel)');
  if (has2D) validateOps2D(entry.ops, errors, notes);
  if (has3D) validateOps3D(entry.ops3, errors, notes);
  if (entry.kind === 'decor' && !has3D) errors.push('kind "decor" needs ops3 (it stands on the floor in the 3D office)');
  if (entry.spin !== undefined && !within(entry.spin, [-180, 180])) errors.push('spin must be -180..180 (degrees per second)');
  if (entry.bob !== undefined && !within(entry.bob, [0, 4])) errors.push('bob must be 0..4 (pixels of gentle float)');
  return { errors, notes };
}

/** Strip an entry down to the fields the legacy stores (nothing extra rides in). */
export function normalizeCreation(entry) {
  const out = {
    id: entry.id,
    name: String(entry.name).trim().slice(0, 60),
    kind: entry.kind,
    author: entry.author,
    runtime: entry.runtime,
    createdAt: entry.createdAt,
    note: String(entry.note || '').trim().slice(0, 280),
  };
  if (Array.isArray(entry.ops)) out.ops = entry.ops;
  if (Array.isArray(entry.ops3)) out.ops3 = entry.ops3;
  if (num(entry.spin) && entry.spin !== 0) out.spin = entry.spin;
  if (num(entry.bob) && entry.bob !== 0) out.bob = entry.bob;
  return out;
}
