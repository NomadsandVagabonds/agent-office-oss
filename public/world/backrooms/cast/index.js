// The Backrooms — the cast's builders: one file to a creature, listed here by
// the id it has in cast.js. (Listed, not fetched by name, so that the page the
// level is staged on for showing finds every one of them by following imports.)
import { create as pirate } from './pirate.js';
import { create as shadow } from './shadow.js';
import { create as moth } from './moth.js';
import { create as porter } from './porter.js';
import { create as toner } from './toner.js';
import { create as otherDoor } from './other-door.js';
import { create as theLines } from './the-lines.js';
import { create as dummies } from './dummies.js';
import { create as mother } from './mother.js';
import { create as headCount } from './head-count.js';
import { create as standingMeeting } from './standing-meeting.js';
import { create as intern } from './intern.js';
import { create as carriedInterest } from './carried-interest.js';
import { create as middleManager } from './middle-manager.js';
import { create as stickyNotes } from './sticky-notes.js';

export const MAKERS = { pirate, shadow, moth, porter, toner, 'other-door': otherDoor, 'the-lines': theLines, dummies, mother, 'head-count': headCount, 'standing-meeting': standingMeeting, intern, 'carried-interest': carriedInterest, 'middle-manager': middleManager, 'sticky-notes': stickyNotes };
