# Camcorder lamp and more dim rooms

Review branch: `codex/backrooms-camcorder-light`, based on Fable's working
branch at `f6af65c`. It carries Last Light (`5be0e76`, equivalent to `fc85344`)
and the surface-aware flashlight/darker-outage pass (`38008c8`, equivalent to
`514f388`). The deck merge preserves Gemini's Drop Plenum alongside Last Light.
The new ambient mix still requires `lighting=1`; ordinary public visits do
not opt into that prototype automatically.

## What changes

The camcorder has its own soft 60-degree lamp, angled slightly down. It begins
fading at 0.9 metres and reaches zero by 2.2 metres, with distance and surface
angle affecting the light. It eases in as the room grows dark and out again
in brighter rooms. The flashlight retains its narrower, much stronger beam.
The camera can reveal a nearby wall or the carpet underfoot without revealing
the far end of a dark corridor.

`CAMCORDER_LAMP` and `camcorderLampPower()` in `flashlight.js` hold the tuning.
The lamp has a separate shader uniform, including on visible adjacent floors.
It never supplies inventory flashlight power, spends flashlight charge, or
stops a beam-sensitive creature. Existing `noTorch` rooms such as Last Light
can suppress the automatic camera lamp immediately; the real flashlight
still works there. Recording battery drain is unchanged.

The mix among eligible rooms is now:

| Treatment | Chance |
| --- | --- |
| Unchanged steady lighting | 60% |
| Persistent dim side | 15% |
| Isolated surviving lights | 10% |
| Failing fluorescent bank | 10% |
| Traveling outage candidate | 4% |
| Emergency lighting candidate | 1% |

Persistent dark pockets rise from 13% to 25%. Traveling outages retain the
corridor requirement, and emergency lighting remains capped at one room per
part. Protected rooms, dead fixtures and authored encounters keep their rules.
The independent lighting RNG still leaves layout, supplies and residents alone.
In a 100-seed sample, 551 of 2,927 total rooms received a treatment; 1,373 were
eligible. Most of the whole building therefore still keeps its original light.

## Review locally

`/world/dev/backrooms.html?seed=9&lighting=1&lightstudy=1&mute=1&vhs=1&pursuer=0`

The selected room on this base is room 1, a narrow corridor. **Near wall ·
camera beam** turns the ceiling and inventory flashlight off and faces a nearby
wall. **Across room** looks down the room's longer axis. **Look at carpet**
reveals the faint nearby floor light. Toggle **Flashlight on / off** to compare
the stronger beam, and use **Banks → Seeded cycle** to restore ordinary lighting.
The live readout exposes the two separate powers. The study is dev-only.

## Cost and limits

Both lamps run in the existing surface shader. No new draw passes, Three
lights, shadow maps, dependencies or geometry rebuilding. The weak lamp's
calculation is skipped when its power is zero. Dynamic furniture shadows and
flashlight occlusion remain outside this pass; distant doorway spill is baked.
Mobile frame time and resource balance still need longer playtesting.

## Integration checks

Carrying Last Light onto the larger current deck exposed two brittle existing
tests, corrected separately in `33486c0`: banner height is stored to the nearest
millimetre, and a fixed random sample can contain fewer than five instances of
an old room when the deck grows. The stash test now directly generates any
underrepresented room until five real coin placements are checked; all bounds
and placement assertions remain. Neither change alters gameplay.

Focused lighting, flashlight, Last Light and conductor tests: 30/30. These cover
smooth lamp activation, authored suppression, independence from creature power,
shared material uniforms, seeded distribution and the existing beam geometry.
Standalone build succeeds. Browser checks show the near wall patch, faint
carpet, dark distant corridor and stronger flashlight comparison.

Final full suite: **839/840 pass**. The sole remaining failure is the unrelated
status-line bridge in `test/usage.test.mjs:197`, also reproduced on an untouched
archive of base `f6af65c`. Initial harness-wake/waiting timing failures passed on
recheck; the untouched base also showed intermittent waiting failures. No
daemon, usage or wake code is changed. The standalone build contains 232 files.
