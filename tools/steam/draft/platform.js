// DRAFT of public/world/backrooms/platform.js (contract C1, docs/BLOCKROOMS-STEAM-PLAN.md). Kept here, under
// tools/steam/draft/, until the lead hangs it on env.platform (L-2): nothing imports it yet.
//
// On the web every call is a no-op or a plain answer, so the web build behaves exactly as before. In the shell, the
// preload (tools/steam/preload.cjs) puts a bridge on window.blockroomsShell, and the calls go through it to the main
// process, which alone talks to Steamworks. The game never imports Electron or Steamworks; it only sees this object.
//
//   platform = {
//     kind: 'web' | 'steam',
//     online(): boolean,
//     achieve(id): void,
//     stat(id, n): void,
//     cloud: { get(key): Promise<string|null>, set(key, value): Promise<boolean> },
//     user(): { name, id } | null,
//     inventory(): Promise<item[]>,
//   }

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;          // achievement and stat ids are kebab-case (C2)

/**
 * The platform for this page. `shell` is what the shell's preload exposes (window.blockroomsShell), or nothing on
 * the web; `nav` is for online() (navigator). Both are parameters so a test can hand in stand-ins.
 */
export function createPlatform({ shell = globalThis.window?.blockroomsShell, nav = globalThis.navigator, account = () => null } = {}) {
  const steam = !!shell && shell.kind === 'steam';
  const call = (name, ...args) => {
    const fn = steam && typeof shell[name] === 'function' ? shell[name] : null;
    if (!fn) return undefined;
    try { return fn(...args); } catch (err) { console.warn(`[platform] ${name} failed`, err); return undefined; }
  };
  return Object.freeze({
    kind: steam ? 'steam' : 'web',
    online: () => (nav && typeof nav.onLine === 'boolean' ? nav.onLine : true),
    achieve(id) { if (ID.test(String(id))) call('achieve', String(id)); },
    stat(id, n) { if (ID.test(String(id)) && Number.isFinite(n)) call('stat', String(id), Math.trunc(n)); },
    cloud: Object.freeze({
      // (on the web the archive already keeps the visitor's things; this is for what the shell syncs, and is empty here)
      get: async (key) => (steam ? ((await call('cloudGet', String(key))) ?? null) : null),
      set: async (key, value) => (steam ? (await call('cloudSet', String(key), String(value))) === true : false),
    }),
    user() {
      const u = steam ? call('user') : account();
      return u && u.id != null ? { name: String(u.name || ''), id: String(u.id) } : null;
    },
    inventory: async () => {
      const items = steam ? await call('inventory') : null;
      return Array.isArray(items) ? items : [];
    },
  });
}

/** The page's one platform, made when first asked for. */
let made = null;
export const platform = () => (made ||= createPlatform());
