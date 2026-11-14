// Local, static Backrooms preview. No daemon, agents, account or network needed.
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Packaged at kit/tools/preview.mjs; also runnable directly in the repository.
const source = await realpath(path.resolve(here, here.endsWith('backrooms-offline') ? '../..' : '../source'));
const publicRoot = await realpath(path.join(source, 'public'));
const coreRoot = await realpath(path.join(source, 'core'));
const portArg = process.argv.indexOf('--port');
const port = portArg < 0 ? 44321 : Number(process.argv[portArg + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use --port followed by an integer from 1024 to 65535.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const entry = '/world/dev/backrooms.html?seed=713&vhs=2&mute=1&pursuer=0&loot=1';
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.writeHead(302, { Location: entry }).end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const isCore = pathname.startsWith('/core/');
    const root = isCore ? coreRoot : publicRoot;
    const relative = isCore ? pathname.slice(6) : pathname.slice(1);
    const file = await realpath(path.resolve(root, relative));
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('Not a static file');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Backrooms offline preview: http://127.0.0.1:${port}${entry}\nCtrl+C stops the preview. This server has no Office API.`));
