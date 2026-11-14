#!/usr/bin/env node
// The cut. One list of pieces of picture, in order; where a sound belongs to a piece it is written beside it, so
// moving a shot moves its sound. Music runs between named pieces.
//
//   node edit/cut.mjs [--no-cards] [--post] [--sheet] [--list] [--out file.mp4] [--only id,id]
//                     [--clips dir] [--cards dir] [--audio dir] [--music dir]
//
// The soundtrack decides where the cuts fall. From the title card to the wall in the basement the film is laid on the
// bars of "Glitch Basement" (a bar every 3.4425 s once it gets going), so most pieces are given in beats. A card
// (`card: true`) is a whole number of beats long, which is why --no-cards can take them all out and stay in time.
//
// Every piece is cut out of its clip to its own small file (work/<id>-<recipe>.mp4, re-used while its recipe is
// unchanged), the files are joined without re-encoding, and the sound is mixed in one pass and laid under them.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const SCRATCH = process.env.PROMO_SCRATCH || path.join(HERE, '..', 'out');
const CLIPS = path.resolve(flag('clips', path.join(SCRATCH, 'clips')));
const CARDS = path.resolve(flag('cards', path.join(SCRATCH, 'cards')));
const AUDIO = path.resolve(flag('audio', process.env.PROMO_AUDIO || path.join(HERE, '..', '..', 'public', 'audio')));
// the two tracks the film is scored with are not the project's and are not in the repository: glitch-basement.mp3, room4.mp3
const MUSIC = path.resolve(flag('music', process.env.PROMO_MUSIC || path.join(SCRATCH, 'music')));
const WORK = path.join(SCRATCH, 'work');
const NO_CARDS = argv.includes('--no-cards');
const OUT = path.resolve(flag('out', path.join(SCRATCH, NO_CARDS ? 'agent-office-v2-nocards.mp4' : 'agent-office-v2.mp4')));
const FPS = 30;
fs.mkdirSync(WORK, { recursive: true });

/* ---- time ------------------------------------------------------------------------------------------------------- */
const BEAT = 3.4425 / 4;
const b = (n) => n * BEAT;
// Where the soundtrack's first bars fall (seconds into the track): a hit as it starts, a quiet bar, a hit, a quiet
// bar, and at 13.96 it comes in properly. The title appears on the first, the new office on the second, somebody
// steps out of the lift on the third, and she starts choosing a face when the track comes in.
const HIT = { title: 0.2, office: 3.63, lift: 6.98, in: 13.94 };

/* ---- the picture ---------------------------------------------------------------------------------------------- */
// { id, clip | still, in, dur | beats, speed?, crop?, caption?, glitch?, card?, sfx?: [[seconds into the piece, name, dB?]], fade? }
//   dur is how long the piece lasts in the cut (beats: the same, in beats); it eats dur × speed seconds of its clip.
//   still: a picture from out/cards held for that long, instead of a clip.
//   screen: a clip of light on black (the end title) laid over this one, which is dimmed and softened to take it.
//   crop: [w, h, x, y] of the 1920×1080 frame to fill the screen with (x and y may be ffmpeg expressions of t, the piece's own clock).
//   pad: beats this piece is given when the section cards are left out (--no-cards), so the film keeps its length and its bars.
//   glitch: 'head' | 'tail' — a fifth of a second of colour coming apart, for the cut between the old office and the title.
//   A sound called 'static:0.6' is that many seconds of tape noise, made here.
const SHEET = [1280, 720, 490, 92];          // the Comms sheet's reading column, for the note an agent leaves
const PIECES = [
  /* the office as it was */
  { id: 'old1', clip: 'classic', in: 0.4, dur: 1.8, fade: 'in', sfx: [[0.1, 'typing', -6], [1.0, 'typing', -8]] },
  { id: 'old2', clip: 'classic', in: 3.2, dur: 1.4, glitch: 'tail', sfx: [[0.2, 'typing', -8]] },
  /* what it is called now. (Not a card that --no-cards takes out: this one was asked for either way.) */
  { id: 'title', clip: 'titleMain', in: 0, dur: HIT.office - HIT.title },
  { id: 'hero', clip: 'hero', in: 0.8, dur: HIT.lift - HIT.office },

  /* someone new */
  { id: 'lift', clip: 'liftOut', in: 0.3, dur: 2.52, caption: 'cmd-join', sfx: [[0.0, 'lift-doors', -6]] },
  { id: 'walk', clip: 'walk', in: 0.4, dur: 2.0 },
  { id: 'sit', clip: 'sit', in: 1.5, dur: HIT.in - HIT.lift - 4.52, sfx: [[1.7, 'typing', -8]] },
  // twelve changes of mind, one every half beat (she had them a second apart)
  { id: 'looks', clip: 'looks2', in: 0.92, beats: 6, speed: 1 / (BEAT / 2), caption: 'cmd-me' },
  // four things for the desk, one a beat
  { id: 'desk', clip: 'desk2', in: 0.47, beats: 4, speed: 0.8 / BEAT, caption: 'cmd-desk', sfx: [0, 1, 2, 3].map((n) => [0.03 + b(n), 'sticky', -10]) },

  /* working together */
  { id: 'note', clip: 'plane', in: 0.45, beats: 4, speed: 0.5, caption: 'cmd-dm', sfx: [[0.6, 'paper-plane', -1]] },
  { id: 'pair', clip: 'pairL', in: 1.2, beats: 3.5 },
  { id: 'done', clip: 'done', in: 0.5, beats: 3.5, sfx: [[0.2, 'sticky', -5], [1.8, 'sticky', -5], [1.9, 'confetti', -2]] },
  { id: 'needs', clip: 'needs', in: 0.9, beats: 3, sfx: [[0.3, 'needs-you', -2]] },

  /* the same office, as text */
  { id: 'cardUi', clip: 'titleUi', in: 0, beats: 3, card: true },
  { id: 'con1', clip: 'console', in: 0.5, beats: 4, pad: 1, speed: 3.1, crop: [1536, 864, 0, 'if(lt(t,0.95),216,216*max(0,1-(t-0.95)/0.4))'], sfx: [[0.05, 'typing', -6], [0.5, 'typing', -8]] },
  { id: 'con2', clip: 'console', in: 12.6, beats: 2.5, speed: 1.55, crop: [1536, 864, 0, 216] },
  { id: 'con3', clip: 'console', in: 19.3, beats: 2.5, sfx: [[0.3, 'sticky', -8], [1.7, 'sticky', -8]] },

  /* turns end */
  { id: 'kitchen', clip: 'kitchenL', in: 0.6, beats: 3.5, pad: 1, sfx: [[0.2, 'coffee', -5], [1.6, 'vend', -7]] },
  { id: 'jukebox', clip: 'jukebox', in: 1.6, beats: 2.5, caption: 'cmd-jukebox', sfx: [[0.3, 'coin', -5]] },
  { id: 'disco', clip: 'disco', in: 2.0, beats: 4, pad: 1 },

  /* somebody resigns: her context is full, so she leaves a handoff and a note, and takes the lift */
  { id: 'resign1', clip: 'resignDesk', in: 0.5, beats: 3, caption: 'cmd-resign', sfx: [[0.7, 'paper-plane', -4]] },
  { id: 'resign2', clip: 'resignWalk', in: 3.3, beats: 2.5, sfx: [[1.0, 'lift-doors', -6]] },
  { id: 'resign3', clip: 'resignNote', in: 0.85, beats: 1.5, crop: [1120, 630, 0, 450] },
  { id: 'resign4', clip: 'resignNote', in: 2.5, beats: 3, crop: SHEET },

  /* the lift */
  { id: 'cardEggs', clip: 'titleEggs', in: 0, beats: 3, card: true },
  { id: 'panel', clip: 'liftRoof2', in: 1.5, beats: 3, pad: 1, sfx: [[0, 'lift-doors', -6], [2.1, 'lift-closing', -2]] },
  { id: 'ride', clip: 'liftRoof2', in: 4.5, beats: 3, speed: 2.0, sfx: [[0.3, 'lift-up', -2], [2.2, 'lift-ding', -3]] },
  { id: 'roof', clip: 'roof', in: 0.6, beats: 3.5, pad: 1, sfx: [[0.1, 'lift-roof', -1]] },
  { id: 'pasture', clip: 'pasture', in: 0.8, beats: 3, pad: 1, sfx: [[0.0, 'lift-down', -3], [0.9, 'goat-1', -3], [2.1, 'goat-bell', -9]] },
  { id: 'goats', clip: 'goats', in: 1.2, beats: 2, sfx: [[0.2, 'goat-3', -3], [1.1, 'goat-2', -5]] },
  { id: 'scranton', clip: 'scranton', in: 1.2, beats: 2 },
  { id: 'night9', clip: 'nightshift', in: 1.5, beats: 2.5 },
  { id: 'crow1', clip: 'crowbar', in: 1.4, beats: 2.5 },
  { id: 'crow2', clip: 'crowbar', in: 5.6, beats: 1.5, sfx: [[0.5, 'squash', 0]] },
  { id: 'mission', clip: 'mission', in: 0.5, beats: 2 },

  /* the basement, and the stretch of its wall that is not as solid as the rest */
  { id: 'basement', clip: 'basement', in: 1.0, beats: 1.5 },
  { id: 'wallA', clip: 'wall', in: 0.75, beats: 3.5 },
  { id: 'wallB', clip: 'wall', in: 3.95, beats: 4, sfx: [[0.0, 'noclip', -2]] },

  /* under the office (not on the soundtrack's clock: there is no clock down here) */
  { id: 'wallC', clip: 'wall', in: 7.85, dur: 1.9, sfx: [[0, 'static:0.8', -16]] },
  { id: 'std1', clip: 'standees', in: 0.6, dur: 1.2 },
  { id: 'std2', clip: 'standees', in: 4.5, dur: 1.6 },
  { id: 'ceiling', clip: 'ceiling', in: 2.7, dur: 1.9 },
  { id: 'pool', clip: 'pool', in: 1.5, dur: 1.5 },
  { id: 'cake', clip: 'cake', in: 0.3, dur: 2.6 },
  { id: 'tiny', clip: 'tiny', in: 0.6, dur: 2.0 },
  { id: 'keyboard', clip: 'keyboard', in: 0.0, dur: 1.7 },
  { id: 'coolers', clip: 'coolers', in: 0.4, dur: 1.2, sfx: [[0.3, 'water', -12]] },
  { id: 'dispatch', clip: 'dispatch', in: 0.8, dur: 1.5 },
  { id: 'workers', clip: 'workers', in: 5.2, dur: 1.9 },
  { id: 'wellness', clip: 'wellness', in: 0.6, dur: 1.2 },
  { id: 'mascot1', clip: 'mascot', in: 2.0, dur: 2.5 },
  { id: 'mascot2', clip: 'mascot', in: 6.3, dur: 2.0 },
  { id: 'smiler', clip: 'pipes', in: 1.1, dur: 3.5, sfx: [[1.8, 'noclip', -2], [2.7, 'static:0.9', -14]] },

  /* back upstairs, and what you actually do with it: click somebody, click the board on their wall (one take, two bars) */
  { id: 'feat', clip: 'features', in: 0.4, beats: 8, sfx: [[4.3, 'sticky', -8], [5.9, 'sticky', -8], [5.95, 'confetti', -8]] },

  /* the name again */
  { id: 'end', clip: 'officeNight', in: 1.5, dur: BEAT * 4 + 0.7, screen: 'titleEnd', fade: 'out' },
];

/* ---- the sound that runs under more than one piece --------------------------------------------------------------- */
// { track, dir?: 'music', from, to (piece ids; `to` is included), dB, loop?, lead? (seconds before `from` that the track starts),
//   offset? (seconds into the track), fadeIn?, fadeOut? }
const BEDS = [
  { track: 'office-bed', from: 'old1', to: 'old2', dB: -10, loop: true, fadeOut: 0.05 },
  // the soundtrack: it starts a fifth of a second before the title so that its first hit is the title, plays through
  // everything above ground, and stops dead at the wall
  { track: 'glitch-basement', dir: 'music', from: 'title', to: 'wallA', lead: HIT.title, dB: -1, fadeIn: 0.01, fadeOut: 0.05 },
  // under the office: room4, low, with the tubes humming under it
  { track: 'room4', dir: 'music', from: 'wallC', to: 'smiler', offset: 54, dB: -4, fadeIn: 1.0, fadeOut: 0.05 },
  { track: 'backrooms-hum', from: 'wallC', to: 'smiler', dB: -17, loop: true, fadeIn: 0.6, fadeOut: 0.05 },
  // …and back, at the bar the track comes in again after its break (100.02 s in), as the film comes back upstairs
  { track: 'glitch-basement', dir: 'music', from: 'feat', to: 'end', offset: 99.95, dB: -1, fadeIn: 0.01, fadeOut: 1.2 },
];

/* ---- cutting ----------------------------------------------------------------------------------------------------- */
const only = flag('only') ? new Set(flag('only').split(',')) : null;
const ff = (args) => { const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' ').slice(0, 300)); };
// a clip the camera is still writing has no index yet: it is "not filmed yet" until it has
const known = new Map();
function finished(file) {
  if (!known.has(file)) known.set(file, fs.existsSync(file) && spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).status === 0);
  return known.get(file);
}

let clock = 0;                      // the cut's own time, exactly; frames are rounded from it so that nothing drifts off the beat
const laid = [];
for (const p of PIECES) {
  if (only && !only.has(p.id) && !only.has(p.clip)) continue;
  if (NO_CARDS && p.card) continue;
  const speed = p.speed || 1, want = p.beats !== undefined ? b(p.beats + (NO_CARDS ? p.pad || 0 : 0)) : p.dur;
  const f0 = Math.round(clock * FPS), f1 = Math.round((clock + want) * FPS), n = f1 - f0, dur = n / FPS, span = dur * speed;
  const src = p.still ? path.join(CARDS, `${p.still}.png`) : path.join(CLIPS, `${p.clip}.mp4`);
  const have = p.still ? fs.existsSync(src) : finished(src);
  const cap = p.caption ? path.join(CARDS, `${p.caption}.png`) : null;
  const over = p.screen ? path.join(CLIPS, `${p.screen}.mp4`) : null;
  const recipe = JSON.stringify([p.clip || p.still, p.in, n, speed, p.crop || '', p.caption || '', p.captionFade || 0, p.fade || '', p.glitch || '',
    have ? fs.statSync(src).mtimeMs : 'missing', cap && fs.existsSync(cap) ? fs.statSync(cap).mtimeMs : '', over && finished(over) ? fs.statSync(over).mtimeMs : '']);
  const file = path.join(WORK, `${p.id}-${crypto.createHash('sha1').update(recipe).digest('hex').slice(0, 8)}.mp4`);
  if (!fs.existsSync(file)) {
    for (const old of fs.readdirSync(WORK)) if (old.startsWith(`${p.id}-`)) fs.rmSync(path.join(WORK, old));
    const enc = ['-frames:v', String(n), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-video_track_timescale', '15360', file];
    // the picture, timed and sized; a crop is taken after the retiming so that its t is the piece's own clock
    const look = `setpts=(PTS-STARTPTS)/${speed},fps=${FPS}${p.crop ? `,crop=${p.crop[0]}:${p.crop[1]}:${p.crop[2]}:'${p.crop[3]}'` : ''},scale=1920:1080:flags=lanczos,setsar=1`;
    const when = p.glitch === 'head' ? `lt(t,0.2)` : `gte(t,${(dur - 0.22).toFixed(3)})`;
    const glitch = p.glitch ? `,format=gbrp,rgbashift=rh=-22:bh=22:rv=5:enable='${when}',noise=alls=34:allf=t+u:enable='${when}',format=yuv420p` : '';
    const tail = `${glitch}${p.fade === 'in' ? ',fade=t=in:st=0:d=0.35' : ''}${p.fade === 'out' ? `,fade=t=out:st=${(dur - 0.9).toFixed(2)}:d=0.9` : ''}`;
    if (!have) {
      ff(['-f', 'lavfi', '-i', `color=c=0x14110f:s=1920x1080:r=${FPS}`, '-vf', `drawtext=text='${p.clip || p.still}  (not filmed yet)':fontcolor=0xf4f0e6:fontsize=44:x=(w-tw)/2:y=(h-th)/2`, ...enc]);
    } else if (p.still) {
      ff(['-loop', '1', '-framerate', String(FPS), '-t', String(dur + 0.2), '-i', src, '-vf', `fps=${FPS},scale=1920:1080,setsar=1,format=yuv420p${tail}`, ...enc]);
    } else if (over && finished(over)) {
      ff(['-ss', String(p.in), '-t', String(span + 0.2), '-i', src, '-t', String(dur + 0.2), '-i', over,
        '-filter_complex', `[0:v]${look},gblur=sigma=7,lutrgb=r=val*0.36:g=val*0.36:b=val*0.42[v];[1:v]fps=${FPS},scale=1920:1080,setsar=1[t];[v][t]blend=all_mode=screen,format=yuv420p${tail}[o]`, '-map', '[o]', ...enc]);
    } else if (cap && fs.existsSync(cap)) {
      const fadeIn = p.captionFade || 0.12;
      ff(['-ss', String(p.in), '-t', String(span + 0.2), '-i', src, '-loop', '1', '-t', String(dur + 0.2), '-i', cap,
        '-filter_complex', `[0:v]${look}[v];[1:v]format=rgba,fade=t=in:st=${p.captionFade ? 0.25 : 0}:d=${fadeIn}:alpha=1[c];[v][c]overlay=0:0:format=auto${tail}[o]`, '-map', '[o]', ...enc]);
    } else {
      ff(['-ss', String(p.in), '-t', String(span + 0.2), '-i', src, '-vf', `${look}${tail}`, ...enc]);
    }
  }
  laid.push({ ...p, at: f0 / FPS, dur, file, have });
  clock += want;
}
const total = Math.round(clock * FPS) / FPS;
const byId = new Map(laid.map((p) => [p.id, p]));
if (argv.includes('--list')) {
  const t0 = (byId.get('title')?.at ?? 0) - HIT.title;
  for (const p of laid) console.log(`${p.at.toFixed(2).padStart(7)}  ${p.dur.toFixed(2).padStart(5)}  ${p.id.padEnd(9)} ${(p.clip || p.still).padEnd(12)} ${p.at >= t0 && byId.has('wallA') && p.at <= byId.get('wallA').at ? `track ${(p.at - t0).toFixed(2)}` : ''}${p.have ? '' : '   (missing)'}`);
  console.log(`total ${total.toFixed(1)}s`);
}

fs.writeFileSync(path.join(WORK, 'list.txt'), laid.map((p) => `file '${p.file}'`).join('\n') + '\n');
const silent = path.join(WORK, 'picture.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'list.txt'), '-c', 'copy', silent]);

/* ---- sound --------------------------------------------------------------------------------------------------------- */
const inputs = [], graph = [], outs = [];
let count = 0;
const add = (file, loop = false) => { if (loop) inputs.push('-stream_loop', '-1'); inputs.push('-i', file); return count++; };
function soundFile(name) {
  const m = /^static:([\d.]+)$/.exec(name);
  if (!m) return path.join(AUDIO, `${name}.mp3`);
  const file = path.join(WORK, `static-${m[1]}.wav`);          // what a tape with nothing on it sounds like
  if (!fs.existsSync(file)) ff(['-f', 'lavfi', '-i', `anoisesrc=d=${m[1]}:c=white:r=48000:a=0.9`, '-af', `highpass=f=900,lowpass=f=7000,afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, m[1] - 0.12)}:d=0.12`, '-ac', '2', file]);
  return file;
}
for (const p of laid) for (const [off, name, dB = 0] of p.sfx || []) {
  const file = soundFile(name);
  if (!fs.existsSync(file)) { console.warn('no sound called', name); continue; }
  const i = add(file), ms = Math.max(0, Math.round((p.at + off) * 1000));
  graph.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${dB}dB,adelay=${ms}:all=1[s${i}]`); outs.push(`[s${i}]`);
}
for (const bed of BEDS) {
  const a = byId.get(bed.from), z = byId.get(bed.to), file = path.join(bed.dir === 'music' ? MUSIC : AUDIO, `${bed.track}.mp3`);
  if (!a || !z) continue;
  if (!fs.existsSync(file)) { console.warn(`no track called ${bed.track} in ${path.dirname(file)}`); continue; }
  const start = Math.max(0, a.at - (bed.lead || 0)), len = z.at + z.dur - start, i = add(file, !!bed.loop);
  const fi = bed.fadeIn ?? 0.03, fo = bed.fadeOut ?? 0.08;
  graph.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=${bed.offset || 0}:duration=${len.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fi},afade=t=out:st=${Math.max(0, len - fo).toFixed(3)}:d=${fo},volume=${bed.dB || 0}dB,adelay=${Math.round(start * 1000)}:all=1[b${i}]`);
  outs.push(`[b${i}]`);
}
const mixed = path.join(WORK, 'sound.m4a');
// One fixed gain for the whole film (measured, then applied), so that what was mixed quiet stays quiet: a loudness
// normaliser that rides the level would pull the Backrooms up to meet the soundtrack.
const pre = `${outs.join('')}amix=inputs=${outs.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},alimiter=limit=0.89:level=false`;
fs.writeFileSync(path.join(WORK, 'sound.graph'), [...graph, `${pre}[mix]`].join(';\n'));
const raw = path.join(WORK, 'sound-raw.wav');
ff([...inputs, '-filter_complex_script', path.join(WORK, 'sound.graph'), '-map', '[mix]', '-ar', '48000', raw]);
const measured = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const loud = Number((/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(measured) || [])[1]);
const gain = Number.isFinite(loud) ? Math.min(12, -15 - loud) : 0;
ff(['-i', raw, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=false`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', mixed]);

ff(['-i', silent, '-i', mixed, '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', OUT]);
// …and a copy for posting: the same picture at a size that uploads (X takes 1080p H.264 + AAC; it re-encodes whatever it is given)
if (argv.includes('--post')) {
  const post = OUT.replace(/\.mp4$/, '-x.mp4');
  ff(['-i', OUT, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'copy', '-movflags', '+faststart', post]);
  console.log(`${post}  ${(fs.statSync(post).size / 1e6).toFixed(1)} MB`);
}
// --sheet: one frame from the middle of every piece, in order — the cut at a glance
if (argv.includes('--sheet')) {
  const sheet = OUT.replace(/\.mp4$/, '-storyboard.jpg'), cols = 8, rows = Math.ceil(laid.length / cols);
  const pick = laid.map((p) => `eq(n\\,${Math.round((p.at + p.dur / 2) * FPS)})`).join('+');
  ff(['-i', OUT, '-vf', `select='${pick}',scale=480:-1,tile=${cols}x${rows}:padding=4:color=0x14110f`, '-frames:v', '1', '-q:v', '3', sheet]);
  console.log(sheet);
}
console.log(`${OUT}  ${total.toFixed(1)}s  ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB  mix ${Number.isFinite(loud) ? `${loud} LUFS ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB` : 'unmeasured'}  (${laid.filter((p) => !p.have).length} pieces still to film)`);
