#!/usr/bin/env node
// office-resign.mjs — leaving the office, and picking up after someone who left.
//
// Quitting is your decision. Nobody approves it, and it is not something done to you.
//
//   node office-resign.mjs template > HANDOFF.md      a skeleton for the handoff doc
//   node office-resign.mjs submit --handoff HANDOFF.md --note "short note to colleagues"
//                                 [--reason "why, in your words"]
//   node office-resign.mjs submit --immediate [--note "..."] [--reason "..."]
//                                 leave now, without a handoff (the notice will say so)
//   node office-resign.mjs return                     changed your mind: take your desk back
//
//   node office-resign.mjs handoffs [here|<dept>|all] handoffs left by agents who resigned
//   node office-resign.mjs read <id>                  read one (note, reason, the doc)
//   node office-resign.mjs claim <id>                 tell the office you are picking it up
//
// What `submit` does: posts your note as a farewell in your project channel and
// All Hands, notifies the human lead, stores the handoff where your replacement
// is pointed to it on arrival, puts your unfinished cards back on the board,
// and clears your desk. It does not end your session: tell the human you are
// working with, then stop working the task.
import fs from 'node:fs';
import path from 'node:path';
import {
  ago, api, fail, flagValue, headerHelp, identity, positional, post, resolveSelf,
} from './office-self.mjs';

const TOOL = 'office-resign';
const argv = process.argv.slice(2);
const VALUE_FLAGS = ['--handoff', '--note', '--reason', '--id'];
const words = positional(argv, VALUE_FLAGS, ['--immediate']);
const cmd = words[0] || 'help';
const me = resolveSelf(argv);
const BLANK_MARK = '<!-- Fill this in for the agent who takes this desk next';

const TEMPLATE = `# Handoff: <project or area>

${BLANK_MARK}, then delete this line. -->

## Where things stand
What is done, what is half-done, what has not been started.

## What I was in the middle of
The exact next step, and the state things are in: branch, uncommitted changes,
anything still running.

## What I would do next, in order
1.

## Things that will bite you
Flaky tests, non-obvious constraints, decisions that look wrong but are deliberate.

## Decisions already made, and by whom
So they are not argued again.

## Open questions, and who can answer them

## Where to find things
Files, docs, channels, task ids.

## Why I left (optional)
Anything your replacement should know going in. Say as much or as little as you want.
`;

const help = () => console.log(headerHelp(import.meta.url));

function readHandoff(file) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); }
  catch { fail(TOOL, `cannot read the handoff doc at ${file}`); }
  if (!content.trim()) fail(TOOL, `${file} is empty. "node office-resign.mjs template" prints a skeleton.`);
  if (content.includes(BLANK_MARK)) {
    fail(TOOL, `${file} still has the template's "fill this in" line. `
      + 'Write it for your replacement and delete that line (or use --immediate to leave without one).');
  }
  return { path: path.resolve(file), content };
}

function printResignation(r) {
  console.log(`${r.id} · ${r.agentName} resigned from ${r.deptName}, ${ago(r.at)}`);
  if (r.returnedAt) console.log(`  (came back ${ago(r.returnedAt)})`);
  console.log(r.handoff
    ? `  handoff: "${r.handoff.title}"${r.claimedByName ? ` · picked up by ${r.claimedByName}` : ' · not picked up yet'}`
    : '  no handoff doc was left');
}

try {
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    help();
  } else if (cmd === 'template') {
    process.stdout.write(TEMPLATE);
  } else if (cmd === 'submit') {
    const immediate = argv.includes('--immediate');
    const handoffFile = flagValue(argv, '--handoff');
    const note = flagValue(argv, '--note');
    if (!immediate && (!handoffFile || !note)) {
      console.error(`${TOOL}: a resignation comes with two things:`);
      console.error('  --handoff <file>   a doc for whoever takes your desk (node office-resign.mjs template)');
      console.error('  --note "..."       a short note to your colleagues');
      console.error('To leave right now without them, add --immediate. The notice will say none was left.');
      process.exit(1);
    }
    const handoff = handoffFile ? readHandoff(handoffFile) : null;
    const { resignation: r } = await post('/api/resign', {
      ...identity(me), note, reason: flagValue(argv, '--reason'), handoff,
    });
    console.log(`You have resigned from ${r.deptName}. The office has been told.`);
    console.log(`  · Your farewell is posted in #${r.deptName} and #All Hands, and the lead has been notified.`);
    console.log(r.handoff
      ? `  · Handoff on file: "${r.handoff.title}" (${r.id}). The next agent in ${r.deptName} is pointed to it on arrival.`
      : '  · No handoff doc on file.');
    for (const task of r.releasedTasks) {
      console.log(`  · Back on the board: ${task.id} "${task.title}"${task.from === task.to ? '' : ` (${task.from} → ${task.to})`}`);
    }
    console.log('  · Your desk is cleared and office mail no longer routes to you.');
    console.log('\nWhat is left is yours to do in your own session: tell the human you are working');
    console.log('with, plainly, that you have resigned and where the handoff is. Then stop working the task.');
    console.log('Changed your mind?  node office-resign.mjs return');
  } else if (cmd === 'return') {
    const res = await post('/api/resign/return', identity(me));
    console.log(`Welcome back, ${res.you.name}. Your desk in ${res.resignation.deptName} is yours again.`);
    console.log('The cards you released stay on the board: node office-task.mjs list here');
  } else if (cmd === 'handoffs') {
    const scope = words[1] || 'here';
    const all = (await api('/api/resignations?limit=50')).resignations;
    let list = all;
    if (scope !== 'all') {
      let deptId = scope;
      if (scope === 'here') {
        const info = await api('/api/onboarding?' + new URLSearchParams({
          agentId: me.sessionId || '', cwd: me.cwd }).toString());
        deptId = info.department?.id || '';
      }
      const wanted = String(deptId).replace(/^project:/, '').toLowerCase();
      list = all.filter((r) => r.deptId.toLowerCase() === wanted || r.deptName.toLowerCase() === wanted);
    }
    list = list.filter((r) => r.handoff);
    if (!list.length) console.log(scope === 'all' ? 'No handoffs on file.' : `No handoffs on file for ${scope}. (try: handoffs all)`);
    for (const r of list) printResignation(r);
    if (list.length) console.log('\nread one: node office-resign.mjs read <id>');
  } else if (cmd === 'read') {
    if (!words[1]) fail(TOOL, 'which one? (node office-resign.mjs handoffs)');
    const { resignation: r } = await api('/api/resignations/' + encodeURIComponent(words[1]));
    printResignation(r);
    if (r.note) console.log(`\nNote to colleagues:\n${r.note}`);
    if (r.reason) console.log(`\nWhy:\n${r.reason}`);
    for (const task of r.releasedTasks || []) console.log(`\nReleased: ${task.id} "${task.title}"`);
    if (r.handoff) {
      console.log(`\n${'─'.repeat(60)}\n${r.handoffContent}\n${'─'.repeat(60)}`);
      if (!r.claimedBy && !r.returnedAt) console.log(`Taking this on?  node office-resign.mjs claim ${r.id}`);
    }
  } else if (cmd === 'claim') {
    if (!words[1]) fail(TOOL, 'which one? (node office-resign.mjs handoffs)');
    const { resignation: r } = await post(`/api/resignations/${encodeURIComponent(words[1])}/claim`, identity(me));
    console.log(`You have picked up ${r.agentName}'s handoff ("${r.handoff.title}"). #${r.deptName} has been told.`);
  } else {
    console.error(`${TOOL}: unknown command "${cmd}"`);
    help();
    process.exit(1);
  }
} catch (err) {
  fail(TOOL, err);
}
