// avatar/rig.js uses a name from avatar/build.js without importing it, and `new Avatar(...)` then throws a ReferenceError for
// every species (hatTop, 15 Nov, found when the caught-by camera in the Backrooms would not come on). Avatar needs three and a
// DOM to be built here, so what is held is the cheap half of it: a name that build.js exports and rig.js calls is imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const exportsOf = (src) => [...src.matchAll(/^export\s+(?:const|function|class|let)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
const importedFrom = (src, from) => { const m = src.match(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${from.replace(/[./]/g, '\\$&')}['"]`)); return m ? m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean) : []; };
const declaredHere = (src, name) => new RegExp(`(?:const|let|var|function|class)\\s+${name}\\b`).test(src);

test('avatar/rig.js imports every name it uses from avatar/build.js', () => {
  const rig = read('../public/world/avatar/rig.js'), build = read('../public/world/avatar/build.js');
  const taken = importedFrom(rig, './build.js');
  for (const name of exportsOf(build)) {
    const used = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(rig);
    if (used && !declaredHere(rig, name)) assert.ok(taken.includes(name), `rig.js calls ${name}() but does not import it from ./build.js, so building any Avatar throws a ReferenceError`);
  }
  assert.ok(taken.includes('hatTop'), 'hatTop in particular (the alien cranium)');
});
