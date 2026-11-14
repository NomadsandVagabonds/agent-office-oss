# Inventory visual studies

**Selected: 3 — Through the lens.** Its camcorder treatment now ships in the
normal `inventory=1` prototype through `backrooms/inventory-style.js` and
`backrooms/inventory-icons.js`. Inventory and crafting behavior is unchanged.

Open `/world/dev/inventory-studies.html` on the local dev/static server. The
three switches apply historical CSS skins to the actual inventory HUD, over
the preserved `reference-style.js` base. Inspect, Craft and Pockets reset the
same sample contents for comparison; these switches do not change the style
used by the ordinary game.

1. **Office equipment:** forest enamel, brass keys, label tape and Pixelify
   lettering. An unframed voxel prop sits beside its equipment description.
2. **Found property:** a paper form with a photocopied specimen, blue ink and
   brick-red annotations. Six pockets share one ruled strip.
3. **Through the lens:** a translucent camcorder readout, bitmap lettering,
   cursor triangles and selection brackets. More of the room stays visible.

This page stops its embedded stage clock after arrival so a visual review
cannot exhaust the camera. Native item actions still use the existing
inventory controller. Use `/world/dev/backrooms.html?inventory=1` for the
selected production style with running world and camera clocks.
The preview's resize handler redraws the held scene without advancing time.

Prop thumbnails use the production icon renderer: actual Office voxel models
rendered once into transparent images, with the SVG fallback retained when
WebGL rendering is unavailable. No generated artwork, external fonts or
network assets are required. Each historical skin is scoped to its own
`data-study` value.

All three directions were rendered with both the inspection and crafting
panels. Desktop and 390×844 checks cover visible controls, two ingredients,
six slots, native inputs, responsive sizing and browser errors. Paper uses
some upper letterbox space on phones; the other two compact into the picture.
The date is hidden while any study panel is open on a narrow screen so it
cannot show through the crafting controls. These three historical alternatives
remain available for comparison after promoting the chosen direction.

The production camcorder style additionally uses the upper letterbox for its
open menu on portrait phones, with REC and camera power in a separate strip
above it. This adaptation was verified in the ordinary live game at 390×844
and 390×667, including long error feedback and native touch/keyboard controls.
