// The office as it was: the original pixel-art client on main (run `npm run demo` on a checkout of main, port 4317).
//   rig/film shots/classic.mjs --shot classic
export const shots = {
  classic: {
    base: 'http://localhost:4317', url: '/',
    size: [1920, 1080], fps: 30, seconds: 6.5,
    ready: "typeof agents !== 'undefined' && agents.size > 3 && document.querySelector('canvas')",
    settle: 1.5, pointer: false,
    setup() { document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' })); },
    actions: [
      // (the old client reads the mouse through p5; from here it is told what the click would have told it)
      { at: 2.6, js: "(() => { const k = [...agents.keys()].find((id) => /api/.test(agents.get(id).cwd || '')) || [...agents.keys()][0]; panelOpen = false; deskAgentId = k; view = 'desk'; })()" },
    ],
  },
};
