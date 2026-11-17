// The Backrooms — which of the things in reach E acts on. Pure: no three.js, nothing of the page.
//
// world.js scores every usable thing in front of the visitor (near and faced beats far and askance) and E takes the best.
// One exception, and the reason this file exists: something lying in a doorway. A door's use spot is in the opening itself,
// so with a battery on the threshold the door always scored best and E opened or shut it; the battery could not be had.
// So: where the best thing is a door and something to pick up is also in reach and faced, the thing to pick up is taken.
// (The door is there afterwards. Nothing else changes places: a button, a creature, furniture are as they were.)

/**
 * @param best  the best-scoring usable thing, or null
 * @param item  the best-scoring thing to pick up among them (an inventory item on the floor), or null
 */
export const chooseUse = (best, item) => (best && best.door && item ? item : best);
