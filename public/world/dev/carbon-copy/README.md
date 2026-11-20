# Carbon Copy

A local WebGL puzzle using the BlockRooms furniture and voxel mesher. Start it with `node tools/blockrooms/carbon-copy-lab.mjs` from the repository root and open `http://127.0.0.1:4386/`.

Scan a donor or type an object. Choose the feedstock and destination, then make a copy. A copy keeps its blueprint's traits and gains its donor's behavior and a physical detail. The scale needs weight and the acoustic receiver needs a ring at the same time. The test track shows rolling objects. Printing over a pad replaces its previous object. Reset clears the lab, including an in-flight transfer.

There are 14 offline shapes. They accept colors, size, traits, and a second shape joined with “with”. Unlisted requests use the loopback model when available, or the browser's Prompt API when its model is already installed. Both produce a small recipe using fixed bodies, fittings, colors, and behaviors. Cached recipes last for the current session.

For local inference, start a llama.cpp server on `127.0.0.1:4387` with an instruction model that supports JSON schema output. Set `CARBON_COPY_MODEL_KEY_FILE` in the lab process to the model server's key-file path if using authentication. The lab also accepts `CARBON_COPY_MODEL_PORT` and `CARBON_COPY_PORT`. Fallback catalog play works without a model.

One instanced draw carries up to 512 sampled surface voxels. Clipping planes peel the donor and reveal the destination. Transfers use fixed stations and replenishing stock for repeatable experiments. The Pirate combat proposal is in `docs/CARBON-COPY-COMBAT.md`.
