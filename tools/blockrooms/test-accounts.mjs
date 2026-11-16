#!/usr/bin/env node
// Explicit, LOCAL-ONLY integration check. Sends codes to local Mailpit, never
// to a real inbox; two Supabase users and two independent browser stores.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from './build.mjs';
import { archiveRecord, archiveRun, mergeArchive, editArchive } from '../../core/archive.mjs';
const config = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
for (const url of [config.API_URL, config.MAILPIT_URL]) assert.ok(new URL(url).hostname === '127.0.0.1', 'Local test only');
const { createClient } = new Function(fs.readFileSync(new URL('./vendor/supabase-2.119.0.js', import.meta.url), 'utf8') + '\nreturn supabase;')();
const client = () => createClient(config.API_URL, config.PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false, flowType: 'pkce' } });
const a = client(), b = client(), other = client();
const suffix = crypto.randomUUID();
async function login(c, email) {
  const { error } = await c.auth.signInWithOtp({ email }); assert.equal(error, null, error?.message);
  let token;
  for (let i = 0; i < 30 && !token; i++) {
    const list = await fetch(config.MAILPIT_URL + '/api/v1/messages').then(r => r.json());
    const mail = list.messages?.find(m => m.To?.some(t => t.Address === email));
    if (mail) {
      const message = await fetch(config.MAILPIT_URL + '/api/v1/message/' + mail.ID).then(r => r.json());
      token = (message.Text || message.HTML || '').match(/\b(\d{6})\b/)?.[1];
    }
    if (!token) await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(token, 'email template supplies a six-digit code');
  const verified = await c.auth.verifyOtp({ email, token, type: 'email' }); assert.equal(verified.error, null, verified.error?.message);
  return verified.data;
}
const first = await login(a, `archive-a-${suffix}@example.invalid`);
const set = await b.auth.setSession({ access_token: first.session.access_token, refresh_token: first.session.refresh_token }); assert.equal(set.error, null);
const second = await login(other, `archive-b-${suffix}@example.invalid`);
assert.notEqual(first.user.id, second.user.id);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blockrooms-local-accounts-'));
try {
  build(dir, { origin: '', accountEnv: { BLOCKROOMS_SUPABASE_URL: config.API_URL, BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY }, localAccounts: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const { syncArchive, supabaseRemote } = await import(pathToFileURL(path.join(dir, 'archive-cloud.js')));
  const report = (seed, room) => ({ seed, reason: 'exit', edition: 'qa', rooms: { kinds: [room], explored: 3 }, cast: { met: ['pirate'] } });
  let one = archiveRun({}, report('device-one', 'lobby'), { writer: 'one', at: 100 }).document;
  let two = archiveRun({}, report('device-two', 'pool'), { writer: 'two', at: 200 }).document;
  one = editArchive(one, { name: 'Visitor A', character: { species: 'goblin', outfit: 'hoodie' } }, 'one', 300);
  await Promise.all([
    syncArchive({ read: () => one, merge: async d => { one = mergeArchive(one, d); }, remote: supabaseRemote(a) }),
    syncArchive({ read: () => two, merge: async d => { two = mergeArchive(two, d); }, remote: supabaseRemote(b) }),
  ]);
  const saved = await supabaseRemote(a).read();
  assert.equal(archiveRecord(saved.document).runs, 2); assert.equal(saved.document.character.value.species, 'goblin'); assert.equal(saved.document.tapes.length, 2);
  // Explicit user filter cannot bypass RLS; anonymous clients cannot read/RPC.
  const stolen = await other.from('blockrooms_profiles').select('*').eq('user_id', first.user.id); assert.deepEqual(stolen.data, []);
  const anonymous = client(); assert.ok((await anonymous.from('blockrooms_profiles').select('*')).error);
  assert.ok((await anonymous.rpc('blockrooms_save_profile', { expected_revision: 0, payload: { v: 1 } })).error);
  assert.ok((await other.from('blockrooms_profiles').update({ document: saved.document }).eq('user_id', first.user.id)).error);
  assert.ok((await a.rpc('blockrooms_save_profile', { expected_revision: saved.revision, payload: { v: 1, junk: 'x'.repeat(270000) } })).error);
  const own = await supabaseRemote(other).save(0, editArchive({}, { name: 'Visitor B' }, 'other', 400)); assert.equal(own.accepted, true);
  const pinned = createClient(config.API_URL, config.PUBLISHABLE_KEY, { accessToken: async () => first.session.access_token });
  await a.auth.setSession({ access_token: second.session.access_token, refresh_token: second.session.refresh_token });
  assert.equal((await supabaseRemote(pinned).read()).document.name.value, 'Visitor A', 'an in-flight sync stays attached to its original identity');
  const oauth = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://127.0.0.1:44341/archive', skipBrowserRedirect: true } });
  assert.equal(oauth.error, null); const url = new URL(oauth.data.url);
  assert.equal(url.searchParams.get('provider'), 'google'); assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  await other.auth.signOut({ scope: 'local' }); assert.equal((await other.auth.getSession()).data.session, null);
  console.log('PASS: real local email OTP, two-device merge, character sync, CAS conflict, RLS isolation, anonymous rejection, size limit, pinned identity, Google PKCE URL, sign-out.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  // Test users only. The privileged key stays in this process, never an asset.
  for (const id of [first.user.id, second.user.id]) await fetch(config.API_URL + '/auth/v1/admin/users/' + id, { method: 'DELETE', headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: 'Bearer ' + config.SERVICE_ROLE_KEY } });
}
