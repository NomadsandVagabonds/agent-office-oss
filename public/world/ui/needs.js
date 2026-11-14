// The Office — NEEDS YOU, as an in-tray.
//
// However many agents are waiting, you are handed one slip: who is asking,
// what exactly, and what your answer is holding up. A counter and two arrows
// reach the rest. Nothing piles up on the screen, nothing steals the slip you
// are reading, and the tray can be put away — a new arrival only nudges it.
//
// What you can do with a slip is exactly what the agent's runtime can honour:
// stamps (allow / deny) appear only when a live request is waiting on them;
// otherwise there is a line to write back on.
import { h, ago, replace } from './dom.js';
import { mugshot } from './portrait.js';

const ASK = { permission: 'wants permission', question: 'has a question' };
const STAMP = { once: ['Allow', 'ok', 'Allow this once', 'ALLOWED'], always: ['Always', 'ok', 'Allow this for the rest of the session', 'ALLOWED'],
  reject: ['Deny', 'no', 'Refuse it', 'DENIED'] };
const HELD = ['doing', 'blocked', 'review'];
// what blocks a running turn comes first, then other permissions, then questions; oldest first within each
const rank = (p) => (p.request?.pending ? 0 : p.kind === 'permission' ? 1 : 2);

export function createNeeds(office, ui) {
  const net = office.net;
  const tray = h('div.intray');
  ui.root.append(tray);
  let list = [];                 // what is waiting, in the order you would want it
  let top = null;                // id of the slip on top
  let folded = false;            // the tray has been put away
  let covered = false;           // a panel is open: the tray waits as a tab until it closes
  let shown = '';                // what is drawn, so a tick does not rebuild it
  let slip = null;               // { el, input, receipt, age, prompt }
  const later = new Set();       // slips sent to the back

  const current = () => list.find((p) => p.id === top) || list[0] || null;

  /** The cards this agent is carrying: what an answer lets move again. */
  function held(p) {
    const mine = [];
    for (const tasks of net.state.tasks.values()) {
      for (const t of tasks) {
        if (HELD.includes(t.status) && (t.assignee === p.agentId || t.assigneeId === p.agentId || (t.assigneeName && t.assigneeName === p.agentName))) mine.push(t);
      }
    }
    return mine;
  }
  function whereabouts(p) {
    const place = net.state.places.get(p.agentId);
    const room = place && office.world?.layout.roomById.get(place.room);
    return room?.name || '';
  }

  async function answer(body, mark, cls) {
    const p = slip?.prompt;
    if (!p || slip.busy) return;
    slip.busy = true;
    slip.el.append(h(`div.mark.${cls}`, mark));
    try {
      const res = await net.api(`/api/prompts/${encodeURIComponent(p.id)}/reply`, { method: 'POST', body });
      const how = body.action ? null : !body.text ? null : res.turnDelivered ? `${p.agentName} has it.` : res.terminalDelivered ? `Typed into ${p.agentName}'s terminal.`
        : res.boardPosted ? `Left for ${p.agentName}: they read it on their next turn.` : null;
      if (how) ui.toast(how);
      slip.el.classList.add('gone');                                  // the bus takes it off the list; this is just the paper leaving
    } catch (err) {
      slip.busy = false;
      slip.el.querySelector('.mark')?.remove();
      slip.receipt.textContent = `That did not go through: ${err.message}`;
    }
  }

  function step(dir) {
    if (list.length < 2) return;
    const i = Math.max(0, list.findIndex((p) => p.id === top));
    top = list[(i + dir + list.length) % list.length].id;
    draw(true);
  }

  function build(p, index) {
    const agent = net.state.agents.get(p.agentId);
    const photo = mugshot(agent?.profile?.character, 'photo');
    const show = () => ui.select(p.agentId);
    photo.onclick = show; photo.title = 'Show me';
    const age = h('small');
    const pager = list.length > 1 ? h('div.pager',
      h('button', { type: 'button', title: 'The one before', onclick: () => step(-1) }, '‹'), `${index + 1}/${list.length}`,
      h('button', { type: 'button', title: 'The next one (N)', onclick: () => step(1) }, '›')) : null;
    const req = p.request?.pending ? p.request : null;
    const detail = req ? [req.command, ...(req.paths || []), req.detail].filter(Boolean).join('\n') : '';
    const cards = held(p);
    const stamps = (p.actions || []).filter((a) => STAMP[a]).map((a) => {
      const [label, cls, title, mark] = STAMP[a];
      return h(`button.inkstamp.${cls}`, { type: 'button', title, onclick: () => answer({ action: a }, mark, cls) }, h('span', label));
    });
    const canWrite = (p.actions || []).includes('reply');
    const input = canWrite ? h('input', { type: 'text', placeholder: stamps.length ? 'or write back…' : 'write back…', 'aria-label': `Reply to ${p.agentName}` }) : null;
    const send = () => { const text = input.value.trim(); if (text) answer({ text, close: true }, 'SENT', 'sent'); };
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } e.stopPropagation(); });
    const receipt = h('div.receipt');
    const el = h(`article.slip.${p.kind === 'question' ? 'question' : 'permission'}${list.length > 1 ? '.more' : ''}${list.length > 2 ? '.many' : ''}`,
      h('header', photo, h('div.who', { onclick: show, title: 'Show me' }, h('b', p.agentName || 'Someone'), age), pager),
      h('div.ask', ASK[p.kind] || 'needs you'),
      h('p.msg', (req?.title && req.title !== p.message ? req.title + '\n' : '') + (p.message || '')),
      detail ? h('pre.cmd', detail) : null,
      cards.length ? h('p.holds', 'Holding up ', h('b', cards.length === 1 ? '1 card' : `${cards.length} cards`), ': ', cards.slice(0, 2).map((t) => `“${t.title}”`).join(', '), cards.length > 2 ? ` and ${cards.length - 2} more` : '') : null,
      stamps.length ? h('div.stamps', stamps) : null,
      input ? h('div.write', input, h('button', { type: 'button', onclick: send }, 'Send')) : null,
      receipt,
      h('footer',
        p.terminalSessionId ? h('a', { onclick: () => ui.openSheet('work', { sessionId: p.terminalSessionId }) }, 'open its terminal') : null,
        list.length > 1 ? h('a', { title: 'Put this one at the back', onclick: () => { later.add(p.id); sort(); top = list[0]?.id || null; draw(true); } }, 'later') : null,
        h('a', { title: 'Take it off the pile without answering', onclick: () => answer({ text: '', close: true }, 'FILED', 'sent') }, 'dismiss'),
        h('span.grow'),
        h('a', { title: 'Put the tray away', onclick: () => { folded = true; draw(true); } }, 'put away')));
    return { el, input, receipt, age, prompt: p, busy: false };
  }

  function draw(force) {
    const p = current();
    top = p ? p.id : null;
    const key = p ? `${folded || covered}|${p.id}|${p.updatedAt}|${list.length}|${list.indexOf(p)}|${(p.actions || []).join()}|${held(p).length}` : `${folded || covered}|`;
    if (!force && key === shown) return;
    shown = key;
    if (!p) { slip = null; replace(tray); return; }
    if (folded || covered) {
      slip = null;
      replace(tray, h('button.tab', { type: 'button', title: 'Show who is waiting (N)', onclick: () => { folded = false; if (covered) ui.closeSheet(); covered = false; draw(true); } }, `${list.length} waiting on you`));
      return;
    }
    slip = build(p, list.indexOf(p));
    replace(tray, slip.el);
    tick();
  }

  function sort() {
    list.sort((a, b) => (later.has(a.id) - later.has(b.id)) || (rank(a) - rank(b)) || (a.createdAt - b.createdAt));
  }

  function render(prompts) {
    const before = new Set(list.map((p) => p.id));
    list = (prompts || []).filter((p) => p.status === 'pending' && p.kind !== 'idle');
    for (const id of later) if (!list.some((p) => p.id === id)) later.delete(id);
    sort();
    const fresh = list.some((p) => !before.has(p.id));
    // the slip you are reading stays where it is; whatever arrives joins the pile behind it
    if (!list.some((p) => p.id === top)) top = list[0]?.id || null;
    draw();
    if (fresh && before.size) { tray.classList.remove('nudge'); void tray.offsetWidth; tray.classList.add('nudge'); }
    ui.setNeedCount(list.length);
  }

  function tick() {
    if (!slip) return;
    const p = slip.prompt;
    slip.age.textContent = [whereabouts(p), `waiting ${ago(p.createdAt, net.now())}`].filter(Boolean).join(' · ');
  }
  setInterval(tick, 20000);

  net.on('prompts', render);
  net.on('tasks', () => draw());
  render(net.state.prompts);

  return {
    count: () => list.length,
    /** A panel opened or closed: tuck the slip away, or bring it back. */
    cover(on) { covered = !!on; draw(true); },
    /** Put one agent's slip on top and get ready to answer it. */
    focus(agentId) {
      const p = list.find((x) => x.agentId === agentId);
      if (!p) return false;
      top = p.id; folded = false;
      if (covered) { ui.closeSheet(); covered = false; }
      draw(true);
      (slip?.input || slip?.el.querySelector('.inkstamp'))?.focus({ preventScroll: true });
      return true;
    },
    /** Whose slip comes after `afterId`'s (wraps round). */
    next(afterId) {
      if (!list.length) return null;
      const i = list.findIndex((p) => p.agentId === afterId);
      return list[(i + 1) % list.length].agentId;
    },
  };
}
