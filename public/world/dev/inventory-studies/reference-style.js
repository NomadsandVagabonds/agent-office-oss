// Original base layout retained only for comparing the three archived studies.
export const REFERENCE_CSS = `
.backrooms:has(.br-inventory) .br-use { bottom:var(--br-inv-hint-bottom,max(21%,94px)); max-width:calc(100% - 32px); box-sizing:border-box; }
.backrooms:has(.br-inventory) .br-osd.bl, .backrooms:has(.br-inventory) .br-osd.brr { bottom:var(--br-inv-osd-bottom,8%); }
.backrooms:has(.br-inventory.is-open) .br-use { opacity:0; visibility:hidden; pointer-events:none; }
.backrooms:has(.br-inventory.is-open) { touch-action:auto; }
.br-inventory { position:absolute; left:var(--px,0px); top:var(--py,0px); width:var(--pw,100%); height:var(--ph,100%); z-index:8; pointer-events:none; container-type:size;
  color:#eee5cd; font:700 12px/1.4 "Courier New",ui-monospace,monospace; letter-spacing:0; text-transform:none; text-shadow:none; filter:none; }
.br-inventory button { font:inherit; color:inherit; cursor:pointer; border-radius:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.br-inventory button:focus-visible { outline:2px solid #fff0bc; outline-offset:3px; }
.br-inventory button:disabled { cursor:default; opacity:.4; }
.br-inventory [hidden] { display:none!important; }
.br-inv-pack { position:absolute; left:50%; bottom:2.5%; transform:translateX(-50%); width:min(396px,calc(100% - 28px)); pointer-events:auto; }
.br-inv-meta { position:absolute; bottom:calc(100% + 9px); left:4px; right:4px; min-height:17px; display:flex; align-items:center; justify-content:center; gap:12px; }
.br-inv-caption { max-width:100%; white-space:nowrap; font-size:12px; text-align:center; color:#eee5cd;
  text-shadow:1px 2px #171712,-1px -1px #171712,1px -1px #171712,-1px 1px #171712; }
.br-inv-caption:empty { display:none; }
.br-inventory.has-health .br-inv-caption { margin-left:auto; text-align:right; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.br-inv-health { display:flex; gap:3px; flex:none; margin-right:auto; height:15px; }
.br-inv-health[hidden] { display:none; }
.br-inv-heart { display:block; width:18px; height:15px; overflow:visible; }
.br-inv-heart .heart-body { fill:#423e34; stroke:#161610; stroke-width:1.5; stroke-linejoin:miter; }
.br-inv-heart .heart-shine { fill:#625747; }
.br-inv-heart.is-filled .heart-body { fill:#b66b58; }
.br-inv-heart.is-filled .heart-shine { fill:#e3aa86; }
.br-inv-health.is-low .is-filled .heart-body { fill:#d0755d; }
.br-inv-health.is-low .is-filled .heart-shine { fill:#ffe0ae; }
.br-inventory.has-health .br-inv-panel { bottom:calc(2.5% + 111px); max-height:calc(100% - 137px); }
.br-inv-bar { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:4px; padding:5px; background:#1b1a16;
  box-shadow:0 0 0 2px #100f0c,inset 0 2px #8a8066,inset 2px 0 #6a6251,inset -2px 0 #332e25,inset 0 -2px #332e25; }
.br-inv-slot { position:relative; display:grid; place-items:center; min-width:0; aspect-ratio:1; padding:8px 5px 10px; border:2px solid #514b3c; background:#302e27;
  box-shadow:inset 2px 2px #1c1c18,inset -2px -2px #675e4a; }
.br-inv-slot:hover { background:#3c382d; }
.br-inv-slot.is-selected { border-color:#eee0b3; box-shadow:0 0 0 1px #fff0c8,inset 2px 2px #73664b,inset -2px -2px #1b1914; background:#4b4433; z-index:1; }
.br-inv-slot.is-compatible { border-color:#d9be75; background:#484432; }
.br-inv-slot.is-compatible::after { content:'+'; position:absolute; right:3px; top:0; color:#ffe2a1; font-size:15px; }
.br-inv-slot.is-source { border-color:#b3935b; opacity:.65; }
.br-inv-slot.is-muted { opacity:.42; }
.br-inv-number { position:absolute; top:1px; left:4px; color:#b5ab90; font-size:10px; line-height:1.2; text-shadow:1px 1px #151510; }
.br-inv-slot.is-selected .br-inv-number { color:#fff0c5; }
.br-inv-icon { display:block; width:100%; height:auto; max-width:39px; aspect-ratio:1; overflow:visible; }
.br-inv-icon-wrap { width:100%; display:grid; place-items:center; }
.br-inv-count { position:absolute; right:4px; bottom:4px; font-size:10px; line-height:1; color:#f6edcf; text-shadow:1px 1px #161610; }
.br-inv-power { position:absolute; bottom:3px; left:5px; right:5px; height:2px; background:#191b16; }
.br-inv-power i { display:block; height:100%; background:#c3b273; transform-origin:left; }
.br-inv-slot.is-active .br-inv-power i { background:#f8e4a3; }
.br-inv-slot.is-active::before { content:''; position:absolute; right:4px; top:4px; width:4px; height:4px; background:#f8e4a3; box-shadow:0 0 0 1px #5d5335; }
.br-inv-mount { position:absolute; right:4px; bottom:8px; color:#eee0b3; font-size:9px; line-height:1; text-shadow:1px 1px #171712; }
.br-inv-panel { position:absolute; left:50%; bottom:calc(2.5% + 99px); transform:translateX(-50%); width:min(420px,calc(100% - 28px)); box-sizing:border-box; padding:16px;
  background:#26251e; border:2px solid #b1a383; box-shadow:0 0 0 2px #13140f,inset 2px 2px #5d5846,inset -2px -2px #151711; pointer-events:auto; max-height:calc(100% - 125px); overflow:auto; touch-action:pan-y; }
.br-inv-panel[hidden] { display:none; }
.br-inv-panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:13px; padding-bottom:9px; border-bottom:1px solid #544e3d; }
.br-inv-eyebrow { color:#bcb294; font-size:10px; letter-spacing:.16em; }
.br-inv-close { display:grid; place-items:center; width:28px; height:28px; margin:-6px -6px -6px 0; border:0; background:transparent; color:#d8cdb0; font-size:20px!important; line-height:1; }
.br-inv-close:hover { background:#464132; }
.br-inv-detail { display:grid; grid-template-columns:84px minmax(0,1fr); gap:18px; align-items:start; }
.br-inv-specimen { display:grid; place-items:center; width:84px; min-height:90px; background:#1d201a; box-shadow:inset 2px 2px #11140f,inset -2px -2px #494b3b; }
.br-inv-specimen .br-inv-icon { max-width:none; width:70px; height:70px; }
.br-inv-title { margin:0 0 5px; font-size:19px; font-weight:700; line-height:1.1; color:#f3e7c7; }
.br-inv-description { margin:0; color:#c4bda4; font-size:12px; line-height:1.5; font-weight:400; }
.br-inv-condition { min-height:17px; margin:9px 0 0; color:#e8cf91; font-size:11px; }
.br-inv-actions { display:flex; gap:8px; margin-top:17px; }
.br-inv-action { min-height:37px; padding:8px 13px; border:1px solid #8e8267; background:#39382d; box-shadow:inset 1px 1px #605d48,inset -1px -1px #171b14; }
.br-inv-action:hover:enabled { background:#4d4836; }
.br-inv-action.primary { flex:1; color:#211f17; border-color:#dfc88d; background:#d2bc82; box-shadow:inset 1px 1px #f4dfa5,inset -1px -1px #8d794d; }
.br-inv-action.primary:hover:enabled { background:#e4cc8c; }
.br-inv-action kbd { font:inherit; font-size:10px; opacity:.65; margin-left:9px; }
.br-inv-action[hidden] { display:none; }
.br-inv-camera-choice { margin-left:auto; padding:2px 6px; background:none; border:1px solid #746b53; color:#e8cf91!important; font-size:10px!important; }
.br-inv-ingredients { display:grid; grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr); gap:8px; align-items:center; }
.br-inv-plus { color:#9d9275; text-align:center; }
.br-inv-ingredient { position:relative; display:flex; align-items:center; gap:9px; height:48px; min-width:0; padding:5px 9px; text-align:left; border:2px solid #514b3c; background:#1d201a; box-shadow:inset 2px 2px #11140f,inset -2px -2px #494b3b; }
.br-inv-ingredient.is-focused { border-color:#eee0b3; }
.br-inv-ingredient .br-inv-icon { width:30px; height:30px; flex:none; }
.br-inv-ingredient-label { min-width:0; font-size:11px; line-height:1.2; }
.br-inv-ingredient-label strong,.br-inv-ingredient-label small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.br-inv-ingredient-label small { margin-top:2px; color:#bcb294; font-size:9px; font-weight:400; }
.br-inv-ingredient-clear { position:absolute; right:3px; top:1px; color:#a99e80; font-size:10px; }
.br-inv-result { display:flex; gap:8px; align-items:center; min-height:32px; margin-top:9px; }
.br-inv-result-copy { flex:1; min-width:0; }
.br-inv-result-title { display:block; margin:0; color:#f3e7c7; font-size:12px; line-height:14px; }
.br-inv-result-description { margin:2px 0 0; color:#bcb294; font-size:10px; line-height:12px; }
.br-inv-result.is-invalid .br-inv-result-title { color:#d8c6a1; font-size:11px; line-height:14px; font-weight:400; }
.br-inv-paper-count { display:flex; align-items:center; gap:3px; flex:none; }
.br-inv-paper-count button { width:27px; height:28px; padding:0; border:1px solid #7b7057; background:#39382d; font-size:15px; }
.br-inv-paper-count output { min-width:18px; text-align:center; color:#eee0b3; font-size:11px; }
.br-inv-craft-heading { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.br-inventory.is-combining .br-inv-panel-head { margin-bottom:6px; padding-bottom:4px; }
.br-inventory.is-combining .br-inv-actions { margin-top:8px; }
.br-inv-notice { position:absolute; left:50%; bottom:var(--br-inv-notice-bottom,calc(max(21%,94px) + var(--ph,600px) * .0462 + 12px)); transform:translateX(-50%); width:max-content; max-width:calc(100% - 36px); box-sizing:border-box; padding:7px 11px;
  color:#f4e6c3; background:#25251ce8; border:1px solid #7c735a; text-align:center; font-size:12px; opacity:0; transition:opacity .12s ease; }
.br-inv-notice.on { opacity:1; }
.br-inventory.is-open .br-inv-notice { display:none; }
.br-inventory.is-open .br-inv-caption { visibility:hidden; }
@container (max-width:520px) {
  .br-inv-pack { width:min(330px,calc(100% - 24px)); bottom:2%; }
  .br-inv-bar { padding:4px; gap:3px; }
  .br-inv-slot { padding:7px 4px 9px; }
  .br-inv-icon { max-width:32px; }
  .br-inv-panel { bottom:calc(2% + 79px); padding:12px; max-height:calc(100% - 90px); }
  .br-inventory.has-health .br-inv-panel { bottom:calc(2% + 91px); max-height:calc(100% - 102px); }
  .br-inv-detail { grid-template-columns:62px minmax(0,1fr); gap:13px; }
  .br-inv-specimen { width:62px; min-height:72px; }
  .br-inv-specimen .br-inv-icon { width:56px; height:56px; }
  .br-inv-title { font-size:17px; }
  .br-inv-panel-head { margin-bottom:10px; }
  .br-inv-actions { margin-top:12px; }
  .br-inv-action { padding:8px 10px; }
}
@container (max-height:430px) {
  .br-inv-panel { padding:10px 12px; }
  .br-inv-panel-head { margin-bottom:8px; padding-bottom:5px; }
  .br-inv-description { font-size:11px; line-height:1.35; }
  .br-inv-detail { grid-template-columns:62px minmax(0,1fr); gap:12px; }
  .br-inv-specimen { min-height:65px; width:62px; }
  .br-inv-specimen .br-inv-icon { width:56px; height:56px; }
  .br-inv-title { font-size:17px; }
  .br-inv-condition { margin-top:5px; }
  .br-inv-actions { margin-top:9px; }
  .br-inventory.has-health .br-inv-panel { padding-top:8px; padding-bottom:8px; }
  .br-inventory.has-health .br-inv-panel-head { margin-bottom:4px; }
  .br-inventory.has-health .br-inv-condition { margin-top:3px; }
  .br-inventory.has-health .br-inv-actions { margin-top:7px; }
  .br-inventory.is-combining .br-inv-panel-head { margin-bottom:5px; padding-bottom:3px; }
  .br-inventory.is-combining .br-inv-ingredient { height:42px; padding:4px 7px; gap:7px; }
  .br-inventory.is-combining .br-inv-result { min-height:28px; margin-top:6px; }
  .br-inventory.is-combining .br-inv-actions { margin-top:6px; }
  .br-inventory.is-combining .br-inv-action { min-height:30px; padding:5px 11px; font-size:11px; }
}
@media (prefers-reduced-motion:reduce) { .br-inv-notice { transition:none; } }
`;
