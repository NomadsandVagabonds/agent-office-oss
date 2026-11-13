// The Office — the board. Every project's kanban in one place: the same cards
// that hang on the wall in each team's room (and that agents move with
// `office task …`). Drag a card to move it; everyone sees it move.
import { h, ago, icon, replace } from './dom.js';
import { TASK_STATUS, TASK_PRIORITY } from '/core/contract.mjs';

const COLUMN = { backlog: 'Backlog', todo: 'To do', doing: 'Doing', blocked: 'Blocked', review: 'Review', done: 'Done' };

const css = `
#ui .kb { display: flex; flex: 1 1 auto; min-width: 0; }
#ui .kb .depts { width: 170px; flex: none; border-right: 1px solid var(--line); padding: 6px 0; }
#ui .kb .cols { flex: 1 1 auto; display: grid; grid-template-columns: repeat(6, minmax(126px, 1fr)); gap: 6px; padding: 10px; overflow-x: auto; min-width: 0; }
#ui .kb .col { display: flex; flex-direction: column; min-height: 0; background: rgba(0, 0, 0, .18); border-radius: 8px; border: 1px solid transparent; }
#ui .kb .col.over { border-color: var(--accent); background: rgba(240, 184, 96, .08); }
#ui .kb .col > h4 { margin: 0; padding: 9px 10px 7px; font: 600 10px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--dim); display: flex; gap: 6px; align-items: center; }
#ui .kb .col > h4 i { width: 8px; height: 8px; border-radius: 2px; }
#ui .kb .stack { flex: 1 1 auto; overflow-y: auto; padding: 0 6px 8px; display: flex; flex-direction: column; gap: 6px; }
#ui .kb .card { padding: 8px 9px; border-radius: 7px; background: var(--panel-solid); border: 1px solid var(--line); cursor: grab; font-size: 12.5px; }
#ui .kb .card:hover { border-color: var(--line-2); }
#ui .kb .card.high { box-shadow: inset 3px 0 0 var(--danger); }
#ui .kb .card.low { opacity: .75; }
#ui .kb .card.dragging { opacity: .4; }
#ui .kb .card .meta { display: flex; gap: 6px; align-items: center; margin-top: 6px; font: 11px/1 var(--mono); color: var(--faint); }
#ui .kb .card .who { color: var(--dim); }
#ui .kb .card .body { margin-top: 6px; color: var(--dim); white-space: pre-wrap; word-break: break-word; }
#ui .kb .card .edit { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
#ui .kb .add { margin: 0 6px 8px; }
#ui .kb .add input { height: 30px; }
`;
const DOT = { backlog: '#b9c2cf', todo: '#f2d45c', doing: '#6fb6e8', blocked: '#ee6f5e', review: '#c59af0', done: '#7fd08a' };

export function open({ office, ui, content, header, arg }) {
  if (!document.getElementById('kb-css')) document.head.append(h('style', { id: 'kb-css' }, css));
  const net = office.net;
  let dept = arg?.deptId || null;
  let openCard = null;
  const depts = h('div.depts.list.scroll');
  const cols = h('div.cols');
  content.append(h('div.kb', depts, cols));
  const hint = h('span.faint', { style: { fontSize: '12px', marginLeft: '8px' } }, 'drag a card to move it · click to open');
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
      h('div.meta', t.assigneeName ? h('span.who', '@' + t.assigneeName) : h('span', 'unassigned'), h('span.grow'), t.promptStatus === 'pending' ? h('span', { style: { color: 'var(--blocked)' } }, 'needs you') : null, h('span', ago(t.updatedAt, net.now()))));
    if (isOpen) {
      if (t.body) el.append(h('div.body', t.body));
      const who = h('select.field', { style: { width: 'auto', height: '26px', padding: '0 6px' }, onchange: (e) => patch(t.id, { assignee: e.target.value || null }), onclick: (e) => e.stopPropagation() },
        h('option', { value: '' }, 'unassigned'),
        [...net.state.agents.values()].map((a) => h('option', { value: a.id, selected: t.assignee === a.id }, a.name)));
      const pri = h('select.field', { style: { width: 'auto', height: '26px', padding: '0 6px' }, onchange: (e) => patch(t.id, { priority: e.target.value }), onclick: (e) => e.stopPropagation() },
        TASK_PRIORITY.map((p) => h('option', { value: p, selected: (t.priority || 'normal') === p }, p)));
      el.append(h('div.edit', who, pri, h('span.grow'),
        t.assignee && net.state.agents.has(t.assignee) ? h('button.btn.small', { onclick: (e) => { e.stopPropagation(); ui.closeSheet(); ui.select(t.assignee); } }, icon('eye'), 'Visit') : null,
        h('button.btn.small.ghost', { title: 'Delete this card', onclick: async (e) => { e.stopPropagation(); try { await net.api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'DELETE' }); } catch (err) { ui.toast(err.message); } } }, icon('close'))));
    }
    el.addEventListener('click', () => { openCard = isOpen ? null : t.id; render(); });
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
  return { close: () => off.forEach((f) => f()), show: (a) => { if (a?.deptId) { dept = a.deptId; render(); } } };
}
