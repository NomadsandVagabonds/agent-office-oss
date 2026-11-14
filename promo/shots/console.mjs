// The console: the office as text. One continuous take, cut up afterwards.
//   rig/film shots/console.mjs --shot console
import fs from 'node:fs';

const tapePath = new URL('../tapes/07-console.json', import.meta.url).pathname;
const tape = fs.existsSync(tapePath) ? JSON.parse(fs.readFileSync(tapePath, 'utf8')) : { meta: { session: '', request: '' }, http: {} };
const meta = tape.meta;
const record = `/api/harness/sessions/${meta.session}/transcript`;

export const shots = {
  console: {
    base: 'http://localhost:4411',
    url: `/console/#s=${meta.session}`,
    tape: '../tapes/07-console.json', tapeStart: 0,
    size: [1920, 1080], dsf: 1.5, fps: 30, seconds: 24,
    ready: "!!document.querySelector('#bar') && document.getElementById('rail').innerText.length > 80 && document.getElementById('bar').innerText.length > 5",
    settle: 0.6, afterSetup: 0.2,
    pointer: [760, 420],
    // what the hand does is filmed, not done: the turn that plays is the one on the tape
    answers: { 'POST /api/harness/sessions/*': { ok: true, queued: false },
      // however the page asks for the record so far, it gets the record as it stood when the tape began
      [`GET ${record}*`]: tape.http[record] || { entries: [] } },
    setup() { document.documentElement.style.cursor = 'none'; document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' })); },
    actions: [
      { at: 0.35, click: { css: '#input' }, dur: 0.4 },
      { at: 0.95, type: meta.request, cps: 27 },
      { at: 3.05, key: 'Enter' },
      { at: 3.3, hover: { css: '#feed', px: 0.72, py: 0.55 }, dur: 0.8 },
      // who it is said to, and on which model
      { at: 12.4, click: { css: '#bar button', text: 'Gemini 2.5 Pro' }, dur: 0.6 },
      { at: 13.5, hover: { css: '#pop button.it', text: 'Codex' }, dur: 0.5 },
      { at: 14.3, click: { css: '#pop button.it', text: 'Codex' }, dur: 0.1 },
      { at: 15.2, hover: { css: '#pop button.it', text: 'GPT-5 Codex Mini' }, dur: 0.45 },
      { at: 16.4, key: 'Escape' },
      // how freely it may act
      { at: 16.7, click: { css: '#bar button', text: 'asks first' }, dur: 0.5 },
      { at: 17.7, hover: { css: '#pop button.it', text: 'edits freely' }, dur: 0.4 },
      { at: 18.5, key: 'Escape' },
      // a project's board
      { at: 18.8, click: { css: '#rail .ghead button.name', text: 'Webstore' }, dur: 0.6 },
      { at: 20.0, hover: { css: '#feed', px: 0.5, py: 0.5 }, dur: 0.8 },
    ],
  },
};
