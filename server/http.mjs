// The Office — HTTP layer: a tiny router, a safe static file server, and the
// request guard that keeps a local control plane from being driven by a web
// page or another machine.
//
// Why the guard exists: the office can type into terminals. Any endpoint that
// mutates state must only answer (a) non-browser local tools — hooks, the
// office CLI, curl — and (b) the office's own pages. So we check the Host
// header (DNS rebinding), the Origin / Sec-Fetch-Site headers (cross-site
// requests, including "simple" no-preflight POSTs), and require a token for
// anything that is not loopback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isLoopbackAddress } from './config.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_BODY = 1024 * 1024;

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

export function sendJson(res, status, data, headers) {
  if (res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(headers || {}),
  });
  res.end(body);
}

export function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (fn, value) => { if (!done) { done = true; fn(value); } };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        finish(reject, new HttpError(413, 'request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
    req.on('error', (err) => finish(reject, err));
    req.on('aborted', () => finish(reject, new HttpError(400, 'request aborted')));
  });
}

export async function readJson(req) {
  const text = await readBody(req);
  if (!text.trim()) return {};
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new HttpError(400, 'Invalid JSON body'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'JSON body must be an object');
  }
  return parsed;
}

/* ------------------------------------------------------------------------ */
/* Request guard                                                            */
/* ------------------------------------------------------------------------ */

function hostName(hostHeader) {
  const h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

function timingSafeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function presentedToken(req, url) {
  const auth = String(req.headers.authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (req.headers['x-office-token']) return String(req.headers['x-office-token']);
  const cookie = String(req.headers.cookie || '');
  const hit = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('office_token='));
  if (hit) return decodeURIComponent(hit.slice('office_token='.length));
  if (url && url.searchParams.get('token')) return url.searchParams.get('token');
  return '';
}

/**
 * Decide whether a request (or WS upgrade) may proceed.
 * @returns {{ok:true, loopback:boolean, cors:string|null, setCookie:string|null}
 *          |{ok:false, status:number, error:string}}
 */
export function guardRequest(req, cfg, url) {
  const remote = req.socket?.remoteAddress || '';
  const loopback = isLoopbackAddress(remote);
  const host = hostName(req.headers.host);
  const method = (req.method || 'GET').toUpperCase();
  const isUpgrade = String(req.headers.upgrade || '').toLowerCase() === 'websocket';
  const unsafe = isUpgrade || !SAFE_METHODS.has(method);
  let setCookie = null;

  if (!loopback) {
    // Reachable from the network only when the operator opted in and set a token.
    if (!cfg.token) return { ok: false, status: 403, error: 'remote access is disabled' };
    const token = presentedToken(req, url);
    if (!timingSafeEqual(token, cfg.token)) {
      return { ok: false, status: 401, error: 'office token required' };
    }
    if (url && url.searchParams.get('token')) {
      setCookie = `office_token=${encodeURIComponent(cfg.token)}; Path=/; HttpOnly; SameSite=Strict`;
    }
  } else if (host && !cfg.allowedHosts.has(host)) {
    // Loopback socket but a foreign Host header: DNS rebinding.
    return { ok: false, status: 403, error: 'host not allowed' };
  }

  const origin = req.headers.origin;
  let cors = null;
  if (origin !== undefined) {
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase(); }
    catch { sameOrigin = false; }
    const listed = cfg.allowedOrigins.has(origin);
    if (listed) cors = origin;
    if (!sameOrigin && !listed && unsafe) {
      return { ok: false, status: 403, error: 'cross-origin request refused' };
    }
  } else if (unsafe && String(req.headers['sec-fetch-site'] || '') === 'cross-site') {
    return { ok: false, status: 403, error: 'cross-site request refused' };
  }
  return { ok: true, loopback, cors, setCookie };
}

/* ------------------------------------------------------------------------ */
/* Router                                                                   */
/* ------------------------------------------------------------------------ */

function compile(pattern) {
  const names = [];
  const source = pattern.split('/').map((part) => {
    if (part.startsWith(':')) {
      const rest = part.endsWith('*');
      names.push(rest ? part.slice(1, -1) : part.slice(1));
      return rest ? '(.+)' : '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { regex: new RegExp(`^${source}/?$`), names };
}

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler, opt = {}) {
    this.routes.push({ method: method.toUpperCase(), pattern, handler, opt, ...compile(pattern) });
    return this;
  }
  get(pattern, handler, opt) { return this.add('GET', pattern, handler, opt); }
  post(pattern, handler, opt) { return this.add('POST', pattern, handler, opt); }
  patch(pattern, handler, opt) { return this.add('PATCH', pattern, handler, opt); }
  put(pattern, handler, opt) { return this.add('PUT', pattern, handler, opt); }
  delete(pattern, handler, opt) { return this.add('DELETE', pattern, handler, opt); }

  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.routes) {
      const hit = route.regex.exec(pathname);
      if (!hit) continue;
      pathMatched = true;
      if (route.method !== method && !(method === 'HEAD' && route.method === 'GET')) continue;
      const params = {};
      try {
        route.names.forEach((name, i) => { params[name] = decodeURIComponent(hit[i + 1]); });
      } catch {
        throw new HttpError(400, 'malformed path');
      }
      return { route, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }

  /** A machine-readable list of what this daemon can do. */
  describe() {
    return this.routes
      .filter((r) => !r.opt.hidden)
      .map((r) => ({ method: r.method, path: r.pattern, about: r.opt.about || '',
        ...(r.opt.loopbackOnly ? { loopbackOnly: true } : {}) }));
  }
}

/* ------------------------------------------------------------------------ */
/* Static files                                                             */
/* ------------------------------------------------------------------------ */

/**
 * @param {Array<{prefix:string, dir:string, file?:string}>} mounts  longest prefix first
 */
export function createStatic(mounts) {
  const sorted = mounts.slice().sort((a, b) => b.prefix.length - a.prefix.length);
  return function serveStatic(req, res, pathname) {
    let decoded;
    try { decoded = decodeURIComponent(pathname); }
    catch { res.writeHead(400).end('bad path'); return; }
    if (decoded.includes('\0')) { res.writeHead(400).end('bad path'); return; }
    const mount = sorted.find((m) => decoded === m.prefix.replace(/\/$/, '')
      || decoded.startsWith(m.prefix));
    if (!mount) { res.writeHead(404).end('not found'); return; }
    if (mount.file) {                      // a single file mounted at a path
      streamFile(req, res, mount.file);
      return;
    }
    if (decoded === mount.prefix.replace(/\/$/, '') && mount.prefix !== '/') {
      res.writeHead(308, { location: mount.prefix }).end();   // /classic → /classic/
      return;
    }
    const rel = decoded.slice(mount.prefix.length);
    // No dotfiles, no editor/lock droppings.
    if (rel.split('/').some((seg) => seg.startsWith('.'))) {
      res.writeHead(404).end('not found');
      return;
    }
    const root = path.resolve(mount.dir);
    let target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.stat(target, (err, st) => {
      if (!err && st.isDirectory()) {
        if (!decoded.endsWith('/')) {
          res.writeHead(308, { location: pathname + '/' }).end();
          return;
        }
        target = path.join(target, 'index.html');
      }
      streamFile(req, res, target);
    });
  };
}

function streamFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    const etag = `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`;
    const headers = {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      etag,
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return;
    }
    headers['content-length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

/* ------------------------------------------------------------------------ */
/* Request handler                                                          */
/* ------------------------------------------------------------------------ */

/**
 * Build the `(req, res)` handler for http.createServer.
 * Route handlers receive a context and may return a value (sent as JSON 200),
 * call `ctx.send(status, data)`, or throw an HttpError.
 */
export function createHandler({ cfg, router, serveStatic, onError }) {
  return async function handle(req, res) {
    let url;
    try { url = new URL(req.url || '/', 'http://office.local'); }
    catch { res.writeHead(400).end('bad request'); return; }
    const pathname = url.pathname;
    const method = (req.method || 'GET').toUpperCase();
    const verdict = guardRequest(req, cfg, url);
    if (!verdict.ok) {
      sendJson(res, verdict.status, { error: verdict.error });
      return;
    }
    const baseHeaders = {};
    if (verdict.cors) {
      baseHeaders['access-control-allow-origin'] = verdict.cors;
      baseHeaders.vary = 'origin';
    }
    if (verdict.setCookie) baseHeaders['set-cookie'] = verdict.setCookie;

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        ...baseHeaders,
        ...(verdict.cors ? {
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'content-type,authorization,x-office-token',
          'access-control-max-age': '600',
        } : {}),
      }).end();
      return;
    }

    let matched;
    try { matched = router.match(method, pathname); }
    catch (err) { sendJson(res, err.status || 400, { error: err.message }, baseHeaders); return; }

    if (!matched) {
      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'no such endpoint', path: pathname }, baseHeaders);
        return;
      }
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 404, { error: 'not found' }, baseHeaders);
        return;
      }
      for (const [key, value] of Object.entries(baseHeaders)) res.setHeader(key, value);
      serveStatic(req, res, pathname);
      return;
    }
    if (matched.methodNotAllowed) {
      sendJson(res, 405, { error: `method ${method} not allowed here` }, baseHeaders);
      return;
    }
    const { route, params } = matched;
    if (route.opt.loopbackOnly && !verdict.loopback && !cfg.remoteTerminals) {
      sendJson(res, 403, { error: 'this endpoint only answers on loopback' }, baseHeaders);
      return;
    }
    let bodyPromise = null;
    const ctx = {
      req, res, url, params, method,
      query: url.searchParams,
      loopback: verdict.loopback,
      json: () => (bodyPromise ||= readJson(req)),
      send: (status, data) => sendJson(res, status, data, baseHeaders),
      /** Legacy shape: `{error, status}` objects carry their own HTTP status. */
      result: (r) => sendJson(res, (r && typeof r.status === 'number') ? r.status : 200, r, baseHeaders),
    };
    try {
      const out = await route.handler(ctx);
      if (res.writableEnded) return;
      if (out === undefined) { res.writeHead(204, baseHeaders).end(); return; }
      sendJson(res, 200, out, baseHeaders);
    } catch (err) {
      if (res.writableEnded) return;
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...(err.extra || {}) }, baseHeaders);
        return;
      }
      if (onError) onError(err, req);
      sendJson(res, 500, { error: 'internal error', detail: String(err?.message || err) }, baseHeaders);
    }
  };
}
