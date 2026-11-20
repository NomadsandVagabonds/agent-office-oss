# Carbon Copy — quantum damage

Design idea for a later BlockRooms combat playtest. The returns-office demo explores object copying and inherited traits.

Copying costs the original some of its integrity. On an enemy, a successful copy briefly stuns the original and halves its health. The player chooses where the strange copy materializes. Both surviving enemies can pursue and hurt the player. Printing one beside you can turn a manageable chase into two attackers. Printing across a gap, over a drop, or inside a trap can buy distance or let the room do the work.

At one health, copying consumes the original. It comes apart into the moving voxels and only its replacement materializes. The copy still has to be dealt with unless the placement takes care of it.

## The Pirate example

1. A Pirate with two health chases the player. The first copy leaves the original stunned with one health and places a strange Pirate at the chosen destination. There are now two Pirates.
2. The player copies that same one-health original a second time. It dissolves and a second strange Pirate materializes at the new destination. There are still two Pirates, both copies.

The same integrity cost could give furniture a finite number of duplications. The familiar prop becoming visibly less coherent with each scan would tell the player how much copying it can take.

## Questions for the playtest

- How much health does a new copy receive? How do odd health values round?
- Can a strange copy be scanned again? If so, repeated scans at one health allow relocation even when the enemy count stops growing.
- What separates the stun window from the tool cooldown, and can two copies hit on the same beat?
- How much placement range and line of sight feel fair? Try a ledge and a trap on purpose. Preview where the copy will actually form.
- When a placement is invalid or the player cancels, keep the source intact. Deduct integrity only when the transfer commits.
