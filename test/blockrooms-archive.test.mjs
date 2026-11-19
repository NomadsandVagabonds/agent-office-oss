import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dealtThemes } from '../public/world/backrooms/themes.js';
import { CLEARANCE_FLOORS, cleanArchive, importArchive, mergeArchive, archiveRecord, archiveRun, editArchive, archiveLook } from '../core/archive.mjs';
import { accountConfig } from '../tools/blockrooms/account-config.mjs';
import { fileStats } from '../tools/blockrooms/archive-charts.js';
import { build } from '../tools/blockrooms/build.mjs';
const run = (seed, room = 'lobby') => ({ reason: 'exit', seed, edition: 'v1', mascot: true, rooms: { explored: 4, kinds: [room] }, cast: { met: ['pirate'], survived: 1 }, parts: { of: 2, reached: 2 }, seconds: 100 });
const visit = (a, writer, seed, room) => archiveRun(a, run(seed, room), { writer, at: 100, by: 'Test' }).document;
test('HR worksheets count dated first sightings once and time only retained tapes with durations', () => {
  const day = Date.UTC(1998, 3, 6), next = day + 86400000;
  const record = archiveRecord(importArchive({ runs: 10, out: 3, rooms: { lobby:day, pool:next, imported:0 }, cast: { toner:day+100 },
    tapes:[{ seed:'new', seconds:70, plays:2 }, { seed:'old', seconds:95 }, { seed:'undated' }] }));
  const stats = fileStats(record);
  assert.deepEqual(stats.discoveries.map(r=>[r.run,r.rooms,r.encounters]), [[1,1,0],[2,1,1],[3,3,1]]);
  assert.equal(stats.unplaced,7);
  assert.deepEqual(stats.busiest, { day:day/86400000, count:2 });
  assert.equal(stats.rate,'30%');
  assert.equal(stats.fastest,'1:10');
  assert.deepEqual(stats.timed.map(t=>t.seed),['old','new']);
  assert.equal(stats.replays,2);
  assert.equal(fileStats(archiveRecord({})).rate,'—');
});
test('each finished visit adds its encounters, while a repeated room counts once across losses, replays and devices', () => {
  const play = (a,writer,at,seed,rooms,encounters,reason) => archiveRun(a,{...run(seed),reason,
    rooms:{kinds:rooms},cast:{met:['toner'],encounters}},{writer,at}).document;
  const first = play({},'a',100,'one',['party'],3,'exit');
  const repeat = play(first,'a',200,'one',['party'],1,'caught');
  const other = play(first,'b',200,'two',['party','pool'],2,'quit');
  const combined = mergeArchive(repeat,other);
  assert.deepEqual(mergeArchive(combined,other),combined);
  const stats = fileStats(archiveRecord(combined),combined.activity.streams);
  assert.deepEqual(stats.discoveries.map(r=>[r.run,r.rooms,r.encounters]), [[1,1,3],[2,1,4],[3,2,6]]);
  const legacy = importArchive({runs:3,rooms:{party:15,pool:25},cast:{toner:15}});
  const tracked = play(legacy,'b',100,'three',['party','grove'],2,'quit');
  const past = [{runs:{n:1},seen:{rooms:1,cast:1},lines:[{id:'survived',count:2}]}];
  const data = fileStats(archiveRecord(tracked),tracked.activity.streams,past);
  assert.deepEqual(data.discoveries.map(r=>[r.run,r.rooms,r.encounters]), [[1,1,2],[3,2,2],[4,3,4]]);
});
test('floor evidence restores historical escape itineraries and distinguishes visiting a floor from clearing it', async t => {
  const {dir, createArchiveStorage} = await modules(t);
  const {floorEvidence, escapedFloors} = await import(pathToFileURL(path.join(dir,'archive-floors.js')));
  const cases = [
    ['yntnbj',['yellow','night','archive','fitout']], ['kwr85e',['yellow','archive','suburb','exec']],
    ['t25noi',['yellow','archive','exec','suburb']], ['36nyx7',['yellow','archive','fitout','exec']]
  ];
  for (const [edition,ids] of cases) assert.deepEqual(escapedFloors({edition,seed:'compat0'}).sort(),ids.sort());
  assert.deepEqual(escapedFloors({edition:'unknown',seed:'compat0'}),[]);
  const legacy = {runs:7,out:1,rooms:{'channel-hall':33,trailhead:55},tapes:[{seed:'compat0',at:33,edition:'kwr85e'}]};
  const storage = memory({'office-backrooms:record':JSON.stringify({record:legacy})});
  let seq=0;
  const a = createArchiveStorage({storage,uuid:()=> 'id-'+ ++seq});
  const evidence = floorEvidence(a.record(),a.document());
  assert.deepEqual(evidence.clearances,['yellow','archive','exec','suburb','waterpark']);
  assert.ok(evidence.visited.includes('forest') && !evidence.clearances.includes('forest'));
  await a.restoreFloors(evidence); await a.visitFloor('mall'); await a.claim('alice');
  assert.ok(a.document().activity.floors.includes('mall') && !a.document().clearances.includes('mall'));
  await a.signOut(); assert.deepEqual(a.document().activity.floors,[]);
});
test('concurrent devices union discoveries/tapes and count visits once across retries', () => {
  const a = visit({}, 'a', 'tape-a'), b = visit({}, 'b', 'tape-b', 'pool');
  const ab = mergeArchive(a, b);
  assert.deepEqual(ab, mergeArchive(b, a));
  assert.deepEqual(mergeArchive(ab, a), ab);
  assert.equal(archiveRecord(ab).runs, 2); assert.equal(ab.tapes.length, 2);
  assert.deepEqual(Object.keys(ab.rooms), ['lobby', 'pool']); assert.equal(ab.tapes[0].mascot, true);
});
test('legacy import is repeatable and cannot double totals copied between browsers', () => {
  const a = importArchive({ runs: 10, out: 4, best: 300, rooms: { lobby: 12 } });
  const b = importArchive({ runs: 8, out: 3, best: 600, rooms: { pool: 10 } });
  const r = archiveRecord(mergeArchive(visit(a, 'a', 'new'), b));
  assert.equal(r.runs, 11); assert.equal(r.out, 5); assert.ok(r.best >= 600); assert.equal(r.rooms.pool, 10);
});
test('stale device upload does not undo a newer character or nickname', () => {
  const old = editArchive({}, { name: 'Old', character: { species: 'robot' } }, 'a', 10);
  const next = editArchive(old, { name: 'New', character: { species: 'goblin' } }, 'b', 20);
  const merged = mergeArchive(next, visit(old, 'a', 'later'));
  assert.equal(merged.name.value, 'New'); assert.equal(merged.character.value.species, 'goblin');
  assert.equal(archiveLook({ accessory: 'c_private' }).accessory, 'none');
});
test('replays keep existing visit counts, version and original tape', () => {
  const a = visit({}, 'a', 'one'); const b = visit(a, 'a', 'one', 'pool');
  assert.equal(archiveRecord(b).runs, 1); assert.equal(b.tapes[0].plays, 1); assert.equal(b.tapes[0].edition, 'v1');
  assert.equal(mergeArchive(a, b).tapes[0].plays, 1);
});
test('discovery dates merge to the first encounter and only twelve newest tapes survive', () => {
  let a = {}; for (let i = 0; i < 20; i++) a = archiveRun(a, run('seed' + i), { writer: 'a', at: 100 + i }).document;
  const b = importArchive({ rooms: { lobby: 50 } });
  const m = mergeArchive(a, b); assert.equal(m.rooms.lobby, 50); assert.equal(m.tapes.length, 12); assert.equal(m.tapes[0].seed, 'seed19');
});
const memory = initial => { const m = new Map(Object.entries(initial || {})); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }; };
async function modules(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  build(dir, { origin: '', accountEnv: {} }); fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const a = await import(pathToFileURL(path.join(dir, 'archive-storage.js'))), b = await import(pathToFileURL(path.join(dir, 'archive-cloud.js')));
  return { ...a, ...b, dir };
}
test('guest import, claim, sign-out and another account are isolated, including an in-flight visit', async t => {
  const { createArchiveStorage } = await modules(t); let serial = 0;
  const storage = memory({ 'office-backrooms:record': JSON.stringify({ record: { runs: 4, out: 1, rooms: { lobby: 1 } } }), 'blockrooms:me': JSON.stringify({ name: 'Existing', look: { species: 'cat' } }) });
  const a = createArchiveStorage({ storage, uuid: () => 'id-' + ++serial, now: () => 100 });
  assert.equal(a.record().runs, 4); assert.equal(a.profile().look.species, 'cat');
  const guest = a.owner(); await a.claim('A'); await a.edit({ name: 'A name' }); await a.signOut();
  assert.equal(a.record().runs, 0); await a.claim('B'); assert.equal(a.record().runs, 0);
  await a.report(run('pending'), 'visit-1', guest);
  assert.equal(a.record().runs, 0); assert.equal(a.record('user:A').runs, 5);
  await a.report(run('pending'), 'visit-1', guest); assert.equal(a.record('user:A').runs, 5);
  await a.signOut(); await a.claim('A'); assert.equal(a.profile().name, 'A name');
  const reopened = createArchiveStorage({ storage, uuid: () => 'id-' + ++serial });
  assert.equal(reopened.record().runs, 5, 'legacy data is not imported again');
});
test('floor stamps belong to the visitor who crossed, survive a lost run, and merge across devices', async t => {
  const { createArchiveStorage } = await modules(t);
  assert.deepEqual(Object.keys(CLEARANCE_FLOORS).sort(), dealtThemes().sort());
  const storage = memory(); let i = 0;
  const a = createArchiveStorage({ storage, uuid: () => 'id-' + ++i });
  const guest = a.owner();
  await a.clearFloor('yellow',guest);
  await a.claim('first'); await a.signOut(); await a.claim('second');
  await Promise.all([a.clearFloor('waterpark',guest), a.clearFloor('waterpark',guest), a.clearFloor('unbuilt',guest)]);
  await a.report({ ...run('lost','fitout'), reason:'caught' }, 'attempt', guest);
  assert.deepEqual(a.document().clearances, []);
  assert.deepEqual(a.document('user:first').clearances, ['yellow','waterpark']);
  // An older game tab saves updated visit totals without knowing the stamp field.
  storage.setItem('blockrooms:archive:save:user:first',JSON.stringify({v:1,baseline:{runs:6,out:1}}));
  const reopened = createArchiveStorage({ storage, uuid: () => 'id-' + ++i });
  assert.equal(reopened.record('user:first').runs, 6);
  const other = { clearances:['forest','__proto__','forest'] };
  const merged = mergeArchive(other,reopened.document('user:first'));
  assert.deepEqual(merged.clearances, ['yellow','waterpark','forest']);
  assert.deepEqual(mergeArchive(merged,other), merged);
  assert.deepEqual(cleanArchive({clearances:'waterpark'}).clearances, []);
  assert.deepEqual(importArchive({out:4,rooms:{forest:100}}).clearances, []);
});
test('cross-tab report writes share a lock and cannot drop either visit', async t => {
  const { createArchiveStorage } = await modules(t); let q = Promise.resolve(), i = 0;
  const locks = { request: (_name, f) => (q = q.then(f)) }, storage = memory();
  const a = createArchiveStorage({ storage, locks, uuid: () => 'id-' + ++i }), b = createArchiveStorage({ storage, locks, uuid: () => 'id-' + ++i });
  await Promise.all([a.report(run('a'), 'a'), b.report(run('b'), 'b')]); assert.equal(a.record().runs, 2);
});
test('storage denial still allows a visit and advertises the temporary save', async t => {
  const { createArchiveStorage } = await modules(t); let i = 0;
  const a = createArchiveStorage({ uuid: () => 'id-' + ++i }); await a.report(run('x'), 'x');
  assert.equal(a.record().runs, 1); assert.equal(a.durable(), false);
});
test('CAS conflict retries merge; local edits made during an upload are saved too', async t => {
  const { syncArchive } = await modules(t); let local = visit({}, 'a', 'a'), server = visit({}, 'b', 'b'), revision = 1, calls = 0;
  const remote = { read: async () => ({ revision: 0, document: {} }), save: async (rev, doc) => {
    calls++; if (rev !== revision) return { accepted: false, revision, document: server };
    server = doc; revision++; if (calls === 2) local = visit(local, 'a', 'c', 'pool');
    return { accepted: true, revision, document: server };
  } };
  await syncArchive({ read: () => local, merge: async d => { local = mergeArchive(local, d); }, remote });
  assert.equal(archiveRecord(server).runs, 3); assert.equal(calls, 3);
});
test('a switched account stops sync before saving', async t => {
  const { syncArchive } = await modules(t); let saved = false;
  assert.equal(await syncArchive({ read: () => ({}), merge: async () => {}, allowed: () => false, remote: { read: async () => ({ revision: 0, document: {} }), save: async () => { saved = true; } } }), false);
  assert.equal(saved, false);
});
test('cloud build configuration rejects privileged keys and unsafe URL/CSP input', () => {
  assert.deepEqual(accountConfig({}), { enabled: false });
  const key = 'sb_publishable_public';
  for (const url of ['http://evil.test', 'https://a.test/route', 'https://a.test/?x=y', 'https://u:p@a.test', "https://a.test/\";script-src *"]) assert.throws(() => accountConfig({ BLOCKROOMS_SUPABASE_URL: url, BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY: key }));
  for (const bad of ['sb_secret_secret', 'abc.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature']) assert.throws(() => accountConfig({ BLOCKROOMS_SUPABASE_URL: 'https://test.supabase.co', BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY: bad }));
  assert.throws(() => accountConfig({ BLOCKROOMS_SUPABASE_URL: 'https://test.supabase.co' }));
});
test('configured build allows only the selected Supabase origin, and has a complete account page', async t => {
  const { dir } = await modules(t);
  build(dir, { origin: '', accountEnv: { BLOCKROOMS_SUPABASE_URL: 'https://test.supabase.co', BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public' } });
  for (const f of ['index.html', 'play.html', 'archive.html']) assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /connect-src 'self' https:\/\/test.supabase.co;/);
  const html = fs.readFileSync(path.join(dir, 'archive.html'), 'utf8'), js = fs.readFileSync(path.join(dir, 'archive-page.js'), 'utf8');
  for (const m of js.matchAll(/\$\('([\w-]+)'\)/g)) assert.ok(html.includes(`id="${m[1]}"`), m[1]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'account-config.json'))).enabled, true);
});

test('blocked storage after a prior successful write does not hide newer in-memory saves', async t => {
  const { createArchiveStorage } = await modules(t); const m = memory(); let blocked = false, i = 0;
  const a = createArchiveStorage({ storage: { getItem: m.getItem, setItem(k,v) { if (blocked) throw Error('quota'); m.setItem(k,v); } }, uuid: () => 'id-' + ++i });
  await a.report(run('first'), 'first'); blocked = true; await a.report(run('second'), 'second');
  assert.equal(a.record().runs, 2); assert.equal(a.durable(), false);
});
test('guest default identity is stable and does not reuse the previous account nickname', async t => {
  const { createArchiveStorage } = await modules(t); let i = 0;
  const a = createArchiveStorage({ storage: memory(), uuid: () => 'id-' + ++i });
  await a.claim('A'); await a.edit({ name: 'Private A' }); await a.signOut();
  const guest = a.profile(); assert.notEqual(guest.name, 'Private A'); assert.deepEqual(a.profile(), guest);
});
