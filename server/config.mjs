// The Office — daemon configuration. One place that turns env vars into a
// frozen config object, so no other module reads process.env directly.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LOOPBACK_HOSTS = ['127.0.0.1', '::1'];
const LOOPBACK_NAMES = ['localhost', '127.0.0.1', '[::1]'];

function list(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function isLoopbackAddress(addr) {
  const a = String(addr || '').toLowerCase();
  return a === '::1' || a === '127.0.0.1' || a.startsWith('127.')
    || a === '::ffff:127.0.0.1' || a.startsWith('::ffff:127.');
}

export function loadConfig(env = process.env) {
  const port = Number(env.OFFICE_PORT || 4317);
  const hostRaw = String(env.OFFICE_HOST || 'loopback').trim().toLowerCase();
  const loopbackOnly = hostRaw === 'loopback' || hostRaw === 'localhost'
    || LOOPBACK_HOSTS.includes(hostRaw);
  const hosts = loopbackOnly ? LOOPBACK_HOSTS.slice() : list(hostRaw);
  const token = String(env.OFFICE_TOKEN || '').trim() || null;
  const dataDir = path.resolve(env.OFFICE_DATA_DIR || path.join(ROOT, 'data'));
  const publicDir = path.join(ROOT, 'public');
  return Object.freeze({
    root: ROOT,
    port,
    hosts,
    loopbackOnly,
    // A non-loopback bind is a remote control surface: it must carry a token.
    token,
    allowedHosts: new Set([...LOOPBACK_NAMES, ...list(env.OFFICE_ALLOWED_HOSTS)
      .map((h) => h.toLowerCase())]),
    allowedOrigins: new Set(list(env.OFFICE_ALLOWED_ORIGINS)),
    remoteTerminals: env.OFFICE_REMOTE_TERMINALS === '1',
    dataDir,
    publicDir,
    coreDir: path.join(ROOT, 'core'),
    creationsFile: path.resolve(env.OFFICE_CREATIONS_FILE
      || path.join(publicDir, 'creations.json')),
    profilesFile: env.OFFICE_PROFILES_FILE
      || path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json'),
    localProfilesFile: path.join(dataDir, 'profiles.local.json'),
    autoObserveCodex: env.OFFICE_AUTO_OBSERVE_CODEX !== '0',
    staleAgentMs: Number(env.OFFICE_STALE_AGENT_MS || 30 * 60 * 1000),
    quiet: env.OFFICE_QUIET === '1',
  });
}
