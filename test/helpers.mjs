// Test helpers: boot a real office on a throwaway port + data directory.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../server/config.mjs';
import { createOffice } from '../server/office.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

export function tempDir(prefix = 'office-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Start an isolated office. Returns { base, port, dir, ctx, stop, restart, get, post, patch, del }. */
export async function startOffice(opt = {}) {
  const dir = opt.dir || tempDir();
  const port = opt.port || await freePort();
  const creations = path.join(dir, 'creations.json');
  if (!fs.existsSync(creations)) fs.copyFileSync(path.join(ROOT, 'public', 'creations.json'), creations);
  const cfg = loadConfig({
    OFFICE_PORT: String(port), OFFICE_HOST: '127.0.0.1', OFFICE_DATA_DIR: dir,
    OFFICE_CREATIONS_FILE: creations, OFFICE_PROFILES_FILE: path.join(dir, 'no-profiles.json'),
    OFFICE_AUTO_OBSERVE_CODEX: '0', OFFICE_QUIET: '1',
    // A driven session snapshots the git working tree it is in (server/harness/checkpoints.mjs), and a test
    // that names no folder runs its agent right here, in this checkout: no test may write into the
    // repository of whoever runs it. The suite about snapshots asks for them, in repositories of its own.
    OFFICE_CHECKPOINTS: '0', ...(opt.env || {}),
  });
  const office = createOffice(cfg);
  await office.start();
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, {
      method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  return {
    base, port, dir, cfg, ctx: office.ctx,
    stop: () => office.stop(),
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    patch: (p, b = {}, h) => call('PATCH', p, b, h),
    del: (p, h) => call('DELETE', p, undefined, h),
    hook: (ev) => call('POST', '/hook', ev),
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
