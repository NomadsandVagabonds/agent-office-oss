#!/usr/bin/env node
// BlockRooms — the built site on one's own machine, book and all. Serves a
// folder made by build.mjs the way the host will (/play is play.html), and
// answers /api/book out of a store that is only a Map: it is empty every time
// this starts, and nothing it holds goes anywhere.
//
//   node tools/blockrooms/build.mjs dist && node tools/blockrooms/serve.mjs dist [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handle } from './book-api.mjs';
import { memoryStore } from './book-store.mjs';

const root = path.resolve(process.argv[2] || 'dist'), port = Number(process.argv[3]) || 4478;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const ctx = { store: process.env.BOOK === '0' ? null : memoryStore(), salt: 'local' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/book') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const answer = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), ctx);
    res.writeHead(answer.status, Object.fromEntries(answer.headers)); res.end(await answer.text());
    return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`BlockRooms: http://127.0.0.1:${port}/  (${root}${ctx.store ? ', with a book that is only a Map' : ', with no book'})`));
