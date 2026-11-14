#!/usr/bin/env node
// Local-only MECHA workshop preview. Serves public/ and core/ without starting
// the Office daemon, observers, accounts, agent sessions, or any API routes.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('usage: node tools/mecha-preview.mjs [--port 44328]');
  process.exit(0);
}
if (args.length && (args.length !== 2 || args[0] !== '--port')) {
  console.error('usage: node tools/mecha-preview.mjs [--port 44328]');
  process.exit(2);
}
const port = args.length ? Number(args[1]) : 44328;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('The preview port must be an integer from 1 to 65535.');
  process.exit(2);
}

const roots = {
  public: await realpath(path.join(repo, 'public')),
  core: await realpath(path.join(repo, 'core')),
};
const preview = '/world/dev/backrooms.html?room=mecha&seed=713&vhs=2&mute=1&pursuer=0&check=1';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const server = createServer(async (req, res) => {
  const reply = (status, text) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : text);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('allow', 'GET, HEAD');
    reply(405, 'This preview only serves static files.');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { reply(400, 'Invalid path.'); return; }
  if (pathname.includes('\0') || pathname.includes('\\')) { reply(400, 'Invalid path.'); return; }
  if (pathname === '/') { res.writeHead(302, { location: preview, 'cache-control': 'no-store' }); res.end(); return; }

  const isCore = pathname.startsWith('/core/');
  const root = isCore ? roots.core : roots.public;
  const requested = path.resolve(root, isCore ? pathname.slice(6) : pathname.slice(1));
  if (!inside(root, requested)) { reply(403, 'Outside preview files.'); return; }
  try {
    const file = await realpath(requested);
    if (!inside(root, file)) { reply(403, 'Outside preview files.'); return; }
    const info = await stat(file);
    if (!info.isFile()) { reply(404, 'No file here.'); return; }
    res.writeHead(200, {
      'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': info.size, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch (err) {
    reply(err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 404 : 500, 'No file here.');
  }
});
server.on('error', (err) => { console.error(`Preview could not listen: ${err.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`MECHA preview: http://127.0.0.1:${port}${preview}`);
  console.log('Static local preview only. Ctrl+C stops it.');
});
