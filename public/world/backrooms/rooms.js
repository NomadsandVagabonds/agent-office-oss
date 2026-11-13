// The Backrooms — the rooms. One builder per archetype in the deck (gen.js),
// plus the plain connective rooms, the room you land in and the way out.
// A builder gets the toolbox from world.js and a set of rolled details, and
// works in the room's own frame: x across, z deep, you walk in through +z.
import * as THREE from 'three';

function plain(c) {
  c.shell();
  for (const p of c.room.pillars) c.pillar(p.x, p.z, p.w, p.d);
  if (c.room.sign) c.exitSign(c.room.doors[c.room.sign.door], c.room.sign.text);
}

export const BUILDERS = { plain, start: plain, exit: plain };
