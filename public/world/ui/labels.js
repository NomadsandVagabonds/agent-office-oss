// The Office — name tags, speech bubbles and room names, floating over the 3D
// world as plain DOM so they stay crisp, clickable and readable at any zoom.
import * as THREE from 'three';
import { h } from './dom.js';

export function createLabels(office, ui) {
  const layer = h('div.labels');
  ui.root.append(layer);
  const tags = new Map();        // agent id → tag
  const roomTags = new Map();    // room id → { el, room }
  const leadTags = new Map();    // humans walking the floor
  const v = new THREE.Vector3();
  let roomsFor = null;

  function tagFor(id) {
    let t = tags.get(id);
    if (t) return t;
    const dot = h('i.dot');
    const text = h('span');
    const name = h('div.name', { onclick: (e) => { e.stopPropagation(); ui.select(id); } }, dot, text);
    const el = h('div.tag', name);
    t = { el, dot, text, name, bubble: null, bubbleUntil: 0, sticky: null, key: '' };
    layer.append(el);
    tags.set(id, t);
    return t;
  }

  function setBubble(t, text, cls, onclick) {
    if (!text) { if (t.bubble) { t.bubble.remove(); t.bubble = null; } return; }
    if (!t.bubble) { t.bubble = h('div.bubble'); t.el.prepend(t.bubble); }
    t.bubble.className = 'bubble' + (cls ? ' ' + cls : '');
    t.bubble.textContent = text;
    t.bubble.onclick = onclick || null;
  }

  /** Someone says something out loud: a bubble for a few seconds. */
  function say(id, text, ms = 5200, cls = '') {
    const t = tags.get(id);
    if (!t) return;
    t.said = { text, cls, until: performance.now() + ms };
  }

  function syncRooms() {
    const layout = office.world?.layout;
    if (!layout || roomsFor === layout) return;
    roomsFor = layout;
    for (const r of roomTags.values()) r.el.remove();
    roomTags.clear();
    for (const room of layout.rooms) {
      if (room.locked || room.kind === 'corridor' || room.kind === 'elevator' || room.kind === 'landing' || room.kind === 'vacant') continue;
      const sub = h('small');
      const el = h('div.roomtag', { onclick: (e) => { e.stopPropagation(); ui.gotoRoom(room.id); } }, room.name, sub);
      layer.append(el);
      roomTags.set(room.id, { el, sub, room });
    }
  }

  function update() {
    const people = office.people;
    if (!people || !office.world) return;
    syncRooms();
    const { camera, size } = office.stage;
    const dist = office.rig.cur.dist;
    const far = dist > 34, map = dist > 46 && dist < 112, tiny = dist >= 112;      // tiny: the whole office is a speck on a desk
    layer.style.opacity = tiny ? '0' : '1';
    const now = performance.now();
    const pending = new Map(office.net.state.prompts.filter((p) => p.status === 'pending').map((p) => [p.agentId, p]));
    const perRoom = new Map();

    for (const id of [...tags.keys()]) if (!people.people.has(id)) { tags.get(id).el.remove(); tags.delete(id); }
    for (const person of people.people.values()) {
      if (!person.place) continue;
      const a = person.agent, t = tagFor(person.id);
      const idle = a.turn === 'idle' && a.status !== 'blocked';
      const prompt = pending.get(a.id);
      const needs = !!prompt || (a.status === 'blocked' && a.blockKind !== 'idle');
      const key = `${a.name}|${a.status}|${idle}|${needs}|${office.selected === a.id}|${far}`;
      if (key !== t.key) {
        t.key = key;
        t.text.textContent = a.name;
        t.dot.className = 'dot ' + (needs ? 'blocked' : idle ? '' : a.status);
        t.el.className = 'tag' + (far ? ' far' : '') + (idle ? ' idle' : '') + (office.selected === a.id ? ' selected' : '');
        t.name.title = `${a.name} — ${needs ? 'needs you' : a.status}`;
      }
      // what is over their head: something they said, else "needs you"
      if (t.said && now > t.said.until) t.said = null;
      const want = t.said ? `s:${t.said.text}` : needs ? `n:${far}` : '';
      if (want !== t.sticky) {
        t.sticky = want;
        if (t.said) setBubble(t, t.said.text, t.said.cls);
        else if (needs) setBubble(t, far ? '!' : 'needs you', 'alert', (e) => { e.stopPropagation(); ui.focusNeed(a.id); });
        else setBubble(t, null);
      }
      v.set(person.pos.x, person.atDesk || person.place.pose === 'sit' ? 1.5 : 1.62, person.pos.z).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.2;
      t.el.style.display = on ? '' : 'none';
      if (on) t.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.h).toFixed(1)}px) translate(-50%, -100%)`;
      const room = person.place.room;
      const tally = perRoom.get(room) || { here: 0, needs: 0 };
      tally.here++; if (needs) tally.needs++;
      perRoom.set(room, tally);
    }

    // humans on the floor (you, and anyone else watching this office)
    const walk = office.walk;
    const humans = [];
    if (walk?.active) humans.push({ key: 'me', name: walk.me.name + ' (you)', x: walk.state.x, z: walk.state.z });
    for (const [client, vis] of walk?.visitors || []) humans.push({ key: 'v' + client, name: vis.name || 'Lead', x: vis.x, z: vis.z });
    for (const [key, t] of leadTags) if (!humans.some((p) => p.key === key)) { t.el.remove(); leadTags.delete(key); }
    for (const p of humans) {
      let t = leadTags.get(p.key);
      if (!t) { const text = h('span'); t = { el: h('div.tag.lead', h('div.name', h('i.dot', { style: { background: 'var(--accent)' } }), text)), text }; layer.append(t.el); leadTags.set(p.key, t); }
      if (t.name !== p.name) { t.name = p.name; t.text.textContent = p.name; }
      v.set(p.x, 1.66, p.z).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.2;
      t.el.style.display = on ? '' : 'none';
      if (on) t.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.h).toFixed(1)}px) translate(-50%, -100%)`;
    }

    for (const r of roomTags.values()) {
      if (!map) { r.el.style.display = 'none'; continue; }
      const { rect } = r.room;
      v.set(rect.x + rect.w / 2, 0, rect.z + rect.d * 0.86).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      r.el.style.display = on ? '' : 'none';
      if (!on) continue;
      const tally = perRoom.get(r.room.id);
      const line = tally ? `${tally.here} here${tally.needs ? ` · ${tally.needs} need${tally.needs > 1 ? '' : 's'} you` : ''}` : '';
      if (r.line !== line) { r.line = line; r.sub.textContent = line; r.sub.style.display = line ? '' : 'none'; r.el.classList.toggle('hot', !!tally?.needs); }
      r.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.h).toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  /* ---- floaters: a heart over the cat, a "ding!" over the bell ------------------- */
  const floaters = [];
  function float(x, y, z, text, opt = {}) {
    const el = h('div.floater', text);
    if (opt.color) el.style.color = opt.color;
    if (opt.size) el.style.fontSize = opt.size + 'px';
    layer.append(el);
    floaters.push({ el, x, y, z, born: performance.now(), ms: opt.ms || 1500, rise: opt.rise ?? 0.7, drift: (Math.random() - 0.5) * 0.3 });
  }
  function updateFloaters() {
    if (!floaters.length) return;
    const { camera, size } = office.stage;
    const now = performance.now();
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], t = (now - f.born) / f.ms;
      if (t >= 1) { f.el.remove(); floaters.splice(i, 1); continue; }
      v.set(f.x + f.drift * t, f.y + f.rise * t, f.z).project(camera);
      f.el.style.opacity = String(Math.min(1, (1 - t) * 2.2));
      f.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.h).toFixed(1)}px) translate(-50%, -50%) scale(${(0.7 + Math.min(1, t * 6) * 0.3).toFixed(2)})`;
    }
  }

  return { update() { update(); updateFloaters(); }, say, float };
}
