// The Backrooms — the cast's builders: one file to a creature, listed here by
// the id it has in cast.js. (Listed, not fetched by name, so that the page the
// level is staged on for showing finds every one of them by following imports.)
import { create as pirate } from './pirate.js';
import { create as shadow } from './shadow.js';
import { create as moth } from './moth.js';
import { create as porter } from './porter.js';
import { create as toner } from './toner.js';
import { create as otherDoor } from './other-door.js';

import { create as mother } from './mother.js';
import { create as theLines } from './the-lines.js';

export const MAKERS = { mother, 'the-lines': theLines, pirate, shadow, moth, porter, toner, 'other-door': otherDoor };
