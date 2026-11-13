// The Office — walking the floor. Press Tab and you are in the building: your
// own avatar, WASD to walk, E to use whatever you are standing at. Agents can
// tell you are there (`office look` says so, `office go lead` walks over), and
// other people watching the same office see you too.
//
// Using a thing goes through the very same rules agents get
// (server/world/text.mjs), so the coffee machine, the bell and the red book
// behave identically for everyone — and answer in the same words.
import * as THREE from 'three';
import { Avatar } from './avatar/rig.js';
import { h } from './ui/dom.js';
import { edgeKey, tileKey } from '/core/layout.mjs';
import { resolveLook } from '/core/look.mjs';

const RADIUS = 0.24, WALK = 2.3, RUN = 4.4, REACH = 1.35;
const TAU = Math.PI * 2;
const NEEDS_TEXT = { guestbook: 'Write a line in the guestbook…', console: 'Type a word…' };

function loadIdentity() {
  let me = null;
  try { me = JSON.parse(localStorage.getItem('office.lead') || 'null'); } catch { me = null; }
  if (!me || !me.id) me = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name: 'Lead', look: null };
  try { localStorage.setItem('office.lead', JSON.stringify(me)); } catch { /* private mode: fine */ }
  return me;
}

export function createWalk(office) {
  const me = loadIdentity();
  const net = office.net;
  const s = { active: false, x: 0, z: 10.2, heading: Math.PI, moving: false, sentAt: 0, sentMoving: false, hop: 0, near: null, busy: false };
  let avatar = null;
  const visitors = new Map();            // other humans: client id → { avatar, x, z, heading, tx, tz, moving, name }
  const group = new THREE.Group();
  office.stage.scene.add(group);

  /* ---- narration: the world answers in words, like a text adventure ------------ */
  const root = document.getElementById('ui');
  const prompt = h('div.usehint.glass.hidden');
  const story = h('div.story.glass.hidden');
  root.append(prompt, story);
  let storyTimer = null;
  function narrate(text, opt = {}) {
    if (!text) return;
    clearTimeout(storyTimer);
    story.replaceChildren(h('div.text', text));
    story.classList.remove('hidden');
    if (opt.ask) {
      const input = h('input.field', { placeholder: opt.ask, maxLength: 140 });
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && input.value.trim()) { const v = input.value.trim(); story.classList.add('hidden'); opt.onAnswer(v); }
        else if (e.key === 'Escape') story.classList.add('hidden');
      });
      story.append(input);
      setTimeout(() => input.focus(), 30);
    } else {
      if (opt.actions) story.append(h('div.row', { style: { marginTop: '8px' } }, opt.actions.map((a) => h('a.btn.small.primary', { href: a.href || '#', onclick: a.onclick || null }, a.label))));
      storyTimer = setTimeout(() => story.classList.add('hidden'), Math.min(14000, 3500 + text.length * 55) + (opt.actions ? 6000 : 0));
    }
  }

  /* ---- can I stand here? ---------------------------------------------------------- */
  function openBetween(layout, ax, az, bx, bz) {            // adjacent tiles, no wall on the shared edge
    if (ax === bx && az === bz) return true;
    if (ax !== bx && az !== bz) return openBetween(layout, ax, az, bx, az) && openBetween(layout, bx, az, bx, bz)
      && openBetween(layout, ax, az, ax, bz) && openBetween(layout, ax, bz, bx, bz);
    if (ax !== bx) return !layout.wallEdges.has(edgeKey('v', Math.max(ax, bx), az));
    return !layout.wallEdges.has(edgeKey('h', ax, Math.max(az, bz)));
  }
  function standable(layout, tx, tz) {
    if (!layout.walkable(tx, tz)) return false;
    const room = layout.roomById.get(layout.tiles.get(tileKey(tx, tz)));
    return !!room && room.kind !== 'elevator';
  }
  function canStand(x, z) {
    const layout = office.world?.layout;
    if (!layout) return false;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!standable(layout, cx, cz)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const tx = Math.floor(x + Math.cos(a) * RADIUS), tz = Math.floor(z + Math.sin(a) * RADIUS);
      if (tx === cx && tz === cz) continue;
      if (!standable(layout, tx, tz) || !openBetween(layout, cx, cz, tx, tz)) return false;
    }
    return true;
  }

  function ensureAvatar() {
    if (avatar) return;
    const look = resolveLook('lead:' + me.id, me.look || { accessory: 'crown' });
    avatar = new Avatar(look, { seed: 'lead:' + me.id, provider: 'custom' });
    group.add(avatar.root);
  }

  function announce(force) {
    const now = performance.now();
    if (!force && now - s.sentAt < (s.moving ? 140 : 1200)) return;
    if (!force && !s.moving && !s.sentMoving) { if (now - s.sentAt < 5000) return; }
    s.sentAt = now; s.sentMoving = s.moving;
    net.send({ type: 'walk', x: s.x, z: s.z, heading: s.heading, moving: s.moving });
  }

  /* ---- what is within reach --------------------------------------------------------- */
  function nearest() {
    const layout = office.world?.layout;
    if (!layout) return null;
    let best = null, bestD = REACH;
    const unlocked = !!net.state.world?.plan?.unlocked?.backroom;
    for (const poi of layout.pois.values()) {
      if (poi.hidden && !unlocked) continue;
      if (poi.kind === 'seat') continue;
      const d = Math.min(Math.hypot(poi.stand.x - s.x, poi.stand.z - s.z), Math.hypot(poi.look.x - s.x, poi.look.z - s.z) - 0.3);
      if (d < bestD) { bestD = d; best = { thing: poi.id, label: poi.label, kind: poi.kind, x: poi.look.x, z: poi.look.z }; }
    }
    const cat = office.cat?.pos;
    if (cat && Math.hypot(cat.x - s.x, cat.z - s.z) < Math.min(bestD, 1.1)) best = { thing: 'cat', label: `${net.state.world?.cat?.name || 'the cat'}`, kind: 'cat', x: cat.x, z: cat.z };
    const duck = office.duck;
    if (duck && Math.hypot(duck.x - s.x, duck.z - s.z) < Math.min(bestD, 1.5)) best = { thing: 'duck', label: 'a rubber duck', kind: 'duck', x: duck.x, z: duck.z };
    return best;
  }

  async function use(target = s.near, arg) {
    if (!target || s.busy) return;
    if (NEEDS_TEXT[target.kind] && arg === undefined && target.kind === 'guestbook') {
      narrate('The guestbook lies open at a blank line.', { ask: NEEDS_TEXT.guestbook, onAnswer: (v) => use(target, v) });
      return;
    }
    s.busy = true;
    if (s.active) s.heading = Math.atan2(target.x - s.x, target.z - s.z);
    try {
      const r = await net.api('/api/world/lead/use', { method: 'POST', body: { id: me.id, name: me.name, thing: target.thing, arg } });
      if (target.kind === 'console' && arg === undefined) narrate(r.text, { ask: NEEDS_TEXT.console, onAnswer: (v) => use(target, v) });
      else narrate(r.text);
      office.onUsed?.(target, r);
    } catch (err) { narrate(err.message); }
    s.busy = false;
  }

  /* ---- other humans ------------------------------------------------------------------ */
  function onLead(fx) {
    if (fx.id === me.id) return;
    let v = visitors.get(fx.client);
    if (fx.gone || fx.x === null || fx.x === undefined) {
      if (v) { group.remove(v.avatar.root); v.avatar.dispose(); visitors.delete(fx.client); }
      return;
    }
    if (!v) {
      const av = new Avatar(resolveLook('lead:' + fx.id, fx.look || { accessory: 'crown' }), { seed: 'lead:' + fx.id, provider: 'custom' });
      v = { avatar: av, x: fx.x, z: fx.z, heading: fx.heading || 0, name: fx.name };
      group.add(av.root);
      visitors.set(fx.client, v);
    }
    v.tx = fx.x; v.tz = fx.z; v.th = fx.heading || 0; v.moving = !!fx.moving; v.name = fx.name;
  }
  net.on('fx', (fx) => { if (fx.kind === 'lead') onLead(fx); });
  net.on('world', (w) => { for (const l of w.leads || []) onLead(l); });
  net.on('status', (up) => { if (up && s.active) { net.send({ type: 'lead', id: me.id, name: me.name, look: me.look || { accessory: 'crown' } }); announce(true); } });

  const api = {
    me, state: s, visitors,
    get active() { return s.active; },
    get position() { return s.active ? s : null; },
    enter() {
      const layout = office.world?.layout;
      if (!layout || s.active) return;
      ensureAvatar();
      // start where you are looking, if that is somewhere you can stand; else at the front door
      const c = office.rig.cur;
      if (canStand(c.x, c.z)) { s.x = c.x; s.z = c.z; } else if (!canStand(s.x, s.z)) { s.x = layout.spots.entrance.x; s.z = layout.spots.entrance.z - 0.6; }
      s.active = true;
      avatar.root.visible = true;
      office.ui?.select(null);
      office.rig.flyTo({ dist: Math.min(office.rig.goal.dist, 9), pitch: 0.62 }, { follow: () => s });
      net.send({ type: 'lead', id: me.id, name: me.name, look: me.look || { accessory: 'crown' } });
      announce(true);
      document.body.classList.add('walking');
      narrate('You step onto the floor.  WASD to walk · Shift to hurry · E to use what is in front of you · Tab to step back out.');
    },
    exit() {
      if (!s.active) return;
      s.active = false; s.moving = false;
      if (avatar) avatar.root.visible = false;
      prompt.classList.add('hidden');
      office.rig.stopFollowing();
      net.send({ type: 'walk', off: true });
      document.body.classList.remove('walking');
    },
    toggle() { if (s.active) api.exit(); else api.enter(); },
    use, narrate,
    setName(name) { me.name = String(name || 'Lead').slice(0, 32); try { localStorage.setItem('office.lead', JSON.stringify(me)); } catch { /* fine */ } },
    /** Called every frame with the keys that are down. Returns true while it owns the keyboard. */
    steer(held, dt) {
      if (!s.active) return false;
      let fx = 0, fz = 0;
      if (held.has('w') || held.has('ArrowUp')) fz -= 1;
      if (held.has('s') || held.has('ArrowDown')) fz += 1;
      if (held.has('a')) fx -= 1;
      if (held.has('d')) fx += 1;
      if (held.has('ArrowLeft')) office.rig.goal.yaw += 1.7 * dt;
      if (held.has('ArrowRight')) office.rig.goal.yaw -= 1.7 * dt;
      const yaw = office.rig.cur.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
      let vx = fx * c + fz * sn, vz = -fx * sn + fz * c;
      const len = Math.hypot(vx, vz);
      s.moving = len > 0.01;
      if (s.moving) {
        const speed = held.has('Shift') ? RUN : WALK;
        vx = (vx / len) * speed * dt; vz = (vz / len) * speed * dt;
        const okX = canStand(s.x + vx, s.z), okZ = canStand(s.x, s.z + vz);
        if (okX) s.x += vx;                                     // slide along whatever is in the way
        if (okZ) s.z += vz;
        // …except in one corner, where leaning on the wall long enough gets a different answer
        const soft = office.softSpot;
        if (soft && !okX && !okZ && Math.hypot(soft.x - s.x, soft.z - s.z) < 0.75) {
          s.lean = (s.lean || 0) + dt;
          if (s.lean > 1.1) { s.lean = 0; office.onNoclip?.(); }
        } else s.lean = 0;
        const want = Math.atan2(vx, vz);
        let d = (want - s.heading) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        s.heading += d * (1 - Math.exp(-14 * dt));
        avatar.speed = speed / 1.5;
      }
      return true;
    },
    hop() { if (s.active) s.hop = 1; },
    update(dt) {
      for (const v of visitors.values()) {
        if (v.tx !== undefined) { const k = 1 - Math.exp(-9 * dt); v.x += (v.tx - v.x) * k; v.z += (v.tz - v.z) * k; let d = (v.th - v.heading) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; v.heading += d * k; }
        v.avatar.walking += ((v.moving ? 1 : 0) - v.avatar.walking) * (1 - Math.exp(-10 * dt));
        v.avatar.root.position.set(v.x, 0, v.z); v.avatar.root.rotation.y = v.heading;
        v.avatar.update(dt);
      }
      if (!s.active || !avatar) return;
      avatar.walking += ((s.moving ? 1 : 0) - avatar.walking) * (1 - Math.exp(-12 * dt));
      if (s.hop > 0) { s.hop = Math.max(0, s.hop - dt * 2.2); avatar.bounce = Math.sin(s.hop * Math.PI); } else avatar.bounce = 0;
      avatar.root.position.set(s.x, 0, s.z);
      avatar.root.rotation.y = s.heading;
      avatar.update(dt);
      announce(false);
      const near = s.busy ? s.near : nearest();
      if ((near?.thing || null) !== (s.near?.thing || null)) {
        s.near = near;
        if (near) { prompt.replaceChildren(h('kbd', 'E'), ' ', near.label); prompt.classList.remove('hidden'); } else prompt.classList.add('hidden');
      } else if (near) s.near = near;
    },
  };
  return api;
}
