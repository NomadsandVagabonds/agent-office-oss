// The Office — the binder over HTTP. knowledge.mjs still builds the per-project
// files under public/knowledge/ (and the daemon still serves them statically);
// these endpoints let an agent that cannot read this machine's disk — one
// joining over MCP, or from a container — list, read and search the same docs.
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './http.mjs';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function registerKnowledgeRoutes(router, ctx) {
  const dir = path.join(ctx.cfg.publicDir, 'knowledge');
  const readJson = (file) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch { return null; }
  };
  const index = () => readJson('_index.json')?.projects || [];

  function resolveDept(ref) {
    const projects = index();
    const needle = String(ref || '').trim().toLowerCase();
    return projects.find((p) => p.deptId.toLowerCase() === needle)
      || projects.find((p) => norm(p.deptId) === norm(needle) || norm(p.project) === norm(needle))
      || projects.find((p) => needle && (p.deptId.toLowerCase().includes(needle) || p.project.toLowerCase().includes(needle)))
      || null;
  }

  function load(ref) {
    const hit = resolveDept(ref);
    if (!hit || !/^[\w.-]+$/.test(hit.deptId)) throw new HttpError(404, `no binder for "${ref}" (GET /api/knowledge lists them)`);
    const data = readJson(hit.deptId + '.json');
    if (!data) throw new HttpError(404, `binder for "${hit.deptId}" is not built yet (run: node office-knowledge.mjs refresh)`);
    return data;
  }

  router.get('/api/knowledge', () => ({ projects: index() }),
    { about: 'Projects in the binder (docs ingested from each project\'s .md files).' });

  router.get('/api/knowledge/search', (c) => {
    const q = String(c.query.get('q') || '').trim().toLowerCase();
    if (q.length < 2) throw new HttpError(400, 'q must be at least 2 characters');
    const limit = Math.min(40, Number(c.query.get('limit')) || 12);
    const hits = [];
    for (const project of index()) {
      const data = /^[\w.-]+$/.test(project.deptId) ? readJson(project.deptId + '.json') : null;
      for (const doc of data?.docs || []) {
        const text = String(doc.text || '');
        const lower = text.toLowerCase();
        const at = lower.indexOf(q);
        const inTitle = String(doc.title || '').toLowerCase().includes(q);
        if (at < 0 && !inTitle) continue;
        let count = 0;
        for (let i = lower.indexOf(q); i >= 0 && count < 99; i = lower.indexOf(q, i + q.length)) count++;
        const from = Math.max(0, at - 80);
        hits.push({
          deptId: project.deptId, project: project.project, path: doc.path, title: doc.title,
          matches: count + (inTitle ? 5 : 0),
          snippet: at >= 0 ? text.slice(from, at + 160).replace(/\s+/g, ' ').trim() : '',
        });
      }
    }
    hits.sort((a, b) => b.matches - a.matches);
    return { query: q, hits: hits.slice(0, limit), total: hits.length };
  }, { about: 'Search every project\'s docs: ?q=<text>.' });

  router.get('/api/knowledge/:dept', (c) => {
    const data = load(c.params.dept);
    const match = String(c.query.get('doc') || '').trim().toLowerCase();
    if (!match) {
      return { deptId: data.deptId, project: data.project, generatedAt: data.generatedAt,
        docs: data.docs.map((d) => ({ path: d.path, title: d.title, bytes: d.bytes })) };
    }
    const doc = data.docs.find((d) => d.path.toLowerCase() === match)
      || data.docs.find((d) => d.path.toLowerCase().endsWith(match) || String(d.title).toLowerCase() === match)
      || data.docs.find((d) => d.path.toLowerCase().includes(match) || String(d.title).toLowerCase().includes(match));
    if (!doc) throw new HttpError(404, `no doc matching "${match}" in ${data.deptId}`);
    return { deptId: data.deptId, project: data.project, doc };
  }, { about: 'One project\'s docs; add ?doc=<path or title> to read one.' });
}
