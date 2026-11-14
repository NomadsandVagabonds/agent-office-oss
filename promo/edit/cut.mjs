#!/usr/bin/env node
// The cut. One list of pieces of picture, in order; where a sound belongs to a piece it is written beside it, so
// moving a shot moves its sound. Music and room tone run between named pieces.
//
//   node edit/cut.mjs [--clips dir] [--cards dir] [--audio dir] [--out file.mp4] [--only id,id] [--list]
//
// Every piece is cut out of its clip to its own small file (work/<id>.mp4, re-used while its recipe is unchanged),
// the files are joined without re-encoding, and the sound is mixed in one pass and laid under them.
import { execFileSync, spawnSync } from 'node:child_process';
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
const WORK = path.join(SCRATCH, 'work');
const OUT = path.resolve(flag('out', path.join(SCRATCH, 'the-office-promo.mp4')));
const FPS = 30;
fs.mkdirSync(WORK, { recursive: true });

/* ---- the picture ---------------------------------------------------------------------------------------------- */
// { id, clip, in, dur, speed?, crop?, caption?, sfx?: [[seconds into the piece, name, dB?]], fade?: 'in' | 'out' }
// dur is how long the piece lasts in the cut; it eats dur × speed seconds of its clip.
// crop: [w, h, x, y] of the 1920×1080 frame to fill the screen with (x and y may be ffmpeg expressions of t, the piece's own clock).
// A sound called 'static:0.6' is that many seconds of tape noise, made here.
const PIECES = [
  /* the office as it was */
  { id: 'old1', clip: 'classic', in: 0.4, dur: 1.8, fade: 'in', sfx: [[0.1, 'typing', -6], [1.0, 'typing', -8]] },
  { id: 'old2', clip: 'classic', in: 3.2, dur: 1.4, sfx: [[0.2, 'typing', -8]] },
  /* the office as it is */
  { id: 'hero', clip: 'hero', in: 0.8, dur: 3.3, sfx: [[0, 'lift-ding', 3]] },

  /* someone new */
  { id: 'lift', clip: 'liftOut', in: 0.3, dur: 2.5, caption: 'cmd-join', sfx: [[0.0, 'lift-doors', 0]] },
  { id: 'walk', clip: 'walk', in: 0.4, dur: 2.0 },
  { id: 'sit', clip: 'sit', in: 1.3, dur: 3.0, sfx: [[2.2, 'typing', -3]] },
  // twelve changes of mind, one a second, at two and a half times the speed she had them
  { id: 'looks', clip: 'looks2', in: 0.6, dur: 5.2, speed: 2.4, caption: 'cmd-me',
    sfx: [...Array.from({ length: 12 }, (_, n) => [0.125 + n / 2.4, 'sticky', -8]), [4.75, 'discovery', -5]] },
  { id: 'desk', clip: 'desk2', in: 0.2, dur: 3.2, caption: 'cmd-desk', sfx: [[0.3, 'sticky', -6], [1.1, 'sticky', -6], [1.9, 'sticky', -6], [2.7, 'sticky', -6]] },

  /* working together */
  { id: 'note', clip: 'plane', in: 0.45, dur: 3.6, speed: 0.5, caption: 'cmd-dm', sfx: [[0.7, 'paper-plane', 3], [2.9, 'needs-you', -8]] },
  { id: 'pair', clip: 'pairL', in: 1.2, dur: 3.5 },
  { id: 'done', clip: 'done', in: 0.4, dur: 3.5, sfx: [[0.3, 'sticky', 0], [1.9, 'sticky', 0], [2.0, 'confetti', 2]] },
  { id: 'needs', clip: 'needs', in: 0.9, dur: 3.0, sfx: [[0.3, 'needs-you', 2]] },

  /* the same office, as text */
  { id: 'con1', clip: 'console', in: 0.5, dur: 3.6, speed: 3.1, crop: [1536, 864, 0, "if(lt(t,0.95),216,216*max(0,1-(t-0.95)/0.4))"], sfx: [[0.05, 'typing', -2], [0.5, 'typing', -4]] },
  { id: 'con2', clip: 'console', in: 12.6, dur: 2.4, speed: 1.55, crop: [1536, 864, 0, 216] },
  { id: 'con3', clip: 'console', in: 19.3, dur: 2.4, sfx: [[0.3, 'sticky', -2], [1.7, 'sticky', -2]] },

  /* turns end */
  { id: 'kitchen', clip: 'kitchenL', in: 0.6, dur: 3.5, sfx: [[0.2, 'coffee', 0], [1.6, 'vend', -2]] },
  { id: 'jukebox', clip: 'jukebox', in: 1.6, dur: 2.0, caption: 'cmd-jukebox', sfx: [[0.3, 'coin', 0]] },
  { id: 'disco', clip: 'disco', in: 2.0, dur: 3.6 },

  /* the lift */
  { id: 'panel', clip: 'liftRoof', in: 1.5, dur: 2.5, sfx: [[0, 'lift-doors', -2], [2.1, 'lift-closing', 2]] },
  { id: 'ride', clip: 'liftRoof', in: 4.5, dur: 2.6, speed: 2.0, sfx: [[0.3, 'lift-up', 2], [2.2, 'lift-ding', 2]] },
  { id: 'roof', clip: 'roof', in: 0.6, dur: 3.2, sfx: [[0.1, 'lift-roof', 3]] },
  { id: 'pasture', clip: 'pasture', in: 0.8, dur: 3.0, sfx: [[0.0, 'lift-down', 1], [0.9, 'goat-1', 0], [2.1, 'goat-bell', -6]] },
  { id: 'goats', clip: 'goats', in: 1.2, dur: 1.8, sfx: [[0.2, 'goat-3', 0], [1.1, 'goat-2', -2]] },
  { id: 'scranton', clip: 'scranton', in: 1.2, dur: 1.8 },
  { id: 'night9', clip: 'nightshift', in: 1.5, dur: 2.4 },
  { id: 'crow1', clip: 'crowbar', in: 1.5, dur: 2.0 },
  { id: 'crow2', clip: 'crowbar', in: 5.6, dur: 1.4, sfx: [[0.5, 'squash', 3]] },
  { id: 'mission', clip: 'mission', in: 0.5, dur: 1.8 },

  /* the button that was not there yesterday */
  { id: 'p13', clip: 'thirteen', in: 2.4, dur: 2.0, sfx: [[0.0, 'lift-doors', -4]] },
  { id: 'r13', clip: 'thirteen', in: 4.6, dur: 2.8, speed: 1.9, sfx: [[0.1, 'lift-13', 2]] },
  { id: 'fall', clip: 'fall', in: 0.0, dur: 2.0, sfx: [[0, 'noclip', 0], [0, 'static:0.7', -20]] },
  { id: 'std1', clip: 'standees', in: 0.6, dur: 1.2 },
  { id: 'std2', clip: 'standees', in: 4.5, dur: 1.8 },
  { id: 'ceiling', clip: 'ceiling', in: 2.6, dur: 2.2, sfx: [[0.0, 'pa-meeting', 0]] },
  { id: 'pool', clip: 'pool', in: 1.5, dur: 1.8 },
  { id: 'tiny', clip: 'tiny', in: 0.4, dur: 2.4 },
  { id: 'keyboard', clip: 'keyboard', in: 0.0, dur: 2.0 },
  { id: 'coolers', clip: 'coolers', in: 0.4, dur: 1.5, sfx: [[0.3, 'water', -8]] },
  { id: 'dispatch', clip: 'dispatch', in: 0.8, dur: 1.8 },
  { id: 'workers', clip: 'workers', in: 5.0, dur: 2.2 },
  { id: 'wellness', clip: 'wellness', in: 0.6, dur: 1.4 },
  { id: 'stairs', clip: 'stairs', in: 0.6, dur: 4.0, sfx: [[2.2, 'static:0.9', -18]] },
  { id: 'exec', clip: 'exec', in: 1.2, dur: 1.5 },
  { id: 'mascot1', clip: 'mascot', in: 1.6, dur: 3.0 },
  { id: 'mascot2', clip: 'mascot', in: 6.3, dur: 2.0 },
  { id: 'smiler', clip: 'pipes', in: 0.6, dur: 4.0, sfx: [[2.3, 'noclip', 1], [3.2, 'static:0.9', -14]] },

  /* the plate on the door */
  { id: 'end', clip: 'officeNight', in: 1.5, dur: 3.8, caption: 'end', captionFade: 0.4, fade: 'out', sfx: [[0.3, 'lift-ding', -3]] },
];

/* ---- the sound that runs under more than one piece --------------------------------------------------------------- */
// { track, from, to (piece ids; `to` is included), dB, loop?, fadeIn?, fadeOut?, offset? (seconds into the track) }
const BEDS = [
  { track: 'office-bed', from: 'old1', to: 'old2', dB: -8, loop: true, fadeOut: 0.05 },
  { track: 'elevator-muzak', from: 'hero', to: 'kitchen', dB: -3, loop: true, fadeIn: 0.02, fadeOut: 0.25 },
  { track: 'jukebox-disco', from: 'jukebox', to: 'disco', dB: -1, loop: true, startIn: 0.6, fadeIn: 0.05, fadeOut: 0.12 },
  { track: 'elevator-muzak', from: 'panel', to: 'ride', dB: -7, offset: 8, fadeIn: 0.3, fadeOut: 0.1 },
  { track: 'rooftop-lofi', from: 'roof', to: 'roof', dB: -1, fadeIn: 0.15, fadeOut: 0.2 },
  { track: 'pasture-bed', from: 'pasture', to: 'goats', dB: 0, loop: true, fadeOut: 0.1 },
  { track: 'office-bed', from: 'scranton', to: 'night9', dB: -6, loop: true },
  { track: 'arcade-chiptune', from: 'crow1', to: 'crow2', dB: -4, fadeOut: 0.1 },
  { track: 'office-bed', from: 'mission', to: 'r13', dB: -8, loop: true },
  { track: 'backrooms-hum', from: 'fall', to: 'smiler', dB: -6, loop: true, fadeIn: 0.6, fadeOut: 0.02 },
];

/* ---- cutting ----------------------------------------------------------------------------------------------------- */
const only = flag('only') ? new Set(flag('only').split(',')) : null;
const ff = (args, quiet = true) => { const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', quiet ? 'error' : 'info', ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' ').slice(0, 300)); };
const frames = (seconds) => Math.round(seconds * FPS);
const clipPath = (p) => path.join(p.dir === 'office' ? CLIPS : CLIPS, `${p.clip}.mp4`);

// a clip the camera is still writing has no index yet: it is "not filmed yet" until it has
const known = new Map();
function finished(file) {
  if (!known.has(file)) known.set(file, fs.existsSync(file) && spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).status === 0);
  return known.get(file);
}

let at = 0;
const laid = [];
for (const p of PIECES) {
  if (only && !only.has(p.id) && !only.has(p.clip)) continue;
  const speed = p.speed || 1, n = frames(p.dur), dur = n / FPS, span = dur * speed;
  const src = clipPath(p), have = finished(src);
  const cap = p.caption ? path.join(CARDS, `${p.caption}.png`) : null;
  const recipe = JSON.stringify([p.clip, p.in, dur, speed, p.crop || '', p.caption || '', p.captionFade || 0, p.fade || '', have ? fs.statSync(src).mtimeMs : 'missing']);
  // the picture, timed and sized; a crop is taken after the retiming so that its t is the piece's own clock
  const look = `setpts=(PTS-STARTPTS)/${speed},fps=${FPS}${p.crop ? `,crop=${p.crop[0]}:${p.crop[1]}:${p.crop[2]}:'${p.crop[3]}'` : ''},scale=1920:1080:flags=lanczos,setsar=1`;
  const file = path.join(WORK, `${p.id}-${crypto.createHash('sha1').update(recipe).digest('hex').slice(0, 8)}.mp4`);
  if (!fs.existsSync(file)) {
    for (const old of fs.readdirSync(WORK)) if (old.startsWith(`${p.id}-`)) fs.rmSync(path.join(WORK, old));
    const enc = ['-frames:v', String(n), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-video_track_timescale', '15360', file];
    const tail = `${p.fade === 'in' ? `,fade=t=in:st=0:d=0.35` : ''}${p.fade === 'out' ? `,fade=t=out:st=${(dur - 0.7).toFixed(2)}:d=0.7` : ''}`;
    if (!have) {
      ff(['-f', 'lavfi', '-i', `color=c=0x14110f:s=1920x1080:r=${FPS}`, '-vf', `drawtext=text='${p.clip}  (not filmed yet)':fontcolor=0xf4f0e6:fontsize=44:x=(w-tw)/2:y=(h-th)/2`, ...enc]);
    } else if (cap && fs.existsSync(cap)) {
      const fadeIn = p.captionFade || 0.12;
      ff(['-ss', String(p.in), '-t', String(span + 0.2), '-i', src, '-loop', '1', '-t', String(dur + 0.2), '-i', cap,
        '-filter_complex', `[0:v]${look}[v];[1:v]format=rgba,fade=t=in:st=${p.captionFade ? 0.5 : 0}:d=${fadeIn}:alpha=1[c];[v][c]overlay=0:0:format=auto${tail}[o]`, '-map', '[o]', ...enc]);
    } else {
      ff(['-ss', String(p.in), '-t', String(span + 0.2), '-i', src, '-vf', `${look}${tail}`, ...enc]);
    }
  }
  laid.push({ ...p, at, dur, file, have });
  at += dur;
}
const total = at;
if (argv.includes('--list')) {
  for (const p of laid) console.log(`${p.at.toFixed(1).padStart(6)}  ${p.dur.toFixed(1).padStart(4)}  ${p.id.padEnd(9)} ${p.clip}${p.have ? '' : '   (missing)'}`);
  console.log(`total ${total.toFixed(1)}s`);
}

fs.writeFileSync(path.join(WORK, 'list.txt'), laid.map((p) => `file '${p.file}'`).join('\n') + '\n');
const silent = path.join(WORK, 'picture.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'list.txt'), '-c', 'copy', silent]);

/* ---- sound --------------------------------------------------------------------------------------------------------- */
const byId = new Map(laid.map((p) => [p.id, p]));
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
for (const b of BEDS) {
  const a = byId.get(b.from), z = byId.get(b.to), file = path.join(AUDIO, `${b.track}.mp3`);
  if (!a || !z || !fs.existsSync(file)) continue;
  const start = a.at + (b.startIn || 0), len = z.at + z.dur - start, i = add(file, !!b.loop);
  const fi = b.fadeIn ?? 0.03, fo = b.fadeOut ?? 0.08;
  graph.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=${b.offset || 0}:duration=${len.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fi},afade=t=out:st=${Math.max(0, len - fo).toFixed(3)}:d=${fo},volume=${b.dB || 0}dB,adelay=${Math.round(start * 1000)}:all=1[b${i}]`);
  outs.push(`[b${i}]`);
}
const mixed = path.join(WORK, 'sound.m4a');
graph.push(`${outs.join('')}amix=inputs=${outs.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},alimiter=limit=0.89:level=false,loudnorm=I=-15:TP=-2:LRA=11,alimiter=limit=0.84:level=false[mix]`);
fs.writeFileSync(path.join(WORK, 'sound.graph'), graph.join(';\n'));
ff([...inputs, '-filter_complex_script', path.join(WORK, 'sound.graph'), '-map', '[mix]', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', mixed]);

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
console.log(`${OUT}  ${total.toFixed(1)}s  ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB  (${laid.filter((p) => !p.have).length} pieces still to film)`);
