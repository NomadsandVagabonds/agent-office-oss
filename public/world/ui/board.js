// The Office — the board. Every project's kanban in one place: the same cards
// that hang on the wall in each team's room (and that agents move with
// `office task …`). Drag a card to move it; everyone sees it move.
import { h, ago, icon, replace } from './dom.js';
import { TASK_STATUS, TASK_PRIORITY } from '/core/contract.mjs';
import { openReviewTable, reviewLine } from './review.js';

const COLUMN = { backlog: 'Backlog', todo: 'To do', doing: 'Doing', blocked: 'Blocked', review: 'Review', done: 'Done' };

const css = `
#ui .kb { display: flex; flex: 1 1 auto; min-width: 0; }
#ui .kb .depts { width: 170px; flex: none; border-right: 2px solid var(--edge); padding: 6px 0; }
/* cork, and the same cards that hang on each room's wall */
#ui .kb .cols { flex: 1 1 auto; display: grid; grid-template-columns: repeat(6, minmax(132px, 1fr)); padding: 0; overflow-x: auto; min-width: 0;
  background: #a67c4d radial-gradient(rgba(60, 36, 12, .3) 1px, transparent 1.5px) 0 0 / 7px 7px; }
#ui .kb .col { display: flex; flex-direction: column; min-height: 0; border-right: 2px dashed rgba(60, 36, 12, .28); }
#ui .kb .col:last-child { border-right: 0; }
#ui .kb .col.over { background: rgba(255, 240, 200, .2); }
#ui .kb .col > h4 { margin: 10px 8px 8px; padding: 4px 8px 5px; background: var(--tape); color: #f4f0e6; font: 400 14px/1 var(--display); letter-spacing: .1em; text-transform: uppercase;
  display: flex; gap: 7px; align-items: center; box-shadow: 2px 2px 0 rgba(0, 0, 0, .3); }
#ui .kb .col > h4 i { width: 8px; height: 8px; flex: none; }
#ui .kb .col > h4 .faint { font: 600 12px/1 var(--mono); color: #b8b2a2; letter-spacing: 0; }
#ui .kb .stack { flex: 1 1 auto; overflow-y: auto; padding: 6px 10px 12px; display: flex; flex-direction: column; gap: 11px; scrollbar-color: rgba(60, 36, 12, .5) transparent; }
#ui .kb .card { position: relative; padding: 12px 10px 9px; background: var(--paper); color: var(--paper-ink); border: 2px solid var(--edge); box-shadow: 3px 3px 0 rgba(40, 24, 8, .4);
  cursor: grab; font: 12.5px/1.35 var(--sans); }
#ui .kb .card:nth-child(odd) { transform: rotate(-.5deg); } #ui .kb .card:nth-child(even) { transform: rotate(.45deg); }
#ui .kb .card::before { content: ''; position: absolute; left: 50%; top: -6px; width: 9px; height: 9px; margin-left: -5px; background: var(--no); border: 2px solid var(--edge); }      /* the pin */
#ui .kb .card:hover { transform: none; background: #fffaf0; }
#ui .kb .card.high { box-shadow: inset 4px 0 0 var(--no), 3px 3px 0 rgba(40, 24, 8, .4); }
#ui .kb .card.low { opacity: .8; }
#ui .kb .card.dragging { opacity: .4; }
#ui .kb .card .meta { display: flex; gap: 6px; align-items: center; margin-top: 7px; font: 11px/1.2 var(--mono); color: var(--paper-dim); }
#ui .kb .card .who { color: var(--paper-ink); }
#ui .kb .card .body { margin-top: 6px; color: var(--paper-dim); white-space: pre-wrap; word-break: break-word; }
#ui .kb .card .edit { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; color: var(--ink); }
#ui .kb .add { margin: 0 10px 12px; }
#ui .kb .add input { height: 30px; background: rgba(255, 246, 220, .45); border: 2px dashed rgba(60, 36, 12, .55); color: var(--paper-ink); box-shadow: none; }
#ui .kb .add input::placeholder { color: rgba(60, 36, 12, .75); }
#ui .kb .add input:focus { background: var(--paper); border-style: solid; border-color: var(--edge); }
`;
const DOT = { backlog: '#b9c2cf', todo: '#f2d45c', doing: '#6fb6e8', blocked: '#ee6f5e', review: '#c59af0', done: '#7fd08a' };

export function open({ office, ui, content, header, arg }) {
  if (!document.getElementById('kb-css')) document.head.append(h('style', { id: 'kb-css' }, css));
  const net = office.net;
  let dept = arg?.deptId || null;
  let openCard = null;
  let reviewing = null;                       // the review table on show, if any
  const depts = h('div.depts.list.scroll');
  const cols = h('div.cols');
  const kb = h('div.kb', depts, cols);
  content.append(kb);
  const hint = h('span.faint', { style: { fontSize: '12px', marginLeft: '8px' } }, 'drag a card to move it · click to open');
  /** Lay a card's review out over the board. */
  function review(taskId) {
    reviewing?.close();
    reviewing = openReviewTable({ office, ui, host: kb, taskId, onClose: () => { reviewing = null; } });
  }
  header.append(hint);

  const deptList = () => {
    const names = new Map();
    for (const r of net.state.world?.plan?.rooms || []) names.set(r.deptId, r.name);
    for (const id of net.state.tasks.keys()) if (!names.has(id)) names.set(id, id);
    return [...names].map(([id, name]) => ({ id, name, tasks: net.state.tasks.get(id) || [] })).sort((a, b) => a.name.localeCompare(b.name));
  };

  async function patch(id, body) {
    try { await net.api(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body }); }
    catch (err) { ui.toast(`Could not update the card: ${err.message}`); }
  }

  function card(t) {
    const isOpen = openCard === t.id;
    const el = h('div.card.' + (t.priority || 'normal'), { draggable: true, dataset: { id: t.id } },
      h('div', t.title),
      h('div.meta', t.assigneeName ? h('span.who', '@' + t.assigneeName) : h('span', 'unassigned'), h('span.grow'), t.promptStatus === 'pending' ? h('span', { style: { color: 'var(--blocked)' } }, 'needs you') : null, h('span', ago(t.updatedAt, net.now()))),
      reviewLine(t.review));
    if (isOpen) {
      if (t.body) el.append(h('div.body', t.body));
      const who = h('select.field', { style: { width: 'auto', height: '26px', padding: '0 6px' }, onchange: (e) => patch(t.id, { assignee: e.target.value || null }), onclick: (e) => e.stopPropagation() },
        h('option', { value: '' }, 'unassigned'),
        [...net.state.agents.values()].map((a) => h('option', { value: a.id, selected: t.assignee === a.id }, a.name)));
      const pri = h('select.field', { style: { width: 'auto', height: '26px', padding: '0 6px' }, onchange: (e) => patch(t.id, { priority: e.target.value }), onclick: (e) => e.stopPropagation() },
        TASK_PRIORITY.map((p) => h('option', { value: p, selected: (t.priority || 'normal') === p }, p)));
      el.append(h('div.edit', who, pri, h('span.grow'),
        t.review ? h('button.btn.small', { title: 'What was put up for review, what was found, what was decided', onclick: (e) => { e.stopPropagation(); review(t.id); } }, 'Review') : null,
        t.assignee && net.state.agents.has(t.assignee) ? h('button.btn.small', { onclick: (e) => { e.stopPropagation(); ui.closeSheet(); ui.select(t.assignee); } }, icon('eye'), 'Visit') : null,
        h('button.btn.small.ghost', { title: 'Delete this card', onclick: async (e) => { e.stopPropagation(); try { await net.api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'DELETE' }); } catch (err) { ui.toast(err.message); } } }, icon('close'))));
    }
    // a card that is waiting for a verdict opens straight onto its review table: that is what there is to do with it
    el.addEventListener('click', () => { if (t.status === 'review' && !isOpen) { openCard = t.id; render(); review(t.id); return; } openCard = isOpen ? null : t.id; render(); });
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    return el;
  }

  function render() {
    const list = deptList();
    if (!dept || !list.some((d) => d.id === dept)) dept = (list.find((d) => d.tasks.length) || list[0])?.id || null;
    replace(depts, h('h3', 'Projects'), list.map((d) => {
      const open = d.tasks.filter((t) => t.status !== 'done').length;
      return h('div.item' + (d.id === dept ? '.on' : ''), { onclick: () => { dept = d.id; openCard = null; render(); } }, h('span.grow.clip', d.name), open ? h('span.chip', String(open)) : null);
    }), list.length ? null : h('div.empty', 'No projects yet. A board appears when an agent joins from a project folder.'));
    const tasks = dept ? net.state.tasks.get(dept) || [] : [];
    replace(cols, TASK_STATUS.map((status) => {
      const mine = tasks.filter((t) => t.status === status).sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || b.updatedAt - a.updatedAt);
      const stack = h('div.stack.scroll', mine.map(card));
      const col = h('div.col', h('h4', h('i', { style: { background: DOT[status] } }), COLUMN[status], h('span.grow'), h('span.faint', String(mine.length))), stack);
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain');
        const t = tasks.find((x) => x.id === id);
        if (t && t.status !== status) { t.status = status; render(); patch(id, { status }); }      // move now, confirm from the server
      });
      if (status === 'todo' || status === 'backlog') {
        const input = h('input.field', { placeholder: '+ add a card', onkeydown: async (e) => {
          e.stopPropagation();
          if (e.key !== 'Enter' || !input.value.trim() || !dept) return;
          const title = input.value.trim(); input.value = '';
          try { await net.api('/api/tasks', { method: 'POST', body: { title, deptId: dept, status } }); } catch (err) { ui.toast(`Could not add the card: ${err.message}`); }
        } });
        col.append(h('div.add', input));
      }
      return col;
    }));
  }

  const off = [net.on('tasks', render), net.on('world', render), net.on('agent', () => { if (openCard) render(); })];
  render();
  if (arg?.taskId) review(arg.taskId);
  return { close: () => { off.forEach((f) => f()); reviewing?.close(); },
    show: (a) => { if (a?.deptId) { dept = a.deptId; render(); } if (a?.taskId) review(a.taskId); } };
}
