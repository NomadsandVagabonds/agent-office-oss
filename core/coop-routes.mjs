// Route IDs are shared by the relay and both browsers. Invite codes remain
// random/private even when the building itself uses a repeatable seed.
export const SHOWCASE_ROUTE = 'showcase';
// Tonight's four-floor tour; the waterpark will join after its own integration.
export const SHOWCASE_PENDING = '';
export const SHOWCASE_SEED = 'blockrooms-the-long-way-round-v1';
export const COOP_ROUTES = Object.freeze([
  Object.freeze({id:'random',label:'Somewhere new',description:'A different building each time.'}),
  Object.freeze({id:SHOWCASE_ROUTE,label:'The long way round',description:'Four floors. Familiar halls, stranger corners, and a neighbourhood downstairs.'}),
]);

// Leave time to explore the longer authored tour before retiring its invite.
export const sessionLifetime = route => (route === SHOWCASE_ROUTE ? 3 : 1) * 60 * 60 * 1000;
