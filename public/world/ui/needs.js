// The Office — NEEDS YOU. Every agent that is waiting on the human, as a
// stack of cards you can answer without leaving the room. This is the one
// part of the interface that is allowed to demand attention.
import { h, ago, icon } from './dom.js';

const KIND = { permission: 'wants permission', question: 'has a question', idle: 'finished — your move' };

export function createNeeds(office, ui) {
  const tray = h('div.needs');
  ui.root.append(tray);
  const cards = new Map();          // prompt id → card

  function roomName(agentId) {
    const place = office.net.state.places.get(agentId);
    const room = place && office.world?.layout.roomById.get(place.room);
    return room ? room.name : '';
  }

  async function send(card, text, close = true) {
    const p = card.prompt;
    card.sendBtn.disabled = true;
    try {
      const res = await office.net.api(`/api/prompts/${encodeURIComponent(p.id)}/reply`, { method: 'POST', body: { text, close } });
      const how = !text ? 'Dismissed.' : res.terminalDelivered ? `Typed into ${p.agentName}'s terminal.`
        : res.boardPosted ? `Left for ${p.agentName} — they will read it on their next turn.` : `Noted for ${p.agentName}.`;
      ui.toast(how);
    } catch (err) {
      card.sendBtn.disabled = false;
      card.receipt.textContent = `Could not send: ${err.message}`;
      card.receipt.style.color = 'var(--danger)';
    }
  }

  function makeCard(p) {
    const input = h('textarea.field', { rows: 1, placeholder: p.kind === 'permission' ? 'yes / no / instructions…' : 'Reply…' });
    const sendBtn = h('button.btn.primary.small', { title: 'Send (Enter)' }, icon('send'), 'Send');
    const receipt = h('div.receipt.dim');
    const age = h('span.faint.mono');
    const where = h('span.chip');
    const head = h('header', { title: 'Show me', onclick: () => ui.select(p.agentId) },
      h('i.dot.blocked'), h('b.clip', p.agentName || 'Someone'), where, h('span.grow'), age);
    const msg = h('div.msg', { onclick: () => el.classList.toggle('open') }, p.message || '(no message)');
    const el = h('div.need.glass', head, h('div.kind', KIND[p.kind] || 'needs you'), msg,
      h('div.reply', input, sendBtn, h('button.btn.ghost.small', { title: 'Dismiss without answering', onclick: () => send(card, '', true) }, icon('close'))), receipt);
    if (p.kind === 'idle') el.style.borderLeftColor = 'var(--done)';
    const card = { el, prompt: p, input, sendBtn, receipt, age, where };
    const submit = () => { const text = input.value.trim(); if (text) send(card, text); };
    sendBtn.onclick = submit;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
      e.stopPropagation();
    });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight + 2) + 'px'; });
    return card;
  }

  function render(prompts) {
    const pending = (prompts || []).filter((p) => p.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
    const live = new Set(pending.map((p) => p.id));
    for (const [id, card] of cards) if (!live.has(id)) { card.el.remove(); cards.delete(id); }
    for (const p of pending) {
      let card = cards.get(p.id);
      if (!card) { card = makeCard(p); cards.set(p.id, card); tray.append(card.el); }
      card.prompt = p;
    }
    tick();
    ui.setNeedCount(pending.length);
  }

  function tick() {
    for (const card of cards.values()) {
      card.age.textContent = ago(card.prompt.createdAt, office.net.now());
      const room = roomName(card.prompt.agentId);
      card.where.textContent = room; card.where.style.display = room ? '' : 'none';
    }
  }
  setInterval(tick, 20000);

  office.net.on('prompts', render);
  render(office.net.state.prompts);

  return {
    count: () => cards.size,
    /** Bring one agent's card forward and put the cursor in it. */
    focus(agentId) {
      const card = [...cards.values()].find((c) => c.prompt.agentId === agentId);
      if (!card) return false;
      card.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      card.el.classList.add('open');
      card.input.focus();
      return true;
    },
    /** The agent after `afterId` in waiting order (wraps round). */
    next(afterId) {
      const list = [...cards.values()].map((c) => c.prompt.agentId);
      if (!list.length) return null;
      return list[(list.indexOf(afterId) + 1) % list.length];
    },
  };
}
