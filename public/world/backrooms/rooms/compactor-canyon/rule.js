// Pure rail geometry & state machine for `compactor-canyon` ("The Compactor Canyon").
// Five 8-metre high-density archive shelving monoliths roll along floor tracks
// between 6 canyon slot positions (`0..5`), parting to reveal a hidden camp in Slot 3.

export const N_BANKS = 5;
export const CAMP_SLOT = 3;
export const AISLE_GAP = 1.56;
export const SEAM_GAP = 0.14;
export const RAIL_SPEED = 1.45; // m/s rolling speed along the steel floor tracks

export function canyonMetrics(W, D) {
  const railSpan = W - 4.5; // leaves 2.25m clear perimeter aisle on left & right
  const bankW = (railSpan - AISLE_GAP - N_BANKS * SEAM_GAP) / N_BANKS;
  const bankD = D - 5.2; // leaves 2.60m clear perimeter aisle on front & back
  return { railSpan, bankW, bankD, halfSpan: railSpan / 2, halfD: bankD / 2 };
}

/** Center X of open canyon `slot` (`0..5`) when that slot is cranked open. */
export function slotCenterX(W, slot) {
  const { halfSpan, bankW } = canyonMetrics(W, 18);
  return -halfSpan + slot * (bankW + SEAM_GAP) + AISLE_GAP / 2;
}

/** Target center X of Bank `i` (`0..4`) when `openSlot` (`0..5`) is the active canyon. */
export function targetBankX(W, i, openSlot) {
  const { halfSpan, bankW } = canyonMetrics(W, 18);
  const x0 = -halfSpan + i * bankW + (openSlot <= i ? AISLE_GAP + i * SEAM_GAP : (i + 1) * SEAM_GAP);
  return x0 + bankW / 2;
}

export function compactorStash(r, side) {
  const slot = r.params?.initialSlot ?? 1;
  const cx = slotCenterX(r.W, slot);
  return side < 0
    ? [+(cx - 0.34).toFixed(3), -2.1, +(cx + 0.34).toFixed(3), -1.1]
    : [+(cx - 0.34).toFixed(3), 1.1, +(cx + 0.34).toFixed(3), 2.1];
}

/**
 * Pure walkability clip for `compactor-canyon` (`c.rt.clip`):
 * - All 4 outer perimeter corridors (`|x| >= halfSpan` or `|z| >= halfD`) are permanently open.
 * - Inside the rail bay (`|x| < halfSpan` and `|z| < halfD`), only the locked `openSlot` canyon is passable!
 *   Zero travelling colliders (`docs/BACKROOMS.md` §3).
 */
export function compactorWalkable(x, z, r, W, D, state) {
  const { halfSpan, halfD } = canyonMetrics(W, D);
  const m = Math.min(r, 0.24);
  if (Math.abs(z) >= halfD + m) return true;
  if (Math.abs(x) >= halfSpan + m) return true;
  if (state.anyMoving) return false;
  const cx = slotCenterX(W, state.openSlot);
  return Math.abs(x - cx) <= AISLE_GAP / 2 - m;
}

export function createCompactorState(W, initialSlot = 1) {
  const banks = [];
  for (let i = 0; i < N_BANKS; i++) {
    const x = targetBankX(W, i, initialSlot);
    banks.push({ x, targetX: x, moving: false, wheelAngle: 0, dir: 0 });
  }
  return {
    W,
    openSlot: initialSlot,
    banks,
    anyMoving: false,
    cranksTurned: 0,
  };
}

/**
 * Step the rolling archive monoliths.
 * `crankedBank` (`0..4`): visitor turned the 3-spoke iron wheel on Bank `crankedBank`,
 * shifting the open canyon directly beside that bank.
 */
export function stepCompactor(state, { dt = 0, crankedBank = -1 } = {}) {
  let { W, openSlot, cranksTurned } = state;
  let startedRoll = false, settled = false;

  if (crankedBank >= 0 && crankedBank < N_BANKS) {
    // Open the canyon beside `crankedBank`: if open canyon is on/left of it (`<= i`), open right (`i + 1`), else open left (`i`)
    const nextSlot = openSlot <= crankedBank ? crankedBank + 1 : crankedBank;
    if (nextSlot !== openSlot) {
      openSlot = nextSlot;
      cranksTurned += 1;
      startedRoll = true;
    }
  }

  let anyMoving = false;
  const wasMoving = state.anyMoving;
  const banks = state.banks.map((b, i) => {
    const targetX = targetBankX(W, i, openSlot);
    const diff = targetX - b.x;
    if (Math.abs(diff) <= 1e-4) {
      return { x: targetX, targetX, moving: false, wheelAngle: b.wheelAngle, dir: 0 };
    }
    anyMoving = true;
    const dir = Math.sign(diff);
    const step = Math.min(Math.abs(diff), RAIL_SPEED * dt);
    const x = b.x + dir * step;
    const stillMoving = Math.abs(targetX - x) > 1e-4;
    if (stillMoving) anyMoving = true;
    const wheelAngle = b.wheelAngle + dir * (step / 0.18);
    return { x, targetX, moving: stillMoving, wheelAngle, dir };
  });

  if (wasMoving && !anyMoving && !startedRoll) settled = true;

  return {
    state: { W, openSlot, banks, anyMoving, cranksTurned },
    startedRoll,
    settled,
    campRevealed: openSlot === CAMP_SLOT && !anyMoving,
  };
}
