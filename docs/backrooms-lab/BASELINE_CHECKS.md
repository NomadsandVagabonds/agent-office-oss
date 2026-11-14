# Kit verification — 14 November 2026

Source snapshot: `e81f634a15ce7a3dafd27c5c092c587963d82d16`.

- `node --test test/backrooms.test.mjs test/vox.test.mjs`: **20 passed, 0 failed**.
- `node --check tools/backrooms-offline/preview.mjs`: passed.
- Extracted archive: all **319 source-file SHA-256 hashes** matched the manifest.
- Source export contains no `.git`, runtime `data/`, knowledge or transcripts.
- Launched the packaged static server from the extracted kit, without the Office
  daemon. Headless Chrome with software WebGL loaded the preview at seed 713,
  generated 18 rooms, rendered the scene, and responded to a held movement key.
- That preview emitted no JavaScript errors or room-build warnings. All observed
  resource requests went to its local preview origin. No live Office API was used.
- Return helper: unchanged source produced no changes; a modified file, a new
  file and a deleted file were identified correctly. A sample runtime-data file
  was excluded. These checks ran on a disposable copy, not the shipped snapshot.

This verifies the starting kit, not the unbuilt Carbon Copy room. The complete
repository test suite was not run for this documentation/packaging change.
The contributor must report validation of their own additions separately.
