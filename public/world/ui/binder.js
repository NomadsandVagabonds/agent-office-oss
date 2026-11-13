// The Office — the binder. Every project's own docs (their .md files, as
// ingested by `office-knowledge.mjs refresh`), readable and searchable in one
// place. Agents read the same binder with `office docs` / `office search`.
import { h, icon, replace } from './dom.js';

const css = `
#ui .bd { display: flex; flex: 1 1 auto; min-width: 0; }
#ui .bd .nav { width: 270px; flex: none; border-right: 1px solid var(--line); display: flex; flex-direction: column; }
#ui .bd .nav .search { padding: 10px 10px 4px; }
#ui .bd .nav .item small { display: block; color: var(--faint); font: 11px/1.3 var(--mono); }
#ui .bd .nav .item .snip { display: block; color: var(--dim); font-size: 11.5px; margin-top: 2px; white-space: normal; }
#ui .bd .doc { flex: 1 1 auto; min-width: 0; padding: 18px 26px 40px; }
#ui .md { max-width: 760px; line-height: 1.6; font-size: 13.5px; }
#ui .md h1, #ui .md h2, #ui .md h3, #ui .md h4 { font-family: var(--sans); line-height: 1.25; margin: 1.3em 0 .5em; }
#ui .md h1 { font-size: 22px; margin-top: 0; } #ui .md h2 { font-size: 17px; padding-bottom: 4px; border-bottom: 1px solid var(--line); } #ui .md h3 { font-size: 14.5px; } #ui .md h4 { font-size: 13px; color: var(--dim); }
#ui .md p { margin: .6em 0; } #ui .md ul, #ui .md ol { margin: .5em 0; padding-left: 1.5em; } #ui .md li { margin: .15em 0; }
#ui .md code { font: 12px/1.4 var(--mono); background: rgba(255, 255, 255, .08); padding: 1px 5px; border-radius: 4px; }
#ui .md pre { background: rgba(0, 0, 0, .35); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; overflow-x: auto; }
#ui .md pre code { background: none; padding: 0; white-space: pre; }
#ui .md blockquote { margin: .6em 0; padding: 2px 12px; border-left: 3px solid var(--line-2); color: var(--dim); }
#ui .md a { color: var(--accent); text-decoration: none; } #ui .md a:hover { text-decoration: underline; }
#ui .md hr { border: 0; border-top: 1px solid var(--line); margin: 1.2em 0; }
#ui .md table { border-collapse: collapse; margin: .7em 0; font-size: 12.5px; display: block; overflow-x: auto; }
#ui .md th, #ui .md td { border: 1px solid var(--line-2); padding: 4px 9px; text-align: left; vertical-align: top; }
#ui .md th { background: rgba(255, 255, 255, .05); }
#ui .md mark { background: rgba(240, 184, 96, .35); color: inherit; border-radius: 2px; }
`;

/* ---- a small, safe Markdown renderer: builds DOM nodes, never HTML strings --------- */
function inline(text, into) {
  // code spans first (nothing inside them is formatted), then links, bold, italic
  const re = /(`+)([^`]|[^`][\s\S]*?[^`])\1|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(?<![\w])_([^_\s][^_]*)_(?![\w])|~~([^~]+)~~/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) into.append(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[2] !== undefined) into.append(h('code', m[2]));
    else if (m[3] !== undefined) {
      const href = m[4];
      const safe = /^(https?:|mailto:)/i.test(href);
      const a = h('a', safe ? { href, target: '_blank', rel: 'noopener noreferrer' } : { title: href });
      inline(m[3], a);
      into.append(a);
    } else if (m[5] !== undefined || m[6] !== undefined) { const b = h('strong'); inline(m[5] ?? m[6], b); into.append(b); }
    else if (m[7] !== undefined || m[8] !== undefined) { const i = h('em'); inline(m[7] ?? m[8], i); into.append(i); }
    else if (m[9] !== undefined) { const s = h('s'); inline(m[9], s); into.append(s); }
  }
  if (last < text.length) into.append(text.slice(last));
  return into;
}

export function markdown(source) {
  const root = h('div.md');
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  let i = 0;
  const isBlockStart = (l) => /^(#{1,6}\s|```|~~~|>|\s*([-*+]|\d+[.)])\s|\|.*\||(\*\s*){3,}$|(-\s*){3,}$)/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^(```|~~~)\s*([\w+-]*)/.exec(line))) {                       // fenced code
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(m[1])) body.push(lines[i++]);
      i++;
      root.append(h('pre', h('code', body.join('\n'))));
    } else if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line))) {
      root.append(inline(m[2], h('h' + Math.min(4, m[1].length)))); i++;
    } else if (/^((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line.trim())) { root.append(h('hr')); i++; }
    else if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      const q = h('blockquote'); q.append(...markdown(body.join('\n')).childNodes); root.append(q);
    } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {      // table
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      root.append(h('table', h('thead', h('tr', head.map((c) => inline(c, h('th'))))), h('tbody', rows.map((r) => h('tr', r.map((c) => inline(c, h('td'))))))));
    } else if ((m = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line))) {               // list (one level of nesting is plenty)
      const ordered = /\d/.test(m[2]);
      const list = h(ordered ? 'ol' : 'ul');
      const base = m[1].length;
      while (i < lines.length) {
        const lm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!lm) {
          if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && list.lastChild) { list.lastChild.append(' '); inline(lines[i].trim(), list.lastChild); i++; continue; }
          break;
        }
        if (lm[1].length > base + 1 && list.lastChild) {                   // nested: gather and recurse
          const sub = [];
          while (i < lines.length && (/^\s+/.test(lines[i]) || !lines[i].trim()) && !(lines[i].trim() === '' && !/^\s+\S/.test(lines[i + 1] || ''))) sub.push(lines[i++].slice(base + 2));
          list.lastChild.append(...markdown(sub.join('\n')).childNodes);
          continue;
        }
        if (lm[1].length < base) break;
        const li = h('li');
        const task = /^\[([ xX])\]\s+(.*)$/.exec(lm[3]);
        if (task) { li.append(h('input', { type: 'checkbox', checked: task[1] !== ' ', disabled: true }), ' '); inline(task[2], li); } else inline(lm[3], li);
        list.append(li); i++;
      }
      root.append(list);
    } else {                                                                  // paragraph
      const body = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) body.push(lines[i++]);
      root.append(inline(body.join(' '), h('p')));
    }
  }
  return root;
}

function highlight(root, term) {
  if (!term) return null;
  const needle = term.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  let node;
  while ((node = walker.nextNode())) if (node.nodeValue.toLowerCase().includes(needle)) hits.push(node);
  let first = null;
  for (const n of hits) {
    const text = n.nodeValue, lower = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let at = 0, k;
    while ((k = lower.indexOf(needle, at)) >= 0) {
      if (k > at) frag.append(text.slice(at, k));
      const mark = h('mark', text.slice(k, k + needle.length));
      first ||= mark;
      frag.append(mark);
      at = k + needle.length;
    }
    if (at < text.length) frag.append(text.slice(at));
    n.replaceWith(frag);
  }
  return first;
}

export function open({ office, ui, content, header, arg }) {
  if (!document.getElementById('bd-css')) document.head.append(h('style', { id: 'bd-css' }, css));
  const net = office.net;
  let projects = [], dept = arg?.deptId || null, docs = [], docPath = null, query = '', hits = null, token = 0;
  const search = h('input.field', { placeholder: 'Search every project…', spellcheck: false });
  const list = h('div.list.scroll.grow');
  const doc = h('div.doc.scroll');
  const title = h('span.dim.clip', { style: { marginLeft: '8px' } });
  header.append(title);
  content.append(h('div.bd', h('div.nav', h('div.search', search), list), doc));

  function renderNav() {
    if (hits) {
      replace(list, h('h3', `${hits.length} match${hits.length === 1 ? '' : 'es'} for “${query}”`),
        hits.map((x) => h('div.item' + (x.path === docPath && x.deptId === dept ? '.on' : ''), { onclick: () => openDoc(x.deptId, x.path, query) },
          h('div.grow', { style: { minWidth: 0 } }, h('div.clip', x.title || x.path), h('small.clip', `${x.project} · ${x.path}`), x.snippet ? h('span.snip', '…' + x.snippet + '…') : null))),
        hits.length ? null : h('div.empty', 'Nothing found.'));
      return;
    }
    replace(list,
      h('h3', 'Projects'),
      projects.map((p) => h('div.item' + (p.deptId === dept ? '.on' : ''), { onclick: () => openProject(p.deptId) }, h('span.grow.clip', p.project), h('span.chip', String(p.docs ?? '')))),
      projects.length ? null : h('div.empty', 'The binder is empty. Run “node office-knowledge.mjs refresh” to ingest each project\'s .md files.'),
      docs.length ? h('h3', 'Documents') : null,
      docs.map((d) => h('div.item' + (d.path === docPath ? '.on' : ''), { onclick: () => openDoc(dept, d.path) },
        h('div.grow', { style: { minWidth: 0 } }, h('div.clip', d.title || d.path), h('small.clip', d.path)))));
  }

  async function openProject(id) {
    dept = id; docs = []; docPath = null;
    const mine = ++token;
    try {
      const data = await net.api(`/api/knowledge/${encodeURIComponent(id)}`);
      if (mine !== token) return;
      docs = data.docs || [];
      renderNav();
      if (docs[0]) openDoc(id, docs[0].path); else replace(doc, h('div.empty', 'This project has no documents yet.'));
    } catch (err) { replace(doc, h('div.empty', `Could not open this project: ${err.message}`)); }
  }

  function showDoc(d, term) {
    docPath = d.path;
    title.textContent = d.path;
    const body = markdown(d.text || '');
    replace(doc, body);
    const mark = highlight(body, term);
    if (mark) mark.scrollIntoView({ block: 'center' }); else doc.scrollTop = 0;
    renderNav();
  }

  const texts = new Map();           // "dept\npath" → full document, fetched when first opened
  async function openDoc(deptId, path, term) {
    const mine = ++token;
    if (deptId !== dept || !docs.length) {
      dept = deptId;
      try { docs = (await net.api(`/api/knowledge/${encodeURIComponent(deptId)}`)).docs || []; } catch { docs = []; }
    }
    const key = deptId + '\n' + path;
    docPath = path; renderNav();
    try {
      if (!texts.has(key)) texts.set(key, (await net.api(`/api/knowledge/${encodeURIComponent(deptId)}?doc=${encodeURIComponent(path)}`)).doc);
    } catch (err) { if (mine === token) replace(doc, h('div.empty', `Could not open this document: ${err.message}`)); return; }
    if (mine === token) showDoc(texts.get(key), term);
  }

  let timer = null;
  search.addEventListener('keydown', (e) => e.stopPropagation());
  search.addEventListener('input', () => {
    clearTimeout(timer);
    query = search.value.trim();
    if (query.length < 2) { hits = null; renderNav(); return; }
    timer = setTimeout(async () => {
      const q = query;
      try {
        const data = await net.api(`/api/knowledge/search?q=${encodeURIComponent(q)}&limit=30`);
        if (q !== query) return;
        hits = data.hits || data.results || [];
      } catch { hits = []; }
      renderNav();
    }, 220);
  });

  (async () => {
    try { projects = (await net.api('/api/knowledge')).projects || []; } catch { projects = []; }
    renderNav();
    const first = (dept && projects.find((p) => p.deptId === dept)) || projects[0];
    if (first) openProject(first.deptId); else replace(doc, h('div.empty', 'No documents yet.'));
  })();

  return { close: () => { clearTimeout(timer); token++; }, show: (a) => { if (a?.deptId) openProject(a.deptId); } };
}
