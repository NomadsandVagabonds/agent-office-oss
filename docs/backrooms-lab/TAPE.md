# The tape: two optional puzzle rooms on one mechanic

A proposal with a tested rule behind it. No room is built yet. The owner asked
for this after turning down the twelve rooms in `PUZZLES.md`, which are
withdrawn as puzzles: most of them were "notice the odd thing and collect".
The owner's direction for this document:

- few puzzles, optional side rooms, with a reward that pays for the time;
- a eureka, not a groan; at worst an honest borrowing of a well-loved
  mechanic, at best something of our own;
- do not hold a room to one new rule. The player is an adult.

## The mechanic

A tape deck on a trolley, with a small monitor. Press E at it and it records
you for as long as its tape is (about twelve seconds): where you stand and
where you look. When the tape runs out it plays. You come out of the deck as a
cardboard cut-out of yourself, which does what you did and then stops on its
last frame and stays there.

The cut-out is two things:

- **A body.** It counts wherever a body counts: a desk that wants somebody at it.
- **Eyes.** What its printed side faces is being looked at. A screen that wants
  watching is watched. A cardboard colleague, who only moves while nobody is
  looking, does not move.

It is not solid to you, it cannot hurt or be hurt, and recording again wipes
it. The tape always runs its full length; there is no stop button. Recording
and playing both run on the camcorder's clock, so every solution is paid for
twice in battery.

The only words are on the deck's own monitor: `REC`, `PLAY`, a counter.

**What is borrowed and what is ours.** Working alongside a recording of
yourself is a well-loved idea that several games have used. That part is
borrowed, as a shape and nothing more. What is ours: the recording keeps where
you *looked*, and in this building looking is the rule everything else runs
on. The cut-out is also already in the level (`cutout.js` makes one of the
visitor for the Standees room), with a printed front and `THIS SIDE BACK` on
the reverse, so which way your recording is looking can be read across a room.

## Room one: Cover

*The stock shutter is up while somebody is at the desk and looking at the
screen. Tape yourself doing your job.*

```
 +----------------------------------------------+
 | [shutter]                                    |
 |  reward                                      |
 |                                              |
 |                                  (mat)[screen|
 |                                   desk       |
 |                                              |
 |        [deck]                                |
 +---------------------- you -------------------+
```

- **What you find by poking.** Stand at the desk and look at its screen: it
  wakes, and a shutter across the room rolls up. Look away or step off and
  the screen sleeps and the shutter comes down, well before you can cross
  the room. The deck records you and plays you back.
- **The catch.** The obvious tape is: walk to the desk, then turn round to
  watch the shutter go up. Played back, your cut-out walks to the desk and
  turns its back on the screen exactly as you did. The screen sleeps. The
  shutter stays down.
- **The eureka.** It kept where I was looking. Record it again: go to the
  desk, look at the screen, and wait out the tape staring at a monitor. Then
  walk to the shutter while a cardboard you does the staring.
- **Time and reward.** About thirty seconds for somebody who knows it, a
  minute or more cold. One battery pack and a snack.
- **The joke.** The office only checks that something shaped like you is
  facing a screen.

## Room two: Handover

*Two desks and a cage that is open while both are attended. One cardboard
colleague. You need three people.*

```
 +----------------------------------------------+
 |################  cage  ######################|
 |############# [  door  ] #####################|
 |                              o colleague     |
 |                                              |
 |[scr](mat A)                    [scr](mat B)  |
 |                                              |
 |                   [deck]                     |
 +---------------------- you -------------------+
```

Both screens are on the west side of their desks, so from B, looking at A is
looking at B's own screen.

- **What you find by poking.** Each desk is as in Cover. The cage door is up
  only while both are attended. The cardboard colleague comes toward you
  whenever you are not looking, and stops when you look.
- **The catches, in the order people meet them.**
  1. You at one desk and your tape at the other opens the cage, and then
     there is nobody left to walk into it.
  2. The colleague will come and stand on a desk's mat if you stand beyond it
     with your back turned. It faces you, which is facing the screen. But the
     moment you stop watching it, it gets up and follows you.
  3. You cannot watch it from inside the cage.
- **The eureka.** The tape has eyes. Lure the colleague onto desk A. Back away
  to the deck without taking your eyes off it. Press E, and walk backwards to
  desk B, still watching it, until the tape runs out. Your cut-out now sits
  at B and stares at A: it is the body on one desk and the eyes that hold the
  other. Turn your back on all of it and walk into the cage.
- **Time and reward.** About a minute known, two to three minutes cold. Three
  battery packs, which is more than the room costs even on a slow first go.
- **What makes it ours.** The cardboard people frightened you upstairs for
  moving when you looked away. Here you seat one at a desk and leave a
  recording of yourself to supervise it.

## What the simulation shows

`public/world/backrooms/tape.js` is the rule, pure, and
`test/backrooms-tape.test.mjs` plays both rooms with a made-up visitor at the
real walking and running speeds from `player.js`. It passes on all of these:

| Claim | Result |
|---|---|
| Cover: at the desk yourself, the shutter is up, and you cannot reach it even at a run | holds |
| Cover: the obvious tape (turn to watch the shutter) fails, because the cut-out looks away too | holds |
| Cover: taped looking at the screen, you walk in | holds |
| Handover: you plus your tape opens the cage and nobody can get in, even at a run | holds |
| Handover: the colleague sits at A when lured and leaves when you walk off normally | holds |
| Handover: lure, back away watching, tape yourself to B watching: you walk in | holds |
| Handover: the same, but taped facing the wrong way from B: the colleague gets up and the cage shuts | holds |

What it does not show: whether it is fun, whether a cut-out's gaze really
reads across a room, how walking backwards while watching something feels on
a keyboard, and whether it works at all on a touch screen. Only a playable
room answers those.

## What the seed changes

The rule never changes. The layout does, and with it the tape you have to
make:

- which side of each desk its screen is on, so that "where must my recording
  be looking at the end" has a different answer each visit;
- how long the tape is (eight to fourteen seconds) against how far the deck
  is from the desks, so that some visits leave time to spare and some need
  the route planned;
- where the colleague starts, and which desk is the easier one to lure it to.

Every rolled layout would be run through the same simulated solution in a
test before it can be dealt, so that no visit is given an unsolvable room.
That test is not written yet.

## Where they go

Optional side rooms, as the owner chose: dead ends off the path (`ports: []`),
never on the way through, one of the two in a visit at most. Handover is only
dealt below a part that had Cover or the Standees in it, not because the
player needs teaching but because it is the bigger room and should come
later.

## What I tried and dropped

- **Decoy.** A crowd of colleagues blocks a doorway; tape yourself walking
  into a corner so they gather round the recording. On paper it has a hole:
  you can lure them away and pin them with your own eyes while backing
  through the door, so the tape is not needed. Dropped until it has a real
  reason to exist.
- **Chain.** A second deck that can only be reached while the first tape is
  holding something. More of the same idea, and worth building only if the
  first two land.

## What it needs from other sessions

- Nothing from the conductor, the HUD or the cast for these two rooms. The
  colleague and the cut-out are the room's own; the rule is in `tape.js`.
- From the lead: the guide's rule 2 ("one new thing to learn per room") does
  not hold for these, on the owner's word. And three packs for Handover is
  more than the "one pack, or a pack and a snack" the lead asked rewards to
  be kept to. The owner asked for a reward that pays for the time; the amount
  is theirs to set.
- Later, if wanted: the tape's eyes holding the mascot. That is the cast
  session's code.

## Next

Build Cover as a playable room on `claude/backrooms-gameplay`, because the
open questions above are about feel and nothing on paper will settle them.
