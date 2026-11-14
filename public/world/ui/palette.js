// The Office — the command palette (Ctrl/⌘-K, or "/"). Type a few letters of
// a name, a room, or a thing you want to do.
import { h, icon } from './dom.js';

const css = `
#ui .palette { position: absolute; left: 50%; top: 110px; transform: translateX(-50%); width: min(560px, calc(100% - 24px)); overflow: hidden; animation: rise .14s ease-out; }
#ui .palette input { width: 100%; border: 0; outline: 0; background: transparent; padding: 14px 16px; font-size: 15px; border-bottom: 1px solid var(--line); }
#ui .palette .list { max-height: 46vh; overflow-y: auto; padding: 4px 0; }
#ui .palette .item small { color: var(--faint); font: 11px/1 var(--mono); }
`;

function score(text, query) {                       // letters in order; earlier and tighter is better
  const t = text.toLowerCase();
  let at = -1, total = 0;
  for (const ch of query) {
    const next = t.indexOf(ch, at + 1);
    if (next < 0) return null;
    total += next - at - 1 + (next === 0 || t[next - 1] === ' ' ? -2 : 0);
    at = next;
  }
  return total + t.length * 0.01;
}

export function createPalette(office, ui) {
  if (!document.getElementById('pal-css')) document.head.append(h('style', { id: 'pal-css' }, css));
  let el = null, items = [], index = 0;

  function commands() {
    const out = [];
    const net = office.net;
    for (const a of net.state.agents.values()) {
      const needs = a.status === 'blocked' && a.blockKind !== 'idle';
      out.push({ label: a.name, hint: `${a.department?.name || a.provider || ''} · ${needs ? 'needs you' : a.turn === 'idle' ? 'idle' : a.status}`, dot: needs ? 'blocked' : a.turn === 'idle' ? 'idle' : a.status, run: () => ui.select(a.id) });
    }
    for (const r of office.world?.layout.rooms || []) {
      if (r.locked || r.kind === 'corridor' || r.kind === 'elevator' || r.kind === 'landing' || r.kind === 'vacant') continue;
      out.push({ label: r.name, hint: 'room', icon: 'pin', run: () => ui.gotoRoom(r.id) });
    }
    const sheet = (name, label, key) => out.push({ label, hint: key, icon: { comms: 'chat', board: 'board', binder: 'book', work: 'term', passport: 'star', usage: 'eye' }[name], run: () => ui.openSheet(name) });
    sheet('comms', 'Comms — channels and direct lines', 'C'); sheet('board', 'Board — kanban', 'B'); sheet('binder', 'Binder — project docs', 'K');
    sheet('work', 'Terminals', 'T'); sheet('passport', 'Passport — discoveries', 'P');
    sheet('usage', 'What is left — usage per provider', 'U');
    out.push({ label: office.walk?.active ? 'Step back off the floor' : 'Walk the floor', hint: 'Tab', icon: 'pin', run: () => office.walk?.toggle() });
    out.push({ label: 'The whole office', hint: 'Space', icon: 'home', run: () => ui.overview() });
    out.push({ label: 'Next agent waiting on you', hint: 'N', icon: 'inbox', run: () => ui.nextNeed() });
    const s = office.settings;
    for (const [mode, label] of [['auto', 'Graphics: decide for me'], ['pretty', 'Graphics: pretty (bloom, soft focus)'], ['fast', 'Graphics: fast']]) {
      out.push({ label, hint: s.get('graphics') === mode ? 'current' : '', icon: 'gear', run: () => s.set('graphics', mode) });
    }
    for (const [mode, label] of [['auto', 'Time: follow the clock'], ['day', 'Time: always day'], ['dusk', 'Time: always golden hour'], ['night', 'Time: always night']]) {
      out.push({ label, hint: s.get('time') === mode ? 'current' : '', icon: 'gear', run: () => s.set('time', mode) });
    }
    out.push({ label: s.get('sound') === 'on' ? 'Sound: turn off' : 'Sound: turn on (a chime when someone needs you, and the office itself)', hint: s.get('sound') === 'on' ? 'on' : 'off', icon: 'gear', run: () => s.set('sound', s.get('sound') === 'on' ? 'off' : 'on') });
    if (s.get('sound') === 'on') {                      // what sound.js listens to; each is on, at normal volume, until changed
      for (const [key, label] of [['music', 'Music'], ['ambience', 'Ambience (room tone, typing)']]) {
        const on = (s.get(key) ?? 'on') === 'on';
        out.push({ label: `${label}: turn ${on ? 'off' : 'on'}`, hint: on ? 'on' : 'off', icon: 'gear', run: () => s.set(key, on ? 'off' : 'on') });
      }
      for (const level of ['quiet', 'normal', 'loud']) out.push({ label: `Volume: ${level}`, hint: (s.get('volume') ?? 'normal') === level ? 'current' : '', icon: 'gear', run: () => s.set('volume', level) });
    }
    out.push({ label: s.get('notify') === 'on' ? 'Notify me in other tabs: turn off' : 'Notify me when someone needs me (in other tabs)', hint: s.get('notify') === 'on' ? 'on' : 'off', icon: 'gear', run: () => s.set('notify', s.get('notify') === 'on' ? 'off' : 'on') });
    out.push({ label: 'Rename yourself…', hint: office.walk?.me.name || '', icon: 'gear', run: () => {
      const name = window.prompt('What should agents call you?', office.walk?.me.name || 'Lead');
      if (name && name.trim()) { office.walk.setName(name.trim()); ui.toast(`Agents will know you as ${office.walk.me.name}.`); }
    } });
    out.push({ label: 'Open the classic 2D office', hint: '/classic/', icon: 'eye', run: () => { window.open('/classic/', '_blank', 'noopener'); } });
    return out;
  }

  function close() { if (el) { el.remove(); el = null; } }
  function render(list, query) {
    const all = commands();
    const q = query.trim().toLowerCase();
    const rank = (c) => { const a = score(c.label, q), b = score(c.label + ' ' + c.hint, q); return a !== null ? a : b !== null ? b + 20 : null; };
    items = q ? all.map((c) => ({ c, s: rank(c) })).filter((x) => x.s !== null).sort((a, b) => a.s - b.s).map((x) => x.c) : all;
    items = items.slice(0, 40);
    index = Math.min(index, Math.max(0, items.length - 1));
    list.replaceChildren(...items.map((c, i) => h('div.item' + (i === index ? '.on' : ''), { onclick: () => { close(); c.run(); }, onmouseenter: () => { index = i; for (const [k, n] of [...list.children].entries()) n.classList.toggle('on', k === i); } },
      c.dot ? h('i.dot.' + c.dot) : icon(c.icon || 'search'), h('span.grow.clip', c.label), h('small', c.hint || ''))),
    ...(items.length ? [] : [h('div.empty', 'Nothing by that name.')]));
  }

  function open() {
    if (el) { close(); return; }
    const input = h('input', { placeholder: 'Someone, a room, or something to do…', spellcheck: false });
    const list = h('div.list');
    el = h('div.palette.glass', input, list);
    ui.root.append(el);
    index = 0;
    render(list, '');
    input.addEventListener('input', () => { index = 0; render(list, input.value); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); index = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); render(list, input.value); list.children[index]?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { const c = items[index]; close(); c?.run(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (el && !el.contains(document.activeElement)) close(); }, 120));
    input.focus();
  }

  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
  });
  return { open, close };
}
