# Audit log

How we work, by the owner's word (15 Nov): every push is checked for errors
and no more. That is the test suite once, and one load in a browser when the
change can be seen. Detailed testing is not done per push. It is done in
batches, as an audit, and this file is what an audit works from.

One entry per release to the live branch, newest first. Each says what
changed, what was checked, and **what was not**, which is the list an audit
starts with. When an audit has been through an entry, it says so under it.

| Date | Commit | What changed | Checked | Not checked |
|---|---|---|---|---|
| 15 Nov | (merge of codex/backrooms-barricades, 28b8c32) | Codex's furniture that can be dragged and put in a creature's way (`docs/BACKROOMS-BARRICADES.md`). **Off for everybody**: on only where asked for (`&barricades=1` on the dev page, `?debug&barricades=1` on the site). With it off, two things still changed: how the moth flies over low furniture, and the cardboard follower has a body. `walk.js` merged by hand (the crawl rule and Codex's flying rule together). | Suite after the merge (782). One load each way in a browser, walking for four seconds: no errors, four movable pieces found with it on. The make of the building unchanged by it. | Everything about the feature itself (Codex's own checks are in its notes). The toner and the other door were made after Codex's base and have never met furniture that moves. The moth now being able to fly into a crawl space. Phones and frame rate, which Codex says to profile before it is on for anybody. It puts words on the picture ("E · Move Chair"), which the level's rules do not allow: the owner's to decide before it is on. |
| 15 Nov | a6af2f5 | The other door (`cast/mimic.js`): a pair of fire doors on a blank wall that is not doors. Its only tell is a shiver. E, walking into it, or 2.5 s stood in front springs it: two hearts. `homeFor` no longer gives two of the cast the same room. | Suite after the merge. By its builder, in a browser, one seed: it hangs, the three ways of springing it, fire, walking past. Read by the lead: the wiring and the wall words. | With the building's camera (it was built before that existed; a death by it has not been watched). The shiver at playing speed, by eye: the owner to say if it is too easy or too hard to catch. Beside a real pair. The mascot in the room. Sound, a phone. |
| 15 Nov | 5b614fb | A visit that ends by being caught is shown for three seconds from a fixed camera in the corner of the room, with the visitor's own character in it (`lastshot.js`; `takes(shot)` for the cast). | Suite. One death by a toner in a browser: camera label, character visible, card follows, no errors. | Every other creature and every room that can take the last heart. Small rooms, crawl spaces, doorways, the hallway's room. A phone. The office's own lift (not the site). How it sounds. No creature has a `takes` yet. |
| 15 Nov | 0d7f497 | A kind of floor can keep to its own rooms (`own`), and a room to its own floor (`'*': 0`). | Suite. Staged in memory with a made-up floor. The make of the building unchanged. | Nothing uses it yet: first real use is the suburb floor. |
| 15 Nov | 5c27ba7 | A kind of floor can be unfinished (`dealt: false`) and asked for by name (`themes=`). Visits opened with `debug` or `room=` no longer sign the book. | Suite. `themes=` in a browser, locally and live. | That a debug visit really signs nothing (read in the code, not walked out of). |
| 15 Nov | e588992 | Gemini's waste toner merged, with five changes. | Checked in detail before this way of working began: its whole life, the hallway, the last heart, live. | By ear: every check was muted. A phone. More than three at once. |

## Audits

None yet.
