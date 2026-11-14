# Inventory visual studies

Open `/world/dev/inventory-studies.html` on the local dev/static server. The
three switches apply isolated CSS to the actual inventory HUD. Inspect, Craft
and Pockets reset the same sample contents for comparison.

1. **Office equipment:** forest enamel, brass keys, label tape and Pixelify
   lettering. An unframed voxel prop sits beside its equipment description.
2. **Found property:** a paper form with a photocopied specimen, blue ink and
   brick-red annotations. Six pockets share one ruled strip.
3. **Through the lens:** a translucent camcorder readout, bitmap lettering,
   cursor triangles and selection brackets. More of the room stays visible.

The normal game and crafting implementation are unchanged. This page stops
its embedded stage clock after arrival so a visual review cannot exhaust the
camera. Native item actions still use the existing inventory controller.
The preview's resize handler redraws the held scene without advancing time.

Prop thumbnails are generated once from the actual Office voxel models, then
used as transparent images. No generated artwork, external fonts or network
assets are required. Each CSS skin is scoped to its own `data-study` value.

All three directions were rendered with both the inspection and crafting
panels. Desktop and 390×844 checks cover visible controls, two ingredients,
six slots, native inputs, responsive sizing and browser errors. Paper uses
some upper letterbox space on phones; the other two compact into the picture.
The date is hidden while any study panel is open on a narrow screen so it
cannot show through the crafting controls. This is a visual proposal only;
the selected direction can be folded into the normal HUD afterward.
