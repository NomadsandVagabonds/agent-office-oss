// Co-op: the partner's beam is patched into the kit's fragment shader (public/world/coop/lights.js). What it adds goes
// into the kit's own main(), so it may not declare a name main() already has: two of a name in one scope does not compile,
// and a surface whose shader does not compile is not drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../public/world/${p}`, import.meta.url), 'utf8');
const declared = (glsl) => [...glsl.matchAll(/\b(?:float|int|bool|vec[234]|mat[234])\s+([A-Za-z_]\w*)\s*(?==|;)/g)].map((m) => m[1]);

test('the partner\'s beam declares nothing in the kit\'s main() that the kit has declared there', () => {
  const kit = read('backrooms/kit.js'), lights = read('coop/lights.js');
  const at = kit.indexOf('void main() {\n  vec3 c = vLit;'); assert.ok(at > 0, 'the kit\'s fragment main() is not where it was');
  const main = kit.slice(at, kit.indexOf('gl_FragColor', at));
  const own = declared(main); assert.ok(own.includes('beam') && own.includes('torch') && own.includes('c'), `the kit's main declares ${own.join(', ')}`);
  // the two places the patch takes hold of are still there, once each
  for (const anchor of ['uniform float uTorch;', '  #ifdef VOXEL\n  c += torch']) assert.equal(kit.split(anchor).length - 1, 1, `anchor ${JSON.stringify(anchor)}`);
  const m = lights.match(/replace\('  #ifdef VOXEL\\n  c \+= torch',`([\s\S]*?)`\)/); assert.ok(m, 'the patch is not where it was');
  const added = declared(m[1]); assert.ok(added.length >= 3, `it declares ${added.join(', ')}`);
  for (const name of added) assert.ok(!own.includes(name), `the patch declares "${name}", which the kit's main() already has`);
  assert.ok(m[1].trimEnd().endsWith('#ifdef VOXEL\n  c += torch'), 'and it puts back what it took hold of');
  assert.match(m[1], /torch \+= vAlb \* uCoopLight \* coopBeam/);
});
