// The Office — office life, as the interface says it. An agent may be on a
// break, on the roof, playing, on personal time or in focus (server/life.mjs:
// `agent.activity`); this is the one place that turns that into words.
const TEXT = { break: 'on a break', rooftop: 'on the roof', game: 'playing', personal: 'on personal time', focus: 'in focus' };
const AWAY = new Set(['break', 'rooftop', 'game']);

/** What the agent has on right now, or null: { kind, label, away, note, until }. */
export function lifeOf(agent, now = Date.now()) {
  const act = agent?.activity;
  if (!act || !(act.until > now) || !TEXT[act.kind]) return null;
  return { kind: act.kind, label: TEXT[act.kind], away: AWAY.has(act.kind), note: act.note || '', until: act.until };
}
