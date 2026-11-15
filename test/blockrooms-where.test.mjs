// BlockRooms — the award that names a visitor's city: what the function passes back of what the host tells it, and
// that it keeps nothing and lets nothing in between keep it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cityOf, handle, CITY_MAX } from '../tools/blockrooms/where-api.mjs';

const from = (value) => new Headers(value === undefined ? {} : { 'x-vercel-ip-city': value });

test('the city a request comes from: a name as a name is written, or nothing', () => {
  assert.equal(cityOf(from('Portland')), 'Portland');
  assert.equal(cityOf(from('S%C3%A3o%20Paulo')), 'São Paulo', 'the host percent-encodes what is not plain ASCII');
  assert.equal(cityOf(from('San%20Jos%C3%A9')), 'San José');
  assert.equal(cityOf(from('Winston-Salem')), 'Winston-Salem');
  assert.equal(cityOf(from("Coeur d'Alene")), "Coeur d'Alene");
  assert.equal(cityOf(from('6th%20of%20October%20City')), '6th of October City');
  assert.equal(cityOf(from('  New%20%20York ')), 'New York');
  // nothing, and anything that is not a place name, is nothing
  for (const bad of [undefined, '', '%3Cscript%3E', 'https%3A%2F%2Fevil.example', '%E0%A4%A', 'a%0Ab', '-x', 'x'.repeat(CITY_MAX + 1), 'y'.repeat(400), 'a%26b%3Dc', 'Tom%40Home']) assert.equal(cityOf(from(bad)), '', `${bad}`);
  assert.equal(cityOf(null), '');
  assert.equal(cityOf(from('z'.repeat(CITY_MAX))).length, CITY_MAX);
});

test('GET /api/where: the city and nothing else, private, never stored; no other method', async () => {
  const yes = handle(new Request('https://example.app/api/where', { headers: { 'x-vercel-ip-city': 'Reykjav%C3%ADk', 'x-forwarded-for': '203.0.113.9', 'x-vercel-ip-latitude': '64.1', 'x-vercel-ip-postal-code': '101' } }));
  assert.equal(yes.status, 200);
  assert.deepEqual(await yes.json(), { ok: true, city: 'Reykjavík' }, 'not the address, not the postcode, not where on the map');
  assert.equal(yes.headers.get('cache-control'), 'private, no-store', 'no cache in between may give one visitor another\'s city');
  assert.match(yes.headers.get('content-type'), /^application\/json/);
  const no = handle(new Request('https://example.app/api/where'));
  assert.deepEqual(await no.json(), { ok: true, city: null }, 'no host to say (or nothing said): no city, and the welcome is still a welcome');
  assert.equal(no.headers.get('cache-control'), 'private, no-store');
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal(handle(new Request('https://example.app/api/where', { method })).status, 405);
});

test('it keeps nothing: no store, no log, no other site; and the page puts the name on as text', () => {
  const src = fs.readFileSync(new URL('../tools/blockrooms/where-api.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/fetch\(|console\.|process\.env|createStore|writeFile|appendFile|x-forwarded-for|x-real-ip|latitude|longitude|postal/.test(src), 'the function does more than pass a city back');
  const fn = fs.readFileSync(new URL('../api/where.mjs', import.meta.url), 'utf8');
  assert.match(fn, /export const GET = \(request\) => handle\(request\);/);
  assert.ok(!/export const (POST|PUT|DELETE)/.test(fn));
  const home = fs.readFileSync(new URL('../tools/blockrooms/home.js', import.meta.url), 'utf8');
  assert.match(home, /fetch\('\.\/api\/where', \{ headers: \{ accept: 'application\/json' \}, cache: 'no-store' \}\)/);
  assert.match(home, /if \(city\) \{ \$\('city'\)\.textContent = city; \$\('voted'\)\.hidden = false; \}/, 'as text, never as markup; and only when there is one');
  assert.ok(!/localStorage[^;]*city|city[^;]*localStorage/.test(home), 'the page does not keep it either');
  const page = fs.readFileSync(new URL('../tools/blockrooms/home.html', import.meta.url), 'utf8');
  // the owner's line, the place on its second line; with no answer the award is not there at all
  assert.ok(page.includes('<span class="award a4 wide" id="voted" hidden>VOTED 6TH BEST OFFICE PARK<br><small>of <span id="city"></span></small></span>'));
  assert.ok(page.includes('*** WELCOME *** NEW SCREENSHOTS *** SIGN THE GUESTBOOK ***') && !/VISITOR FROM/.test(page + home), 'the city is said once, on the award');
  assert.ok(page.includes('Your city comes from your connection and is not kept.'), 'and the page says so, in as many words');
});
