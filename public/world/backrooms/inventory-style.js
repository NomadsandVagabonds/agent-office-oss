// Native camcorder controls: six pockets and a compact two-ingredient menu.
// Kept separate from the inventory controller so styling cannot change play.
export const INVENTORY_CSS = `
@font-face { font-family: "Pixelify Sans"; src: url("/vendor/fonts/pixelify-sans-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/vendor/fonts/ibm-plex-mono-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/vendor/fonts/ibm-plex-mono-600.woff2") format("woff2"); font-weight: 600; font-display: swap; }

.backrooms:has(.br-inventory) .br-use { bottom: var(--br-inv-hint-bottom, max(21%, 94px)); max-width: calc(100% - 32px); box-sizing: border-box; }
.backrooms:has(.br-inventory) .br-osd.bl,
.backrooms:has(.br-inventory) .br-osd.brr { bottom: var(--br-inv-osd-bottom, 8%); }
.backrooms:has(.br-inventory.is-open) .br-use { opacity: 0; visibility: hidden; pointer-events: none; }
.backrooms:has(.br-inventory.is-open) { touch-action: auto; }

.br-inventory {
  position: absolute;
  left: var(--px, 0px);
  top: var(--py, 0px);
  width: var(--pw, 100%);
  height: var(--ph, 100%);
  z-index: 8;
  pointer-events: none;
  container-type: size;
  letter-spacing: 0;
  text-transform: none;
  filter: none;
  --vf-ink: #ecf2db;
  --vf-soft: #c3d4b8;
  --vf-green: #d0e6b8;
  --vf-rule: #b9caaa70;
  --vf-shadow: 1px 1px 0 #151c12, -1px 0 0 #151c12, 0 -1px 0 #151c12, 0 2px 3px #11180ed9;
  color: var(--vf-ink);
  font: 400 14px/1.3 "Pixelify Sans", monospace;
  text-shadow: var(--vf-shadow);
}
.br-inventory button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: 0;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  text-shadow: inherit;
  transition: background-color 100ms ease-out, color 100ms ease-out;
}
.br-inventory button:focus-visible {
  outline: 1px dashed var(--vf-ink);
  outline-offset: 4px;
}
.br-inventory button:disabled {
  cursor: default; opacity: .45; }
.br-inventory .br-inv-pack {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: min(384px, calc(100% - 32px));
  bottom: 3.5%;
}
.br-inventory .br-inv-meta {
  position: absolute;
  min-height: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  bottom: calc(100% + 10px);
  left: 3px;
  right: 3px;
  gap: 16px;
}
.br-inventory .br-inv-caption {
  max-width: 100%;
  white-space: nowrap;
  text-align: center;
  color: var(--vf-ink);
  font: 400 12px/1.3 "IBM Plex Mono", monospace;
  text-shadow: var(--vf-shadow);
}
.br-inventory .br-inv-health {
  display: flex;
  flex: none;
  margin-right: auto;
  height: 17px;
  color: var(--vf-ink);
}
.br-inventory .br-inv-heart {
  display: block;
  overflow: visible;
  width: 22px;
  height: 17px;
  filter: drop-shadow(1px 1px 0 #151c12);
}
.br-inventory .br-inv-heart .heart-body {
  stroke-linejoin: miter;
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  stroke-opacity: .65;
}
.br-inventory .br-inv-health.is-low { color: #de746b; }
.br-inventory .br-inv-bar {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
.br-inventory .br-inv-slot {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  height: 58px;
  aspect-ratio: auto;
  padding: 5px 5px 8px;
  border: 0;
  border-bottom: 1px solid #c3d4b852;
  background: #18231522;
  box-shadow: none;
}
.br-inventory .br-inv-slot:hover { background-color: #d6e6bd1f; }
.br-inventory .br-inv-slot.is-selected {
  z-index: 1;
  border-color: transparent;
  color: var(--vf-ink);
  box-shadow: none;
  background:
    linear-gradient(var(--vf-ink) 0 0) left top / 9px 2px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) left top / 2px 9px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) right top / 9px 2px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) right top / 2px 9px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) left bottom / 9px 2px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) left bottom / 2px 9px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) right bottom / 9px 2px no-repeat,
    linear-gradient(var(--vf-ink) 0 0) right bottom / 2px 9px no-repeat,
    #d6e6bd0c;
}
.br-inventory .br-inv-slot.is-selected::after {
  content: "▴";
  position: absolute;
  top: auto;
  right: auto;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--vf-ink);
  font-size: 16px;
  line-height: 1;
}
.br-inventory .br-inv-slot.is-compatible {
  border-color: var(--vf-green);
  background-color: #b8d29725;
}
.br-inventory .br-inv-slot.is-compatible::after {
  position: absolute;
  content: "+";
  left: auto;
  top: 1px;
  right: 5px;
  bottom: auto;
  transform: none;
  color: var(--vf-green);
  font: 600 15px/1 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-slot.is-source {
  border-color: var(--vf-rule); opacity: .75; }
.br-inventory .br-inv-slot.is-muted { opacity: .48; }
.br-inventory .br-inv-number {
  position: absolute;
  left: 5px;
  top: 3px;
  color: var(--vf-soft);
  font: 400 10px/1 "IBM Plex Mono", monospace;
  text-shadow: var(--vf-shadow);
}
.br-inventory .br-inv-slot.is-selected .br-inv-number { color: var(--vf-ink); }
.br-inventory .br-inv-icon {
  display: block;
  aspect-ratio: 1;
  overflow: visible;
  width: 44px;
  height: 44px;
  max-width: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(1px 2px 1px #10170d88);
}
.br-inventory .br-inv-count {
  position: absolute;
  bottom: 5px;
  right: 5px;
  color: var(--vf-ink);
  font: 400 11px/1 "IBM Plex Mono", monospace;
  text-shadow: var(--vf-shadow);
}
.br-inventory .br-inv-power {
  position: absolute;
  height: 2px;
  left: 8px;
  right: 8px;
  bottom: 4px;
  background: #d0e6b82b;
}
.br-inventory .br-inv-power i,
.br-inventory .br-inv-slot.is-active .br-inv-power i { background: var(--vf-green); }
.br-inventory .br-inv-slot.is-active::before {
  content: "";
  position: absolute;
  width: 4px;
  height: 4px;
  top: 5px;
  right: 6px;
  background: #d87966;
  box-shadow: 1px 1px #151c12;
}
.br-inventory .br-inv-panel,
.br-inventory.has-health .br-inv-panel {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  pointer-events: auto;
  overflow: auto;
  touch-action: pan-y;
  bottom: calc(3.5% + 110px);
  width: min(460px, calc(100% - 32px));
  max-height: calc(100% - 158px);
  padding: 10px 14px 12px;
  border: 0;
  background: linear-gradient(90deg, #121d124d, #121d126b 45%, #121d122e);
  box-shadow: none;
  scrollbar-width: thin;
  scrollbar-color: var(--vf-soft) #151e134d;
}
.br-inventory .br-inv-panel-head,
.br-inventory.is-combining .br-inv-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  gap: 12px;
  margin: 0 0 16px;
  padding: 0 0 7px;
  border-bottom: 1px solid var(--vf-rule);
}
.br-inventory .br-inv-panel-head::before {
  content: "MENU";
  color: var(--vf-ink);
  font: 400 21px/1 "Pixelify Sans", monospace;
  letter-spacing: .08em;
}
.br-inventory .br-inv-eyebrow {
  flex: 1;
  color: var(--vf-soft);
  font: 400 10px/1.3 "IBM Plex Mono", monospace;
  letter-spacing: .04em;
}
.br-inventory .br-inv-close {
  display: grid;
  place-items: center;
  border: 0;
  line-height: 1.3;
  flex: none;
  width: 40px;
  height: 40px;
  margin: -5px -9px -5px 0;
  color: var(--vf-ink);
  font-size: 25px;
  background: none;
}
.br-inventory .br-inv-close:hover { background: #d0e6b81a; }
.br-inventory .br-inv-detail {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}
.br-inventory .br-inv-specimen {
  display: grid;
  place-items: center;
  width: 92px;
  min-height: 92px;
  background: transparent;
  box-shadow: none;
  border-left: 1px solid var(--vf-rule);
}
.br-inventory .br-inv-specimen .br-inv-icon {
  max-width: none; width: 88px; height: 88px; }
.br-inventory .br-inv-title {
  margin: 0 0 6px;
  color: var(--vf-ink);
  font: 400 28px/1 "Pixelify Sans", monospace;
  text-transform: uppercase;
  letter-spacing: .025em;
}
.br-inventory .br-inv-description {
  margin: 0;
  color: var(--vf-ink);
  font: 400 12px/1.55 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-condition {
  min-height: 16px;
  margin: 9px 0 0;
  color: var(--vf-green);
  font: 400 11px/1.45 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-actions,
.br-inventory.is-combining .br-inv-actions {
  display: flex;
  margin-top: 16px;
  gap: 8px;
  border-top: 1px solid #b9caaa3b;
  padding-top: 7px;
}
.br-inventory .br-inv-action {
  min-height: 40px;
  padding: 7px 10px;
  color: var(--vf-ink);
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 17px;
  white-space: nowrap;
}
.br-inventory .br-inv-action:hover:enabled { background: #d0e6b823; }
.br-inventory .br-inv-action.primary {
  flex: 1;
  text-align: left;
  padding-left: 8px;
  border: 0;
  color: var(--vf-green);
  background: #d0e6b80f;
  box-shadow: none;
}
.br-inventory .br-inv-action.primary::before {
  content: "▸";
  display: inline-block;
  margin-right: 8px;
  font-size: 16px;
}
.br-inventory .br-inv-action.primary:hover:enabled { background: #d0e6b82b; }
.br-inventory .br-inv-action kbd {
  color: var(--vf-soft);
  font: 400 10px/1 "IBM Plex Mono", monospace;
  margin-left: 8px;
  opacity: 1;
}
.br-inventory .br-inv-camera-choice {
  margin-left: auto;
  min-height: 36px;
  padding: 6px 4px;
  color: var(--vf-green);
  border: 0;
  border-bottom: 1px dotted var(--vf-rule);
  background: transparent;
  font: 400 11px/1.2 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-camera-choice:hover:enabled { background: #d0e6b81a; }
.br-inventory .br-inv-equipment {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -5px 0 12px;
}
.br-inventory .br-inv-equipment-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  min-width: 0;
}
.br-inventory .br-inv-equipment-choice .br-inv-icon { width: 30px; height: 30px; }
.br-inventory .br-inv-equipment-choice strong { display: block; font: inherit; }
.br-inventory .br-inv-equipment-choice small { display: block; color: var(--vf-soft); font: 400 9px/1.5 "IBM Plex Mono", monospace; }
.br-inventory .br-inv-equipment-choice.is-source { border-bottom-style: solid; }
.br-inventory .br-inv-ingredients {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr);
  gap: 9px;
}
.br-inventory .br-inv-plus {
  text-align: center; color: var(--vf-soft); font-size: 22px; }
.br-inventory .br-inv-ingredient {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  text-align: left;
  height: 66px;
  gap: 10px;
  padding: 7px 9px;
  border: 1px solid #b9caaa55;
  background: #1823153b;
  box-shadow: none;
}
.br-inventory .br-inv-ingredient.is-focused {
  border-color: var(--vf-green);
  background: #d0e6b814;
}
.br-inventory .br-inv-ingredient:hover:enabled { background: #d0e6b81f; }
.br-inventory .br-inv-ingredient .br-inv-icon {
  flex: none; width: 38px; height: 38px; }
.br-inventory .br-inv-ingredient-label {
  min-width: 0;
  line-height: 1.2; color: var(--vf-ink); font-size: 16px; }
.br-inventory .br-inv-ingredient-label strong { font-weight: 400; }
.br-inventory .br-inv-ingredient-label small {
  margin-top: 5px;
  color: var(--vf-soft);
  font: 400 10px/1.2 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-ingredient-clear {
  position: absolute;
  color: var(--vf-soft);
  right: 4px;
  top: 0;
  font-size: 15px;
}
.br-inventory .br-inv-result {
  display: flex;
  align-items: center; gap: 12px; min-height: 44px; margin-top: 12px; }
.br-inventory .br-inv-result-title {
  display: block;
  margin: 0;
  color: var(--vf-green);
  font: 400 19px/1.1 "Pixelify Sans", monospace;
}
.br-inventory .br-inv-result-description {
  margin: 4px 0 0;
  color: var(--vf-soft);
  font: 400 10px/1.4 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-result.is-invalid .br-inv-result-title {
  color: var(--vf-soft);
  font: 400 11px/1.4 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-paper-count {
  display: flex;
  align-items: center;
  flex: none; gap: 3px; }
.br-inventory .br-inv-paper-count button {
  padding: 0;
  width: 36px;
  height: 36px;
  border: 1px solid var(--vf-rule);
  background: transparent;
  font-size: 21px;
}
.br-inventory .br-inv-paper-count button:hover:enabled { background: #d0e6b823; }
.br-inventory .br-inv-paper-count output {
  text-align: center;
  min-width: 23px;
  color: var(--vf-ink);
  font: 400 12px/1 "IBM Plex Mono", monospace;
}
.br-inventory .br-inv-notice {
  position: absolute;
  left: 50%;
  bottom: var(--br-inv-notice-bottom, calc(max(21%, 94px) + var(--ph, 600px) * .0462 + 12px));
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 36px);
  box-sizing: border-box;
  pointer-events: none;
  text-align: center;
  opacity: 0;
  transition: opacity 120ms ease-out;
  border: 0;
  padding: 6px 9px;
  color: var(--vf-ink);
  background: #1823154d;
  font: 400 13px/1.45 "IBM Plex Mono", monospace;
  text-shadow: var(--vf-shadow);
}

.br-inventory [hidden] { display: none !important; }
.br-inventory .br-inv-caption:empty { display: none; }
.br-inventory.has-health .br-inv-caption { margin-left: auto; text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.br-inventory .br-inv-icon-wrap { width: 100%; display: grid; place-items: center; }
.br-inventory .br-inv-power i { display: block; height: 100%; transform-origin: left; }
.br-inventory .br-inv-ingredient-label strong,
.br-inventory .br-inv-ingredient-label small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-inventory .br-inv-result-copy { flex: 1; min-width: 0; }
.br-inventory .br-inv-craft-heading { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.br-inventory .br-inv-notice.on { opacity: 1; }
.br-inventory.is-open .br-inv-notice { display: none; }
.br-inventory.is-open .br-inv-caption { visibility: hidden; }

@container (max-width: 520px) {
  .br-inventory .br-inv-pack { bottom: 3%; width: calc(100% - 30px); }
  .br-inventory .br-inv-bar { gap: 4px; }
  .br-inventory .br-inv-slot { height: 54px; padding: 6px 3px 8px; }
  .br-inventory .br-inv-icon { width: 40px; height: 40px; }
  .br-inventory .br-inv-caption { font-size: 10px; }
  .br-inventory .br-inv-panel,
  .br-inventory.has-health .br-inv-panel {
    width: calc(100% - 24px);
    bottom: calc(3% + 104px);
    max-height: calc(100% - 145px);
    padding: 9px 12px 10px;
  }
  .br-inventory .br-inv-panel-head,
  .br-inventory.is-combining .br-inv-panel-head { gap: 9px; margin-bottom: 12px; }
  .br-inventory .br-inv-panel-head::before { font-size: 19px; }
  .br-inventory .br-inv-eyebrow { font-size: 9px; }
  .br-inventory .br-inv-detail { grid-template-columns: 74px minmax(0, 1fr); gap: 12px; }
  .br-inventory .br-inv-specimen { width: 74px; min-height: 82px; }
  .br-inventory .br-inv-specimen .br-inv-icon { width: 72px; height: 72px; }
  .br-inventory .br-inv-title { font-size: 25px; }
  .br-inventory .br-inv-description { font-size: 11px; line-height: 1.5; }
  .br-inventory .br-inv-action { min-height: 44px; padding: 7px 8px; font-size: 16px; }
  .br-inventory .br-inv-action kbd { margin-left: 5px; font-size: 9px; }
  .br-inventory .br-inv-close { width: 44px; height: 44px; }
  .br-inventory .br-inv-camera-choice { min-height: 44px; font-size: 10px; }
  .br-inventory .br-inv-ingredients { gap: 6px; grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr); }
  .br-inventory .br-inv-ingredient { height: 72px; gap: 5px; padding: 6px; }
  .br-inventory .br-inv-ingredient .br-inv-icon { width: 31px; height: 36px; }
  .br-inventory .br-inv-ingredient-label { font-size: 15px; }
  .br-inventory .br-inv-ingredient-label small { font-size: 9px; }
  .br-inventory .br-inv-result { gap: 8px; }
  .br-inventory .br-inv-result-title { font-size: 18px; }
  .br-inventory .br-inv-paper-count button { width: 38px; height: 44px; }
}
@container (max-height: 430px) {
  .br-inventory .br-inv-pack { bottom: 4%; }
  .br-inventory .br-inv-panel,
  .br-inventory.has-health .br-inv-panel {
    bottom: calc(4% + 82px);
    max-height: calc(100% - 100px);
    padding-top: 5px;
    padding-bottom: 5px;
  }
  .br-inventory .br-inv-panel-head,
  .br-inventory.is-combining .br-inv-panel-head { margin-bottom: 8px; padding-bottom: 3px; }
  .br-inventory .br-inv-detail { grid-template-columns: 60px minmax(0, 1fr); }
  .br-inventory .br-inv-specimen { width: 60px; min-height: 60px; }
  .br-inventory .br-inv-specimen .br-inv-icon { width: 56px; height: 56px; }
  .br-inventory .br-inv-title { font-size: 23px; }
  .br-inventory .br-inv-actions,
  .br-inventory.is-combining .br-inv-actions { margin-top: 8px; padding-top: 4px; }
  .br-inventory:not(.is-combining) .br-inv-condition { margin-top: 3px; }
  .br-inventory:not(.is-combining) .br-inv-actions { margin-top: 4px; padding-top: 2px; }
  .br-inventory.is-combining .br-inv-panel-head { margin-bottom: 1px; padding-bottom: 0; }
  .br-inventory.is-combining .br-inv-ingredient { height: 44px; padding-top: 3px; padding-bottom: 3px; }
  .br-inventory.is-combining .br-inv-ingredient-label small { margin-top: 2px; }
  .br-inventory.is-combining .br-inv-result { min-height: 32px; margin-top: 1px; }
  .br-inventory.is-combining .br-inv-actions { margin-top: 1px; padding-top: 0; }
  .br-inventory.is-combining .br-inv-action { min-height: 44px; font-size: 16px; }
}
/* The date has its own band during play. On a short picture the open menu
   needs that band; the REC, camera battery and health readouts stay visible. */
@media (max-width: 520px), (max-height: 430px) {
  .backrooms:has(.br-inventory.is-open) .br-osd.bl { visibility: hidden; }
}
/* Portrait VHS has useful space above the picture. Open the menu there and
   keep the running camera readouts in a separate, always-visible strip. */
@media (max-width: 520px) and (orientation: portrait) {
  .backrooms:has(.br-inventory.is-open) .br-osd.tl,
  .backrooms:has(.br-inventory.is-open) .br-osd.tr { top: calc(8px - var(--py, 0px)); }
  .backrooms:has(.br-inventory.is-open) .br-carry { top: calc(8px - var(--py, 0px) + 1.75em); }
  @container (max-height: 430px) {
    .br-inventory .br-inv-panel,
    .br-inventory.has-health .br-inv-panel {
      top: calc(44px - var(--py, 0px));
      bottom: auto;
      max-height: calc(var(--py, 0px) + var(--ph, 100%) - 140px);
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .br-inventory .br-inv-notice { transition: none; }
  .br-inventory button { transition: none; }
}
`;
