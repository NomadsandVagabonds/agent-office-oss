// The camcorder's pause controls, laid over the last frame of the recording.
export const MENU_CSS = `
@font-face { font-family: "Pixelify Sans"; src: url("/vendor/fonts/pixelify-sans-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/vendor/fonts/ibm-plex-mono-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
.br-menu {
  position: absolute; inset: 0; z-index: 12; pointer-events: none; container-type: size;
  --menu-ink: #ecf2db; --menu-soft: #c3d4b8; --menu-rule: #b9caaa70;
  --menu-shadow: 1px 1px 0 #151c12, -1px 0 0 #151c12, 0 -1px 0 #151c12, 0 2px 3px #11180ed9;
  color: var(--menu-ink); font: 400 18px/1.35 "Pixelify Sans", monospace;
  letter-spacing: 0; text-transform: none; text-shadow: var(--menu-shadow);
}
.br-menu[hidden], .br-menu [hidden] { display: none !important; }
.br-menu *, .br-menu *::before, .br-menu *::after { box-sizing: border-box; }
.br-menu button, .br-menu input, .br-menu select { font: inherit; color: inherit; }
.br-menu button, .br-menu select { cursor: pointer; border-radius: 0; text-shadow: inherit; }
.br-menu button { border: 0; background: transparent; touch-action: manipulation; }
.br-menu :is(button, input, select):focus-visible { outline: 1px dashed var(--menu-ink); outline-offset: 4px; }
.br-menu button:hover { background-color: #d6e6bd16; }
.br-menu button:disabled, .br-menu select:disabled { cursor: default; opacity: .55; }
.br-menu-picture { position: absolute; left: var(--px, 0px); top: var(--py, 0px); width: var(--pw, 100%); height: var(--ph, 100%); pointer-events: none; }
.br-menu .br-menu-launcher {
  position: absolute; top: 18%; right: 6%; min-width: 74px; min-height: 44px; padding: 8px;
  display: flex; align-items: center; justify-content: center; gap: 8px; pointer-events: auto;
  font: 400 12px/1.2 "IBM Plex Mono", monospace; opacity: .8;
}
.br-menu-launcher span { font: 400 19px/1 "Pixelify Sans", monospace; }
.br-menu-launcher kbd { font: inherit; color: var(--menu-soft); }
.br-menu.is-open .br-menu-picture { display: none; }
.br-menu-overlay {
  position: absolute; inset: 0; display: grid; place-items: center; padding: clamp(14px, 5vmin, 52px);
  pointer-events: auto; background: #0c140ec2; touch-action: auto;
}
.br-menu-panel {
  position: relative; display: flex; flex-direction: column; width: min(100%, 660px); max-height: 100%; min-height: 0;
  padding: clamp(18px, 4vmin, 34px); overflow: hidden;
  background:
    linear-gradient(var(--menu-ink) 0 0) left top / 17px 2px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) left top / 2px 17px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) right top / 17px 2px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) right top / 2px 17px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) left bottom / 17px 2px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) left bottom / 2px 17px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) right bottom / 17px 2px no-repeat,
    linear-gradient(var(--menu-ink) 0 0) right bottom / 2px 17px no-repeat;
}
.br-menu-panel:focus { outline: none; }
.br-menu-header { flex: none; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--menu-rule); }
.br-menu-eyebrow { display: block; color: var(--menu-soft); font: 400 10px/1.4 "IBM Plex Mono", monospace; letter-spacing: .18em; }
.br-menu-title { margin: 7px 0 0; font: 400 clamp(32px, 5vmin, 46px)/1 "Pixelify Sans", monospace; }
.br-menu .br-menu-close { flex: none; width: 44px; height: 44px; margin: -7px -9px 0 0; font-size: 30px; line-height: 1; }
.br-menu-content { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 22px 5px 12px; scrollbar-color: var(--menu-rule) transparent; scrollbar-width: thin; }
.br-menu-main { display: grid; gap: 3px; }
.br-menu .br-menu-choice {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 20px;
  width: 100%; min-height: 57px; padding: 9px 13px 9px 33px; text-align: left; font-size: 30px;
}
.br-menu-choice::before { content: "▸"; position: absolute; left: 9px; opacity: 0; }
.br-menu-choice:hover::before, .br-menu-choice:focus-visible::before { opacity: 1; }
.br-menu-choice small { color: var(--menu-soft); font: 400 10px/1.3 "IBM Plex Mono", monospace; white-space: nowrap; }
.br-menu .br-menu-giveup { margin-top: 19px; padding-top: 17px; border-top: 1px solid var(--menu-rule); color: #deb3a4; }
.br-menu-footer { flex: none; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 16px; border-top: 1px solid var(--menu-rule); }
.br-menu-footer small { color: var(--menu-soft); font: 400 10px/1.5 "IBM Plex Mono", monospace; }
.br-menu .br-menu-back { min-height: 44px; padding: 7px 11px; margin-left: -11px; font-size: 19px; }
.br-menu-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; margin: 0; }
.br-menu-control { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #b9caaa29; }
.br-menu-control dt { color: var(--menu-soft); font-size: 18px; }
.br-menu-control dd { margin: 0; text-align: right; font: 400 11px/1.5 "IBM Plex Mono", monospace; }
.br-menu-note { margin: 20px 0 2px; color: var(--menu-soft); font: 400 11px/1.7 "IBM Plex Mono", monospace; }
.br-menu-note strong { color: var(--menu-ink); font-weight: inherit; }
.br-menu-settings { display: grid; gap: 20px; }
.br-menu-setting { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px 18px; }
.br-menu-setting > label { font-size: 22px; }
.br-menu-setting output { text-align: right; font: 400 12px/1.5 "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; }
.br-menu-setting input[type="range"] { grid-column: 1 / -1; display: block; width: 100%; height: 30px; margin: -2px 0; accent-color: var(--menu-ink); cursor: ew-resize; background: transparent; touch-action: pan-y; }
.br-menu-setting select { min-height: 40px; max-width: 100%; padding: 4px 26px 4px 9px; border: 1px solid var(--menu-rule); background: #101b15c4; font-size: 18px; }
.br-menu-setting option { color: var(--menu-ink); background: #182019; }
.br-menu-setting input[type="checkbox"] { width: 22px; height: 22px; margin: 4px; accent-color: var(--menu-ink); cursor: pointer; }
.br-menu-setting small { grid-column: 1 / -1; color: var(--menu-soft); font: 400 10px/1.5 "IBM Plex Mono", monospace; }
.br-menu-setting.is-future { padding-top: 18px; border-top: 1px solid var(--menu-rule); }
.br-menu-confirm p { margin: 0 0 22px; font-size: 22px; line-height: 1.5; }
.br-menu-confirm-actions { display: flex; gap: 16px; flex-wrap: wrap; }
.br-menu .br-menu-confirm-actions button { min-height: 48px; padding: 10px 14px; border-bottom: 1px solid var(--menu-rule); font-size: 22px; }
.br-menu .br-menu-confirm-end { color: #deb3a4; }
.backrooms:has(.br-menu.is-open) .br-leave,
.backrooms:has(.br-menu.is-open) .br-use,
.backrooms:has(.br-menu.is-open) .br-inventory { visibility: hidden; pointer-events: none; }
.backrooms:has(.br-menu) .br-leave { display: none; }
.backrooms:has(.br-menu.is-open) .br-dot,
.backrooms:has(.br-menu.is-open) .br-batt i { animation-play-state: paused; }
@container (max-width: 520px) {
  .br-menu-overlay { padding: 14px; }
  .br-menu-panel { padding: 20px; }
  .br-menu-content { padding-top: 15px; }
  .br-menu-controls { grid-template-columns: 1fr; }
  .br-menu .br-menu-choice { min-height: 54px; font-size: 27px; }
  .br-menu-choice small { font-size: 9px; }
  .br-menu-settings { gap: 16px; }
  .br-menu-setting > label { font-size: 20px; }
  .br-menu-setting select { font-size: 16px; }
  .br-menu-picture .br-menu-launcher { min-width: 44px; right: 4%; }
  .br-menu-launcher kbd { display: none; }
}
@container (max-height: 430px) {
  .br-menu-overlay { padding: 10px 22px; }
  .br-menu-panel { padding: 14px 22px; }
  .br-menu-header { padding-bottom: 9px; }
  .br-menu-title { margin-top: 2px; font-size: 28px; }
  .br-menu-content { padding-top: 8px; padding-bottom: 8px; }
  .br-menu .br-menu-choice { min-height: 44px; font-size: 24px; }
  .br-menu .br-menu-giveup { margin-top: 4px; padding-top: 9px; }
  .br-menu-footer { padding-top: 5px; }
  .br-menu-note { margin-top: 12px; }
}
`;
