// The Backrooms — rooms written but not yet dealt, each put in the deck only on the dev page with its &preview= flag
// (docs/BLOCKROOMS-PREVIEWS.md). Their lines are in MORE_DECK (deck2.js) with `on: false`, so they are out of the deck
// as a retired room is. Nothing in the game imports this file: without the flag the deck, the plan and every floor are
// exactly what they are. With it the line goes into the deck for this page, as it will when its `on: false` is
// dropped: dealt like any other room, at its own weight, and `&room=<id>` finds it.
import { DECK, ARCHETYPES, STASH } from './gen.js';
import { MORE_DECK } from './deck2.js';

/** flag → the id of its room. */
const WAITING = { mound: 'carpet-mound' };

/** Put the rooms these flags ask for into the deck (once). → the ids added. */
export function enlist(preview) {
  const added = [];
  for (const flag of new Set(preview || [])) {
    const id = WAITING[flag], line = id && MORE_DECK.find((a) => a.id === id);
    if (!line || ARCHETYPES[id]) continue;
    const { on, ...a } = line;
    DECK.push(a); ARCHETYPES[id] = a;
    if (typeof a.stash === 'function') STASH[id] = a.stash;
    added.push(id);
  }
  return added;
}
