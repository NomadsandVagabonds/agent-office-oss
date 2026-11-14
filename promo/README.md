# The promo

How the two-minute film of the office was shot and cut, so that it can be re-shot when the office changes.
Everything on screen is the office drawing itself; nothing is mocked up in an editor.

```
rig/      the camera: a virtual clock for the page, tape playback, a hand on mouse and keyboard, the command captions
scenes/   what happens: scripts that direct a studio office over its own HTTP API and tape the daemon's stream
tapes/    those recordings (fictional demo data only), so a take can be re-filmed without re-staging it
shots/    where the camera is: one entry per take
titles/   the title cards: type on black, animated in one HTML page and filmed like everything else
edit/     the cut: a list of pieces of picture with their sounds beside them, laid on the bars of the soundtrack
out/      clips, captions, music and the finished film (not committed)
```

## Why a rig

A cloud box draws the 3D office in software at about a frame a second. `rig/inject.js` puts the page on a clock that
only moves when the camera asks (`Date`, `performance.now`, timers, `requestAnimationFrame`, CSS animations), and
plays the daemon's WebSocket stream back from a tape at the take's own pace. `rig/capture.mjs` steps that clock one
thirtieth of a second at a time and pipes each frame to ffmpeg. The result is real-time 1080p30 however long a frame
took. `rig/film` runs it on a virtual display with Mesa's llvmpipe, which draws this scene about four times faster
than SwiftShader.

## Re-shooting

The film uses four checkouts of the office, each served by its own daemon:

| port | branch | used for |
|---|---|---|
| 4410, 4411 | `claude/determined-maxwell-ayvlut` (via `rig/studio`) | the office, the lift and its floors, the console |
| 4412 | `claude/nice-curie-1h4ub9` (via `rig/studio`) | an agent resigning, the basement and its wall, the party room, the lift's newest plate |
| 4401 | the same, `npm run demo` | the Backrooms (trunk rooms, floors, the mascot) |
| 4402 | `codex/backrooms-expansion-lab` | Dispatch: crates, the GPU hoard, the two workers |
| 4403 | `codex/after-hours-fps` | After Hours with the crowbar |
| 4404 | `gemini/backrooms-workshop` | the tiled pool, the thing in the pipes |
| 4317 | `main`, `npm run demo` | the original pixel office |

```bash
rig/studio <upgraded checkout> 4410 &                  # a clean office with its own data folder
node scenes/ambient.mjs 4410 --skip demo-webstore-1,demo-webstore-2,demo-mobile-1,demo-api-1,demo-data-1,demo-ml-1,demo-growth-1 &
node scenes/office.mjs 4410                            # tapes 01–06 (about four minutes)
node scenes/lift.mjs 4410                              # tape 08
rig/film shots/office.mjs --shot hero                  # one take → out/clips/hero.mp4   (--still 1,3 checks a framing)
                                                       # (--shot features is the closing take: an agent's card, then the kanban)
rig/queue shots/backrooms.mjs out/clips fall standees  # several, one after another
node scenes/resign.mjs 4412                            # tape 09 (and 09-resign-walkout, which the shots play)
node scenes/lift.mjs 4412 10-quiet                     # tape 10
node rig/cards.mjs                                     # the command captions → out/cards
for t in titleMain titleUi titleEggs titleEnd; do node rig/capture.mjs shots/titles.mjs --shot $t; done
PROMO_AUDIO=<upgraded checkout>/public/audio node edit/cut.mjs --post --sheet --list      # add --no-cards for the cut without section cards
```

The console's takes need a second studio (`rig/studio <checkout> 4411`, on a copy of the first one's data folder)
with an `adapters.json` in that folder pointing the `gemini` and `codex` adapters at `rig/stand-in.mjs`; then
`node scenes/console.mjs 4411` and `node rig/capture.mjs shots/console.mjs --shot console`.

## What is a stand-in

- The cast is the demo's fictional roster, directed through the same calls `office` makes.
- The driven agent in the console is the office's own test fixture behind `rig/stand-in.mjs`, which gives a plainly
  worded request the turn it should produce and shows the fixture's models under real-looking names. No model was
  called. `PROMO_LABELS=plain` leaves the fixture's names as they are.
- Sound is the project's own `public/audio`, plus tape static made by ffmpeg.
- The score is two tracks that are not the project's and are not in the repository: put `glitch-basement.mp3` and
  `room4.mp3` in `out/music/` (or point `PROMO_MUSIC` at them). The first plays from the title card to the wall in the
  basement and again under the end title; the second, low, under the Backrooms. `edit/cut.mjs` cuts on the first one's bars.
- A resigning agent is removed from the floor a second after its farewell in that build, so its walk to the lift is
  never seen. `scenes/resign.mjs` writes a second tape with that one removal held back until the walk is over; the walk
  itself is the office's own.

## Changing the words

The name, the line under it and the two section cards are constants at the top of the script in
`titles/titles.html` (`TITLE`, `SAY`). Change them, film the four title shots again (under a minute) and run the cut.
