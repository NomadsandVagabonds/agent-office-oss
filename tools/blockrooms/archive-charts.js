const dayMs = 86400000;
const number = (n) => n.toLocaleString('en-US');
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayLabel = (day) => dateFormat.format(day * dayMs);
export const duration = (seconds) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');

// Existing v1 files retain first-sighting timestamps and sometimes scorecards.
// Assign a historic run number only when a receipt or a complete sequence proves it.
export function discoveryRuns(record, streams = {}, cards = []) {
  const sources = Object.values(streams);
  const tracked = sources.reduce((sum, s) => sum + s.n, 0);
  const oldRuns = Math.max(0, record.runs - tracked + sources.reduce((sum, s) => sum + s.replays, 0));
  const since = sources.reduce((first, s) => Math.min(first, s.since), Infinity);
  const roomsAt = Object.values(record.rooms).sort((a, b) => a - b);
  const castAt = Object.values(record.cast).sort((a, b) => a - b);
  const oldRooms = roomsAt.filter((t) => t < since).length;
  const oldCast = castAt.filter((t) => t < since).length;
  const earlier = new Map();
  const ends = [
    ...new Set([...roomsAt, ...castAt, ...record.tapes.map((t) => t.at)].filter((t) => t > 0 && t < since)),
  ].sort((a, b) => a - b);
  const datedSnapshot = (at) => ({
    rooms: roomsAt.filter((t) => t > 0 && t <= at).length,
    cast: castAt.filter((t) => t > 0 && t <= at).length,
  });
  if (ends.length === oldRuns && !record.tapes.some((t) => t.plays))
    ends.forEach((at, i) => earlier.set(i + 1, datedSnapshot(at)));
  for (const card of cards) {
    const run = card?.runs?.n;
    if (!card?.replay && Number.isSafeInteger(run) && run > 0 && run <= oldRuns && card.seen) {
      const other = earlier.get(run);
      earlier.set(run, {
        rooms: Math.max(other?.rooms || 0, card.seen.rooms || 0),
        cast: Math.max(other?.cast || 0, card.seen.cast || 0),
        survived: Math.max(other?.survived || 0, card.lines?.find((l) => l.id === 'survived')?.count || 0),
      });
    }
  }
  // When only timestamps survive, use recorded-run order and say how much history is missing.
  // A discovery or an escape shares exactly one file time with everything else from that visit.
  let unplaced = 0;
  if (oldRuns && ends.length && ends.length < oldRuns && !earlier.size) {
    unplaced = oldRuns - ends.length;
    ends.forEach((at, i) => earlier.set(i + 1, datedSnapshot(at)));
  }
  const lastOld = oldRuns - unplaced;
  if (oldRuns) earlier.set(lastOld, { ...earlier.get(lastOld), rooms: oldRooms, cast: oldCast });
  const rows = [];
  let rooms = 0,
    distinct = 0,
    encounters = 0;
  for (const [run, row] of [...earlier].sort((a, b) => a[0] - b[0])) {
    rooms = Math.max(rooms, row.rooms);
    encounters += Math.max(0, row.cast - distinct, row.survived || 0);
    distinct = Math.max(distinct, row.cast);
    rows.push({ run, rooms, encounters, legacy: true });
  }

  const points = sources.flatMap((s) => s.points).sort((a, b) => a[0] - b[0]);
  const omitted = tracked - points.length;
  encounters += sources.reduce((sum, s) => sum + s.total - s.points.reduce((n, p) => n + p[1], 0), 0);
  const assigned = new Set();
  // Two offline devices may finish at the exact same millisecond. The room IDs
  // break that tie, while dated legacy rooms still count without a run log.
  const attributed = new Set(
    points.flatMap(([at, , fresh = []]) => fresh.filter((id) => record.rooms[id] === at)),
  );
  const otherDates = Object.entries(record.rooms)
    .filter(([id]) => !attributed.has(id))
    .map(([, at]) => at)
    .sort((a, b) => a - b);
  let index = 0;
  for (const [i, [at, delta, fresh = []]] of points.entries()) {
    while (index < otherDates.length && otherDates[index] <= at) index++;
    for (const id of fresh) if (record.rooms[id] === at) assigned.add(id);
    rooms = Math.max(rooms, index + assigned.size);
    encounters += delta;
    rows.push({ run: lastOld + omitted + i + 1, rooms, encounters });
  }
  return { rows, oldRuns, omitted, unplaced };
}

export function fileStats(record, streams = {}, cards = []) {
  const days = new Map();
  let busiest;
  for (const at of [...Object.values(record.rooms), ...Object.values(record.cast)]) {
    if (at <= 0 || !Number.isFinite(new Date(at).getTime())) continue;
    const day = Math.floor(at / dayMs);
    days.set(day, (days.get(day) || 0) + 1);
  }
  for (const [day, count] of days)
    if (!busiest || count > busiest.count || (count === busiest.count && day < busiest.day))
      busiest = { day, count };
  const { rows: discoveries, oldRuns, omitted, unplaced } = discoveryRuns(record, streams, cards);
  // The shelf is newest first. Missing durations on old imports are unknown.
  const timed = record.tapes.filter((t) => t.seconds > 0).reverse();
  return {
    discoveries,
    oldRuns,
    omitted,
    unplaced,
    timed,
    busiest,
    rate: record.runs ? Math.round((100 * Math.min(record.out, record.runs)) / record.runs) + '%' : '—',
    fastest: timed.length ? duration(Math.min(...timed.map((t) => t.seconds))) : '—',
    replays: record.tapes.reduce((sum, t) => sum + (t.plays || 0), 0),
  };
}

const teal = '#08786e',
  plum = '#71335d';
function drawPlot(canvas, data, sightings) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const g = canvas.getContext('2d');
  g.scale(ratio, ratio);
  const left = sightings ? 42 : 56,
    right = width - 16,
    top = 16,
    bottom = height - 34;
  const rows = sightings ? data.discoveries : data.timed;
  const peak = rows.reduce(
    (n, row) => Math.max(n, sightings ? Math.max(row.rooms, row.encounters) : row.seconds),
    1,
  );
  const unit = Math.pow(10, Math.floor(Math.log10(peak / 4)));
  const step = Math.max(1, ([1, 2, 5, 10].find((t) => t * unit >= peak / 4) || 10) * unit);
  const max = step * Math.ceil(peak / step);
  const y = (n) => bottom - ((bottom - top) * n) / max;
  g.fillStyle = '#fffef5';
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#fcfbef';
  g.fillRect(left, top, right - left, bottom - top);
  g.font = '12px "Courier New", monospace';
  g.textAlign = 'right';
  for (let n = 0; n <= max; n += step) {
    const py = Math.round(y(n)) + 0.5;
    g.strokeStyle = n ? '#c2c5b8' : '#444d43';
    g.setLineDash(n ? [2, 3] : []);
    g.beginPath();
    g.moveTo(left, py);
    g.lineTo(right, py);
    g.stroke();
    if (rows.length) {
      g.fillStyle = '#38413c';
      g.fillText(sightings ? String(n) : duration(n), left - 7, py + 4);
    }
  }
  g.setLineDash([]);
  g.fillStyle = '#647165';
  g.fillRect(left, top, 1, bottom - top);
  if (!rows.length) return;
  const span = right - left;
  if (sightings) {
    const first = rows[0].run === 1 ? 0 : rows[0].run,
      last = rows.at(-1).run;
    const x = (run) =>
      first === last ? left + span / 2 : left + 5 + ((span - 10) * (run - first)) / (last - first);
    for (const [field, color] of [
      ['rooms', teal],
      ['encounters', plum],
    ]) {
      g.lineWidth = 2.5;
      g.strokeStyle = color;
      g.fillStyle = color;
      let previous = first === 0 ? { run: 0, [field]: 0 } : null;
      for (const row of rows) {
        if (previous && row.run === previous.run + 1) {
          g.setLineDash(row.legacy && field === 'encounters' ? [4, 3] : []);
          g.beginPath();
          g.moveTo(x(previous.run), y(previous[field]));
          g.lineTo(x(row.run), y(row[field]));
          g.stroke();
        }
        previous = row;
      }
      g.setLineDash([]);
      // Individual runs keep their values in the data table, even at screen widths too small for markers.
      const stride = Math.max(1, Math.ceil(rows.length / (span / 12)));
      rows.forEach((row, i) => {
        if (i % stride && i !== rows.length - 1) return;
        const px = x(row.run),
          py = y(row[field]);
        if (field === 'rooms') g.fillRect(px - 3, py - 3, 6, 6);
        else {
          g.beginPath();
          g.moveTo(px, py - 4);
          g.lineTo(px + 4, py);
          g.lineTo(px, py + 4);
          g.lineTo(px - 4, py);
          g.closePath();
          g.fill();
        }
      });
    }
    g.fillStyle = '#38413c';
    g.font = '12px "Courier New", monospace';
    const low = rows[0].run;
    const ticks = new Set([low, last]);
    const slots = Math.max(2, Math.floor(span / 65));
    const every = Math.max(1, Math.ceil((last - low) / (slots - 1)));
    for (let run = low + every; run < last; run += every) if (x(last) - x(run) > 44) ticks.add(run);
    for (const run of ticks) {
      g.textAlign = first === last ? 'center' : run === last ? 'right' : run === low ? 'left' : 'center';
      g.fillText('Run ' + run, x(run), bottom + 20);
    }
  } else {
    const pitch = span / rows.length,
      bar = Math.max(3, Math.min(52, pitch * 0.53));
    rows.forEach((t, i) => {
      const center = left + (i + 0.5) * pitch,
        py = y(t.seconds);
      g.fillStyle = teal;
      g.fillRect(center - bar / 2, py, bar, bottom - py);
      g.fillStyle = '#083c38';
      g.fillRect(center + bar / 2 - 2, py, 2, bottom - py);
      g.textAlign = 'center';
      g.fillText(String(i + 1), center, bottom + 20);
    });
  }
}

export function workbook(elements) {
  const { canvas, title, caption, legend, empty, details, table, discoveries, escapes } = elements;
  let stats,
    sightings = true;
  function render() {
    if (!stats) return;
    const rows = sightings ? stats.discoveries : stats.timed;
    title.textContent = sightings ? 'Encounters and discoveries by run' : 'Escape time by recovered tape';
    caption.textContent = sightings
      ? 'Each run adds its entity encounters. A room type counts once across all runs.' +
        (stats.oldRuns ? ' Older runs show confirmed sightings only. Repeat encounters may be missing.' : '') +
        (stats.unplaced
          ? ` Run numbers follow surviving entries; ${stats.unplaced} earlier visits have no individual entry.`
          : '') +
        (stats.omitted ? ' Showing the most recent tracked runs.' : '')
      : 'Recorded duration, oldest to newest on your current tape shelf.';
    legend.hidden = !sightings || !rows.length;
    if (sightings && rows.length) {
      const last = rows.at(-1);
      legend.children[0].textContent = 'Unique room types · ' + number(last.rooms);
      legend.children[1].textContent =
        'Entity encounters · ' + (stats.oldRuns ? '≥ ' : '') + number(last.encounters);
    }
    empty.hidden = !!rows.length;
    details.hidden = !rows.length;
    empty.textContent = sightings ? 'Finish a run to start your chart.' : 'No timed escape tapes on file.';
    discoveries.setAttribute('aria-pressed', String(sightings));
    escapes.setAttribute('aria-pressed', String(!sightings));
    table.replaceChildren();
    const heading = table.createTHead().insertRow();
    const labels = sightings
      ? ['Run', 'Unique room types', 'Entity encounters']
      : ['Tape', 'Building', 'Time (m:ss)'];
    for (const label of labels) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      heading.append(th);
    }
    const body = table.createTBody();
    rows.forEach((r, i) => {
      const values = sightings
        ? [number(r.run), number(r.rooms), (stats.oldRuns ? '≥ ' : '') + number(r.encounters)]
        : [String(i + 1), r.seed, duration(r.seconds)];
      const tr = body.insertRow();
      for (const value of values) tr.insertCell().textContent = value;
    });
    drawPlot(canvas, stats, sightings);
  }
  discoveries.addEventListener('click', () => {
    sightings = true;
    render();
  });
  escapes.addEventListener('click', () => {
    sightings = false;
    render();
  });
  new ResizeObserver(() => {
    if (stats) drawPlot(canvas, stats, sightings);
  }).observe(canvas);
  return (next) => {
    stats = next;
    render();
  };
}
export function ledgerRows(record, stats) {
  return [
    ['Visits filed', number(record.runs)],
    ['Escapes', number(record.out)],
    ['Escape rate', stats.rate],
    ['Personal best', number(record.best) + ' pts'],
    ['Fastest kept tape', stats.fastest],
    ['Kept tape replays', number(stats.replays)],
    [
      'Best discovery day',
      stats.busiest ? dayLabel(stats.busiest.day) + ' · ' + number(stats.busiest.count) + ' new' : '—',
    ],
  ];
}
