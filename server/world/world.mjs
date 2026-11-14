// The Office — the world. The daemon's model of the 3D office: which project
// has which room, who sits where, where every avatar is right now, what is on
// display, and what has been discovered.
//
// It is authoritative about *intent* ("Amber is walking to the coffee
// machine, due in 6 s") and leaves the frame-by-frame walking to clients,
// which run the same layout + nav code. That keeps the daemon cheap and lets
// agents — who see the world as text — and humans — who see it in 3D — share
// one truth.
import { JsonFile } from '../persist.mjs';
import { EV } from '../../core/contract.mjs';
import {
  buildLayout, deskFillOrder, faceAngle, projectRoomId, PEDESTALS, SHELF_SLOTS,
} from '../../core/layout.mjs';
import { createNav, RUN_SPEED, WALK_SPEED } from '../../core/nav.mjs';
import { SECRETS, dayQuirks, dayWeather, secretById } from '../../core/secrets.mjs';
import { isCreationId } from '../../core/creations.mjs';
import { resolveLook, sanitizeLookPatch } from '../../core/look.mjs';
import { readCreations } from '../creations-store.mjs';
import { createTextWorld } from './text.mjs';
import { createGame } from './game.mjs';

const TICK_MS = 4000;
const IDLE_BEFORE_ERRAND_MS = 25_000;
const MANUAL_STAY_MS = 60_000;
const MAX_ROOMS = 24;
const ROOM_RECYCLE_MS = 7 * 24 * 60 * 60 * 1000;
const EMOTES = Object.freeze(['wave', 'dance', 'bow', 'cheer', 'shrug', 'think', 'facepalm',
  'nod', 'stretch', 'highfive', 'salute', 'spin', 'sleep', 'laugh']);
const ERRANDS = Object.freeze([
  { poi: 'coffee', weight: 5, stay: [9, 16], pose: 'stand' },
  { poi: 'cooler', weight: 3, stay: [8, 14], pose: 'stand' },
  { poi: 'sofa', weight: 3, stay: [30, 70], pose: 'sit' },
  { poi: 'armchair-1', weight: 2, stay: [30, 70], pose: 'sit' },
  { poi: 'armchair-2', weight: 2, stay: [30, 70], pose: 'sit' },
  { poi: 'tree', weight: 2, stay: [8, 14], pose: 'stand' },
  { poi: 'vending', weight: 2, stay: [7, 11], pose: 'stand' },
  { poi: 'bigboard', weight: 2, stay: [10, 18], pose: 'stand' },
  { poi: 'fridge', weight: 1, stay: [7, 11], pose: 'stand' },
  { poi: 'globe', weight: 1, stay: [8, 14], pose: 'stand' },
  { poi: 'printer', weight: 1, stay: [7, 12], pose: 'stand' },
]);

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export function createWorld(ctx, file) {
  const { cfg, bus } = ctx;
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, rooms: [], seats: {}, shelves: {}, unlocked: {}, discoveries: {},
      stats: {}, guestbook: [], arcade: [], cat: { name: 'Kernel', pets: 0 } }),
    validate: (d) => d && Array.isArray(d.rooms),
  });
  const state = store.data;
  for (const key of ['seats', 'shelves', 'unlocked', 'discoveries', 'stats']) state[key] = state[key] || {};
  state.guestbook = Array.isArray(state.guestbook) ? state.guestbook : [];
  state.arcade = Array.isArray(state.arcade) ? state.arcade : [];
  state.cat = state.cat && typeof state.cat === 'object' ? state.cat : { name: 'Kernel', pets: 0 };
  const save = () => store.save();

  /** agentId → Placement */
  const places = new Map();
  /** agentId → desk id */
  const seatOf = new Map();
  /** agentId → { poi, until, manual, rang } */
  const errands = new Map();
  /** poi id → agentId standing there */
  const occupants = new Map();
  /** ws client id → { name, focus, at } — where humans are looking */
  const leads = new Map();
  const cat = { x: 5.3, z: 4.4, room: 'plaza', state: 'nap', since: Date.now(), nextMoveAt: Date.now() + 30_000 };
  let layout = null;
  let nav = null;
  let tickTimer = null;

  /* ---- plan + layout --------------------------------------------------- */

  const plan = () => ({
    rooms: state.rooms.map((r) => ({ slot: r.slot, deptId: r.deptId, name: r.name, color: r.color || null })),
    unlocked: { ...state.unlocked },
  });

  function rebuild() {
    layout = buildLayout(plan());
    nav = createNav(layout);
  }
  rebuild();

  function broadcastWorld() {
    bus.broadcast({ type: EV.WORLD, world: snapshot() });
  }

  function roomFor(dept) {
    if (!dept || !dept.id) return null;
    let room = state.rooms.find((r) => r.deptId === dept.id);
    const now = Date.now();
    if (room) {
      room.lastActive = now;
      let changed = false;
      if (dept.name && room.name !== dept.name) { room.name = dept.name; changed = true; }
      if ((dept.color || null) !== (room.color || null) && !dept.auto) { room.color = dept.color || null; changed = true; }
      if (changed) { save(); rebuild(); broadcastWorld(); }
      return room;
    }
    const used = new Set(state.rooms.map((r) => r.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    if (slot >= MAX_ROOMS) {
      // The floor is full: the stalest empty room gives way.
      const live = new Set(ctx.agents.list().map((a) => a.department?.id));
      const stale = state.rooms.filter((r) => !live.has(r.deptId) && now - (r.lastActive || 0) > ROOM_RECYCLE_MS)
        .sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0))[0];
      if (!stale) return null;
      slot = stale.slot;
      state.rooms = state.rooms.filter((r) => r !== stale);
    }
    room = { slot, deptId: dept.id, name: dept.name || dept.id, color: dept.color || null,
      createdAt: now, lastActive: now };
    state.rooms.push(room);
    save();
    rebuild();
    broadcastWorld();
    return room;
  }

  /** Close a project's room (only when nobody is in it). */
  function closeRoom(deptId) {
    const room = state.rooms.find((r) => r.deptId === deptId);
    if (!room) return { error: 'no such room', status: 404 };
    if (ctx.agents.list().some((a) => a.department?.id === deptId && ctx.agents.isPresent(a))) {
      return { error: 'someone is still working in there', status: 409 };
    }
    state.rooms = state.rooms.filter((r) => r !== room);
    delete state.shelves[deptId];
    save();
    rebuild();
    broadcastWorld();
    return { ok: true };
  }

  const knownDepartments = () => state.rooms.map((r) => ({ id: r.deptId, name: r.name }));

  /* ---- seating --------------------------------------------------------- */

  function seat(agent) {
    const dept = agent.department;
    const record = roomFor(dept);
    const taken = new Set([...seatOf.entries()].filter(([id]) => id !== agent.id).map(([, deskId]) => deskId));
    const personaKey = ctx.personas.keyOf(agent.id);
    let deskId = null;
    if (record) {
      const roomId = projectRoomId(dept.id);
      const remembered = personaKey ? state.seats[personaKey] : null;
      if (remembered && remembered.startsWith(roomId + '#') && !taken.has(remembered) && layout.desk(remembered)) {
        deskId = remembered;
      } else {
        for (const index of deskFillOrder()) {
          const candidate = `${roomId}#${index}`;
          if (!taken.has(candidate) && layout.desk(candidate)) { deskId = candidate; break; }
        }
      }
    }
    if (!deskId) {
      const hot = layout.desks.filter((d) => d.hot).find((d) => !taken.has(d.id));
      deskId = hot ? hot.id : null;
    }
    if (deskId) {
      seatOf.set(agent.id, deskId);
      if (personaKey && !deskId.startsWith('plaza#') && state.seats[personaKey] !== deskId) {
        state.seats[personaKey] = deskId;
        save();
      }
    } else {
      seatOf.delete(agent.id);
    }
    return deskId;
  }

  /* ---- placements ------------------------------------------------------ */

  function currentPosition(id) {
    const p = places.get(id);
    if (!p) return null;
    const now = Date.now();
    if (!p.from || now >= p.eta) return { x: p.x, z: p.z };
    const t = Math.max(0, Math.min(1, (now - p.since) / Math.max(1, p.eta - p.since)));
    return { x: p.from.x + (p.x - p.from.x) * t, z: p.from.z + (p.z - p.from.z) * t };
  }

  function setPlace(agent, target, opt = {}) {
    const from = opt.from || currentPosition(agent.id) || { ...layout.spots.elevator };
    const now = Date.now();
    const speed = opt.run ? RUN_SPEED : WALK_SPEED;
    const seconds = opt.instant ? 0 : nav.walkSeconds(from, target, speed);
    const place = {
      id: agent.id,
      room: layout.roomAt(target.x, target.z) || target.room || 'plaza',
      at: target.at || 'spot',
      ref: target.ref || null,
      x: Math.round(target.x * 100) / 100,
      z: Math.round(target.z * 100) / 100,
      face: target.face ?? 0,
      pose: target.pose || 'stand',
      from: { x: Math.round(from.x * 100) / 100, z: Math.round(from.z * 100) / 100 },
      since: now,
      eta: now + Math.round(seconds * 1000),
      run: !!opt.run,
      leaving: !!opt.leaving,
    };
    places.set(agent.id, place);
    bus.broadcast({ type: EV.WORLD_AGENT, id: agent.id, place });
    return place;
  }

  function deskTarget(agent) {
    const desk = layout.desk(seatOf.get(agent.id));
    if (desk) {
      return { at: 'desk', ref: desk.id, x: desk.seat.x, z: desk.seat.z, face: faceAngle(desk.seat.face), pose: 'sit' };
    }
    // Nowhere to sit: stand around the plaza, spread out so nobody overlaps.
    const n = [...places.keys()].indexOf(agent.id);
    const k = n < 0 ? places.size : n;
    return { at: 'spot', ref: 'standing', x: -2.5 + (k % 6) * 1.0, z: 4.6 + Math.floor(k / 6) * 0.9, face: Math.PI, pose: 'stand' };
  }

  function releasePoi(agentId) {
    for (const [poi, who] of occupants) if (who === agentId) occupants.delete(poi);
  }

  function sendHome(agent, opt = {}) {
    errands.delete(agent.id);
    releasePoi(agent.id);
    const place = setPlace(agent, deskTarget(agent), opt);
    bus.local({ type: 'world:home', agent });            // whoever was on a break is not any more (server/life.mjs)
    return place;
  }

  function poiTarget(poi) {
    const stand = poi.stand;
    const face = Math.atan2(poi.look.x - stand.x, poi.look.z - stand.z);
    const seated = poi.kind === 'seat';
    // A seat faces the way its furniture faces, not back at itself.
    const object = layout.objects.find((o) => o.id === poi.object);
    return {
      at: `poi:${poi.id}`, ref: poi.id, x: stand.x, z: stand.z,
      face: seated && object ? faceAngle(object.face) : face,
      pose: seated ? 'sit' : 'stand',
    };
  }

  /* ---- fx -------------------------------------------------------------- */

  const fx = (effect) => bus.broadcast({ type: EV.WORLD_FX, fx: { t: Date.now(), ...effect } });

  function bumpStat(name, n = 1) {
    state.stats[name] = (state.stats[name] || 0) + n;
    save();
    return state.stats[name];
  }

  /* ---- discoveries ----------------------------------------------------- */

  /**
   * Someone found something. `by` is an agent, or null for the human.
   * Returns { secret, first (office-wide), stamped (new for this finder) }.
   */
  function discover(secretId, by, extra = {}) {
    const secret = secretById(secretId);
    if (!secret) return { error: 'no such secret', status: 404 };
    const byName = by ? by.name : (extra.name || 'Lead');
    const first = !state.discoveries[secretId];
    if (first) {
      state.discoveries[secretId] = { by: by ? (ctx.personas.keyOf(by.id) || by.id) : 'lead', byName, at: Date.now() };
      save();
    }
    let stamped = first;
    if (by) {
      const key = ctx.personas.keyOf(by.id);
      if (key) stamped = ctx.personas.stamp(key, secretId) || first;
    }
    const opens = secretId === 'red-book' && !state.unlocked.backroom;
    if (opens) { state.unlocked.backroom = true; save(); rebuild(); }
    // a first stamp is a coin in the office's jar (core/game.mjs): everybody's copy of the jar should say so at once
    if (first || opens) broadcastWorld();
    if (first || stamped) {
      bus.broadcast({ type: EV.DISCOVERY, secret: { id: secret.id, name: secret.name, icon: secret.icon, blurb: secret.blurb },
        by: byName, byAgentId: by ? by.id : null, first });
      if (first) ctx.activity.log('discovery', `${byName} discovered “${secret.name}”`, { secret: secret.id, agentId: by?.id || null });
    }
    return { ok: true, secret, first, stamped, by: byName };
  }

  /* ---- gallery + shelves ----------------------------------------------- */

  function creationIds() {
    const stored = readCreations(cfg.creationsFile);
    return stored ? stored.creations.map((c) => c.id) : [];
  }

  /** Which creation stands on which pedestal (newest first, paged if many). */
  function gallery() {
    const ids = creationIds().reverse();
    return { total: ids.length, pedestals: ids.slice(0, PEDESTALS), overflow: ids.slice(PEDESTALS) };
  }

  function placeOnShelf(agent, creationId, slot) {
    const deptId = agent.department?.id;
    if (!deptId || !state.rooms.some((r) => r.deptId === deptId)) return { error: 'you have no project room to decorate', status: 409 };
    if (creationId !== null && (!isCreationId(creationId) || !creationIds().includes(creationId))) {
      return { error: `no creation with id "${creationId}" (see GET /api/creations)`, status: 404 };
    }
    const shelf = (state.shelves[deptId] || []).slice(0, SHELF_SLOTS);
    while (shelf.length < SHELF_SLOTS) shelf.push(null);
    let index = Number.isInteger(slot) ? slot : shelf.indexOf(null);
    if (index < 0) index = 0;
    if (index >= SHELF_SLOTS) return { error: `slot must be 0..${SHELF_SLOTS - 1}`, status: 400 };
    shelf[index] = creationId;
    state.shelves[deptId] = shelf;
    save();
    bus.broadcast({ type: EV.WORLD_OBJECT, object: { kind: 'shelf', deptId, items: shelf } });
    return { ok: true, deptId, slot: index, items: shelf };
  }

  /* ---- snapshot -------------------------------------------------------- */

  function today() {
    const now = new Date();
    return { quirks: dayQuirks(now), weather: dayWeather(now), tzOffsetMin: -now.getTimezoneOffset(),
      duckDesk: api.text?.duckDesk()?.id || null };       // where today's rubber duck is sitting
  }

  function snapshot() {
    return {
      plan: plan(),
      places: [...places.values()],
      seats: Object.fromEntries(seatOf),
      shelves: state.shelves,
      gallery: gallery(),
      discoveries: state.discoveries,
      // keycards, the coin jar, what has been bought (core/game.mjs)
      game: game.view(),
      secrets: SECRETS.map((s) => (state.discoveries[s.id]
        ? { id: s.id, name: s.name, icon: s.icon, blurb: s.blurb, found: true,
          by: state.discoveries[s.id].byName, at: state.discoveries[s.id].at }
        : { id: s.id, found: false, hint: s.hint })),
      stats: state.stats,
      cat: { name: state.cat.name, pets: state.cat.pets || 0, x: cat.x, z: cat.z, room: cat.room, state: cat.state },
      guestbook: state.guestbook.slice(-12),
      arcade: state.arcade.slice(0, 8),
      leads: [...leads.values()].map(publicLead),
      today: today(),
      serverTime: Date.now(),
      emotes: EMOTES,
    };
  }

  function summary() {
    return {
      rooms: state.rooms.length,
      avatars: places.size,
      away: errands.size,
      discoveries: Object.keys(state.discoveries).length,
      secrets: SECRETS.length,
      tasksDone: state.stats.tasksDone || 0,
    };
  }

  /* ---- the director: ambient life, driven only by true idleness -------- */

  function pickErrand(agent) {
    const free = ERRANDS.filter((e) => layout.pois.has(e.poi) && !occupants.has(e.poi));
    if (!free.length) return null;
    let roll = Math.random() * free.reduce((sum, e) => sum + e.weight, 0);
    for (const e of free) { roll -= e.weight; if (roll <= 0) return e; }
    return free[0];
  }

  function startErrand(agent, poiId, opt = {}) {
    const poi = layout.pois.get(poiId);
    if (!poi) return null;
    releasePoi(agent.id);
    occupants.set(poiId, agent.id);
    const place = setPlace(agent, poiTarget(poi), { run: opt.run });
    const stay = opt.stayMs ?? rand(9000, 16000);
    errands.set(agent.id, { poi: poiId, until: place.eta + stay, manual: !!opt.manual, holdUntil: opt.holdUntil || 0 });
    return place;
  }

  function moveCat(now) {
    const spots = [...layout.pois.values()].filter((p) => !p.hidden && ['catbed', 'rack', 'seat', 'tree', 'board'].includes(p.kind));
    const desks = layout.desks.filter((d) => !d.hot);
    // Kernel has favourites: the warm racks, the cushion, and whoever is typing.
    const typing = ctx.agents.list().filter((a) => a.status === 'working' && places.get(a.id)?.at === 'desk');
    let target;
    const roll = Math.random();
    if (roll < 0.3 && typing.length) {
      const p = places.get(typing[Math.floor(Math.random() * typing.length)].id);
      target = { x: p.x + 0.7, z: p.z + 0.2, state: 'sit' };
    } else if (roll < 0.55) {
      target = { x: 5.3, z: 4.4, state: 'nap' };
    } else if (roll < 0.7) {
      target = { x: 6.6, z: 8.6, state: 'nap' };                       // by the warm racks
    } else if (spots.length && roll < 0.9) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      target = { x: s.stand.x + 0.4, z: s.stand.z, state: 'sit' };
    } else if (desks.length) {
      const d = desks[Math.floor(Math.random() * desks.length)];
      target = { x: d.seat.x + 0.6, z: d.seat.z, state: 'sit' };
    }
    if (!target) return;
    const tile = nav.nearestWalkable(target.x, target.z);
    if (!tile) return;
    const from = { x: cat.x, z: cat.z };
    cat.x = tile.x + 0.5; cat.z = tile.z + 0.5;
    cat.room = layout.roomAt(cat.x, cat.z) || cat.room;
    cat.state = target.state;
    cat.since = now;
    const seconds = nav.walkSeconds(from, cat, 1.1);
    cat.nextMoveAt = now + seconds * 1000 + rand(35_000, 110_000);
    fx({ kind: 'cat', from, to: { x: cat.x, z: cat.z }, state: cat.state, eta: now + Math.round(seconds * 1000) });
  }

  function tick() {
    const now = Date.now();
    const present = ctx.agents.list().filter(ctx.agents.isPresent);
    const maxAway = Math.max(1, Math.ceil(present.length * 0.45));
    for (const agent of present) {
      const place = places.get(agent.id);
      if (!place) continue;
      const errand = errands.get(agent.id);
      if (errand) {
        const busy = agent.turn === 'active' && agent.status !== 'blocked';
        if (errand.ringBell && now >= place.eta && !errand.rung) {
          errand.rung = true;
          fx({ kind: 'bell', by: agent.id });
          bumpStat('bellRings');
        }
        if ((busy && now >= errand.holdUntil) || now >= errand.until) sendHome(agent, { run: busy });
        continue;
      }
      if (place.at !== 'desk' || now < place.eta) continue;
      // Blocked on a real decision for a while: go and ring for the human.
      if (agent.status === 'blocked' && agent.blockKind === 'permission'
        && now - agent.since > 75_000 && agent._rangFor !== agent.since && layout.pois.has('bell')
        && !occupants.has('bell')) {
        agent._rangFor = agent.since;
        startErrand(agent, 'bell', { stayMs: 3500 });
        errands.get(agent.id).ringBell = true;
        continue;
      }
      if (agent.turn !== 'idle' || agent.status === 'blocked' || agent.status === 'arriving') continue;
      if (now - Math.max(agent.since, place.eta) < IDLE_BEFORE_ERRAND_MS) continue;
      if (errands.size >= maxAway || Math.random() > 0.09) continue;
      const choice = pickErrand(agent);
      if (choice) startErrand(agent, choice.poi, { stayMs: rand(choice.stay[0], choice.stay[1]) * 1000 });
    }
    if (now >= cat.nextMoveAt) moveCat(now);
  }

  /* ---- reactions to what really happens -------------------------------- */

  bus.on('agent:join', ({ agent, restored }) => {
    seat(agent);
    if (restored) {                             // already at its desk before the restart
      setPlace(agent, deskTarget(agent), { instant: true, from: deskTarget(agent) });
      return;
    }
    setPlace(agent, deskTarget(agent), { from: { ...layout.spots.elevator } });
    fx({ kind: 'elevator', dir: 'in', id: agent.id });
    if (dayQuirks(new Date()).includes('friday-13')) discover('thirteenth', agent);
    const hour = new Date().getHours();
    if (hour >= 1 && hour < 4) discover('night-owl', agent);
  });

  bus.on('agent:leave', ({ agent }) => {
    errands.delete(agent.id);
    releasePoi(agent.id);
    seatOf.delete(agent.id);
    setPlace(agent, { at: 'spot', ref: 'elevator', ...layout.spots.elevator, face: Math.PI, pose: 'stand' }, { leaving: true });
    fx({ kind: 'elevator', dir: 'out', id: agent.id });
    // (only if they are still on their way out: someone who came straight back keeps the place they were given)
    const t = setTimeout(() => { if (places.get(agent.id)?.leaving) places.delete(agent.id); }, 30_000);
    if (typeof t.unref === 'function') t.unref();
  });

  // An agent whose project (cwd) changed mid-session moves desks.
  bus.on('update', ({ agent }) => {
    const live = ctx.agents.get(agent.id);
    if (!live || !ctx.agents.isPresent(live) || !places.has(agent.id)) return;
    const deskId = seatOf.get(agent.id);
    const wantRoom = live.department?.id ? projectRoomId(live.department.id) : null;
    if (wantRoom && deskId && !deskId.startsWith(wantRoom + '#') && !deskId.startsWith('plaza#')) {
      seat(live);
      if (!errands.has(live.id)) setPlace(live, deskTarget(live));
    } else if (wantRoom && !deskId) {
      if (seat(live) && !errands.has(live.id)) setPlace(live, deskTarget(live));
    }
  });

  // Real work pulls an agent straight back to its desk.
  bus.on('hook', ({ name, id }) => {
    if (name === 'PreToolUse') bumpStat('tools');
    if (name !== 'UserPromptSubmit' && name !== 'PreToolUse' && name !== 'PostToolUse') return;
    const errand = errands.get(id);
    const agent = ctx.agents.get(id);
    if (!errand || !agent || Date.now() < errand.holdUntil) return;
    sendHome(agent, { run: true });
  });

  bus.on('comms:channel', ({ channel, post, author }) => {
    if (author.agent) fx({ kind: 'say', id: author.agent.id, text: clip(post.content, 120), channel: channel.name });
    // A human in a work channel is an announcement to the room. In the lounge it is just someone talking.
    else if (channel.kind !== 'lounge' && post.authorType !== 'system') fx({ kind: 'announce', channelId: channel.id, channel: channel.name, by: post.author, text: clip(post.content, 160) });
  });

  bus.on('comms:dm', ({ from, to, fromLead, toLead }) => {
    fx({ kind: 'plane', from: fromLead ? 'lead' : (from ? from.id : null), to: toLead ? 'lead' : (to ? to.id : null) });
  });

  bus.on('task:created', ({ task, by }) => {
    fx({ kind: 'sticky', deptId: task.deptId, taskId: task.id, to: task.status, by: by?.authorAgentId || null, created: true });
  });
  bus.on('task:updated', ({ task, before, by }) => {
    if (before.status === task.status) return;
    fx({ kind: 'sticky', deptId: task.deptId, taskId: task.id, from: before.status, to: task.status, by: by?.authorAgentId || null });
    if (task.status === 'done') {
      const done = bumpStat('tasksDone');
      fx({ kind: 'confetti', deptId: task.deptId, by: by?.authorAgentId || task.assignee || null, tasksDone: done });
    }
  });

  bus.on('creation:added', ({ creation, by }) => {
    bus.broadcast({ type: EV.CREATIONS, count: creationIds().length, latest: creation.id });
    fx({ kind: 'unveil', creationId: creation.id, by: by ? by.id : null });
    ctx.activity.log('creation', `${creation.author} made “${creation.name}”`, { creationId: creation.id, agentId: by?.id || null });
    if (by) discover('curator', by);
    broadcastWorld();
  });

  /* ---- actions (humans via UI, agents via text) ------------------------ */

  function go(agent, target, opt = {}) {
    const holdUntil = Date.now() + (opt.stay ? 4 * 60 * 60 * 1000 : MANUAL_STAY_MS);
    if (target.kind === 'home') {
      const place = sendHome(agent);
      return { ok: true, place, text: `You head back to your desk.` };
    }
    if (target.kind === 'poi') {
      if (occupants.has(target.poi.id) && occupants.get(target.poi.id) !== agent.id) {
        const who = ctx.agents.get(occupants.get(target.poi.id));
        return { error: `${who ? who.name : 'someone'} is already at ${target.poi.label}`, status: 409 };
      }
      const place = startErrand(agent, target.poi.id, { manual: true, holdUntil, stayMs: opt.stay ? 4 * 60 * 60 * 1000 : 5 * 60 * 1000 });
      return { ok: true, place, text: `You walk over to ${target.poi.label}.` };
    }
    if (target.kind === 'agent') {
      const other = places.get(target.agent.id);
      if (!other) return { error: `${target.agent.name} is not on the floor`, status: 404 };
      const spot = nav.nearestWalkable(other.x + 0.9, other.z + 0.3) || { x: Math.floor(other.x), z: Math.floor(other.z) };
      releasePoi(agent.id);
      const place = setPlace(agent, {
        at: `agent:${target.agent.id}`, ref: target.agent.id, x: spot.x + 0.5, z: spot.z + 0.5,
        face: Math.atan2(other.x - (spot.x + 0.5), other.z - (spot.z + 0.5)), pose: 'stand',
      });
      errands.set(agent.id, { poi: null, until: place.eta + 5 * 60 * 1000, manual: true, holdUntil });
      return { ok: true, place, text: `You walk over to ${target.agent.name}.` };
    }
    if (target.kind === 'lead') {
      const lead = target.lead;
      const spot = nav.nearestWalkable(lead.x + 0.9, lead.z + 0.3) || { x: Math.floor(lead.x), z: Math.floor(lead.z) };
      releasePoi(agent.id);
      const place = setPlace(agent, {
        at: 'spot', ref: 'lead', x: spot.x + 0.5, z: spot.z + 0.5,
        face: Math.atan2(lead.x - (spot.x + 0.5), lead.z - (spot.z + 0.5)), pose: 'stand',
      });
      errands.set(agent.id, { poi: null, until: place.eta + 5 * 60 * 1000, manual: true, holdUntil });
      return { ok: true, place, text: `You walk over to ${lead.name}.` };
    }
    if (target.kind === 'room') {
      const room = target.room;
      if (room.locked) return { error: 'you do not know a way in there', status: 403 };
      const cx = room.rect.x + room.rect.w / 2, cz = room.rect.z + room.rect.d / 2;
      const tile = nav.nearestWalkable(cx, cz + (room.kind === 'project' ? 2.6 : 0), 8);
      const here = currentPosition(agent.id) || layout.spots.plaza;
      const wayFrom = (from) => !!tile && !!nav.findPath(from, { x: tile.x + 0.5, z: tile.z + 0.5 });
      // Someone in mid-walk is, on paper, on the straight line between where they were and where they are
      // going, and that line can run through a wall. Then the way is judged from the nearest bit of floor.
      const nearby = () => { const t = nav.nearestWalkable(here.x, here.z, 8); return !!t && wayFrom({ x: t.x + 0.5, z: t.z + 0.5 }); };
      if (!wayFrom(here) && !nearby()) {
        return { error: `there is no way into ${room.name} from here`, status: 409 };
      }
      releasePoi(agent.id);
      const place = setPlace(agent, { at: 'spot', ref: room.id, x: tile.x + 0.5, z: tile.z + 0.5, face: 0, pose: 'stand' });
      errands.set(agent.id, { poi: null, until: place.eta + 5 * 60 * 1000, manual: true, holdUntil });
      visited(agent, room.id);
      return { ok: true, place, text: `You walk to ${room.name}.` };
    }
    return { error: 'nowhere to go', status: 400 };
  }

  function visited(agent, roomId) {
    const key = ctx.personas.keyOf(agent.id);
    const persona = ctx.personas.get(key);
    if (!persona) return;
    persona.rooms = persona.rooms || {};
    if (persona.rooms[roomId]) return;
    persona.rooms[roomId] = Date.now();
    ctx.personas.store.save();
    const must = ['library', 'kitchen', 'plaza', 'foyer', 'closet', 'server'];
    if (must.every((id) => persona.rooms[id])) discover('cartographer', agent);
  }

  function emote(agent, name) {
    const emoteName = String(name || '').toLowerCase();
    if (!EMOTES.includes(emoteName)) return { error: `unknown emote (try: ${EMOTES.join(', ')})`, status: 400 };
    fx({ kind: 'emote', id: agent.id, name: emoteName });
    return { ok: true, emote: emoteName };
  }

  function say(agent, text) {
    const line = clip(text, 160);
    if (!line) return { error: 'say what?', status: 400 };
    fx({ kind: 'say', id: agent.id, text: line, local: true });
    return { ok: true, text: line, note: 'Spoken aloud in the room (a speech bubble). To reach someone\'s inbox, use a channel post or a DM.' };
  }

  function petCat(by, name) {
    state.cat.pets = (state.cat.pets || 0) + 1;
    save();
    fx({ kind: 'pet', by: by ? by.id : null, x: cat.x, z: cat.z });
    let found = null;
    const count = by ? (by._catPets = (by._catPets || 0) + 1) : 0;
    if (by && count >= 9) found = discover('cat-person', by);
    return { ok: true, pets: state.cat.pets, yours: count, found, text: `${state.cat.name} purrs.` };
  }

  function signGuestbook(by, name, text) {
    const line = clip(text, 140);
    if (!line) return { error: 'the page stays blank (give it some text)', status: 400 };
    const entry = { name: by ? by.name : clip(name || 'Lead', 40), text: line, at: Date.now(), agent: !!by };
    state.guestbook.push(entry);
    if (state.guestbook.length > 400) state.guestbook.splice(0, state.guestbook.length - 400);
    save();
    fx({ kind: 'guestbook', entry });
    const found = by ? discover('guest', by) : discover('guest', null, { name: entry.name });
    return { ok: true, entry, found };
  }

  function arcadeScore(by, name, score) {
    const value = Math.max(0, Math.min(999_999, Math.floor(Number(score) || 0)));
    const entry = { name: by ? by.name : clip(name || 'Lead', 24), score: value, at: Date.now(), agent: !!by };
    const best = state.arcade[0]?.score || 0;
    state.arcade.push(entry);
    state.arcade.sort((a, b) => b.score - a.score);
    state.arcade = state.arcade.slice(0, 20);
    save();
    const top = value > 0 && value >= best && state.arcade[0] === entry;
    fx({ kind: 'arcade', entry, top });
    const found = top ? discover('high-score', by, { name: entry.name }) : null;
    return { ok: true, entry, top, rank: state.arcade.indexOf(entry) + 1, board: state.arcade.slice(0, 8), found };
  }

  function disco(seconds = 22) {
    const until = Date.now() + Math.max(5, Math.min(60, seconds)) * 1000;
    fx({ kind: 'disco', until });
    return { ok: true, until };
  }

  /* ---- humans looking around ------------------------------------------- */

  // Humans on the floor. A browser may just be looking (focus), or its owner
  // may be walking around as an avatar (x, z) — either way agents can tell.
  const leadActors = new Map();          // lead id → the stand-in "who" for things a human does
  function leadActor(id, name) {
    const key = clip(id || 'lead', 48) || 'lead';
    if (!leadActors.has(key)) leadActors.set(key, { id: `lead:${key}`, name: 'Lead', lead: true, department: null });
    const actor = leadActors.get(key);
    if (name) actor.name = clip(name, 32) || 'Lead';
    if (leadActors.size > 200) leadActors.delete(leadActors.keys().next().value);
    return actor;
  }
  const publicLead = (l) => ({ client: l.client, id: l.id, name: l.name, focus: l.focus || null, look: l.look || null,
    x: l.x ?? null, z: l.z ?? null, heading: l.heading || 0, moving: !!l.moving, room: l.room || null });

  function onClientMessage(client, message) {
    if (message.type === 'lead' || message.type === 'focus') {
      const prev = leads.get(client.id) || { client: client.id };
      const focus = message.focus && typeof message.focus === 'object'
        ? { kind: clip(message.focus.kind, 16), id: clip(message.focus.id, 80) } : null;
      const lead = { ...prev, name: clip(message.name || prev.name || 'Lead', 32), id: clip(message.id || prev.id || client.id, 48), focus, at: Date.now() };
      if (message.look && typeof message.look === 'object') lead.look = resolveLook(`lead:${lead.id}`, sanitizeLookPatch(message.look).look);
      leads.set(client.id, lead);
      fx({ kind: 'lead', ...publicLead(lead) });
    } else if (message.type === 'walk') {
      const prev = leads.get(client.id) || { client: client.id, name: 'Lead', id: String(client.id) };
      const now = Date.now();
      if (message.off) {                                   // stepped out of walk mode
        const lead = { ...prev, x: null, z: null, room: null, moving: false, at: now };
        leads.set(client.id, lead);
        fx({ kind: 'lead', ...publicLead(lead) });
        return;
      }
      const x = Number(message.x), z = Number(message.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const room = layout.roomAt(x, z);
      if (!room || layout.roomById.get(room)?.locked) return;      // only places that exist
      if (prev.walkAt && now - prev.walkAt < 90 && message.moving) return;     // a few times a second is plenty
      const lead = { ...prev, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, heading: Number(message.heading) || 0,
        moving: !!message.moving, room, at: now, walkAt: now };
      leads.set(client.id, lead);
      fx({ kind: 'lead', ...publicLead(lead) });
    } else if (message.type === 'ping') {
      client.send({ type: 'pong', t: Date.now() });
    }
  }

  function onClientGone(client) {
    if (leads.delete(client.id)) fx({ kind: 'lead', client: client.id, focus: null, gone: true });
  }

  function onPersonaChanged() { /* looks ride on the agent update; nothing to move */ }

  /* ---- lifecycle ------------------------------------------------------- */

  function start() {
    // Agents that were already registered before the world came up.
    for (const agent of ctx.agents.list()) {
      if (!places.has(agent.id)) { seat(agent); setPlace(agent, deskTarget(agent), { instant: true }); }
    }
    tickTimer = setInterval(() => {
      try { tick(); } catch (err) { ctx.log.warn('[world] tick failed: ' + (err?.stack || err)); }
    }, TICK_MS);
    tickTimer.unref();
  }

  function stop() {
    if (tickTimer) clearInterval(tickTimer);
    store.flush();
  }

  // The long game: found keycards light the lift's dark buttons, coins fill the office's jar.
  const game = createGame(ctx, state, { save, changed: () => broadcastWorld() });

  const api = {
    game,
    start, stop, snapshot, summary, plan, knownDepartments, closeRoom,
    layout: () => layout, nav: () => nav,
    placeOf: (id) => places.get(id) || null,
    seatOf: (id) => seatOf.get(id) || null,
    errandOf: (id) => errands.get(id) || null,
    occupantOf: (poiId) => occupants.get(poiId) || null,
    leads: () => [...leads.values()].map(publicLead), leadActor,
    cat: () => ({ ...cat, name: state.cat.name, pets: state.cat.pets || 0 }),
    state: () => state,
    today, gallery, placeOnShelf, discover, bumpStat, fx,
    go, sendHome, emote, say, petCat, signGuestbook, arcadeScore, disco, visited,
    onClientMessage, onClientGone, onPersonaChanged,
    EMOTES,
  };
  api.text = createTextWorld(ctx, api);
  return api;
}
