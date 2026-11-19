// A quick check of the C1 draft with stand-ins: node tools/steam/draft/platform.check.mjs
import assert from 'node:assert/strict';
import { createPlatform } from './platform.js';

const web = createPlatform({ shell: undefined, nav: { onLine: false } });
assert.equal(web.kind, 'web'); assert.equal(web.online(), false); assert.equal(web.user(), null);
web.achieve('first-floor'); web.stat('rooms-seen', 3);
assert.equal(await web.cloud.get('x'), null); assert.equal(await web.cloud.set('x', 'y'), false);
assert.deepEqual(await web.inventory(), []);

const seen = [];
const shell = { kind: 'steam', achieve: (id) => seen.push(['a', id]), stat: (id, n) => seen.push(['s', id, n]),
  cloudGet: async (k) => (k === 'k' ? 'v' : null), cloudSet: async () => true, user: () => ({ name: 'Pat', id: 7 }), inventory: async () => [{ def: 1 }] };
const st = createPlatform({ shell, nav: { onLine: true } });
assert.equal(st.kind, 'steam');
st.achieve('first-floor'); st.achieve('Not Kebab'); st.stat('rooms-seen', 2.7); st.stat('rooms-seen', NaN);
assert.deepEqual(seen, [['a', 'first-floor'], ['s', 'rooms-seen', 2]]);
assert.equal(await st.cloud.get('k'), 'v'); assert.equal(await st.cloud.set('k', 'v'), true);
assert.deepEqual(st.user(), { name: 'Pat', id: '7' }); assert.deepEqual(await st.inventory(), [{ def: 1 }]);
console.log('platform draft: ok');
