// Dev-page fixture only: ordinary catalogue furniture, beside ordinary doors.
// It never goes into the room deck or changes a normal seeded visit.
export function prepareFurnitureStudy(level, builders) {
  const start = level.rooms[level.start.room];
  const next = start.doors.find(d => d.kind === 'door' && !d.sill && d.w >= 1.6);
  if (next) level.pursuer = { room: next.to, corner: 0, face: 3 };
  builders.start = c => {
    c.shell();
    const desk = c.prop('desk', 0, -.9);
    c.prop('crt', 0, -1, { y: desk.top, solid: false });
    c.prop('keyboard', 0, -.64, { y: desk.top, solid: false });
    c.prop('chair', -1.65, .2, { o: { color: '#5a5a66' }, solid: false });
    c.prop('chair', -.45, .2, { o: { color: '#5a5a66' } });
    c.prop('trolley', 1.8, -.3);
  };
  // The same chair is present twice, including one originally decorative
  // solid:false placement: both must behave identically.
  level.start.x = start.cx - 1.65;
  level.start.z = start.cz + 1.45;
  level.start.yaw = 0;
}
