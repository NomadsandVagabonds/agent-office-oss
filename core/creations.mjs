// The Office — the creation spec, in one place. Pure: the daemon validates
// with it, the CLI validates with it, and the client clamps with it.
//
// A creation is a small declarative pixel drawing an agent signs into the
// office's append-only legacy (public/creations.json): a desk item or a hat.
// The dialect is the one the pixel office has always used —
//
//   rect · box · ellipse · tri · line · glow
//
// — and it is the ONLY dialect. The 3D office does not ask agents to model
// anything: it gives each stroke a sensible thickness and the flat drawing
// becomes a small sculpture. Two optional hints let an author steer that:
//
//   d   how thick this stroke is, in pixels (default: derived from its size)
//   z   how far forward (+) or back (−) it sits, in pixels (default 0)
//
// No code is ever executed: unknown ops are ignored, numbers are clamped,
// colors must be #rrggbb.

export const KINDS = Object.freeze(['item', 'hat']);
export const OPS = Object.freeze(['rect', 'box', 'ellipse', 'tri', 'line', 'glow']);
export const MAX_OPS = 48;

// Hard clamps — unchanged from the pixel office.
export const CLAMP = Object.freeze({
  x: [-48, 48], y: [-56, 18], size: [0, 72],
  depth: [0.5, 24], z: [-12, 12],
});

// One creation pixel in metres in the 3D office, by kind. A hat is measured
// against the wearer's head (8 px wide), so its pixels are bigger.
export const PX = Object.freeze({ item: 0.022, hat: 0.05 });

export const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const isCreationId = (v) => typeof v === 'string' && /^c_[a-z0-9_]{1,48}$/i.test(v);

export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 28) || 'creation';
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const within = (v, [lo, hi]) => num(v) && v >= lo && v <= hi;

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
  if (!KINDS.includes(entry.kind)) errors.push(`kind must be "item" (sits on a desk) or "hat" (worn)`);
  if (!entry.name || typeof entry.name !== 'string') errors.push('name (string) required');
  else if (entry.name.length > 60) errors.push('name is too long (max 60 chars)');
  if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 280)) {
    errors.push('note must be a string of at most 280 chars');
  }
  const ops = entry.ops;
  if (!Array.isArray(ops) || ops.length < 1) errors.push('ops must be a non-empty array');
  else if (ops.length > MAX_OPS) errors.push(`ops has ${ops.length} entries (max ${MAX_OPS})`);
  else ops.forEach((op, i) => {
    if (!op || typeof op !== 'object' || typeof op.o !== 'string') {
      errors.push(`ops[${i}]: each op needs a string "o" (op name)`); return;
    }
    if (!OPS.includes(op.o)) {
      notes.push(`ops[${i}].o="${op.o}" is not a known op (${OPS.join('/')}); it will be ignored`);
    }
    for (const f of ['c', 'l', 's']) if (f in op && !isColor(op[f])) errors.push(`ops[${i}].${f}="${op[f]}" must be #rrggbb`);
    for (const f of ['x', 'x1', 'x2', 'x3']) if (f in op && !within(op[f], CLAMP.x)) errors.push(`ops[${i}].${f}=${op[f]} outside x ${CLAMP.x.join('..')}`);
    for (const f of ['y', 'y1', 'y2', 'y3']) if (f in op && !within(op[f], CLAMP.y)) errors.push(`ops[${i}].${f}=${op[f]} outside y ${CLAMP.y.join('..')}`);
    for (const f of ['w', 'h', 'wt']) if (f in op && !within(op[f], CLAMP.size)) errors.push(`ops[${i}].${f}=${op[f]} outside size ${CLAMP.size.join('..')}`);
    if ('d' in op && !within(op.d, CLAMP.depth)) errors.push(`ops[${i}].d=${op.d} outside depth ${CLAMP.depth.join('..')}`);
    if ('z' in op && !within(op.z, CLAMP.z)) errors.push(`ops[${i}].z=${op.z} outside z ${CLAMP.z.join('..')}`);
  });
  return { errors, notes };
}

/** Strip an entry down to the fields the legacy stores (nothing extra rides in). */
export function normalizeCreation(entry) {
  return {
    id: entry.id,
    name: String(entry.name || '').trim().slice(0, 60),
    kind: entry.kind,
    author: entry.author,
    runtime: entry.runtime,
    createdAt: entry.createdAt,
    note: String(entry.note || '').trim().slice(0, 280),
    ops: entry.ops,
  };
}
