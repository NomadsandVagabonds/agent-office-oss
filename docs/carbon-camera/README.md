# Carbon Camera playtest

Pick up the beige instant camera on the desk. Photograph a piece of furniture, choose a clear patch of floor and print a slightly wrong twin. The four-drawer filing cabinet can come out with five drawers. The desk can be turned across a doorway and moved again by hand.

[Watch the desk and cabinet playtest (25 seconds, MP4)](desk-and-cabinet.mp4).

## Run the study

From the repository root on this branch, run `node daemon.mjs` with Node 20 or later. Open the [seed 7 copy room](http://localhost:4317/world/dev/backrooms.html?chairstudy=1&seed=7&themes=yellow&count=1&depths=1&pursuer=0&cast=none&graphics=high&vhs=1). The room runs locally and uses the game's existing renderer, movement, inventory and furniture collisions.

1. Press **E** by the desk to pick up the camera. Hold the mouse button or **X** to raise the wire finder.
2. Center the sight on the cabinet and press **E**. The shutter flashes and the photograph comes out of the back. Lower the camera and carry that exposure elsewhere if you like.
3. Aim at the floor. A mint hologram means the object fits. **R** rotates it a quarter turn. Press **E** to lock the landing and print.
4. Photograph the same original again and place the second print. The first exposure leaves the original solid. The second successful placement consumes the original and leaves both twins. An invalid placement spends nothing. Finished prints cannot themselves become sources.

Each print costs one camera charge. Battery packs recharge the camera through the inventory. The camera starts with four charges. The Copy lab drawer lets you choose a specimen and one of four defects. The [Polaroid catalogue](http://localhost:4317/world/dev/chair-copy/contact-sheets.html) shows the stock. Press **B** in the room to run the repeatable frame-time benchmark.

## For the build team

The pickup and hand models are in `public/world/backrooms/carbon-camera.model.js` and `hand-carbon-camera.js`. The in-engine study is in `public/world/dev/chair-copy/`. Start with `study.js` for the scan, placement check and commit rules, `editions.js` for defects, and `transfer.js` for the single instanced swarm of up to 1,536 cubes. `positive.js` draws the photo from the same stock. The seed 7 benchmark on an Apple M4 Max measured a median frame of 16.7 ms during a transfer. Other devices need their own measurement.

This is an opt-in dev room. It takes an explicit source catalogue, detects nearby floor pickups, and registers printed objects with the furniture system. The earlier typed-object sketch lives separately in `public/world/dev/carbon-copy/`. Enemy copying is a [design proposal](../CARBON-COPY-COMBAT.md).

The next puzzle to test is a door on the ceiling. Photograph it from below, print an upright doorway on the carpet, then walk through to the room already assigned to the original door. A printed doorway needs to retain its destination and provide a safe arrival on the other side.
