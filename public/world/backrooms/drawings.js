// The Backrooms — what somebody wrote under a drawing. Pure.
//
// Earlier visitors drew what they met, on a wall, by hand, and wrote down
// what they had worked out about it: the hard way, in a hurry, and not to
// the end. The drawings are how anybody learns a creature's rule before it
// costs them. They are honest: a drawing is only ever of something that is
// in this visit (plan.js says who; gen.js places it; traces.js draws it).
//
// The words are a frightened person's, never the cast deck's own line
// (cast.js `rule`): a test holds them apart. Each creature has a few
// versions; every one of them stops before it has finished.
export const WARNINGS = Object.freeze({
  pirate: [
    ['THE ONE IN THE HAT', 'ONLY MOVES WHEN YOU', 'ARE NOT LOOKING. SO'],
    ['HAT MAN: IF HE CANT', 'SEE YOU HE DOESNT', 'KNOW WHERE YOU'],
    ['DONT STAND NEXT TO', 'HIM. EVEN IF YOU ARE', 'WATCHING. HE'],
  ],
  shadow: [
    ['DO NOT LOOK AT THE', 'DARK ONE. I LOOKED', 'AND THE CAMERA'],
    ['EYES DOWN WHEN IT IS', 'NEAR. ONE FLASH AND', 'THE BATTERY WAS'],
  ],
  moth: [
    ['THE MOTH IS ALRIGHT.', 'IT WAITS AT A LIGHT.', 'I THINK IT IS GOING'],
    ['FOLLOW THE MOTH??', 'EVERY LIGHT IT PICKS', 'IS NEARER THE'],
  ],
  porter: [
    ['MIND HIS BUCKET.', 'IF YOU KNOCK IT OVER', 'PUT IT BACK OR HE'],
    ['THE MAN WITH THE MOP', 'IS FINE UNLESS YOU', 'KICK THE'],
  ],
});
/** Somebody we have no drawing lessons for yet: they saw it, and that is all they got down. */
const UNKNOWN = [['SAW SOMETHING IN', 'HERE. DID NOT STAY', 'TO FIND OUT WHAT IT']];

/** The words under a drawing of creature `id`: one of its versions, by the seed. → lines */
export function warningFor(id, R) { return R.pick(WARNINGS[id] || UNKNOWN).slice(); }
