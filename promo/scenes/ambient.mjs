#!/usr/bin/env node
// The background cast: the demo's own roster (so everyone keeps the name and face the office gives them), taking
// turns at their desks. No chatter, no cards, no questions — a scene script adds those where the camera is looking.
//   node scenes/ambient.mjs [port] [--skip id,id]   ids a scene wants to direct itself are left alone
import { studio, sleep } from '../rig/direct.mjs';

const port = Number(process.argv[2] || 4410);
const skip = new Set((process.argv[process.argv.indexOf('--skip') + 1] || '').split(',').filter(Boolean));
const o = studio(port);
export const ROSTER = [
  { id: 'demo-webstore-1', cwd: '/tmp/demo/webstore', provider: 'claude', model: 'claude-opus-4-5' },
  { id: 'demo-webstore-2', cwd: '/tmp/demo/webstore', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-mobile-1', cwd: '/tmp/demo/mobile-app', provider: 'gemini', model: 'gemini-2.5-pro' },
  { id: 'demo-mobile-2', cwd: '/tmp/demo/mobile-app', provider: 'claude', model: 'claude-sonnet-4-5' },
  { id: 'demo-api-1', cwd: '/tmp/demo/api-gateway', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-api-2', cwd: '/tmp/demo/api-gateway', provider: 'claude', model: 'claude-haiku-4-5' },
  { id: 'demo-data-1', cwd: '/tmp/demo/data-pipeline', provider: 'claude', model: 'claude-sonnet-4-5' },
  { id: 'demo-ml-1', cwd: '/tmp/demo/ml-research', provider: 'gemini', model: 'gemini-2.5-pro' },
  { id: 'demo-ml-2', cwd: '/tmp/demo/ml-research', provider: 'opencode', model: 'qwen3-coder' },
  { id: 'demo-infra-1', cwd: '/tmp/demo/infra', provider: 'codex', model: 'gpt-5-codex' },
  { id: 'demo-docs-1', cwd: '/tmp/demo/docs-site', provider: 'claude', model: 'claude-haiku-4-5' },
  { id: 'demo-growth-1', cwd: '/tmp/demo/growth', provider: 'custom', model: 'deepseek-v3 · aider' },
];
const TOOLS = ['Edit', 'Edit', 'Bash', 'Read', 'Read', 'Grep', 'Write', 'Glob'];
let seed = 20261114;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const between = (a, b) => a + rnd() * (b - a);

async function life(a) {
  await sleep(between(0, 6000));
  for (;;) {
    await o.prompt(a.id);
    await sleep(between(1200, 2800));
    const steps = 6 + Math.floor(rnd() * 14);
    for (let i = 0; i < steps; i++) {
      const tool = TOOLS[Math.floor(rnd() * TOOLS.length)];
      await o.tool(a.id, tool); await sleep(between(900, 2800));
      await o.toolDone(a.id, tool); await sleep(between(400, 1800));
    }
    await o.stop(a.id);
    await sleep(between(6000, 16000));           // a short breather at the desk, not long enough to wander
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const known = new Set((await o.agents() || []).map((a) => a.id));
  for (const a of ROSTER) { o.cast.set(a.id, { ctx: between(8, 50), ...a }); if (!known.has(a.id)) { await o.arrive({ ctx: between(8, 50), ...a }); await sleep(300); } }
  console.log(`ambient: ${ROSTER.length - skip.size} at work on :${port}`);
  for (const a of ROSTER) if (!skip.has(a.id)) life(a);
}
