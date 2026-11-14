// The Office — who is this? Click anyone and their card opens: what they are
// doing, for whom, how full their context is, and a line straight to them.
import { h, ago, icon, shortPath, replace } from './dom.js';
import { lifeOf } from './life.js';
import { paintFlatCharacter } from '../art/character.js';
import { PROVIDER_COLORS } from '../avatar/build.js';

const DRIVEN_MODE = { ask: 'asks first', edits: 'edits freely', full: 'free hand' };
const STATUS_TEXT = { arriving: 'arriving', thinking: 'thinking', working: 'working', blocked: 'waiting on you', done: 'finished', leaving: 'leaving' };

function mugshot(look) {
  const canvas = h('canvas.mug', { width: 52, height: 52 });
  try {
    const sprite = paintFlatCharacter(look, {}).toCanvas(2);        // x −16..16, y −62..2 → 64 × 128
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(sprite, 6, 44, 52, 52, 0, 0, 52, 52);                // head and shoulders
  } catch { /* a blank portrait is fine */ }
  return canvas;
}

export function createInspector(office, ui) {
  const panel = h('div.side.glass.hidden');
  ui.root.append(panel);
  let current = null, lookKey = '', mug = null, follow = true;

  const title = h('h2.clip');
  const sub = h('div.dim.clip', { style: { fontSize: '12px' } });
  const mugSlot = h('div');
  const status = h('div.statusline');
  const facts = h('dl.kv');
  const meter = h('div.meter', h('i'));
  const input = h('textarea.field', { rows: 2, placeholder: 'Say something to them…' });
  const sendBtn = h('button.btn.primary.small', icon('send'), 'Send');
  const note = h('div.dim', { style: { fontSize: '12px' } });
  const followBtn = h('button.btn.small', { onclick: () => { follow = !follow; applyFollow(); } }, icon('eye'), h('span', 'Following'));
  // where its work can be read: the record of a session the office drives, or its terminal
  const workBtn = h('button.btn.small.hidden', { onclick: () => {
    const a = current && office.net.state.agents.get(current);
    const rt = a?.runtime;
    if (rt?.kind === 'driven') ui.openSheet('work', { driven: rt.sessionId });
    else if (rt?.sessionId) ui.openSheet('work', { sessionId: rt.sessionId });
  } }, icon('term'), h('span', 'Record'));

  panel.append(
    h('header', mugSlot, h('div.grow', title, sub), h('button.btn.ghost.small', { title: 'Close (Esc)', onclick: () => ui.select(null) }, icon('close'))),
    h('div.body.scroll', status, facts, h('div', h('div.row', { style: { marginBottom: '4px', fontSize: '12px' } }, h('span.faint.grow', 'context window'), h('span.mono.dim', { id: 'ctxpct' })), meter),
      h('div', input, h('div.row', { style: { marginTop: '6px', flexWrap: 'wrap' } }, sendBtn, followBtn, workBtn, h('span.grow'), note))),
  );

  async function send() {
    const text = input.value.trim();
    if (!text || !current) return;
    sendBtn.disabled = true;
    try {
      const res = await office.net.api('/api/comms/direct-message', { method: 'POST', body: { toAgentId: current, content: text } });
      input.value = '';
      const live = res?.receipt?.delivered || res?.terminalDelivered || res?.delivered;
      note.textContent = res?.turnDelivered ? 'They have it: it starts their next turn.' : live ? 'Delivered to their terminal.' : 'In their inbox — read on their next turn.';
    } catch (err) { note.textContent = `Could not send: ${err.message}`; }
    sendBtn.disabled = false;
  }
  sendBtn.onclick = send;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } e.stopPropagation(); });

  function applyFollow() {
    followBtn.lastChild.textContent = follow ? 'Following' : 'Follow';
    followBtn.classList.toggle('on', follow);
    if (!current) return;
    if (follow) office.rig.flyTo({ dist: Math.min(office.rig.goal.dist, 13) }, { follow: () => office.people?.positionOf(current) });
    else office.rig.stopFollowing();
  }

  function render() {
    const a = current ? office.net.state.agents.get(current) : null;
    if (!a) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const look = a.profile?.character;
    const key = JSON.stringify(look || {});
    if (key !== lookKey) { lookKey = key; mug = look ? mugshot(look) : h('div.mug'); replace(mugSlot, mug); }
    mug.style.boxShadow = `inset 0 -3px 0 ${PROVIDER_COLORS[a.provider] || PROVIDER_COLORS.unknown}`;
    title.textContent = a.name;
    sub.textContent = [a.provider, a.model].filter(Boolean).join(' · ');
    const needs = a.status === 'blocked' && a.blockKind !== 'idle';
    const idle = a.turn === 'idle' && a.status !== 'blocked';
    const life = lifeOf(a, office.net.now());          // on a break, on the roof, in focus…: their own call (server/life.mjs)
    status.className = 'statusline' + (needs ? ' blocked' : '');
    replace(status, h('i.dot.' + (needs ? 'blocked' : life?.away || idle ? 'idle' : a.status)),
      h('span.grow', needs ? 'waiting on you' : life ? life.label : idle ? 'idle — turn finished' : STATUS_TEXT[a.status] || a.status,
        a.tool && a.status === 'working' && !life?.away ? h('span.dim', ` · ${a.tool}`) : null),
      h('span.faint.mono', ago(a.since, office.net.now())));
    const place = office.net.state.places.get(a.id);
    const room = place && office.world?.layout.roomById.get(place.room);
    const rt = a.runtime || null, driven = rt?.kind === 'driven';
    const ws = office.net.state.workspace;
    const git = ws?.agents?.[a.id] || null;
    const clash = (ws?.overlaps || []).find((o) => (o.agents || []).some((x) => x.id === a.id)) || null;
    const hosted = !driven && rt?.managed && rt?.sessionId && rt?.kind === 'terminal';
    workBtn.classList.toggle('hidden', !(driven || hosted));
    workBtn.lastChild.textContent = driven ? 'Record' : 'Terminal';
    workBtn.title = driven ? 'Read what it has done, and give it its next turn' : 'Open its terminal';
    const rows = [
      ['doing', a.task || (a.status === 'working' && a.tool ? `using ${a.tool}` : '—')],
      needs && a.note ? ['asks', a.note] : null,
      life ? ['their time', `${life.label}${life.note ? ` — ${life.note}` : ''} · mail is held for them`] : null,
      ['project', a.department?.name || '—'],
      ['where', room ? `${room.name}${place.at === 'desk' ? ' · at their desk' : place.at?.startsWith('poi:') ? ` · ${place.ref}` : ''}` : '—'],
      ['folder', shortPath(a.cwd) || '—'],
      git ? ['branch', h('a.link', { title: 'Who else is in this repository (G)', onclick: () => ui.openSheet('repos') },
        [git.branch || (git.detached ? 'detached' : 'no branch yet'), git.linked ? 'own checkout' : '', git.dirty ? `${git.dirty} changed` : '', git.ahead ? `${git.ahead} ahead` : '', git.behind ? `${git.behind} behind` : ''].filter(Boolean).join(' · '))] : null,
      clash ? ['clash', h('a.link.warn', { title: clash.text || '', onclick: () => ui.openSheet('repos') },
        `${clash.agents.filter((x) => x.id !== a.id).map((x) => x.name).join(', ')} ${clash.kind === 'claimed' ? 'has claimed' : 'is also in'} ${String(clash.path || '').split('/').pop()}`)] : null,
      driven ? ['runs', `driven by the office · ${DRIVEN_MODE[rt.mode] || rt.mode || ''}`.replace(/ · $/, '')] : null,
      ['tools used', String(a.toolCount || 0) + (a.subagents ? ` · ${a.subagents} helper${a.subagents > 1 ? 's' : ''} running` : '')],
      ['here since', ago(a.joinedAt, office.net.now())],
    ].filter(Boolean);
    replace(facts, rows.map(([k, val]) => [h('dt', k), h('dd', val)]));
    const pct = Math.max(0, Math.min(100, Math.round(a.contextPct || 0)));
    meter.firstChild.style.width = pct + '%';
    meter.className = 'meter' + (pct >= 90 ? ' full' : pct >= 70 ? ' warn' : '');
    panel.querySelector('#ctxpct').textContent = pct + '%';
  }

  office.net.on('agent', (a) => { if (a.id === current) render(); });
  office.net.on('place', (id) => { if (id === current) render(); });
  office.net.on('workspace', () => { if (current) render(); });
  office.net.on('remove', (id) => { if (id === current) ui.select(null); });
  setInterval(() => { if (current) render(); }, 15000);

  return {
    get current() { return current; },
    show(id, opt = {}) {
      current = id || null;
      note.textContent = '';
      follow = opt.follow !== false;
      render();
      if (opt.follow === false) { followBtn.lastChild.textContent = 'Follow'; followBtn.classList.remove('on'); return; }   // you are walking: the camera stays on you
      if (current) applyFollow(); else office.rig.stopFollowing();
    },
    focusInput() { if (current) input.focus(); },
  };
}
