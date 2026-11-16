# Waterpark: quality pass before release

15 November 2026 · `codex/waterpark-art-pass`, following the technical integration in `819f8cd`.

**The deck is a prototype, not a release candidate.** Passing navigation and water tests means it can be reviewed safely; it does not establish that the geometry, assets, pacing or atmosphere meet BlockRooms' standard. Keep `waterpark.dealt:false`.

Bellmouth Baths now has a first playable study on `codex/waterpark-bellmouth`.
See [its review notes](BACKROOMS-BELLMOUTH.md) for the implemented route, remaining
differences from the brief and validation. Hanging Changing Rooms also has a
first playable connector on `codex/waterpark-hanging-changing`; see
[its route and review notes](BACKROOMS-HANGING-CHANGING.md). The remaining
architecture briefs below are plans.

## Direction

Build an indoor leisure centre whose architecture has become absurd. Floors separate into shelves around deep voids, balconies repeat far above the playable route, corridors narrow beneath descending ceilings, and flumes pass through several storeys. Ordinary office and pool construction gives these impossible volumes a recognisable scale. Ceramic has grout and chipped edges; painted walls have tide marks; fiberglass has seams and collars; rails have mounts; towels sit in usable carts. Those details finish the architecture; they cannot substitute for it.

The recurring problem is not lack of props. The original set repeats a bright blue tiled box, a uniformly lit acoustic ceiling and luminous water, then adds several competing curiosities. Adding a monster or another stack does not fix the space. The lazy river's static browser view makes this particularly clear: neon-looking water lines, symmetrical ring towers and murals compete with the fused lifeguard.

Keep the house's faceted voxels and office furniture. Approximately 60–80% of the route should remain quiet connectors, including dry approaches, changing corridors, wet service passages and repeated shower bays. Quiet means no compulsory encounter or puzzle; the geometry can still be wildly wrong. Repeat unusual architectural modules across the deck so those spaces remain confusing rather than each becoming a unique landmark. Retain bright areas as well as darkness.

## MACBETH reference: IN YOUR DREAMS

Owner-supplied reference, 15 November 2026: [IN YOUR DREAMS by MACBETH](https://verse.works/series/in-your-dreams-by-macbeth). The owner reports permission from the artist, including direct copying, but asks primarily for atmosphere and room-structure inspiration. This is a visual direction reference, not an instruction to import the collection's media into the game.

Review scope: sampled frames across the collection's cover clip, banner clip and [#68](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/67). These notes do not claim a complete collection or audio review.

Observed:

- The cover has a flooded passage beside tall, fog-bright windows, a narrow raised route, handrails and a small glazed booth. Dark water obscures the floor while daylight erases what is beyond the windows.
- The banner cuts a long black-water channel through an otherwise ordinary, brightly lit white corridor. Dry margins, repeated openings and a few waiting chairs do much of the work; there is little decorative clutter.
- #68 moves from a cramped water channel between pale tiled walls into a larger low-ceilinged space with repeated columns and children's slide structures. The contrast in scale and function is more striking than the restrained colours.

Implications for our art pass: wear is useful, but making everything grimy is insufficient. Keep some spaces clean and fluorescent-bright. Give water depth and restrained reflections, conceal the destination with corners or fog, and vary headroom and route width. A believable railing, sill, drain or tile return should explain the construction. Preserve the house's voxel forms rather than pursuing photorealism or unstable geometry from the generated videos.

Candidate adaptations (our proposals, not claims about mechanics in the artwork):

1. **Channel corridors:** repeat a quiet connector family where a narrow recessed waterway replaces part of the floor. Dry margins and occasional crossings make movement deliberate without requiring an enemy or puzzle in each one.
2. **Flooded observation passage:** a glazed office booth and narrow raised walkway beside fogged exterior windows. A submerged shortcut is visible but its depth is uncertain; most of the tension comes from the route itself.
3. **Play area beneath the office:** low acoustic ceilings, square structural columns and adult-height doorways around an incongruously tall slide. A playable return route comes back to its upper landing, making the architecture itself wrong.
4. **Repeated changing suites:** reuse the same restrained material and fixture kit across near-identical spaces. Alter floor elevation, waterline and which door is reachable, keeping most of the route static and easy to confuse.

Use these early observations alongside the broader architecture study below. Review visual changes at player eye level; do not reproduce the reference's erratic camera motion in normal player control.

### Expanded reference review: architecture first

The owner's correction: the first reference selection and proposed adaptations were too conventional. Do not return to rectangular rooms with better surface dressing. Additional review sampled frames across the full durations of #10, #30, #60 and #70, following a nine-thumbnail selection across the collection. Audio was not assessed.

- [#30](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/29): red flumes coil among concentric blue tiers around a deep, dark cylindrical shaft. The camera descent reveals the vertical scale. **Adaptation:** rebuild the Flume Knot around a shaft, with a walkable rim and crossing tube; repeat partial rings below into darkness. The void should dominate the entrance view.
- [#70](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/69): multiple balcony levels, stairs, cross-bridges and sloping supports enclose a long water trench. **Adaptation:** a deep atrium channel with offset office galleries, a high crossing and a lower wet route. This is the stronger next benchmark than another hallway with a pool inserted in its floor.
- [#60](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/59): an escalator descent is compressed under a swollen, sagging ceiling before opening out again. **Adaptation:** a static service descent with a stepped, descending soffit, then an unexpectedly tall chamber. Keep actual walking clearance and automatic crouch consistent with the shape.
- [#10](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/9): a fractured reflective room opens toward water and develops into a repeated vertical shaft. **Adaptation:** repeated window frames and offset landings create disorientation; defer expensive recursive reflections. Use stepped voxel planes for the distorted envelope.

The atrium channel is a candidate benchmark. The owner has asked for more planning before implementation; compare it with the bellmouth and suspended-wall proposals below before selecting a build.

Authoring rules for the next pass:

1. Draw both the plan and a vertical section before dressing. Specify the entrance sightline, destination, playable route and the void or obstruction that makes the route interesting.
2. Establish a strong untextured silhouette: offset floors, visible undersides, uneven headroom, angled walls, faceted curves, bridges and deep recesses. A uniform-height outer box must not determine every room's interior.
3. Keep familiar doors, rails, chairs and tiles at a consistent scale so the surrounding architecture feels implausibly large or compressed. Avoid scaling every object together.
4. Make the conspicuous route playable wherever feasible. Decorative distant levels can extend apparent depth, but should not imply an accessible doorway where none exists.
5. Build static distortions first. Batched repeated geometry can be inexpensive to render; collision, overhead clearance, enemy routes and two-player traversal still need deliberate implementation and verification. Portals, altered gravity and recursive mirrors are separate work.
6. Require the space to feel strange before adding creatures, signage or clutter. Multiple geometric contradictions can belong to one coherent structure; they need not be isolated props in a normal box.

## Planning slate after the broader video study

**Planning only.** No room implementation, generator weights or production settings changed in this reference pass. Room names below are working labels for discussion, not in-game signs or established Backrooms lore.

### Evidence and local review material

Screened **29 additional previews** and downloaded **12 additional videos**: #4, #12, #18, #22, #28, #32, #38, #48, #52, #56, #62 and #74. Inspected twelve evenly spaced frames across the full duration of each clip. This establishes visible architectural references, not reliable physics, consistent topology or a complete audio review. The source's generated transitions sometimes change geometry; our proposed rooms need stable, deliberate interpretations.

Local reference viewer: `/Users/nomads/Downloads/BlockRooms-Macbeth-References/index.html`. It contains playable reduced-resolution copies with audio, sampled sequences, direct source links, observed features and separately labelled adaptation ideas. `reviewed-clips.json` records the media URLs and duration. All media remains outside the repository.

| Source | Visible idea worth studying | Use in our plan |
| --- | --- | --- |
| [#4](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/3) | Slides rise and cross inside a reflective corridor | Flumes replace normal circulation; duplicated views are a later option |
| [#12](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/11) | Extremely tall planes open onto long coloured lanes | Exaggerated proportions and repeated light rhythm |
| [#18](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/17) | Open flumes turn beneath large crossing tubes and building structure | A lower water path with a separate service route |
| [#22](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/21) | Giant tiled funnel with a dark throat | Make the whole room a drain at building scale |
| [#28](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/27) | Branching tubes fill a cyan-lit volume | Recurring flume thickets and partially hidden routes |
| [#32](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/31) | Repeated pale platforms and narrow paths among dark gaps | A maze made by removing floor; borrow the layout, with our own fixtures |
| [#38](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/37) | Door frames and openings repeat at changing proportions | A quiet, tapered threshold connector |
| [#48](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/47) | Water beneath tiled walls opens into a hall split by a long channel | Wet passages below walls and a dry approach above the same water network |
| [#52](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/51) | Stairs, landings and repeated windows frame a tall void | Interleaved flights and views back toward the entry from another height |
| [#56](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/55) | Large tiled partitions appear suspended above water channels | A reusable family of hanging-wall mazes |
| [#62](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/61) | Tiled planes converge toward small apertures beside round black pools | Faceted room envelopes and a stable, exaggerated perspective |
| [#74](https://verse.works/items/ethereum/0x9a78fc8fa54350c2b5629211b9f8c577408f24a0/73) | Broad steps, sloping tile, edge lighting and a circular black pool | An almost empty bowl room with a route around the water |

### What the broader sample changes

- **The building can become a piece of equipment.** A drain, chute or stairwell can determine the whole room's volume. Office objects then provide familiar scale within it.
- **The missing floor matters as much as the walls.** Wells, slots and separated platforms can produce a maze without a forest of upright partitions.
- **Use the vertical view.** Show the underside of the route, a destination above the entry, or another floor through a gap. A top-down plan alone hides the most useful possibilities.
- **Repetition can be absurd.** Nested thresholds and repeated landings can remain disorienting even when their individual shape is unusual. Build reusable families rather than making every deformation a named landmark.
- **Keep colour available.** The coloured chutes against pale tiles are useful contrasts. Wear and a restrained material set should not turn the entire deck brown or desaturate every attraction.
- **Keep player motion dependable.** The footage's rotations and morphing are presentation effects. Our camera stays under player control while the world supplies the impossible impression.

### Eight candidates to compare before building

All routes and gameplay below are **our proposals**, not observed mechanics in the videos.

| Candidate | Entrance composition and spatial idea | Player route / decision | Quiet version and reuse | Main implementation question |
| --- | --- | --- | --- | --- |
| **Bellmouth Baths** (#22, #62, #74) | An ordinary office door opens into a huge faceted tiled funnel. A standard-size doorway is visible across its rim; a black pool occupies the throat. | A broad dry ledge follows the circumference and changes height. A lower optional spur reaches a supply recess; the main route requires no jump. | Repeat smaller concave chambers and tapered connecting throats with no interaction. | Floor slope and headroom must match the facets. The water edge needs a visible lip and a recoverable entry. |
| **Hanging Changing Rooms** (#48, #56) | Familiar tiled partitions stop above a continuous water surface. Their undersides and plumbing are visible; dry platforms are offset around them. | Walk the longer dry route or crouch through a short wet opening to another platform. The shortcut rejoins a reliable exit path. | A primary connector family. Repeat bays and alter which gaps are open, without giving each version its own trick. | Under-wall clearance, auto-crouch, water support and two players passing must agree. |
| **Atrium Channel** (#70, #52) | Enter halfway up a tall stack of office galleries overlooking a narrow water trench. Visible bridges and landings pull attention vertically. | Descend by offset stairs, cross at a lower bridge, then climb toward the exit seen from the entrance. A later optional water route can provide a different tradeoff. | Gallery fragments and deep slots recur in connectors; reserve the full tall atrium for an occasional feature. | Freely traversable overlapping floors need actor-aware support queries. Distant decoration must not suggest reachable doors that are fake. |
| **Flume Knot / Drain Shaft** (#18, #28, #30) | A coiled tube network wraps a deep shaft, with several passages visible across the void. The rim and tube mouths define the room. | Keep the existing crawl route and one-way descent idea; revise them into a legible circuit around the shaft, with a safe lower escape route. | Short flume segments crossing ordinary service passages can recur without rides or creatures. | Preserve crawl width and tested entry/exit transitions while moving the plan into a genuinely vertical composition. |
| **The Remaining Floor** (#32) | A low ceiling spans a much larger dark space. Only repeated tiled islands and narrow causeways remain beneath it. | Navigate a branching continuous walkway. A lost route loops back; optional side islands hold supplies. No mandatory precision jumps. | A quiet maze family with many similar platforms, using our own rails and fixtures. | Protect essential routes from dropped props and provide a recovery policy for accidental falls. Avoid invisible rails. |
| **Misjoined Stairwells** (#52, #60) | Several normal flights occupy one shaft at mismatched elevations. Some pass beneath a sloping soffit; windows reveal another landing where it should not fit. | One continuous walkable sequence brings the visitor above the entry, then through an offset opening into the next room. | Short half-landings and compressed stair approaches work as ordinary connectors. | Plan underpasses and overhead clearance in section; avoid a globally switched floor layer that moves the other player. |
| **Nested Thresholds** (#38, #12) | Successive door frames, columns and ceilings taper toward a seemingly distant opening. Ordinary fixtures maintain a human scale. | A mostly passive passage with a side branch hidden by the repeated frames. Alter width and headroom gradually, leaving adequate movement space. | A high-frequency connector family. Reuse the shape at multiple scales so it is easy to confuse. | Texture scale must stay consistent; forced perspective should not produce visibly miniature usable doors. |
| **Mirrored Chute Hall** (#4, #10) | A slide crosses a corridor whose reflective planes appear to extend the building sideways. | A dry inspection path passes beside a playable chute; openings reveal real adjacent volumes. | Use repeated glazed openings without mirrors for a cheaper connector variation. | Real mirrors multiply rendering work. Compare a single bounded reflection with duplicated static architecture before choosing this feature. |

### Three spatial studies — before production work

Initial plan-and-section sketches are prepared in the local reference viewer (`spatial-studies.png`). They are original conceptual layouts, not dimensioned production plans. Refine and compare the alternatives below before implementation.

1. **Bellmouth Baths:** draw a plan with two rim doorways, a broad crescent walk and a black-water centre. Draw a section through the entrance and throat showing a high mouth, a sloping tiled envelope and a clear lower recovery route. Compare a wide/shallow bowl with a narrow/deep funnel. Both must read as an oversized fixture from player eye level.
2. **Hanging Changing Rooms:** draw the continuous wet route first, then place suspended wall slabs and dry islands above it. In section, compare a low crouching gap with a full-height water passage. Show where two players can pass and how a player returns from water to a dry ledge. The same module should make several near-identical connectors.
3. **Atrium Channel:** draw the playable stair-and-balcony circuit separately from repeated distant galleries. In section, mark every crossing where two actors could occupy the same horizontal position at different heights. Compare two playable levels with three before committing to the movement changes.

Next planning detail for each study: entrance / midpoint / exit compositions, refined clearances and the repeatable variant. Evaluate the empty room before adding supplies or a resident. Choose one benchmark after this comparison; the present plan does not lock the atrium in as the first build.

### Detailed room briefs: arrival, traversal and departure

These are proposed designs for review. An **exit** below means a normal connection into another room, not the end of a visit or an automatic way down. Room names are authoring labels. No room requires an explanatory wall sign, consumable, new creature or unique movable prop to finish. Dimensions should be established relative to the existing avatar and stock doorway before setting world-unit measurements.

#### Bellmouth Baths

**Core image:** a municipal bath has been built like the inside of an enormous ceramic drain. The tile, doors and fittings remain ordinary in size. The room's envelope is the impossible object.

**Enter.** Approach through a low, dry service passage with an acoustic ceiling, painted skirting and a short strip of the office's carpet. Its last turn hides the room until the player crosses a stock door. A small landing gives enough space to stop or turn a towel cart. Ahead, a faceted tiled bowl descends to a black pool; the ceiling rises several doorway heights above it. A second ordinary door is visible across the bowl at roughly the entry elevation. It is an attainable destination, not a fake painted opening.

**Navigate.** A broad crescent walkway hugs the outer wall. Follow it down shallow steps to an intermediate gallery, pass beneath an overhanging tiled buttress, then climb back toward the far door. The buttress briefly conceals the pool and exit; the next opening reveals both from a lower angle. The route should accommodate two players passing at landings and one player carrying a catalogue chair. No balancing on rail tops or mandatory jumping. An optional side stair descends to a maintenance recess near the water and rejoins the intermediate gallery. Its purpose can simply be a different view; seeded supplies may occupy it without becoming guaranteed rewards.

**Exit and backtrack.** The far door leads into a short ordinary tiled passage, with the next room hidden by a turn. The main circuit works in reverse. Taking the lower detour never removes the upper route. The water has a reachable perimeter shelf and two broad stair returns; apparent depth comes from dark water and the shape below, not an unexplained lethal edge. The deepest throat may sit behind a real, visible drain grille. For the first version, the traversable water pocket is shallow enough to recover without an oxygen mechanic. A deeper version is a separate decision.

**Look and material placement.** Bone-white glazed tiles cover the bowl and faceted walls. Keep the tiles at consistent world scale; use smaller cut courses around the throat so the grout follows construction rather than stretching a texture. The walkway is dull cream non-slip mosaic. A narrow faded sea-green band circles the room and continues behind the buttress. Pool water is almost black green, with a few moving ceiling reflections and a readable shallow edge. Dull stainless rails have mineral deposits at their bases and cleaner hand-contact surfaces. Use one mustard or oxblood service hatch as a small colour accent. The entrance carpet and a standard CRT glimpsed through the maintenance recess anchor the space to the office.

**Liminal and surreal details.** A depth marker at normal reading height appears absurdly small against the bowl. An old waterline circles the walls far above the current pool, passing over an ordinary door frame. Fluorescent housings follow the curve at the same interval despite the rising ceiling. A wall socket exists on an inaccessible tiled face. Nothing calls attention to these details. The room remains largely bright: the unnerving darkness is concentrated in the throat and under the gallery. Pump hum arrives from below; a drip has a long tail, while the entry passage sounds dry and close. These are proposed sound treatments, not observations about the source audio.

**Resident and variants.** Default: empty. A later encounter can use the gallery after movement and creature-height support are proven, but the first impression must work alone. Reusable variants change the bowl's eccentricity, rim elevation and buttress position. A small shallow version can be a quiet connector. Do not give every variant a new statue, special colour or puzzle. The wide/shallow and tall/narrow versions should use the same material family.

#### Hanging Changing Rooms

**Core image:** a changing suite continues above a water network, but whole tiled wall slabs stop before reaching the floor. Ordinary tiled partitions become enormous suspended masses.

**Enter.** Start in a familiar short changing bay with one bench, ordinary hooks and a dry tiled floor. A turn reveals moving water through a continuous dark slot beneath the next partition. Only a few steps later does the player see its underside and understand that the wall hangs above the wet route. The initial view should contain several near-identical bays rather than a complete floor plan.

**Navigate.** A continuous dry route winds around the ends of the wall slabs, joining broad platforms and shallow steps. It branches twice: one branch returns to a previously seen bay; the other progresses to the far service passage. Short wet cuts pass beneath selected walls and rejoin the dry route after one bay. Their openings have enough clearance for the existing crouched avatar, with air above the shallow water. A darker slot that is too small to traverse is visibly narrower and physically closed; it must not look like a valid route. The player can glimpse a companion's feet across the water before seeing them around the next partition.

**Exit and backtrack.** The exit is another plain dry changing bay. It has a real passage beyond it, revealed on approach, and a stock doorway into the next room. Avoid a glowing unique portal that announces the answer from the entrance. Every wet shortcut has low steps at both ends. A continuous return route exists from every water cell; currents are decorative or gentle enough to walk against in this first version. The room's internal loop should cause uncertainty without becoming a softlock or an endless forced circuit.

**Look and material placement.** Slightly green ivory glazed tile on the slabs; a dark bottle-green lower course wraps their undersides. Dry platforms use pale buff mosaic, while channel beds use a darker version of the same tile. Clear water at the edges becomes opaque beneath the walls. The ceiling is a low, repeated grid of stained acoustic panels interrupted by tall slots above some hanging slabs. Teal enamel lockers, cream shower fittings and rubber door strips recur with very few variants. Their scale stays normal. Restrained mineral streaks follow bolts and pipe joints; most wall area stays clean. A handful of repairs uses almost-but-not-quite matching white tiles.

**Liminal and surreal details.** Two separated bays contain the same bench, hook spacing and blank cabinet door. A towel hangs at an ordinary height beside a water route with no plausible standing floor. Pipes enter a slab and emerge from its underside much farther away. Some suspended partitions disappear into the ceiling while another ends well below it. Light from a bright bay is visible under a wall even when the route around it is dark. A shower runs audibly out of sight, with no need for an apparition. Keep actual source direction local and consistent; do not use arbitrary sound jumps to disguise the map.

**Props and interaction.** One dirty towel cart sits on a generous dry landing, registered through the normal movable system. Towels sag over its mesh sides; the wheels show damp tracks. It may be useful as a barricade if a roaming resident enters, but never blocks the only exit by default. Benches that are bolted to the architecture have visibly bolted construction; catalogue loose chairs retain the same movability as everywhere else. No new collectible is needed to use the shortcuts.

**Resident and variants.** Default: empty connector. A global roaming creature may encounter it under the normal rules after clearance is verified. Repeat this family often with rotated layouts, different raised bays and changed wet cuts. Repeated objects can confuse memory, but copy-pasted crack textures should not become an obvious rendering pattern. Large variants need passing platforms for co-op; narrow cuts never require one player to lock the other out.

#### Atrium Channel

**Core image:** an office circulation space has stretched into a tall indoor ravine. Familiar doors, rails, ceiling panels and windows repeat on stacked galleries above a narrow channel.

**Enter.** Approach through an ordinary office vestibule and emerge on a middle gallery. A slight bend and a structural column hide the full void until the player steps onto the balcony. The first view reveals water well below, repeated galleries above, and a doorway across the atrium one landing higher than the entrance. The destination is visible, while its connection is initially obscured by overlapping stairs and supports.

**Navigate.** Follow the gallery to a descending stair, pass a windowed office recess on the lower landing, then cross a broad bridge above the channel. On the other bank, climb two staggered flights to the visible exit. Midway, a return view shows the original entry through the structure, helping the player understand their vertical progress. An optional gallery spur loops through an empty office and rejoins the approach to the bridge. Keep the first playable version to a defined two- or three-level circuit; further galleries may be visible, but accessible-looking doorways must have real routes or clearly closed grilles. Do not sell an apparent exploration path that ends at an invisible barrier.

**Exit and backtrack.** The exit passes through a low office corridor where the close ceiling abruptly restores the familiar scale. It connects to another room through a normal doorway. The main circuit is reversible. Water below the bridge leads to shallow recovery shelves and stairs on both banks; dropping down creates a longer return, not an unannounced run-ending fall. Additional swim shortcuts should wait until independent swimmer support works in co-op. Railings are real geometry and collision; an apparently solid rail must not let the player fall through it.

**Look and material placement.** Warm cream painted concrete and repeated beige office panels form the galleries. Pool tile climbs the channel walls and continues several metres above any plausible splash height. The lower tier has dark teal skirting and mineral marks; the upper tier has dry carpet fragments and wood-laminate counter edges from the office catalogue. Narrow bands of wired glass separate circulation from empty offices. Rails are dull green-grey painted metal with worn top edges. Use a limited number of burgundy doors or mustard seats across all floors, repeated instead of unique colour coding. The water is dark olive green under the bridge and faintly readable near the steps.

**Liminal and surreal details.** A standard ceiling grid continues up a steep soffit. A row of normal windows frames another interior wall almost against the glass. Stairs appear to terminate inside a floor slab from one angle, but reveal a proper opening when approached. Far above, the same office door/window module repeats without a grand architectural climax. A single fluorescent bank lights a high empty landing that has no visible purpose. Daylight-like illumination enters through frosted roof panels without offering a view of outdoors. Most upper levels are softly lit; the underside of the bridge and deep recesses need the camcorder or flashlight.

**Sound, props and residents.** Use a persistent channel sound below and a distant electrical buzz above; crossing under the bridge briefly dulls the room. One reachable waiting-chair group and one office desk provide scale. A cart belongs on a wide landing, clear of the stairs. The first architectural study has no resident. If a physical creature is later added, it must use the same stair circuit, respect railings and attack only when vertically close. Co-op players on different levels must retain independent support, sightlines, item drops and damage checks.

**Variants.** A short gallery overlooking a deep slit can recur as a connector. The complete tall atrium stays rare. Vary bridge position, visible upper repetition and which bank holds the stair, while keeping a validated main route. Do not add an arbitrary gate or keycard simply because this room is large.

#### Supporting briefs for the other five concepts

| Room | Enter | Navigate | Exit / recovery | Look and uncanny detail |
| --- | --- | --- | --- | --- |
| **Flume Knot / Drain Shaft** | A cramped service gallery opens onto the rim of a deep shaft with tube mouths on several levels. A small boarding stair makes the usable entry recognisable. | Crawl through an interrupted arc of tubes, with portholes showing the same shaft from changing heights. One reachable junction offers a dry continuation or the existing committed slide descent. | Dry stairs reach the ordinary onward doorway. The slide lands in a lower collection basin with a visible stair return to that onward route. A cul-de-sac tube ends in a visible cap, never a hidden collision plane. | Yellowed fiberglass, faded coral/blue sections, dark rubber collars, dull steel supports and cream tile. The same numbered maintenance collar repeats at distant heights; a normal office window looks directly into a tube's side. Keep the vertical shaft as the dominant composition. |
| **The Remaining Floor** | A low office door reveals a broad low-ceilinged volume with most of its floor absent. Familiar ceiling lights continue across the gaps. | Follow a branching network of broad tiled causeways. One loop returns to a similar-looking platform; side islands are optional. Rail fragments and tile edges reveal the floor outline without painting a route. | A peripheral platform contains a normal doorway. For the first version, dark gaps contain a lower shallow service floor with steps back up at several points. Reserve genuine lethal pits for a clearly signalled later variant. | Buff non-slip tile, dark painted slab edges, muted teal water below and a ceiling that feels too close for the room's width. Repeated ordinary light fixtures and chair groups make the geometry hard to memorise. Avoid importing the source's cross motif as an unexplained theme. |
| **Misjoined Stairwells** | A small carpeted lobby reveals a stock stair flight and a tall slot beside it; the next landing is visible through an oddly placed window. | Follow interleaved flights through alternating low soffits and tall voids. One side landing returns through a short corridor; the main sequence emerges above the entry. No precision jumps or compulsory ladders. | A plain landing door leads to the next room. Missing or non-route flights are closed by visible rails or grilles. The main sequence remains reversible and has room to pass at landings. | Cream institutional paint, green-grey rails, worn vinyl treads, rubber nosings and wired glass. Skirting follows a rising floor at an implausible angle. Fluorescent fixtures repeat as if several stairwells were combined without agreeing on floor heights. |
| **Nested Thresholds** | A normal changing-room doorway frames several more openings, all apparently leading toward a distant brighter wall. | Walk a tapered corridor whose walls and ceiling change proportions. A shallow side branch is hidden behind a repeated frame, then rejoins farther on. Automatic crouch occurs only where the visible clearance requires it. | A normal-size doorway beyond a final turn leads onward. Frame spacing and sightlines make distance uncertain; actual movement speed and player scale stay constant. Backtracking uses the same static geometry. | Pale green-white tile, dark green door frames, long quiet grout courses and identical ceiling panels. Ordinary sockets and hooks anchor scale while the architectural intervals stretch. Most versions have no props, resident or sound event. |
| **Mirrored Chute Hall** | An ordinary inspection passage reveals a broad slide crossing into what looks like another wing through glazed or reflective panels. | Use a continuous dry gallery; an optional chute reaches a lower landing on the same route. At one bend, a view through glass establishes that at least one apparently reflected space is real. | The dry gallery reaches an ordinary service door; the slide landing has a clear stair return. Reflections never substitute for a real visible doorway or hide the only route. | Tired yellow/coral fiberglass, smoked or wired glass, dark gasket strips, stainless collars and restrained fluorescent reflections. Begin the design with actual duplicated architecture. Treat a bounded live mirror as an optional rendering experiment, not a dependency. |

### Detailed material and atmosphere schedule

This is a proposed look specification, not a claim that all shader features already exist. Match the office's voxel scale and existing texture treatment. Large silhouettes use faceted or stepped geometry; detailed wear belongs mostly in reusable textures. Maintain a consistent tile size and texel density across surfaces, including curves. Inspect close-up geometry and distant VHS output: fine grout, repeated slats and water highlights must not shimmer or produce moire.

| Surface / asset | Desired appearance | Placement and variation | Contribution to the space |
| --- | --- | --- | --- |
| **Glazed wall tile** | Warm ivory or very pale green ceramic, thin subdued grey grout, small glaze differences | Main pool/changing walls; use a few repair patches rather than random colour per tile | Familiar public-building construction makes the distorted envelope credible |
| **Funnel tile courses** | Smaller ceramic pieces following facets with deliberate cut rows | Around Bellmouth's throat and curved transitions; no stretched square texture | The tile grid describes the room bending inward |
| **Non-slip floor mosaic** | Matte buff, cream or muted grey-green squares; low contrast and slightly rounded edge treatment | Walkways and dry platforms; edge pieces wrap the lip | Distinguishes safe walking surfaces through material and construction |
| **Wet floor variation** | Darker local tile, soft broken highlights, shallow puddles gathered at joints | Near steps, drains and towel carts, fading into dry approaches | Suggests recent use without requiring a person to appear |
| **Skirting / trim tile** | Dark bottle-green or brown-black ceramic band | Continues beneath hanging walls and around normal corners; occasional impossible elevation | A normal architectural rule persists where the room no longer makes sense |
| **Water** | Dark olive/green-blue body, readable shallow fringe, restrained reflection bands and small ripples | Under walls, in bowl throats and channels; light changes by location | Hides depth while leaving edges readable; avoid a uniform neon surface |
| **Mineral deposits** | Chalky cream streaks, muted brown at fasteners, irregular tide edges | Below pipes, at rail feet and along selected historic waterlines | Records a different water level; one high line can contradict the present room |
| **Painted concrete / plaster** | Institutional cream, pale mint or grey; broad dry areas with sparse peeling | Atrium soffits, structural backs and service passages | Preserves a maintained-but-empty appearance rather than universal ruin |
| **Acoustic ceiling** | Existing office panel language, off-white grid, selective stains and missing panels | Dry approaches and galleries; repeated panels can follow stepped or sloped soffits | Carries office familiarity into a building that has changed scale |
| **Fiberglass flumes** | Faded mustard, coral, blue or teal; dull broad sheen, scuffed inner bends and visible seams | Flume Knot and chute branches, with a limited palette per family | Cheerful leisure equipment becomes uncomfortable through scale and placement |
| **Metal rails and hardware** | Dull stainless or green-grey paint; mounting plates, bolts and hand wear | Real path edges, steps, cart frames and pipe supports | Provides human scale and dependable physical boundaries |
| **Rubber** | Charcoal matte strips, compressed gaskets, worn stair nosings | Door bottoms, tube joints and thresholds | Separates materials and helps the room feel assembled |
| **Glass** | Wired, frosted or lightly smoked; some streaks and restrained reflections | Booths and office windows; keep most panes visibly opaque or translucent enough for their role | Offers partial knowledge of adjacent spaces without revealing the whole map |
| **Carpet and laminate** | Reuse the real office's worn carpet and wood-laminate vocabulary | Small dry entrance patches, office recesses and counters | Makes the pool area feel connected to the same building |
| **Towels** | Off-white, grey, faded rose or institutional green; folded and sagging stacks with dark damp edges | A few baskets, hooks and movable carts; avoid identical perfect cubes | Evidence of interrupted ordinary use |
| **Paper, notices and depth markers** | Small practical lettering, faded ink, grubby plastic sleeves, old adhesive shadows | One or two plausible places per major room; repeat standard rules across a wing | Dry humour comes from placement: a shallow-depth marker beside an enormous throat, or a closure notice beside running water |
| **Fixtures and props** | Existing office desk, CRT, chair, extinguisher cabinet and switches, kept at stock scale | Sparse clusters where a real person might have waited or worked | Measures the architecture against recognisable everyday objects |

**Working palettes.** Bellmouth: bone-white tile, cream deck, sea-green trim, black-green water and a small warm service accent. Hanging Changing Rooms: green ivory tile, bottle-green underside, buff platforms and subdued teal lockers. Atrium: warm cream concrete, beige panels, green-grey metal, dark teal lower walls and repeated burgundy or mustard accents. These are families, not a different colour theme for every seed. Some flumes can retain bright colour; the unusual geometry must still read when colour is removed.

**Wear placement.** Most surface area remains intact. Concentrate wear where use, water or structure explains it. Avoid covering every surface in cracks, slime, random noise or graffiti. Reserve one deliberately impossible stain or repeated defect for a large space; repeating the exact damage atlas everywhere will look unfinished rather than uncanny. Wall/floor seams, tile returns, rail mounts and thresholds should be finished even when the structure is absurd.

**Lighting.** Keep many rooms uncomfortably bright and empty. Fluorescent banks repeat with mundane spacing; an occasional dead bank creates a useful dark pocket. Deep throats, wall undersides and bridge soffits receive much less light. The flashlight should reveal local detail and depth, not brighten the entire chamber. Frosted roof light can imply daylight without showing a real outside world. Wet reflections are subdued and follow nearby fixtures. Avoid spotlighting every doorway or bathing the whole deck in cyan. Emergency lighting remains a rare variation, not the default identity of these rooms.

**Sound.** Proposed palette: distant circulation pumps, local trickles, a pipe ping, a running shower behind a wall, electrical buzz and footsteps that change between dry tile, wet tile and carpet. A large volume has a longer apparent tail than a compressed service passage. Keep enough quiet that a single local sound matters. Use actual source positions and occlusion where supported; do not promise a reverb system before checking implementation. Avoid a mandatory musical sting or whisper in every room.

**Liminal composition.** Show traces of a routine that should be occurring: a waiting chair, a shower still running, a towel cart midway through a corridor, a bright office window with nobody behind it. Leave most of the space empty. Ordinary fittings preserve human scale while walls, voids and routes violate it. Repeat bays, doors and repair styles across several rooms. Hide the destination temporarily with real structure; reveal a changed view when the player moves. Keep exits mundane so leaving a spectacular room feels like continuing through the building rather than completing an attraction.

**Surreal rules.** Each family has a structural contradiction that recurs: the room becomes a drain; walls hang above their floor; circulation stacks into a ravine; door frames stretch a corridor. Secondary contradictions can reinforce it: a high waterline, an outlet on an inaccessible face, a window against another wall, a ceiling grid continuing up a soffit. Keep the geometry static until a particular moving-space mechanic is intentionally designed. No forced camera roll, arbitrary speed changes or generic monster props are needed to communicate the effect.

### Route and visual acceptance notes for later implementation

For each layout, trace entry to exit, exit back to entry, every optional branch, and recovery from water or a fall. Measure the main route and plausible wandering time against the existing camera battery economy before expanding level length. Keep the two-player route open when one person is in a low passage or on another floor. Check a carried chair/cart, dropped inventory, crouch transitions, flashlight sightlines and potential creature approaches. Compare entrance / midpoint / exit views with creatures and supplies hidden. A room should remain convincing in that empty state.

All three main candidates need a normal generator doorway at either end, a documented elevation transition inside the room, and deterministic variants that preserve a valid route. If a draft needs new multi-level support, mark that dependency explicitly. Do not flatten the architecture to bypass a collision problem, or silently replace a visible path with decoration. Room geometry, head clearance and movement need to agree.

### Proposed deck rhythm

A starting composition for discussion is **70% quiet connectors, 20% spaces with a route choice, 10% major features**. On a thirty-room part that would be roughly 21 / 6 / 3, subject to generation constraints and later playtesting. These are not code changes or fixed encounter weights.

Quiet connectors can be tapered, suspended, faceted or split by water. Repeat a small set of architectural families across a part, with changes in headroom, orientation, waterline and lighting. A bright empty room can follow a dark compressed passage. Major features should have stretches of quieter space between them, with variable spacing rather than a predictable repeating schedule. Do not add a monster or puzzle to justify every unusual shape.

Movement choices should create uncertainty without turning exploration into a precision platformer: long dry route versus short wet route, high visible destination versus low approach, or repeated landings that obscure the return path. Essential progress should not depend on having a rare consumable or moving a uniquely marked prop. Dangerous shortcuts should have readable entry conditions and a defined way to recover.

### Technical scope to settle during planning

**Static architectural changes:** tapered walls, faceted funnels, curved or stepped envelopes, deep visual voids, repeated balconies and suspended slabs can use existing geometry tools. Batch repeated pieces and restrict transparency. Their actual cost still needs measurement, especially when two connected rooms are alive.

**Multiple walkable levels:** the inspected branch exposes `world.floorY(x,z)` and room `floorY(x,z)` as a single resolved height. The current Flume Knot uses a room-level `lowerLatched` state to select its floor layer. That is insufficient for independent actors occupying upper and lower routes at once. Before committing to freely traversable stacked spaces, design support selection using the actor's feet/height, distinguish ceilings above the selected surface, and check navigation, contact attacks, dropped items, furniture and co-op snapshots against it. Keep other rooms on a compatible default path. These are scoped follow-up requirements, not a movement implementation in this pass.

**Actual spatial discontinuities:** looping connections, portal views, changing gravity and recursive mirrors require separate decisions. The first geometry studies can achieve a strong impossible appearance using stable Euclidean spaces. If a selected concept needs a fold, define exactly when it occurs and how both players and moved props cross it; do not imply that a visual trick alone solves those systems.

Before implementation, resolve: which of the three studies establishes the benchmark; which vertical routes are genuinely walkable; how wet-route recovery works; which architectural families recur most often; and how much reflection is worth its rendering cost. No final decision is needed on new creatures yet.

## First implementation: Flume Knot

- Solid fiberglass replaces transparent tube shells. Rounded junction chambers replace square cages, retaining the measured crawl paths.
- A restrained mustard, teal and oxblood palette replaces the rainbow. Scratches and mineral wear are procedural; no image dependencies.
- Cream ceramic dado, stained plaster, a high old waterline, service pipe clamps, coping drains and stair tread inserts establish a constructed place.
- Working and dead fluorescent fittings replace the blanket light layout. The lower service light and far gallery are subdued; the water ribbon no longer lights itself.
- An abandoned catalogue desk/CRT and a dirty towel cart connect it to the office. The cart registers with the existing trolley grab system.
- The giant sixteen-ring/noodle tower and three competing murals are removed. A few stored rings remain. The upward flume and boat are the main impossible image.
- The enemy-mechanic sign is replaced by a worn ordinary flume notice. No creature strategy is explained on the wall.

This is an initial art direction pass, not a claim that the slide is finished. The entrance view was inspected in Chrome. Close-up tube seams, the moving boat's reset, and the lower hall still need a continuous visual playthrough; native browser input was interrupted by activity in another Chrome window. Controller tests cover traversal separately.

## Room decisions

The following is an authoring/source audit, supplemented by browser views of the Flume Knot and lazy river. The shower review landed against a partition; that is insufficient evidence of its full composition. None of these rows represents a completed visual playtest of all seeds.

| Room | Keep | Work before release |
| --- | --- | --- |
| Flume Knot | Suspended crawl maze, split upper/lower routes, upward flume | Finish close-up shell seams, slide entry/exit framing, creature readability in opaque tubes, landing camera and sound. Current branch starts this work. |
| Return Pool | Repeated changing tunnel, overhead pool, circulation valve, hotel details | Use as a spatial reference, not an automatic pass. Verify the fold without instructions, both approaches, wet/dry lighting and silhouettes beneath the overhead water. |
| Surge Basin | Warning–surge–refuge rhythm and sloping beach | Rebuild the rectangular crest as a faceted water front with moving foam. Give caissons depth and a convincing warning sequence. Make shelter readable before the first hit. |
| Lazy River | Circulating canal and chair/lifeguard creature | Rebuild the space around partial views of the island. Remove duplicate visual spectacles and reduce water-pattern contrast. Make its silhouette readable before its transformation; check current and escape cues. |
| Diving Well | Submerged partition and air pocket | Build depth through attenuation, lane markers, submerged furniture and surface reflections. Avoid an evenly illuminated aquarium. Resolve the per-player swim support contract before co-op. |
| Drain Spa | Reversible current and tempting drain descent | Cut the simultaneous hanging furniture, ring tower, multiple siphons and murals to one dominant anomaly. Establish normal pump hardware and worn hydrotherapy fittings first. |
| Toadstool Lagoon | Child-height scale and apparently occupied floats | Finish the mushroom, quieter pool edges and approach. Reduce the number of visual gags; give a few floats credible motion and danger. Wire the richer snip rules before claiming the encounter complete. |
| Locker Showers | Repeating stalls, steam and mixing valves | Make an actual changing suite: benches, drains, lockers, pipe runs and wet/dry transitions. Show the valve's consequence through steam and hardware. Avoid putting every oddity in every bay. |
| Plain connectors | Repetition, lost bearings, occasional low/high openings | Highest shared priority after the feature-room benchmark: replace the universal blue skin with a small repeated architectural kit. Most have no creature or spectacle. Keep recognisable navigation shapes, but vary maintenance state, headroom and sound. |

## Release bar

1. Walk the whole route at player eye level: every doorway, low opening, edge, water transition and exit. No repair flattening, paper-thin solids, flickering surfaces or surprise invisible barriers.
2. Inspect each asset close enough to grab it. Consistent voxel scale, deliberate materials, appropriate pivots, and shared movability for shared furniture.
3. Each feature has a readable route and interaction within an unsettling architectural composition. Verify the effect with props and creatures hidden as well as in the finished scene. Test with someone who has not read its code or review notes.
4. Listen through a complete visit. Water, warning signals, room reverb and silence must carry information; current screenshots were reviewed muted.
5. Verify creature damage/cooldowns, difficulty, fire, furniture and journal integration. Pure-rule tests alone do not prove the live room wiring.
6. Verify two players, shared valves, slides, fold state and independent swimming before co-op exposure. This branch remains a single-player study.
7. Measure frame time and transparency cost on an ordinary laptop, including adjacent active rooms. No performance claim from successful compilation.

A smaller release of a few finished features and convincing repeated connectors is preferable to enabling the entire draft deck. The architecture studies above now precede further implementation. After choosing a benchmark, derive its connector family and use that standard to revise the existing rooms individually.

## Validation of this pass

The focused 53-test waterpark set checks real-controller traversal in four slide rotations, automatic crouch, dry upper tubes, lower landing and escape, last-floor fallback, supported supplies and generated floor reachability. Render attributes are now checked for finite values independently of navigation. These checks are technical evidence, not an art-quality score.

Results: 53/53 focused tests pass; static production build passes (292 files). Full suite remains 979/982, with the same three unrelated Office failures recorded in the integration note: the `/var` versus `/private/var` console path check and its parent, plus the usage/status-line undefined `source`. The subsequent junction/dado adjustments were rechecked with the focused set and rebuilt. No branch was pushed and nothing was deployed in this pass.
