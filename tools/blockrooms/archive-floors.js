import { CLEARANCE_FLOORS } from './core/archive.mjs';
import { ARCHETYPES, makeRng } from './world/backrooms/gen.js';
import { atHome } from './world/backrooms/themes.js';
import { edition, planVisit } from './world/backrooms/plan.js';

const themes = Object.keys(CLEARANCE_FLOORS);
const offices = ['archive', 'night', 'fitout', 'exec'];
// Fingerprints from shipped generators. These releases changed rooms and enemies
// more often than the deal. Unknown editions can still use room and escape evidence.
const nineFloors = new Set(['yntnbj', 'zb9fq5']);
const guaranteedSuburb = new Set([
  'dxmyjf',
  'is8gvd',
  '1m7aflj',
  '7pf0ga',
  'am5mx0',
  'q7274a',
  '1ji5rrc',
  'kwr85e',
]);
const earlySuburb = new Set(['t25noi', 'h53x9v', '1229d09', '1leaqmm', '15ernem', '1utmxfl']);
const earlyOffice = new Set([
  '36nyx7',
  '17oibf9',
  '144isqp',
  '8ca9xi',
  'a5cyx4',
  '1js9htw',
  '1uqgzaj',
  '12jr3zt',
  'ukd1sr',
  'tu15gf',
]);

export function escapedFloors(tape) {
  if (!tape.edition) return [];
  const rng = makeRng('visit:' + tape.seed);
  const depth = rng.weighted(
    [
      [3, 5],
      [4, 4],
      [5, 2],
    ],
    (item) => item[1],
  )[0];
  if (nineFloors.has(tape.edition))
    return ['yellow', ...rng.shuffle([...offices, 'suburb', 'mall', 'waterpark', 'forest']).slice(0, 3)];
  if (guaranteedSuburb.has(tape.edition)) {
    // In these editions the suburb took the second or third slot, and both
    // slots were always cleared on escape. Its position cannot change the set.
    const other = rng.shuffle([...offices, 'suburb']).filter((id) => id !== 'suburb');
    return ['yellow', 'suburb', ...other.slice(0, 2)];
  }
  if (earlySuburb.has(tape.edition) || earlyOffice.has(tape.edition)) {
    const below = rng.shuffle(earlySuburb.has(tape.edition) ? [...offices, 'suburb'] : offices);
    return ['yellow', ...below.slice(0, depth - 1)];
  }
  return tape.edition === edition() ? planVisit(tape.seed).floors.map((f) => f.theme) : [];
}

export function floorEvidence(record, archive) {
  const cleared = new Set(archive.clearances);
  const visited = new Set(archive.activity.floors);
  const streams = Object.values(archive.activity.streams);
  const since = streams.reduce((start, s) => Math.min(start, s.since), Infinity);
  const oldTapes = record.tapes.filter((t) => t.at < since);
  const oldVisits = record.runs - streams.reduce((sum, s) => sum + s.n - s.replays, 0);
  if (oldVisits > 0 || oldTapes.length) visited.add('yellow');
  if (oldTapes.length || (!streams.length && record.out)) cleared.add('yellow');
  const escapedAt = new Set(oldTapes.map((t) => t.at).filter((at) => at > 0));
  for (const [room, at] of Object.entries(record.rooms)) {
    if (at >= since) continue;
    const spec = ARCHETYPES[room];
    if (!spec) continue;
    const homes = themes.filter((id) => atHome(spec, id) > 0);
    if (homes.length !== 1) continue;
    visited.add(homes[0]);
    // First sightings are filed with the end-of-run timestamp. A room first
    // seen on an escape proves its exclusive floor was cleared on that run.
    if (escapedAt.has(at)) cleared.add(homes[0]);
  }
  for (const tape of oldTapes) for (const id of escapedFloors(tape)) cleared.add(id);
  return {
    visited: themes.filter((id) => visited.has(id) || cleared.has(id)),
    clearances: themes.filter((id) => cleared.has(id)),
  };
}
