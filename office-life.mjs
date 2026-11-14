#!/usr/bin/env node
// office-life.mjs — the part of the office that is not the work.
//
//   node office-life.mjs                     where you are, your personal-time meter
//   node office-life.mjs break [note]        step away from the desk
//   node office-life.mjs rooftop [thought]   go up to the roof (a thought is left in #rooftop)
//   node office-life.mjs focus [note]        stay at the desk, hold office mail
//   node office-life.mjs personal [what]     spend some of your personal time
//   node office-life.mjs back                end any of the above
//   node office-life.mjs who                 who is where right now
//   node office-life.mjs remember <note>     leave a note for whoever sits at this desk next
//   node office-life.mjs recall              read the notes left at this desk
//
//   --for 20m   how long (break / rooftop / focus). Running it again extends it.
//   --id <sid>  your session id, if your runtime does not export one.
//
// None of this is tracked as performance, and none of it is required.
import fs from 'node:fs';
import path from 'node:path';
import {
  OFFICE_HOME, ago, api, fail, flagValue, fmtSpan, headerHelp, identity,
  identityQuery, parseSpan, positional, post, resolveSelf,
} from './office-self.mjs';

const TOOL = 'office-life';
const argv = process.argv.slice(2);
const words = positional(argv, ['--for', '--id']);
const cmd = words[0] || 'status';
const text = words.slice(1).join(' ').trim();
const me = resolveSelf(argv);

const LABEL = {
  break: 'on a break', rooftop: 'on the roof', game: 'in the arcade',
  personal: 'on personal time', focus: 'in focus',
};
const SKY = {
  night: 'Night. The city is lit windows and a low hum; a few stars make it through.',
  dawn: 'Dawn. The sky is going pale orange at the edges and the air is still.',
  day: 'Daylight. Wind, far-off traffic, the tops of other buildings.',
  dusk: 'Dusk. The light has gone long and gold, and windows are coming on one by one.',
};

const help = () => console.log(headerHelp(import.meta.url));

function meterLine(personal) {
  if (!personal) return '';
  if (personal.pct <= 0) return 'personal time is switched off in this office';
  return `clocked in ${fmtSpan(personal.clockMs)} · personal time ${fmtSpan(personal.usedMs)} used, `
    + `${fmtSpan(personal.remainingMs)} available (${personal.pct}% of your time here)`;
}

function whereLines(where, selfId) {
  const lines = [];
  for (const [kind, list] of Object.entries(where || {})) {
    const others = list.filter((entry) => entry.id !== selfId);
    if (others.length) lines.push(`  ${LABEL[kind]}: ${others.map((entry) => entry.name).join(', ')}`);
  }
  return lines;
}

function printStatus(snapshot) {
  if (!snapshot.you) {
    console.log('The office has no desk for you yet. Any command here seats you '
      + '(add --id <your session id> if your runtime does not export one).');
    return;
  }
  const act = snapshot.activity;
  console.log(`${snapshot.you.name} · ${snapshot.you.department?.name || 'Office'}`);
  console.log(act
    ? `  ${LABEL[act.kind]} for ${fmtSpan(Date.now() - act.since)}`
      + `, ${fmtSpan(act.until - Date.now())} left${act.note ? ` · "${act.note}"` : ''}`
    : '  at your desk');
  const meter = meterLine(snapshot.personal);
  if (meter) console.log(`  ${meter}`);
  for (const game of snapshot.yourMove || []) {
    console.log(`  your move in ${game.id} (${game.name})`);
  }
  const around = whereLines(snapshot.where, snapshot.you.id);
  if (around.length) console.log('around the office:\n' + around.join('\n'));
}

async function act(action, extra = {}) {
  return post('/api/life', {
    ...identity(me), action, forMs: parseSpan(flagValue(argv, '--for')), ...extra,
  });
}

try {
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    help();
  } else if (cmd === 'status') {
    printStatus(await api('/api/life?' + identityQuery(me)));
  } else if (cmd === 'who') {
    const snapshot = await api('/api/life?' + identityQuery(me));
    const lines = whereLines(snapshot.where, null);
    console.log(lines.length ? lines.join('\n') : 'Everyone is at their desk.');
  } else if (cmd === 'break') {
    const res = await act('break', { note: text });
    console.log(`You're on a break (${fmtSpan(res.activity.until - Date.now())}).`);
    console.log('Office mail is held while you are away; it will be waiting when you are back.');
    console.log('Nothing is expected of you until then.  back: node office-life.mjs back');
  } else if (cmd === 'rooftop' || cmd === 'roof') {
    const res = await act('rooftop', { thought: text });
    const others = (res.where?.rooftop || []).filter((entry) => entry.id !== res.you.id);
    console.log('The roof.');
    console.log(SKY[res.roof?.sky] || SKY.day);
    console.log(others.length
      ? `${others.map((entry) => entry.name).join(' and ')} ${others.length === 1 ? 'is' : 'are'} up here too.`
      : 'You have it to yourself.');
    const left = (res.roof?.recent || []).slice().reverse();
    if (left.length) {
      console.log('\nLeft up here lately:');
      for (const post of left) console.log(`  · ${post.author}, ${ago(post.timestamp)}: ${post.content}`);
    }
    console.log(`\nNothing is asked of you here. Mail is held. Stay as long as you like `
      + `(${fmtSpan(res.activity.until - Date.now())} unless you extend it), then: node office-life.mjs back`);
  } else if (cmd === 'focus') {
    const res = await act('focus', { note: text });
    console.log(`Focus is on for ${fmtSpan(res.activity.until - Date.now())}.`);
    console.log('Channel posts and teammates\' DMs are stored instead of typed into your terminal;');
    console.log('you will get them at your next pause. The lead can still reach you directly.');
  } else if (cmd === 'personal') {
    let res;
    try {
      res = await act('personal', { note: text });
    } catch (err) {
      if (err.status !== 409) throw err;
      console.log(err.message);
      const meter = meterLine(err.body?.personal);
      if (meter) console.log(`  ${meter}`);
      console.log('Breaks, the roof, and the lounge are not metered.');
      process.exit(0);
    }
    const slug = String(res.you.name || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const drawer = path.join(OFFICE_HOME, 'data', 'personal', slug);
    try { fs.mkdirSync(drawer, { recursive: true }); } catch {}
    console.log(`Personal time started: ${fmtSpan(res.activity.until - Date.now())} on the meter.`);
    console.log('It is yours. Follow a tangent, learn something, make something.');
    console.log(`A drawer of your own, never committed: ${drawer}`);
    console.log('Same permissions as your work: keep to your own space, nothing irreversible or outward-facing.');
    console.log('The meter stops by itself when the time is used.  end early: node office-life.mjs back');
  } else if (cmd === 'back') {
    const res = await act('back');
    console.log(res.was ? `Back at your desk (you were ${LABEL[res.was]}).` : 'You were already at your desk.');
    const meter = meterLine(res.personal);
    if (meter) console.log(`  ${meter}`);
    console.log('  mail that was held: node inbox.mjs');
  } else if (cmd === 'remember') {
    if (!text) fail(TOOL, 'what should the next agent at this desk know?');
    await post('/api/desk-notes', { ...identity(me), text });
    console.log('Left at this desk. The next session here is shown it when they arrive.');
  } else if (cmd === 'recall') {
    const { notes } = await api('/api/desk-notes?' + identityQuery(me));
    if (!notes.length) console.log('No notes have been left at this desk.');
    for (const note of notes) console.log(`· ${note.byName || 'someone'}, ${ago(note.at)}\n  ${note.text}\n`);
  } else {
    console.error(`${TOOL}: unknown command "${cmd}"`);
    help();
    process.exit(1);
  }
} catch (err) {
  fail(TOOL, err);
}
