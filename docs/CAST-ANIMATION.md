# Cast animation: where every creature's body stands

An audit of how the level's creatures move, written by the animation session
(17 Nov 2026) before any animation work. It covers every `cast/*.js` and every
room resident with a rig. It is read from the code only. Nothing here was
watched on a real GPU, and no frame of it was looked at in a browser.

Ratings: **none** (nothing moves but the whole body) · **slides** (the body
glides; at most a bob) · **two-frame** (a sine on one or two parts) · **basic**
(several parts move, but rigidly, with no planted feet) · **good** (planted
feet / IK / springs, reads as a body).

"Hit by" means what melee can reach today: **sn** = scissors (`snipTarget(s)`),
**sh** = shove (`shoveTargets`, cast only; no room resident can be shoved).
Health tiers are the owner's (1 / 2 / 3) where the owner named the creature; `1?` is my guess and is the cast session's to set. Meshes are counted from the code;
no file states a triangle count, so triangles are not given.

## The table

| creature | tier | rig today | moves today | crawl/jump/fold | hurt · death · kill-cam | hit by | meshes |
|---|---|---|---|---|---|---|---|
| **pirate** (`cast/pirate.js`, model inline) | 2 | body (boots baked, no legs), 2 arms (shoulder only), head with 6 faces × whole/torn | **none**: snaps between 9 fixed poses while unwatched, slides into place. By design it moves only unseen | lies prone "face in the hole"; jumps spot to spot unseen | none · none (a snip = `breakOff`: it relocates, which is the owner's "killed in 1 hit, no animation") · yes, 6 half-second beats | sn, sh | ~16 |
| **The Trunk Line** (`rooms/cable-drop/rig.js`) | 2 | body (legs baked), head spool, 2 arms (rigid at shoulder) | **two-frame**: arms swing on `sin(t·9.5)`, head wobbles, whole body slides. Crouching is `scale.y` squash | drops from ceiling (straight lerp of height), squeezes under the crawl header (squash) | none · none · none. A snip sends it to `recoiling` for 6 s, which is drawn as the standing idle, so a hit **looks like nothing happened** (the owner's "no effect") | sn | 4 + shadow; dormant tendrils 1 |
| **waste toner** (`cast/toner.js`) | 2 | root → orient (wall/ceiling bank) → body; 4 core variants × whole/torn; 4 rigid limbs (knee baked); streaks, drips, puddle | **basic**: diagonal-pair sine scuttle of rigid limbs, strong glitch dressing | ceiling prowl, wall climb, drop, wind-up and locked leap, hatchlings | no flinch (a hit swaps a torn frame) · **yes**: melts to a puddle after its second landed bite, puddle hatches broodlings · no kill-cam | sn (also the puddle), sh | ~20 |
| plenum / flume toner (`rooms/drop-plenum/rig.js`, reused in slide-maze) | 1? | orient/body, 3 cores × torn, 4 limbs × torn | **good**: phased 4-leg gait, ceiling ↔ deck flip | ceiling crawl, drop | recoil only · none · none | sn | ~15 |
| **the-lines** (telephone poles) | 3 | body + 6 rigid poles + 6 stretched sinews | **basic–good**: planted feet, ≤3 stepping, but poles have no knee | folds low under ceilings, falls into gaps (spins, gone) | none · fall only · yes | **nothing** (no snip, no shove, no body: on purpose) | 13 |
| **standing-meeting** (centipede) | 3 | 9 segments × 5 parts, 22 legs (thigh + shin, IK), 5 ties | **good**, the best rig here: trail-following segments, wave, rears, IK legs with step cap, spring ties | rears, charges, reverses (tail becomes head), collapses "down" | none · none ("down" is winded) · yes | sh only | ~94 |
| **mother** | 3 | 14 trunk rings, mouth with worms + 5 feelers, 4 arm chains, 7 feet; worms 4 parts each | **good** body (travelling wave, gulp bulge, chains); her walk is feet treading in place while she slides | brood thrown in arcs, leap at the face | none (her) · worms flatten and die · yes (worm swarm) | sh only | ~65 |
| **intern** | 1 | back, neck, head, 2 IK arms, 2 IK legs (knees backwards) | **good**: quadruped foot-planting, spring head | crawls on all fours | "sorry" nod only · none · yes | sh | 15 |
| **head-count** | 1? | hips knot, 3 torsos, 8 IK arms | **good**: walks on its arms, ≤4 hands stepping | — | shudder · none · yes | sh | 33 |
| **carried-interest** | 1? | weight, 2 arms, 10 bearers, no joints | **basic**: bearers hop and orbit, no stepping | — | bearers squash and regrow; "down" flail · none · yes | sh (heavy) | 13 |
| **middle-manager** (`cast/middle-manager.js`, `.model.js`) | 1 | thin body / full body (shown by fatness, let out between), neck, egg head, 2 IK arms (sleeve, sleeve, hand), 2 IK legs (trouser, trouser, shoe) | **basic**: long strides from a phase on distance walked; folds at hips and neck under the ceiling (`bend`); arms reach while it comes | stoops under ceilings, folds through doors | swelling shakes and lifts the arms · goes off in paper (`dies` ticks the paper) · none | sn, sh | 13 |
| **dummies** | 1 | one baked pose per dummy, no joints | **none**: pop in where you left; rock after a hit | — | rock · none · none | sh | 1 each |
| **moth** | — | body + 2 wing quads | **two-frame** flap; flight paths are good | flies, dips under lintels | burns: mesh just hides | — | 3 |
| **shadow** | — | one static figure | **none**: teleports, tint only | — | none · hides | sn (lurk) | 1 |
| **porter** | — | rigid man, mop, strands, bucket, locker | **basic**: props and spring strands move, body never | — | — | — | ~10 |
| **other-door** | — | two leaves + 7 arms of 11 box links | **basic** glitch reach (snapped to a grid) | — | — · — · yes | — | ~82 |
| **Floor Warden** (`rooms/safety-corridor/rig.js`) | 1 | body (arms baked), head × torn, 2 legs at hip, scissors with 2 blades | **basic**: sine stride, bob, blades snipping | trips | death = trip forward, despawn · no kill-cam | sn | 7 |
| Fun Committee (`mandatory-fun`) | — | head, jaw, 2 arms; legs baked | **slides** + jaw bite | — | — · — · yes (party hat) | — | 5–6 each |
| Retention Clerk (`shredding-bay`) | — | body, head × torn, cart, rollers, confetti | **slides** (rollers turn) | — | — · — · yes (fed to the rollers) | sn | ~8 |
| Keynote Speaker (`all-hands`) + audience | — | one baked body, head × torn; audience 3 merged batches | **slides** a step per blackout; audience heads two-frame | — | — | — | few |
| Smiling climbers (`cubicle-grid`) | 1 | body, head, 2 arms; legs baked | **basic**: hand-over-hand climb, tightrope stalk | climbs out of shafts; falls when snipped | fall · — · fall-cam | sn | 4 |
| Stand-Ins (`blackout-bay`, last-light) | — | one baked mesh | **slides** while unlit | — | — | — | 1 |
| Efficiency Partners (`audit-pod`) | — | body, head × torn, right arm, 2 legs | **basic** stride | — | — | — | 6 |
| Absorbed Staff (`absorbed/rig.js`) | — | core, head × torn, 2 two-joint arms | **good** for something fixed in a wall | hangs from the ceiling | — (never fatal) | — | 7 |

Also moving, rigged outside a `rig.js` (not audited row by row, named so
nothing is forgotten): coat-rack buck (`stag.js`, timber-lot, sn), guard-stand
(`guard-stand.js`, lazy-river, sn), retreat facilitator (`forest.js`,
campfire-circle, sn), fire marshal (burn-scar, sn), timber auditor
(old-growth, sn) and manila bagworm (canopy-walk, sn) are static voxel groups
that bob or spin. The clear-cut dozer, the lemonade girl, the seam-peeker,
the dispatch freight pair, the mecha workers and the eye-birches are also
static voxel groups.

## What this says

1. **Nothing can be seen being hurt.** Only the toner (melt), the Floor
   Warden (trip) and the climbers (fall) have a death. No creature flinches.
   A hit on the pirate makes it vanish, and a hit on the Trunk Line makes it
   stand still. That is all of the owner's notes about hits.
2. **Three of the three-health creatures cannot be hit by the scissors at
   all** (the-lines: by nothing). That is a rule question for the cast
   session, not an animation one: a death animation for them only matters
   once something can hurt them.
3. **The scissors in the hand** (`hand.js`) are a floating model thrust 16 cm.
   No hand holds them. `inventory.js:95` calls `handView.jab()` *before* the
   hit is resolved, so the hand cannot know hit / miss / snap. A one-line hook
   is needed there (below).
4. **Co-op:** every resident runs its own copy of its rule on each client,
   and much pose code rolls `Math.random` (pirate faces and poses, toner
   morphs, mother's heave, other-door, head-count pats). New animation here
   will be a function of time and creature state only, and it will not add any
   `Math.random`. Making the existing calls deterministic is not part of this
   work unless the lead asks for it.
5. **Budget:** room budget is 45 meshes. The centipede (~94), mother (~65)
   and other-door (~82) are already the heaviest mesh counts. Their new
   animations will move existing groups rather than add meshes.

## What I would do, ranked

1. **Scissors in the hand.** A gloved hand gripping the handles, matched to
   the shove hands, and a jab that stabs forward and twists. A hit stops dead
   and judders, and the blades close. A miss overreaches and recovers late. A
   snap ends with the blades splaying, one half dropping out of frame, and the
   empty hand left. Cost: 1 mesh in the hand. Needs: `inventory.js` to tell
   the hand the outcome (`handView.landed?.(result)` after `useSelected`):
   **ask for the lead.**
2. **The Trunk Line, re-rigged.** Arms become chains of 4–5 segments with
   lag and spring, swinging slack that trails behind when it turns. Leads
   reach out ahead in the chase. The drop overshoots and bounces on its cords.
   Under the header it squeezes by bending its spine and flattening its arms
   along the floor, instead of a scale squash. A snip gets a recoil: the cords
   whip back and coil up. The collider and rule are unchanged. Cost: about
   4 → 12 meshes.
3. **Hurt flinch and death, once health is live.** Do these in this order:
   - pirate (a hurt shows a torn face and its head snaps back; it dies by
     folding down onto its knees and staying, never by vanishing)
   - Trunk Line (cords go slack and it collapses into a heap of cable)
   - toner (a flinch before the existing melt)
   - centipede (segments drop out of the wave one by one, front to back)
   - mother (the trunk wave stops, she sags, the rings slump)
   - the-lines (poles buckle at a new knee, the body comes down)

   All are driven by the cast session's `hurt` and `dying` values.
4. **Kill animations.** Each creature that has a kill-cam (`takes`) gets a
   killing motion on its own body: the pirate's grab, the Trunk Line wrapping
   a cord round the neck, the toner's bite.
5. **Walk cycles**, in the order the owner picks. I would suggest:
   - the Trunk Line (in 2)
   - the pirate (none today; it only needs a pose blend for the frames
     when it is half seen)
   - toner limbs with a knee
   - mother's feet actually carrying her
   - the Fun Committee and the Retention Clerk (slides)
   - the-lines' poles with a knee

## Hooks I need from other files

- `inventory.js` (snip): after `useSelected`, call
  `active.env.handView?.landed?.({ ok, snapped })`, so the hand knows hit /
  miss / snap.
- The cast session's health: per creature, `hurt` (seconds since the last hit)
  and `dying` (0→1), readable from inside `cast/<id>.js` and the room files
  that draw residents (`rooms/cable-drop.js` today calls `rig.pose` itself, so
  the Trunk Line's death needs the room file to pass `dying` through, or me to
  be allowed into its draw block).
- Timing: none asked for yet. A death that plays out needs `dying` to last
  long enough to be seen, about 1–2 s. That is a cast-session number.

## Looking at a fast move: slow the page down

There is no query or handle for this in the game. It is a Playwright init script
of my own that runs before the page's code, keeps its own clock, and lets the
page set how fast that clock runs:

```js
await page.addInitScript(() => {
  window.__rate = 1;                                   // 1 = real time, 0.1 = a tenth
  const real = performance.now.bind(performance); let base = real(), virt = base;
  const now = () => { const r = real(); virt += (r - base) * window.__rate; base = r; return virt; };
  performance.now = now;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(now()));
});
```

Load `/play?debug&mute&vhs=0&pursuer=0` (add `room=<arch>` or `cast=<id>&beside=<id>`
to stage someone), wait for `window.__backrooms.world`, then in one `evaluate`
set `window.__rate = 0.1` and start the move, for example
`window.__backrooms.env.hand.wipe()` or `.swat(1)`, and screenshot every half
second or so. The software renderer is slow, so the first frame still comes a
little late: the wipe (0.42 s) lasts about 4 s at a tenth, and the swat (0.26 s)
about 2.6 s. Set `__rate` back to 1 afterwards. It changes only the clock the
page reads, so the game itself is untouched.
