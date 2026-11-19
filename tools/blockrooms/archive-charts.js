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

export function fileStats(record) {
  const days = new Map();
  for (const field of ['rooms', 'cast'])
    for (const at of Object.values(record[field])) {
      if (at <= 0 || !Number.isFinite(new Date(at).getTime())) continue;
      const day = Math.floor(at / dayMs);
      const row = days.get(day) || { day, rooms: 0, cast: 0 };
      row[field]++;
      days.set(day, row);
    }
  let rooms = 0,
    cast = 0,
    busiest;
  const discoveries = [...days.values()]
    .sort((a, b) => a.day - b.day)
    .map((row) => {
      const count = row.rooms + row.cast;
      if (!busiest || count > busiest.count) busiest = { day: row.day, count };
      rooms += row.rooms;
      cast += row.cast;
      return { day: row.day, rooms, cast };
    });
  // The shelf is newest first. Missing durations on old imports are unknown.
  const timed = record.tapes.filter((t) => t.seconds > 0).reverse();
  return {
    discoveries,
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
  const peak = rows.reduce((n, row) => Math.max(n, sightings ? Math.max(row.rooms, row.cast) : row.seconds), 1);
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
    const first = rows[0].day,
      last = rows.at(-1).day;
    const x = (day) =>
      first === last ? left + span / 2 : left + 5 + ((span - 10) * (day - first)) / (last - first);
    for (const [field, color] of [
      ['rooms', teal],
      ['cast', plum],
    ]) {
      g.lineWidth = 2;
      g.strokeStyle = color;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x(first), y(rows[0][field]));
      for (let i = 1; i < rows.length; i++) {
        g.lineTo(x(rows[i].day), y(rows[i - 1][field]));
        g.lineTo(x(rows[i].day), y(rows[i][field]));
      }
      g.stroke();
      for (const row of rows) {
        const px = x(row.day),
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
      }
    }
    g.fillStyle = '#38413c';
    g.textAlign = first === last ? 'center' : 'left';
    g.fillText(dayLabel(first), first === last ? x(first) : left, bottom + 21);
    if (first !== last) {
      g.textAlign = 'right';
      g.fillText(dayLabel(last), right, bottom + 21);
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
    title.textContent = sightings ? 'First sightings over time' : 'Escape time by recovered tape';
    caption.textContent = sightings
      ? 'Cumulative room types and entities, by first recorded date (UTC).'
      : 'Recorded duration, oldest to newest on your current tape shelf.';
    legend.hidden = !sightings || !rows.length;
    empty.hidden = !!rows.length;
    details.hidden = !rows.length;
    empty.textContent = sightings ? 'No dated sightings on file.' : 'No timed escape tapes on file.';
    discoveries.setAttribute('aria-pressed', String(sightings));
    escapes.setAttribute('aria-pressed', String(!sightings));
    table.replaceChildren();
    const heading = table.createTHead().insertRow();
    const labels = sightings
      ? ['First seen (UTC)', 'Room types', 'Entities']
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
        ? [dayLabel(r.day), number(r.rooms), number(r.cast)]
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
