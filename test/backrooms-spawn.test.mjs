import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVisit } from '../public/world/backrooms/plan.js';
import { roomDistances, ARCHETYPES } from '../public/world/backrooms/gen.js';
import { CAST, hauntsFor, lairFor } from '../public/world/backrooms/cast.js';
import { roamingRooms } from '../public/world/backrooms/cast/roaming.rule.js';

test('generated visits keep hostile homes and resident rooms two doorways beyond every landing', () => {
  for (let seed = 0; seed < 32; seed++) {
    for (const level of generateVisit(`spawn-buffer-${seed}`, {}).floors) {
      const distance = roomDistances(level, level.start.room);
      const safe = (id, who) => assert.ok((distance.get(id) ?? 0) >= 2, `${level.seed}: ${who} in room ${id} is too close to the landing`);
      for (const room of level.rooms) if (ARCHETYPES[room.arch]?.resident) safe(room.id, room.arch);
      if (level.pursuer) safe(level.pursuer.room, 'pirate');
      for (const id of roamingRooms(level)) safe(id, 'roaming/carried pirate');
      for (const [id, room] of hauntsFor(level, CAST.map(m => m.id))) if (CAST.find(m => m.id === id).disposition === 'hunts') safe(room, id);
      for (const member of CAST) { const lair = lairFor(level, member); if (lair !== null) safe(lair, member.id); }
    }
  }
});

test('a requested haunt beside the landing cannot override a hostile creature’s safe placement', () => {
  const rooms = Array.from({ length: 4 }, (_, id) => ({ id, kind: id ? 'odd' : 'start', arch: id ? 'company' : null, doors: [] }));
  for (let i = 0; i < 3; i++) { rooms[i].doors.push({ to: i + 1 }); rooms[i + 1].doors.push({ to: i }); }
  const level = { seed: 'near-haunt', start: { room: 0 }, rooms }, deck = { company: { haunt: 2 } };
  const out = hauntsFor(level, ['toner', 'mother', 'moth'], deck);
  assert.equal(out.size, 3, 'safe later rooms retain the hostile encounters');
  for (const id of ['toner', 'mother']) assert.ok(out.get(id) >= 2, id);
  assert.equal(out.get('moth'), 1, 'non-hunting company can still be nearby');
});
