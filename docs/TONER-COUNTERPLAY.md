# Toner stalking and counterplay

Review branch: `codex/toner-counterplay`, based on `ced51c4`.

The old pursuit first spent a full 4.85 m/s movement budget toward the player,
then added lateral movement. Its apparent weave did not reduce closing speed,
and floor contact automatically bit. Sprint sonar locked on in 0.14 seconds.

The new encounter uses wall-perimeter goals at 2.15 m/s (existing difficulty
speed multipliers still apply), moving up/down the walls and crossing ceilings.
After at least 5.5 seconds of stalking, a target within six metres and line of
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
`/world/dev/backrooms.html?room=copiers&seed=7&tonerstudy=1&mute=1&vhs=0`
Click Start stalking encounter. Damage defaults OFF; Toggle damage enables
Easy for a real health test. This developer helper is not imported by the public
entry point. Run the source via the local standalone build with public/world/dev
copied into its world/dev directory.

Validation: 68 focused tests pass (cast lifecycle, quiet/perks, difficulty,
co-op conductor, and new counterplay tests). Browser smoke test observed chase,
windup, lunge, recoil, prowl and perch with no console warnings/errors. The
25% figure is covered by stratified aim samples, not measured player hit rate.
Actual balance and camera readability still need playtesting.

Full suite: 930/933 pass. Failures are the console chat path assertion and its
parent, plus the usage/status-line missing-source test, matching the previously
observed unrelated failures. Standalone build and git diff --check pass.
