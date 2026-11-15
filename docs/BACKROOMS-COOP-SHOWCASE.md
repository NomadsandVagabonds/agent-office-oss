# The long way round — revised route

**Prepared locally; not live.** The owner reserved floor 4 for Gemini's waterpark
and combined the old floors 4–5 into a new floor 5. Gemini's waterpark is still
uncommitted work in `agent-office-backrooms-lab` on `gemini/waterpark-level`.
Those files have not been copied, edited or merged here.

The new tour cannot be started until the waterpark is integrated and tested.
The selector marks it as coming soon, and the relay rejects requests clearly
instead of silently substituting a yellow office floor. **Somewhere new** remains
playable. The hosted Railway release is still `bb4551a`.

## Authored sequence

| Part | Place | Discoveries | Cast |
| --- | --- | --- | --- |
| 1 | Yellow offices | Moving cutouts, cake/party room, chairs, ceiling meeting, Blackout Bay, Dispatch | Pirate, night porter |
| 2 | Unfinished offices | Quiet Zone, Mailroom, Copiers, keyboard floor, Return Plenum | Waste Toner |
| 3 | Suburbia | Show Home, The Close, Back Garden, lemonade, Model Village, Walk-in | Desk moth |
| 4 | Waterpark | Reserved for Gemini's finished version; selection and co-op behavior still to review | Pending |
| 5 | Night offices | Cover, Many Doors, ceiling plants, MECHA, Last Light, Unsure Hall | Other Door, shadow |

The pirate remains on floor 1. The finale already has the MECHA warden and
lamplighter as room residents, so it does not repeat the pirate on top of them.
The phone, vending, team-photo and Stress Pool stops are omitted from the
combined stretch. The earlier three floors retain their authored selection.

The finale's standalone review has **six feature rooms in 32 rooms total**,
**78% ordinary maze**, and two large landmarks. Even the shortest path between
MECHA and Last Light includes two ordinary rooms. No feature rooms are directly
adjacent. Cover adds a puzzle; Many Doors and ceiling plants provide smaller
unsettling discoveries. Unsure Hall remains on the way to the final exit.
Earlier floors teach the rules Last Light and Unsure Hall expect.

Normal generator calls still permit only one large set piece. The authored
finale asks for `setPieces: 2`; the bounded exception does not change ordinary
visits. Final geometry must be rechecked with the complete waterpark route,
because prior floors also contribute lesson and cast context.

This is a curated selection, not the full 53-room catalogue. Side branches can
still be missed. Normal health, camera power, crafting, trading, revives,
lighting, furniture and voice rules remain. There is still no save, reconnect or
host migration, and the host tab must remain visible.

## Files and verification

- `world/coop/showcase.js`: authored schedule; pending slot at index 3.
- `core/coop-routes.mjs`: route label, seed, lifetime and explicit pending reason.
- `world/coop/showcase-preview.js`: isolated review of a ready floor without
  pretending the waterpark is available. It never creates a public invite.
- `plan.js` forwards the optional per-floor set-piece cap to `gen.js`.
- `node --test test/coop*.test.mjs`: layout, cast, lesson prerequisites, unchanged
  one-landmark default, opening pirate/cake/cutouts, and unavailable-tour handling.
- `node tools/blockrooms/coop-content-check.mjs --finale`: both clients build
  the six-room finale, verify streamed scene state and render it without browser
  errors. Measured initial snapshot: approximately 271 KB. This is a build and
  replication check, not a human playthrough of every encounter.

Full suite: **876/879 pass**, with the same three unrelated Office console and
status-line failures as before.

The prior layout completed a five-floor two-client run at `c3523d5`. That result
does **not** establish that the pending waterpark route is playable.

## Integration checklist for the finished waterpark

1. Integrate Gemini's reviewed commit; select its showcase rooms and inhabitants.
2. Replace the pending fourth slot with that selection. Check water movement,
   slides, hazards, creature targeting, shared state and descent for both players.
3. Clear `SHOWCASE_PENDING` only after the complete visit builds and plays through.
4. Recheck quiet-room ratios, landmark separation, supplies, all transitions and
   final extraction with the revised route; run the full regression suite.
5. Prepare a fresh Railway artifact and obtain publication approval.
