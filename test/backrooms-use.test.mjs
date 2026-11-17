// Which usable thing E acts on (use.rule.js), and that world.js asks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseUse } from '../public/world/backrooms/use.rule.js';

test('something to pick up in a doorway is taken before the door is worked', () => {
  const door = { label: 'the doors', door: {} }, battery = { label: 'Batteries', inventoryItem: true }, button = { label: 'call the lift' };
  assert.equal(chooseUse(door, battery), battery, 'the owner could not pick a battery up off a threshold: E always took the door');
  assert.equal(chooseUse(door, null), door, 'a door with nothing lying by it is the door');
  assert.equal(chooseUse(battery, battery), battery);
  assert.equal(chooseUse(button, battery), button, 'only a door gives way: a button that scores best is still the button');
  assert.equal(chooseUse(null, null), null);
});

test('world.js scores the things to pick up apart and asks the rule', () => {
  const world = fs.readFileSync(new URL('../public/world/backrooms/world.js', import.meta.url), 'utf8');
  assert.match(world, /import \{ chooseUse \} from '\.\/use\.rule\.js';/);
  assert.match(world, /if \(use\.inventoryItem && score < itemScore\) \{ item = use; itemScore = score; \}/);
  assert.match(world, /return chooseUse\(best, item\);/);
});
