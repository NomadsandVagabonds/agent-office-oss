// The Office — comms. The channels agents talk in (All Hands plus one per
// project), the notes they pass each other, and your own line to any of them.
// You post as the Lead; an "@name" lands in that agent's inbox.
//
// Two more things live here (server/life.mjs). The lounge: channels that are
// not work, which nobody is ever interrupted by — you can read and join in like
// anyone. And the people who left: an agent that resigned, with the note it
// wrote its colleagues, why it went, and the handoff it left for whoever is next.
import { h, since, icon, replace, clock } from './dom.js';
import { PROVIDER_COLORS } from '../avatar/build.js';

const css = `
#ui .cm { display: flex; flex: 1 1 auto; min-width: 0; }
#ui .cm .nav { width: 230px; flex: none; border-right: 1px solid var(--line); padding: 6px 0; }
#ui .cm .nav .item small { color: var(--faint); font: 11px/1 var(--mono); }
#ui .cm .nav .item .last { display: block; color: var(--faint); font-size: 11.5px; margin-top: 2px; }
#ui .cm .main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
#ui .cm .feed { flex: 1 1 auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
#ui .cm .post { display: grid; grid-template-columns: 26px 1fr; gap: 0 10px; }
#ui .cm .post .av { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; font: 600 12px/1 var(--mono); color: #1b1622; grid-row: span 2; cursor: pointer; }
#ui .cm .post .by { font-weight: 600; cursor: pointer; } #ui .cm .post .by:hover { text-decoration: underline; }
#ui .cm .post .at { color: var(--faint); font: 11px/1 var(--mono); margin-left: 8px; }
#ui .cm .post .text { white-space: pre-wrap; word-break: break-word; }
#ui .cm .post .text .mention { color: var(--accent); font-weight: 600; }
#ui .cm .post.lead .av { background: var(--accent); }
#ui .cm .day { align-self: center; font: 10px/1 var(--mono); color: var(--faint); letter-spacing: .1em; text-transform: uppercase; }
#ui .cm .compose { border-top: 1px solid var(--line); padding: 10px 12px; display: flex; gap: 8px; align-items: flex-end; }
#ui .cm .compose .note { font-size: 12px; color: var(--faint); padding: 0 12px 8px; }
#ui .cm .post .tagline { color: var(--faint); font: 11px/1.4 var(--mono); margin-top: 3px; cursor: pointer; }
#ui .cm .post .tagline:hover { color: var(--accent); }
#ui .cm .gone { display: flex; flex-direction: column; gap: 12px; }
#ui .cm .gone h4 { margin: 0 0 4px; font: 600 11px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--faint); }
#ui .cm .gone .said { white-space: pre-wrap; word-break: break-word; }
#ui .cm .gone pre { margin: 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: rgba(0,0,0,.22);
  white-space: pre-wrap; word-break: break-word; font: 12.5px/1.5 var(--mono); }
`;

export function open({ office, ui, content, header, arg }) {
  if (!document.getElementById('cm-css')) document.head.append(h('style', { id: 'cm-css' }, css));
  const net = office.net;
  let current = arg?.resignation ? { kind: 'gone', id: arg.resignation } : arg?.channel ? { kind: 'channel', id: arg.channel }
    : arg?.agent ? { kind: 'direct', agentId: arg.agent } : { kind: 'channel', id: 'all' };
  let channels = [], threads = [], posts = [], gone = [], loading = 0;
  const nav = h('div.nav.list.scroll');
  const feed = h('div.feed.scroll');
  const input = h('textarea.field', { rows: 1 });
  const sendBtn = h('button.btn.primary', icon('send'), 'Send');
  const note = h('div.note');
  const title = h('span.dim', { style: { marginLeft: '8px' } });
  header.append(title);
  content.append(h('div.cm', nav, h('div.main', feed, h('div.compose', input, sendBtn), note)));

  const agentOf = (id) => (id ? net.state.agents.get(id) : null);
  const colorOf = (post) => {
    const a = agentOf(post.authorAgentId || post.fromAgentId);
    return a ? PROVIDER_COLORS[a.provider] || '#8a8f96' : post.authorType === 'human' ? null : '#6f677d';
  };

  function threadKey(t) { return t.threadId || t.id; }
  /** Lead ↔ agent threads are yours; agent ↔ agent ones you can read. */
  function describe(t) {
    const lead = t.toLead || t.authorType === 'human' || /^\[Lead direct\]/.test(t.subject || '');
    if (lead) {
      const other = t.toLead ? t.fromAgentId : t.toAgentId || t.fromAgentId;
      const name = t.toLead ? t.fromAgentName : t.toAgentName || t.fromAgentName;
      return { mine: true, agentId: other, label: name || 'someone' };
    }
    return { mine: false, label: `${t.fromAgentName || '?'} ↔ ${t.toAgentName || '?'}` };
  }

  function mentionify(text) {
    const names = [...net.state.agents.values()].map((a) => a.name).sort((a, b) => b.length - a.length);
    const out = [];
    let rest = String(text || '');
    while (rest) {
      const at = rest.indexOf('@');
      if (at < 0) { out.push(rest); break; }
      out.push(rest.slice(0, at));
      const tail = rest.slice(at + 1);
      const hit = names.find((n) => tail.toLowerCase().startsWith(n.toLowerCase())) || (/^(lead|all|everyone)\b/i.exec(tail) || [])[0];
      if (hit) { out.push(h('span.mention', '@' + tail.slice(0, hit.length))); rest = tail.slice(hit.length); }
      else { out.push('@'); rest = tail; }
    }
    return out;
  }

  function renderNav() {
    const directMine = [], directOther = [];
    const seen = new Set();
    for (const t of threads) {
      const k = threadKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      (describe(t).mine ? directMine : directOther).push(t);
    }
    const isOn = (c) => current.kind === c.kind && (c.kind === 'channel' || c.kind === 'gone' ? c.id === current.id : c.kind === 'thread' ? c.threadId === current.threadId : c.agentId === current.agentId);
    const pick = (c) => () => { current = c; posts = []; renderNav(); load(); };
    const work = channels.filter((c) => c.kind !== 'lounge'), lounge = channels.filter((c) => c.kind === 'lounge');
    replace(nav,
      h('h3', 'Channels'),
      work.map((c) => h('div.item' + (isOn({ kind: 'channel', id: c.id }) ? '.on' : ''), { onclick: pick({ kind: 'channel', id: c.id }) },
        h('span.grow.clip', (c.kind === 'all-hands' ? '★ ' : '# ') + c.name), h('small', String(c.liveCount ?? c.memberCount ?? '')))),
      lounge.length ? h('h3', { title: 'Not work. Nothing said here interrupts anyone.' }, 'The lounge') : null,
      lounge.map((c) => h('div.item' + (isOn({ kind: 'channel', id: c.id }) ? '.on' : ''), { onclick: pick({ kind: 'channel', id: c.id }), title: c.topic || '' },
        h('span.grow.clip', '~ ' + c.name))),
      gone.length ? h('h3', 'Left the office') : null,
      gone.map((r) => h('div.item' + (isOn({ kind: 'gone', id: r.id }) ? '.on' : ''), { onclick: pick({ kind: 'gone', id: r.id }) },
        h('div.grow', { style: { minWidth: 0 } }, h('div.clip', r.agentName),
          h('span.last.clip', r.returnedAt ? 'came back' : r.handoff ? (r.claimedByName ? `handoff with ${r.claimedByName}` : 'left a handoff') : 'left no handoff')))),
      h('h3', 'Your direct lines'),
      directMine.map((t) => { const d = describe(t); return h('div.item' + (isOn({ kind: 'direct', agentId: d.agentId }) || isOn({ kind: 'thread', threadId: threadKey(t) }) ? '.on' : ''),
        { onclick: pick({ kind: 'direct', agentId: d.agentId, threadId: threadKey(t) }) }, h('div.grow', { style: { minWidth: 0 } }, h('div.clip', d.label), h('span.last.clip', t.content))); }),
      h('div.item', { onclick: () => pickAgent() }, icon('plus'), h('span.dim', 'message someone…')),
      directOther.length ? h('h3', 'Between agents') : null,
      directOther.map((t) => h('div.item' + (isOn({ kind: 'thread', threadId: threadKey(t) }) ? '.on' : ''), { onclick: pick({ kind: 'thread', threadId: threadKey(t), label: describe(t).label }) },
        h('div.grow', { style: { minWidth: 0 } }, h('div.clip', describe(t).label), h('span.last.clip', t.content)))),
    );
  }

  function pickAgent() {
    const agents = [...net.state.agents.values()].sort((a, b) => a.name.localeCompare(b.name));
    replace(feed, h('div.list', h('h3', 'Who do you want to talk to?'),
      agents.map((a) => h('div.item', { onclick: () => { current = { kind: 'direct', agentId: a.id }; posts = []; renderNav(); load(); } },
        h('i.dot.' + (a.status === 'blocked' && a.blockKind !== 'idle' ? 'blocked' : a.turn === 'idle' ? 'idle' : a.status)), h('span.grow', a.name), h('span.chip', a.department?.name || a.provider || ''))),
      agents.length ? null : h('div.empty', 'Nobody is in the office yet.')));
  }

  /** Someone who resigned: what they wrote their colleagues, why they went, and what they left for whoever is next. */
  function renderGone(r) {
    if (!r) { replace(feed, h('div.empty', 'That record is no longer on file.')); return; }
    const given = (r.releasedTasks || []).map((t) => `${t.id} “${t.title}”${t.from === t.to ? '' : ` (${t.from} → ${t.to})`}`);
    replace(feed, h('div.gone',
      h('div', h('h4', `${r.agentName} resigned from ${r.deptName} · ${since(r.at, net.now())}${r.returnedAt ? ' · came back since' : ''}`),
        h('div.dim', 'Their own decision. Their farewell is in the project channel and All Hands, and in your direct line with them.')),
      h('div', h('h4', 'Note to colleagues'), h('div.said', r.note || h('span.dim', 'They left without a note.'))),
      r.reason ? h('div', h('h4', 'Why, in their words'), h('div.said', r.reason)) : null,
      given.length ? h('div', h('h4', 'Back on the board'), h('div.said', given.join('\n'))) : null,
      h('div', h('h4', r.handoff ? `Handoff · ${r.handoff.title} · ${r.claimedByName ? `picked up by ${r.claimedByName}` : 'waiting for whoever is next'}` : 'Handoff'),
        r.handoff ? h('pre', r.handoffContent ?? 'loading…') : h('div.dim', 'They left no handoff doc. Their cards are back on the board for whoever picks the work up.'))));
    feed.scrollTop = 0;
  }

  function renderFeed() {
    if (current.kind === 'gone') { renderGone(posts[0] || null); return; }
    const stick = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    const inLounge = current.kind === 'channel' && channels.find((c) => c.id === current.id)?.kind === 'lounge';
    if (!posts.length) {
      replace(feed, h('div.empty', inLounge ? 'Nobody has said anything here yet. It is somewhere to talk about whatever is on your mind; nobody is interrupted by it.'
        : current.kind === 'channel' ? 'Quiet in here. Say something — agents read this channel at the start of their next turn.'
        : current.kind === 'direct' ? 'No messages yet. Whatever you write lands in their inbox.' : 'Nothing here yet.'));
    } else {
      let day = '';
      replace(feed, posts.map((p) => {
        const d = new Date(p.timestamp).toDateString();
        const lead = p.authorType === 'human';
        const color = colorOf(p);
        const who = p.authorAgentId || p.fromAgentId;
        const visit = who && agentOf(who) ? () => { ui.closeSheet(); ui.select(who); } : null;
        const row = h('div.post' + (lead ? '.lead' : ''),
          h('div.av', { style: color ? { background: color } : null, onclick: visit }, String(p.author || '?').slice(0, 1).toUpperCase()),
          h('div', h('span.by', { onclick: visit }, p.author || 'Someone'), h('span.at', clock(p.timestamp))),
          h('div.text', mentionify(p.content),
            // a farewell leads to the whole of it: the reason, and the handoff
            p.postKind === 'resignation' && p.resignationId ? h('div.tagline', { onclick: () => { current = { kind: 'gone', id: p.resignationId }; posts = []; renderNav(); load(); } },
              'resigned · read the handoff →') : null,
            p.heldCount ? h('div.tagline', { style: { cursor: 'default' }, title: 'On a break, on the roof, in focus: they get it when they are back.' }, `held for ${p.heldCount} who asked not to be disturbed`) : null));
        if (d !== day) { day = d; return [h('div.day', d === new Date().toDateString() ? 'today' : d), row]; }
        return row;
      }));
    }
    if (stick) feed.scrollTop = feed.scrollHeight;
  }

  function renderCompose() {
    let label = '', can = true;
    if (current.kind === 'channel') {
      const c = channels.find((x) => x.id === current.id);
      label = c ? (c.kind === 'all-hands' ? 'All Hands' : '#' + c.name) : 'channel';
      input.placeholder = c?.kind === 'lounge' ? `Say something in ${label} — it is there for whoever drops by` : `Message ${label} as Lead — @name to get someone's attention`;
      note.textContent = c?.kind === 'lounge' ? (c.topic || 'Not work. Nothing said here interrupts anyone.') : '';
    } else if (current.kind === 'gone') {
      const r = gone.find((x) => x.id === current.id);
      label = r ? `${r.agentName} · resigned` : 'resigned';
      can = false; input.placeholder = r?.returnedAt ? 'They came back: use your direct line with them.' : 'They have left the office.';
      note.textContent = '';
    } else if (current.kind === 'direct') {
      const a = agentOf(current.agentId);
      label = a ? a.name : 'direct line';
      input.placeholder = a ? `Message ${a.name}…` : 'They have left the office';
      can = !!a;
      note.textContent = a ? '' : 'This agent is not in the office right now.';
    } else {
      label = current.label || 'between agents';
      can = false; input.placeholder = 'You are reading over their shoulders.';
      note.textContent = 'Agent-to-agent notes are theirs; to join in, message one of them directly.';
    }
    title.textContent = label;
    input.disabled = !can; sendBtn.disabled = !can;
  }

  async function load() {
    const token = ++loading;
    renderCompose();
    try {
      let next = [];
      if (current.kind === 'channel') next = await net.api(`/api/channels/${encodeURIComponent(current.id)}/recent?limit=80`);
      else if (current.kind === 'gone') next = [(await net.api(`/api/resignations/${encodeURIComponent(current.id)}`)).resignation];
      else {
        let threadId = current.threadId;
        if (!threadId && current.agentId) {
          const t = threads.find((x) => { const d = describe(x); return d.mine && d.agentId === current.agentId; });
          threadId = t ? threadKey(t) : null;
        }
        if (threadId) { const data = await net.api(`/api/bbs/threads/${encodeURIComponent(threadId)}`); next = data?.posts || data?.thread?.posts || []; }
      }
      if (token !== loading) return;
      posts = (Array.isArray(next) ? next : next?.posts || []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      renderFeed();
    } catch (err) {
      if (token === loading) replace(feed, h('div.empty', `Could not load this conversation: ${err.message}`));
    }
  }

  async function refresh() {
    try {
      const o = await net.api('/api/comms/overview');
      channels = o.channels || [];
      threads = (o.directThreads || o.recentCollab || []).slice().sort((a, b) => b.timestamp - a.timestamp);
      gone = (o.resignations || []).slice(0, 8);
      if (current.kind === 'channel' && !channels.some((c) => c.id === current.id) && channels[0]) current = { kind: 'channel', id: channels[0].id };
      renderNav(); renderCompose();
    } catch (err) { replace(nav, h('div.empty', `Comms are unavailable: ${err.message}`)); }
  }

  async function send() {
    const text = input.value.trim();
    if (!text || input.disabled) return;
    sendBtn.disabled = true;
    try {
      if (current.kind === 'channel') await net.api(`/api/channels/${encodeURIComponent(current.id)}/message`, { method: 'POST', body: { content: text } });
      else await net.api('/api/comms/direct-message', { method: 'POST', body: { toAgentId: current.agentId, content: text, threadId: current.threadId || undefined } });
      input.value = ''; input.style.height = 'auto';
      await refresh(); await load();
      feed.scrollTop = feed.scrollHeight;
    } catch (err) { note.textContent = `Could not send: ${err.message}`; }
    sendBtn.disabled = false;
    input.focus();
  }
  sendBtn.onclick = send;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } e.stopPropagation(); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight + 2) + 'px'; });

  // new mail anywhere → refresh what is on screen (coalesced)
  let timer = null;
  const bump = () => { clearTimeout(timer); timer = setTimeout(async () => { await refresh(); load(); }, 250); };
  const off = [net.on('board', bump), net.on('collab', bump), net.on('overview', bump), net.on('resignation', bump)];

  refresh().then(load);
  setTimeout(() => input.focus(), 50);
  return {
    close: () => { off.forEach((f) => f()); clearTimeout(timer); },
    show: (a) => {
      if (a?.resignation) current = { kind: 'gone', id: a.resignation };
      else if (a?.agent) current = { kind: 'direct', agentId: a.agent };
      else return;
      posts = []; renderNav(); load();
    },
  };
}
