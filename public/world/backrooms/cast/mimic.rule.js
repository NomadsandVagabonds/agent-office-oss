// The Backrooms — the other door's rule (cast/mimic.js is the creature). Pure.
//
// A pair of fire doors, shut, on a stretch of wall where the plan has no
// doorway: there is nothing behind it. It looks like every other pair on the
// floor, and its one tell is that now and then it is not quite still — a
// shiver, a leaf out of register for a frame. Nothing says so, and nothing
// else gives it away.
//
// Try it — E, as any pair is worked; or walk into it; or stand in front of it
// too long — and the leaves are gone, the opening is black, and what comes out
// of it has you. Two hearts. If those were the last, it takes you through.
// If not, it lets go, and what is left is a hole in the wall that does nothing
// more: it is spent, and you know what it was.
//
// Walking past it, or across its room, is nothing. And it fears a fire: paper
// burning in front of it and it cannot spring, and cannot keep still either.

export const MIMIC = Object.freeze({
  w: 1.8, h: 2.05,       // the pair it copies: the floor's commonest doorway
  near: 1.2,             // metres out from its face that count as standing in front of it
  aside: 0.15,           // …and this far past its jambs, either side, still does
  linger: 2.5,           // seconds in front of it before it has had enough of being looked over
  bump: 0.46,            // walking at it, this near its face (a body is 0.22 across): that is walking into it
  facing: 0.5,           // …and "at it" is this much of your heading, or more
  opens: 0.45,           // seconds from door to open mouth
  grips: 0.9,            // seconds it has you before it costs anything
  hurts: 2,              // hearts (the deck's `caught`)
  lets: 0.7,             // seconds its arms take to go back in, afterwards
  cue: Object.freeze([1.4, 5.5]),      // seconds between shivers: with you at its face · with you at `far`
  shiver: 0.16,          // seconds one lasts
  far: 11,               // metres: further off than this it does not bother
  fire: 2.5,             // metres: paper burning this near its face, in its sight, and it cannot spring
  flinch: 0.5,           // seconds between its flinches for as long as that fire burns
});

/** A door, and nothing else yet. */
export function shut() { return { mode: 'door', t: 0, front: 0, next: MIMIC.cue[1] * 0.5, shiver: 0, tremor: 0, sprung: false, strike: false, shook: false }; }

/** Is somebody standing in front of it? (`out`: metres from its face into the room · `across`: metres along the wall from its middle.) */
export function inFront(out, across) { return out > 0 && out <= MIMIC.near && Math.abs(across) <= MIMIC.w / 2 + MIMIC.aside; }

/** Is this walking into it? In front of it, at its face, moving, and headed at it. (`toward`: how much of the heading is into the wall, −1…1.) */
export function walksInto(sense) { return inFront(sense.out, sense.across) && sense.out <= MIMIC.bump && !!sense.moving && sense.toward >= MIMIC.facing; }

/** How long until the next shiver, for somebody d metres off. */
export function cueGap(d) { const k = Math.max(0, Math.min(1, d / MIMIC.far)); return MIMIC.cue[0] + (MIMIC.cue[1] - MIMIC.cue[0]) * k; }

/**
 * One moment of it.
 * @param s      what shut() or the last call gave
 * @param sense  { out, across: where the visitor is in its own frame · d: how far off they are · moving, toward: as walksInto ·
 *                 used: E was pressed on it this moment · fire: paper is burning in front of it · rnd: 0…1 for this moment }
 * @returns { mode: 'door' | 'opening' | 'gripping' | 'taking' | 'letting' | 'spent', t, front,
 *            tremor: 0…1 how hard it is shivering this moment (0: still), shook: a shiver began this moment,
 *            sprung: it opened this moment, strike: this is the moment it costs (the creature asks c.hurt, and then calls took() or let()) }
 */
export function mimics(s, dt, sense) {
  const n = { ...s, sprung: false, strike: false, shook: false, tremor: 0 };
  if (!Number.isFinite(dt) || dt <= 0) return n;
  if (s.mode === 'spent' || s.mode === 'taking') return n;
  if (s.mode === 'opening') { n.t = s.t + dt; if (n.t >= MIMIC.opens) { n.mode = 'gripping'; n.t = 0; } return n; }
  if (s.mode === 'gripping') { n.t = s.t + dt; if (n.t >= MIMIC.grips) n.strike = true; return n; }
  if (s.mode === 'letting') { n.t = s.t + dt; if (n.t >= MIMIC.lets) { n.mode = 'spent'; n.t = 0; } return n; }
  // a door
  const here = inFront(sense.out, sense.across);
  if (sense.fire) {
    // it cannot spring, and it cannot keep still: a flinch every half second, as hard as it ever shivers
    n.front = 0;
    n.next = Math.min(s.next, MIMIC.flinch) - dt;
    if (n.next <= 0) { n.next = MIMIC.flinch; n.shiver = MIMIC.shiver; n.shook = true; }
    else n.shiver = Math.max(0, s.shiver - dt);
    n.tremor = n.shiver > 0 ? 1 : 0;
    return n;
  }
  n.front = here ? s.front + dt : 0;
  if (sense.used || walksInto(sense) || n.front >= MIMIC.linger) { n.mode = 'opening'; n.t = 0; n.sprung = true; n.shiver = 0; return n; }
  // the tell: now and then, and oftener and harder the nearer somebody is. Nobody near, nothing.
  if (!(sense.d <= MIMIC.far)) { n.shiver = 0; n.next = Math.max(s.next, cueGap(MIMIC.far) * 0.5); return n; }
  n.next = s.next - dt;
  if (n.next <= 0) { n.next = cueGap(sense.d) * (0.7 + 0.6 * (sense.rnd ?? 0.5)); n.shiver = MIMIC.shiver; n.shook = true; }
  else n.shiver = Math.max(0, s.shiver - dt);
  if (n.shiver > 0) n.tremor = 0.35 + 0.65 * (1 - Math.max(0, Math.min(1, sense.d / MIMIC.far)));
  return n;
}

/** It has had them and they are still here: the arms go back in, and then it is a hole in the wall. */
export function let_(s) { return { ...s, mode: 'letting', t: 0, strike: false }; }
/** Those were the last of them: it does not let go. (The conductor ends the visit.) */
export function took(s) { return { ...s, mode: 'taking', t: 0, strike: false }; }
/** Has it got hold of somebody this moment? */
export function holds(s) { return s.mode === 'gripping' || s.mode === 'taking'; }
/** Is it showing what it is? */
export function open(s) { return s.mode !== 'door'; }

/**
 * Where on a room's walls it can hang: the stretches with nothing in the way, wide enough for a pair and its frame.
 * @param spans  { side: [[from, to], …] } — a room's clear wall, by side (gen.js wallSpans)
 * @param R      the creature's own dice
 * @returns [{ side, at }] every place it could go, in the order to try them (`at`: its middle, along the wall)
 */
export function mimicSpots(spans, R) {
  const need = MIMIC.w + 0.5, out = [];
  for (const side of R.shuffle(Object.keys(spans).sort())) {
    for (const [a, b] of R.shuffle((spans[side] || []).filter(([p, q]) => q - p >= need))) {
      // every third of a metre along it, in the dice's order: furniture against a wall leaves some of it and not the rest
      const here = [];
      for (let at = a + need / 2; at <= b - need / 2 + 1e-6; at += 0.3) here.push(at);
      for (const at of R.shuffle(here)) out.push({ side, at: Math.round(at * 1000) / 1000 });
    }
  }
  return out;
}
