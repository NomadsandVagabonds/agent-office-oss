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
| 15 Nov | (this one) | A visit that ends by being caught is shown for three seconds from a fixed camera in the corner of the room, with the visitor's own character in it (`lastshot.js`; `takes(shot)` for the cast). | Suite. One death by a toner in a browser: camera label, character visible, card follows, no errors. | Every other creature and every room that can take the last heart. Small rooms, crawl spaces, doorways, the hallway's room. A phone. The office's own lift (not the site). How it sounds. No creature has a `takes` yet. |
| 15 Nov | 0d7f497 | A kind of floor can keep to its own rooms (`own`), and a room to its own floor (`'*': 0`). | Suite. Staged in memory with a made-up floor. The make of the building unchanged. | Nothing uses it yet: first real use is the suburb floor. |
| 15 Nov | 5c27ba7 | A kind of floor can be unfinished (`dealt: false`) and asked for by name (`themes=`). Visits opened with `debug` or `room=` no longer sign the book. | Suite. `themes=` in a browser, locally and live. | That a debug visit really signs nothing (read in the code, not walked out of). |
| 15 Nov | e588992 | Gemini's waste toner merged, with five changes. | Checked in detail before this way of working began: its whole life, the hallway, the last heart, live. | By ear: every check was muted. A phone. More than three at once. |

## Audits

None yet.
