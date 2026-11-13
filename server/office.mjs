// The Office — assembly. Builds every service around one shared context,
// wires the bus, and exposes start()/stop(). `daemon.mjs` is a thin wrapper
// around this, and the test suite boots the same thing on a throwaway port
// and data directory.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { BBSStore } from '../bbs-store.mjs';
import { TaskStore } from '../task-store.mjs';
import { RuntimeManager } from '../runtime-manager.mjs';
import { EV } from '../core/contract.mjs';
import { loadConfig } from './config.mjs';
import { JsonFile, Journal, flushAll } from './persist.mjs';
import { WsHub } from './ws.mjs';
import { Bus } from './bus.mjs';
import { Router, createHandler, createStatic, guardRequest } from './http.mjs';
import { Profiles } from './profiles.mjs';
import { Personas } from './personas.mjs';
import { createRuntimeView } from './runtime-view.mjs';
import { createAgents } from './agents.mjs';
import { createPrompts } from './prompts.mjs';
import { createComms } from './comms.mjs';
import { createTasks } from './tasks.mjs';
import { createInbox } from './inbox.mjs';
import { createActivity } from './activity.mjs';
import { createCodexObserver } from './codex-observer.mjs';
import { registerCoreRoutes } from './routes.mjs';
import { registerKnowledgeRoutes } from './knowledge.mjs';
import { createWorld } from './world/world.mjs';
import { registerWorldRoutes } from './world/routes.mjs';

function readVersion(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '0.0.0'; }
  catch { return '0.0.0'; }
}

export function createOffice(config) {
  const cfg = config || loadConfig();
  if (!cfg.loopbackOnly && !cfg.token) {
    throw new Error('Refusing to listen beyond loopback without OFFICE_TOKEN. '
      + 'The office can type into terminals; set OFFICE_TOKEN=<secret> to expose it deliberately.');
  }
  fs.mkdirSync(cfg.dataDir, { recursive: true });

  const log = {
    info: (...a) => { if (!cfg.quiet) console.log(...a); },
    warn: (...a) => { if (!cfg.quiet) console.warn(...a); },
  };
  const data = (name) => path.join(cfg.dataDir, name);

  const hub = new WsHub({ verify: (req) => guardRequest(req, cfg, null).ok });
  const bus = new Bus(hub);
  bus.on('listener-error', (err) => log.warn('[bus] listener failed: ' + (err?.stack || err)));

  const ctx = {
    cfg, log, hub, bus,
    version: readVersion(cfg.root),
    startedAt: Date.now(),
  };
  ctx.bbs = new BBSStore(data('bbs.json'));
  ctx.tasks = new TaskStore(data('tasks.json'));
  ctx.runtimes = new RuntimeManager(cfg.port, data('tmux-sessions.json'));
  ctx.journal = new Journal(data('activity.jsonl'));
  ctx.profiles = new Profiles(cfg);
  ctx.personas = new Personas(data('personas.json'));
  ctx.codexObserver = createCodexObserver(cfg, log);
  ctx.runtimeView = createRuntimeView({ runtimes: ctx.runtimes, codexObserver: ctx.codexObserver.status });
  ctx.agents = createAgents(ctx);
  ctx.comms = createComms(ctx);
  ctx.prompts = createPrompts(ctx);
  ctx.taskApi = createTasks(ctx);
  ctx.inbox = createInbox(ctx, data('inbox.json'));
  ctx.activity = createActivity(ctx);
  ctx.world = createWorld(ctx, data('world.json'));

  const router = new Router();
  registerCoreRoutes(router, ctx);
  registerKnowledgeRoutes(router, ctx);
  registerWorldRoutes(router, ctx);
  ctx.router = router;

  const serveStatic = createStatic([
    { prefix: '/', dir: cfg.publicDir },
    { prefix: '/core/', dir: cfg.coreDir },
    // The legacy lives wherever OFFICE_CREATIONS_FILE says (tests point it at a sandbox).
    { prefix: '/creations.json', file: cfg.creationsFile },
  ]);
  const handler = createHandler({
    cfg, router, serveStatic,
    onError: (err, req) => log.warn(`[http] ${req.method} ${req.url} → ${err?.stack || err}`),
  });

  // A new client gets the whole picture, in the order the classic client
  // expects it, followed by the world.
  hub.on('connect', (client) => {
    client.send({
      type: EV.SNAPSHOT,
      agents: ctx.agents.listPublic(),
      boardRecent: ctx.bbs.getRecent(ctx.comms.BBS_RECENT_LIMIT),
      collabRecent: ctx.comms.getCollabRecent(null, ctx.comms.COLLAB_RECENT_LIMIT),
      prompts: ctx.prompts.listPublic(),
      commsOverview: ctx.comms.getOverview(),
      server: { version: ctx.version, startedAt: ctx.startedAt },
    });
    for (const deptId of ctx.taskApi.deptIds()) {
      client.send({ type: EV.TASKS, deptId, tasks: ctx.taskApi.list({ deptId }) });
    }
    client.send({ type: EV.WORLD, world: ctx.world.snapshot() });
  });
  hub.on('message', (client, message) => {
    try { ctx.world.onClientMessage(client, message); }
    catch (err) { log.warn('[ws] bad client message: ' + (err?.message || err)); }
  });
  hub.on('disconnect', (client) => {
    try { ctx.world.onClientGone(client); } catch { /* nothing to clean */ }
  });

  // Who is here + what is waiting on the human, so a restart loses neither.
  const registry = new JsonFile(data('registry.json'), {
    defaults: () => ({ v: 1, agents: [], prompts: null }),
    debounceMs: 400,
    validate: (d) => d && Array.isArray(d.agents),
  });
  const saveRegistry = () => {
    registry.data.agents = ctx.agents.exportState();
    registry.data.prompts = ctx.prompts.exportState();
    registry.data.savedAt = Date.now();
    registry.save();
  };

  const servers = [];
  let sweepTimer = null;
  let stopped = false;

  function listenOn(host) {
    return new Promise((resolve, reject) => {
      const server = http.createServer(handler);
      server.on('upgrade', (req, socket, head) => {
        socket.on('error', () => {});
        hub.handleUpgrade(req, socket, head);
      });
      server.keepAliveTimeout = 30_000;
      server.headersTimeout = 20_000;
      server.requestTimeout = 60_000;
      server.once('error', reject);
      server.listen(cfg.port, host, () => {
        server.removeListener('error', reject);
        server.on('error', (err) => log.warn('[http] server error: ' + err.message));
        resolve(server);
      });
    });
  }

  async function start() {
    let firstError = null;
    for (const host of cfg.hosts) {
      try { servers.push(await listenOn(host)); }
      catch (err) {
        // ::1 may simply not exist on this machine; that is not fatal.
        if (!firstError) firstError = err;
        if (host !== '::1') { await stop(); throw err; }
      }
    }
    if (!servers.length) throw firstError || new Error('could not listen on any address');
    ctx.port = servers[0].address().port;
    const restoredAgents = ctx.agents.restore(registry.data.agents);
    const restoredPrompts = ctx.prompts.restore(registry.data.prompts);
    if (restoredAgents) log.info(`  restored ${restoredAgents} session(s)`
      + (restoredPrompts ? ` and ${restoredPrompts} pending request(s)` : '') + ' from before the restart');
    for (const type of ['update', 'remove', 'prompts']) bus.on(type, saveRegistry);
    sweepTimer = setInterval(() => ctx.agents.sweep(), 60 * 1000);
    sweepTimer.unref();
    ctx.world.start();
    ctx.codexObserver.start();
    return ctx;
  }

  async function stop() {
    if (stopped) return;
    stopped = true;
    if (sweepTimer) clearInterval(sweepTimer);
    ctx.codexObserver.stop();
    try { ctx.world.stop(); } catch {}
    try { saveRegistry(); } catch {}
    hub.close();
    flushAll();
    await Promise.all(servers.map((server) => new Promise((resolve) => {
      server.close(() => resolve());
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    })));
  }

  return { cfg, ctx, router, start, stop };
}
