// The Office — the people. One avatar per agent, standing wherever the daemon
// says they are (see server/world/world.mjs): the server decides the
// destination and the arrival time, the client walks them there along the
// same path-finder the server used to time the trip.
//
// What an avatar is doing is always a readout of real state — typing when the
// agent is working, hand up when it needs you, feet up when it has finished —
// never decoration.
import * as THREE from 'three';
import { Avatar } from '../avatar/rig.js';
import { SIT_H } from '../props/office.js';
import { PROPS } from '../props/index.js';
import { Vox, M, glow } from '../vox/vox.js';
import { voxObject } from '../vox/material.js';

/** A sub-agent: a small hovering helper with a screen for a face. */
function helperBot() {
  const v = new Vox();
  const shell = M('#d8d2c2', 0), dark = M('#3a3f4a', 0);
  v.rbox(-4, 0, -3, 4, 7, 3, 2, shell);
  v.box(-3, 2, 3, 3, 6, 4, dark);                              // face plate
  v.set(-2, 4, 4, glow('#7ad0ff')); v.set(1, 4, 4, glow('#7ad0ff'));
  v.box(-1, 7, -1, 1, 9, 1, dark); v.set(0, 9, 0, glow('#ffb44a'));       // antenna
  v.box(-5, 2, -1, -4, 4, 1, dark); v.box(4, 2, -1, 5, 4, 1, dark);       // little arms
  return v;
}
import { resolveLook, hashId } from '/core/look.mjs';

const TAU = Math.PI * 2;
const angleDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @param {{layout:object, nav:object, furniture:object, screens:object, now:()=>number, makeItems?:Function}} deps
 */
export function createPeople(deps) {
  let { layout, nav, furniture } = deps;
  const group = new THREE.Group();
  const people = new Map();

  function restState(person) {
    const a = person.agent, p = person.place;
    if (!p) return { pose: 'stand', face: 'neutral' };
    const seated = p.pose === 'sit';
    if (p.at === 'desk' && seated) {
      if (a.status === 'working') return { pose: 'type', face: 'focus' };
      if (a.status === 'thinking' && a.turn !== 'idle') return { pose: 'think', face: 'neutral' };
      if (a.status === 'blocked') return a.blockKind === 'idle' ? { pose: 'lounge', face: 'neutral' } : { pose: 'ask', face: 'worried', bounce: 0 };
      if (a.status === 'done') return { pose: 'lounge', face: 'happy' };
      return { pose: a.turn === 'idle' ? 'lounge' : 'sit', face: 'neutral' };
    }
    if (seated) return { pose: 'lounge', face: 'neutral' };
    const kind = layout.pois.get(p.ref)?.kind;
    if (kind === 'coffee' || kind === 'cooler' || kind === 'vending' || kind === 'fridge') return { pose: 'sip', face: 'happy', hold: 'mug' };
    if (a.status === 'blocked' && a.blockKind !== 'idle') return { pose: 'wave', face: 'worried', bounce: 0.35 };
    return { pose: 'stand', face: 'neutral' };
  }

  function screenFor(person) {
    const a = person.agent;
    if (!person.atDesk) return 'idle';
    if (a.status === 'blocked') return a.blockKind === 'idle' ? 'done' : 'blocked';
    if (a.status === 'working') return deps.screens.codeKind(hashId(a.persona || a.id));
    if (a.status === 'done') return 'done';
    if (a.turn === 'idle') return 'done';
    return 'think';
  }

  function claimDesk(person, deskId) {
    if (person.deskId === deskId) return;
    if (person.deskId) {
      const old = furniture.desks.get(person.deskId);
      if (old && old.owner === person.id) { old.setOwner(null); old.setSeated(false); }
    }
    person.deskId = deskId || null;
    const desk = deskId ? furniture.desks.get(deskId) : null;
    if (desk) desk.setOwner(person.agent, deps.makeItems);
  }

  function makeAvatar(person) {
    const a = person.agent;
    const look = a.profile?.character || resolveLook(a.persona || a.id);
    const key = JSON.stringify(look) + (a.provider || '');
    if (person.lookKey === key) return;
    person.lookKey = key;
    const old = person.avatar;
    const avatar = new Avatar(look, { seed: a.persona || a.id, provider: a.provider || 'unknown' });
    avatar.seatHeight = SIT_H;
    avatar.root.userData.agentId = a.id;
    const hat = deps.hatFor ? deps.hatFor(look) : null;       // a hat they (or a teammate) made
    if (hat) avatar.hat.add(hat);
    if (old) {
      avatar.root.position.copy(old.root.position); avatar.root.rotation.y = old.root.rotation.y;
      avatar.snap(old.poseName);
      group.remove(old.root); old.dispose();
    }
    person.avatar = avatar;
    group.add(avatar.root);
  }

  function arrive(person, instant) {
    const p = person.place;
    person.path = null; person.walking = false;
    person.pos.x = p.x; person.pos.z = p.z;
    person.faceGoal = p.face || 0;
    person.atDesk = p.at === 'desk' && p.pose === 'sit';
    // how high this seat is: an office chair, or whatever they sat down on
    let seat = SIT_H;
    if (p.pose === 'sit' && p.at !== 'desk') {
      const object = layout.objects.find((o) => o.poi?.id === p.ref);
      const top = object && PROPS[object.type]?.seat;
      if (top) seat = top + 3;
    }
    person.avatar.seatHeight = seat;
    if (person.atDesk) { claimDesk(person, p.ref); furniture.desks.get(p.ref)?.setSeated(true); }
    if (instant) { person.heading = person.faceGoal; }
    refresh(person, instant);
  }

  // an emote borrows the body for a moment, then real state takes it back
  const EMOTE = {
    wave: { pose: 'wave', face: 'happy' }, dance: { pose: 'cheer', face: 'happy', bounce: 0.8, spin: 2 }, bow: { pose: 'bow' },
    cheer: { pose: 'cheer', face: 'happy', bounce: 0.6 }, shrug: { pose: 'shrug' }, think: { pose: 'think' }, facepalm: { pose: 'facepalm', face: 'worried' },
    nod: { pose: 'bow', ms: 700 }, stretch: { pose: 'stretch', face: 'happy' }, highfive: { pose: 'wave', face: 'happy', bounce: 0.3 },
    salute: { pose: 'salute' }, spin: { pose: 'cheer', spin: 1, face: 'dizzy' }, sleep: { pose: 'sleep', face: 'sleep', ms: 5000 }, laugh: { pose: 'shrug', face: 'happy', bounce: 0.35 },
  };
  function emote(id, name) {
    const person = people.get(id), e = EMOTE[name];
    if (!person || !e || person.walking || !person.place) return;
    const ms = e.ms || 2600;
    person.emote = { ...e, until: performance.now() + ms, spinFrom: person.heading, ms, start: performance.now() };
    refresh(person);
  }

  function refresh(person, instant = false) {
    if (person.walking) return;
    const av = person.avatar;
    let s = restState(person);
    if (person.emote) {
      const seated = person.place?.pose === 'sit';
      s = { pose: person.emote.pose, face: person.emote.face || s.face, bounce: seated ? 0 : person.emote.bounce, seated };
    }
    if (instant) { av.setPose(s.pose, { seated: s.seated }); av.update(0, true); } else av.setPose(s.pose, { seated: s.seated });
    av.setExpression(s.face);
    av.bounce = s.bounce || 0;
    if ((s.hold || null) !== person.holding) { person.holding = s.hold || null; av.hold(person.holding); }
    const desk = person.deskId ? furniture.desks.get(person.deskId) : null;
    if (desk && desk.owner === person.id) desk.setScreen(screenFor(person));
  }

  function walkTo(person, place) {
    const from = { x: person.pos.x, z: person.pos.z };
    const to = { x: place.x, z: place.z };
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    if (dist < 0.05) { arrive(person, false); return; }
    let path = null;
    try { path = nav.findPath(from, to); } catch { path = null; }
    if (!path || path.length < 2) path = [from, to];
    const lengths = [0];
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
    const total = lengths[lengths.length - 1];
    const remaining = Math.max(0.35, (place.eta - deps.now()) / 1000);
    // leave a seat before setting off
    if (person.atDesk && person.deskId) {
      const desk = furniture.desks.get(person.deskId);
      desk?.setSeated(false);
      if (desk && desk.owner === person.id) desk.setScreen('idle');
    }
    person.atDesk = false;
    person.path = path; person.lengths = lengths; person.total = total; person.travel = 0;
    person.speed = clamp(total / remaining, 0.8, place.run ? 4.6 : 2.8);
    person.walking = true;
    const av = person.avatar;
    av.setPose('stand'); av.bounce = 0; av.setExpression('neutral');
    if (person.holding) { person.holding = null; av.hold(null); }
  }

  function setPlace(id, place) {
    const person = people.get(id);
    if (!person || !place) return;
    const first = !person.place;
    person.place = place;
    if (place.at === 'desk') claimDesk(person, place.ref);
    const now = deps.now();
    if (first) {
      if (place.from && place.eta - now > 400) {                 // already on their way when we arrived
        const t = clamp((now - place.since) / Math.max(1, place.eta - place.since), 0, 1);
        person.pos.x = place.from.x; person.pos.z = place.from.z;
        walkTo(person, place);
        if (person.walking) person.travel = person.total * t;
      } else arrive(person, true);
    } else walkTo(person, place);
  }

  function setAgent(agent) {
    let person = people.get(agent.id);
    if (!person) {
      person = { id: agent.id, agent, avatar: null, place: null, pos: { x: layout.spots.elevator.x, z: layout.spots.elevator.z },
        heading: 0, faceGoal: 0, walking: false, path: null, deskId: null, atDesk: false, holding: null, lookKey: '' };
      people.set(agent.id, person);
      makeAvatar(person);
      person.avatar.root.visible = false;                       // until we know where they are
    } else {
      person.agent = agent;
      makeAvatar(person);
      const desk = person.deskId ? furniture.desks.get(person.deskId) : null;
      if (desk && desk.owner === person.id && deps.itemsChanged?.(person, agent)) { desk.setOwner(null); desk.setOwner(agent, deps.makeItems); }
    }
    refresh(person);
    return person;
  }

  function remove(id) {
    const person = people.get(id);
    if (!person) return;
    claimDesk(person, null);
    for (const b of person.bots || []) group.remove(b);
    group.remove(person.avatar.root);
    person.avatar.dispose();
    people.delete(id);
  }

  function update(dt) {
    for (const person of people.values()) {
      const av = person.avatar;
      if (!person.place) continue;
      av.root.visible = true;
      if (person.walking) {
        person.travel += person.speed * dt;
        if (person.travel >= person.total) arrive(person, false);
        else {
          const L = person.lengths;
          let i = 1;
          while (i < L.length - 1 && L[i] < person.travel) i++;
          const a = person.path[i - 1], b = person.path[i];
          const t = (person.travel - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
          person.pos.x = a.x + (b.x - a.x) * t; person.pos.z = a.z + (b.z - a.z) * t;
          person.faceGoal = Math.atan2(b.x - a.x, b.z - a.z);
        }
      }
      if (person.emote) {
        const e = person.emote, now = performance.now();
        if (now >= e.until || person.walking) { person.emote = null; refresh(person); }
        else if (e.spin && person.place.pose !== 'sit') person.heading = e.spinFrom + ((now - e.start) / e.ms) * TAU * e.spin;
      }
      const turn = person.emote?.spin ? 0 : angleDiff(person.heading, person.faceGoal);
      person.heading += turn * (1 - Math.exp(-(person.walking ? 12 : 8) * dt));
      av.walking += ((person.walking ? 1 : 0) - av.walking) * (1 - Math.exp(-10 * dt));
      av.speed = person.walking ? person.speed / 1.5 : 1;
      av.root.position.set(person.pos.x, 0, person.pos.z);
      av.root.rotation.y = person.heading;
      av.update(dt);
      // helpers circle whoever spawned them, for as long as they are running
      const want = Math.min(3, person.agent.subagents || 0);
      person.bots ||= [];
      while (person.bots.length < want) { const b = voxObject(helperBot, { key: 'helperbot' }); b.userData.t = Math.random() * 6; group.add(b); person.bots.push(b); }
      while (person.bots.length > want) group.remove(person.bots.pop());
      person.bots.forEach((b, i) => {
        b.userData.t += dt;
        const a = b.userData.t * 1.1 + (i * Math.PI * 2) / Math.max(1, want);
        b.position.set(person.pos.x + Math.cos(a) * 0.62, 1.55 + Math.sin(b.userData.t * 2.3 + i) * 0.07, person.pos.z + Math.sin(a) * 0.62);
        b.rotation.y = -a + Math.PI / 2;
      });
    }
  }

  return {
    group, people,
    setAgent, setPlace, remove, update, refresh, emote,
    /** Where someone is right now (for the camera and labels). */
    positionOf(id) { const p = people.get(id); return p && p.place ? p.pos : null; },
    /** The floor plan changed: keep everyone, re-seat them against the new furniture. */
    rebind(next) {
      layout = next.layout; nav = next.nav; furniture = next.furniture;
      for (const person of people.values()) {
        const deskId = person.deskId; person.deskId = null;
        if (deskId) claimDesk(person, deskId);
        if (person.place && !person.walking) arrive(person, true);
      }
    },
  };
}
