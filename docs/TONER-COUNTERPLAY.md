# Toner stalking and counterplay

Review branch: `codex/toner-counterplay`, based on `ced51c4`.

The old pursuit first spent a full 4.85 m/s movement budget toward the player,
then added lateral movement. Its apparent weave did not reduce closing speed,
and floor contact automatically bit. Sprint sonar locked on in 0.14 seconds.

The new encounter uses wall-perimeter goals at 2.3 m/s (existing difficulty
speed multipliers still apply), moving up/down the walls and crossing ceilings.
After at least 4.5 seconds of stalking, a target within six metres and line of
sight can trigger a 0.95-second stationary audible wind-up. The 0.8-second jump
commits to a fixed endpoint. 25% of aim rolls target the player's wind-up
position; others aim 2.2 metres to either side. This is aim accuracy, not an
unavoidable damage roll: movement, height, distance and cover still determine
whether contact lands. Ordinary stalking contact cannot damage the player.

A miss retreats for 10.4–13 seconds. A landed hit retreats for 16–20 seconds,
and the whole toner pack gets a 12-second damage grace period so another unit
cannot immediately chain a hit. Walk/sprint sonar fuses are now 1.4/0.75 seconds.
Scissors interrupt both wind-up and flight. Fire cancels flight; collision
checks stop a leap rather than steering it around an obstruction. Existing
puddle/brood lifecycle and character geometry are unchanged.

Local review:
`/world/dev/backrooms.html?room=copiers&seed=7&tonerstudy=1&mute=0&vhs=0`
Click Start stalking encounter. Damage defaults OFF; Toggle damage enables
Easy for a real health test. This developer helper is not imported by the public
entry point. Run the source via the local standalone build with public/world/dev
copied into its world/dev directory.

Quiet counterplay: standing still or crouching prevents attack wind-up, cancels
an existing wind-up, and prevents damage from an already airborne leap. Flight
keeps its committed trajectory. Silence resets the stalking timer and loses
the sound trail even with line of sight. The study uses the same attack gates.

Audio: six ElevenLabs OGG clips from `b7170fe` play through the effects bus with
positional pan and distance gain. Variants avoid immediate repeats; approximate
RMS compensation balances their levels. Playback is 0.7x (30% slower, with lower
pitch), and search/stalking/warning repeat intervals are divided by 0.7 to
preserve gaps. Attack and movement timing are independent of this audio change.
The mix is 82% dry with 18% soft saturation (2x oversampling). Two randomized
15ms interruptions affect only the gritty layer. Original asset bytes are unchanged.

Clips load after the audio gesture and are decoded once per sound context.
Procedural rattles remain the loading/error fallback. The standalone build
ships only the six OGGs; WAV masters and long takes remain on blockrooms-live.
The study's Hear sonar clicks / Hear attack rattle buttons start and unmute
actual game audio for review. The earlier muted preview hid these cues.

Validation: audio and counterplay tests pass, including variant selection,
0.7x playback, distortion routing, finite glitch timing, mute and teardown.
Browser checks observed stalking, wind-up, flight, recovery and return to perch;
the stationary-player check observed no attack and no hits. The 25% aim figure
is covered by stratified samples, not a measured player hit rate. Standalone
build includes all six OGGs; git diff --check passes. Balance remains subject
to playtesting.

Final verification: 80/80 focused tests pass. Full npm test: 932/937 pass;
failures are console chat path normalization (subtest + parent), harness mail
ordering (subtest + parent, also reproduces in isolation), and usage status-line
source reporting. These failures are outside the changed game/audio modules.
