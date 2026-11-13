#!/usr/bin/env node
// make-audio.mjs — how the office's sounds were made, and how to remake them.
//
// The office never calls a sound service at runtime: everything under
// public/audio/ is a small static file, and the client falls back to its own
// built-in synth when one is missing (public/world/ui/sound.js). This script
// is the one-off that generated those files with the ElevenLabs API and then
// trimmed and levelled them with ffmpeg (which has to be on the PATH).
//
//   ELEVENLABS_API_KEY=… node tools/make-audio.mjs            # make what is missing
//   node tools/make-audio.mjs --only lift-ding,bell --force   # redo some
//   node tools/make-audio.mjs --keep ~/office-raw             # keep what the API sent, and reuse it
//   node tools/make-audio.mjs --keep ~/office-raw --polish    # only the ffmpeg pass again (costs nothing)
//   node tools/make-audio.mjs --list
//
// MANIFEST below is the whole truth about what exists: the client plays these
// names and test/audio.test.mjs holds the two together. Prompts are generic
// descriptions of sounds — nothing about you or your projects is sent — and
// the voices are ElevenLabs' stock ones. Every take is different: look at
// (and listen to) what comes back before you commit it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio');
const API = 'https://api.elevenlabs.io';
// In a sandbox whose network proxy injects the credential there is no variable to read; the placeholder is overwritten.
// (Node only uses such a proxy when started with NODE_USE_ENV_PROXY=1.)
const KEY = process.env.ELEVENLABS_API_KEY || 'proxy-injected';
const FORMATS = ['mp3_44100_192', 'mp3_44100_128'];   // the best the plan allows; it is re-encoded smaller below

// ElevenLabs stock voices, and the room each one is heard in (an ffmpeg filter chain, applied once the take is clean)
const VOICE = {
  lift: { id: 'Xb7hH8MSUJpSbSDYk0k2', room: 'highpass=f=170' },                                                   // Alice — clear, British, professional
  hollow: { id: 'nPczCjzI2devNBz1zQrb', room: 'asetrate=44100*0.9,aresample=44100,aecho=0.8:0.7:70|150|290:0.45|0.3|0.18' },   // Brian — deep; slowed a little, somewhere large and empty
  pa: { id: 'onwK4e9ZLuTAKqWW03F9', room: 'highpass=f=420,lowpass=f=3400,aecho=0.8:0.5:110|230:0.3|0.16' },      // Daniel — steady broadcaster, out of a ceiling speaker
  arcade: { id: 'IKne3meq5aSn9XLyUdCD', room: 'acrusher=bits=8:samples=4:mode=log:aa=1:mix=0.8,lowpass=f=4800' },   // Charlie — hyped, out of a cabinet's speech chip
};
// what "the same loudness" means for each kind, and the ceiling nothing may cross (LUFS / dBFS true peak)
const LEVEL = { shot: -18, bed: -24, music: -20, peak: -1.5 };

const sfx = (name, text, seconds, extra = {}) => ({ name, kind: 'sfx', text, seconds, ...extra });
const music = (name, text, seconds, extra = {}) => ({ name, kind: 'music', text, seconds, ...extra });
const voice = (name, who, text, extra = {}) => ({ name, kind: 'voice', who, text, ...extra });

// extra: influence (how literally to take the prompt), fx (an ffmpeg filter chain), tail (seconds of fade at the end), loop, mono, stability.
// Music is asked for in whole bars — 16 at 120 BPM is 32 s — and says its bpm, so that a song comes round on a bar line when it repeats.
export const MANIFEST = [
  // ---- things that happen in the office
  sfx('needs-you', 'A gentle two-note ascending notification chime played on a soft marimba, warm and friendly, clean, no background', 1.4, { influence: 0.6 }),
  sfx('lift-ding', 'A single mellow elevator arrival chime: one warm, mid-pitched bell tone with a soft ringing tail, clean, no background noise', 1.5, { influence: 0.7, fx: 'lowpass=f=2600' }),
  sfx('lift-doors', 'Elevator doors sliding open, smooth mechanical hum and a soft thunk, indoors, clean', 2.2),
  sfx('bell', 'One tap on a small brass reception desk bell, bright ringing ding, close and clean', 1.8, { influence: 0.7 }),
  sfx('coffee', 'Drip coffee machine gurgling and pouring coffee into a mug with a little hiss of steam, close', 3.5, { tail: 0.3 }),
  sfx('vend', 'Vending machine motor whirring, then a snack bar drops into the tray with a clunk', 2.6),
  sfx('water', 'Water poured from a small watering can onto the soil of a potted plant, a short gentle trickle, close', 2.2, { tail: 0.3 }),
  sfx('printer', 'An office laser printer printing a single page: rollers whirring and paper feeding out right from the start, close and steady', 3.2, { tail: 0.25 }),
  sfx('printer-jam', 'An office printer jamming: gears grinding and paper crumpling, then a sad error beep', 2.4),
  sfx('paper-plane', 'A light paper airplane whooshing past, quick soft swish', 0.9, { fx: 'highpass=f=250' }),
  sfx('confetti', 'Party popper pop with a burst of confetti and a small sparkle', 1.4),
  sfx('sticky', 'A paper sticky note being peeled off and pressed onto a board, small paper tap', 0.7),
  sfx('purr', 'A contented cat purring, close, warm and steady', 3.0, { tail: 0.6 }),
  sfx('duck', 'A single squeak of a rubber duck bath toy', 0.6, { influence: 0.7, fx: 'lowpass=f=4000' }),
  sfx('discovery', 'Magical discovery chime, a short ascending sparkle glissando with a shimmering tail', 1.8),
  sfx('typing', 'A burst of typing on a mechanical keyboard, close, no other sound', 2.5, { tail: 0.2 }),
  sfx('coin', 'A coin dropping into a retro arcade machine slot, followed by a short 8-bit ready jingle', 1.6),
  sfx('squash', 'A very short 8-bit squish blip, a video game enemy being squashed', 0.5, { influence: 0.7, fx: 'highpass=f=150' }),
  sfx('noclip', 'Reality glitching: a low digital warble and a tape slowing down as something falls through a wall into silence', 2.6, { tail: 0.5 }),
  sfx('goat-1', 'A single bleat of an adult goat, close, clean, no background', 1.2, { influence: 0.6 }),
  sfx('goat-2', 'A single short, deeper, slightly grumpy bleat of a billy goat, close, clean, no background', 1.0, { influence: 0.6 }),
  sfx('goat-3', 'A single high-pitched bleat of a small baby kid goat, close, clean, no background', 0.9, { influence: 0.6 }),
  // ---- beds that loop
  sfx('office-bed', 'Quiet office room tone: steady soft air conditioning and ventilation hiss, calm and constant, no voices, no distinct events', 20, { loop: true, fx: 'highpass=f=120,highpass=f=120,highshelf=f=700:g=8' }),
  sfx('backrooms-hum', 'Constant fluorescent tube light buzz with a low mains electrical hum in an empty carpeted room, eerie and steady', 12, { loop: true }),
  sfx('pasture-bed', 'Quiet indoor meadow ambience: a soft ventilation hum under faint rustling grass, an occasional small distant goat bell, calm and steady, no voices', 16, { loop: true }),
  // ---- music
  music('elevator-muzak', 'Cheesy elevator muzak at 120 BPM: light bossa nova lounge instrumental with a vibraphone melody, soft nylon guitar, gentle brushed drums and upright bass, pleasant and slightly corny, 1960s easy listening', 32, { bpm: 120 }),
  music('jukebox-disco', 'Joyful 1970s disco funk instrumental at 120 BPM that starts straight into the groove: four on the floor drums, bouncy slap bass, bright string stabs, wah guitar and hand claps, very danceable', 32, { bpm: 120 }),
  music('arcade-chiptune', 'Energetic 8-bit chiptune arcade game music, catchy square wave melody with fast arpeggios, classic console style', 32, { bpm: 120, mono: true }),
  music('rooftop-lofi', 'Calm lo-fi hip hop instrumental at 80 BPM, warm electric piano chords, soft dusty drums and vinyl crackle, a relaxed evening on a city rooftop', 36, { bpm: 80 }),
  // ---- voices
  voice('lift-lobby', 'lift', 'Lobby.'),
  voice('lift-roof', 'lift', 'Rooftop garden.'),
  voice('lift-up', 'lift', 'Going up.'),
  voice('lift-down', 'lift', 'Going down.'),
  voice('lift-closing', 'lift', 'Doors closing.'),
  voice('lift-13', 'lift', 'Floor… thirteen. Please mind the gap in reality.'),
  voice('hollow-fool', 'hollow', 'Fool.', { stability: 0.75 }),
  voice('hollow-fine', 'hollow', 'Fine.', { stability: 0.75 }),
  voice('pa-meeting', 'pa', 'Attention please. The three o\'clock meeting has been moved to the ceiling.'),
  voice('pa-cabinet', 'pa', 'Would the owner of a beige filing cabinet please return to it. It misses you.'),
  voice('pa-exit', 'pa', 'A reminder: the exit is exactly where you left it. Thank you.'),
  voice('arcade-title', 'arcade', 'Bug Squash!'),
];

/* ---- asking for a sound ------------------------------------------------------------ */
async function call(pathname, body) {
  for (const [i, format] of FORMATS.entries()) {
    const res = await fetch(`${API}${pathname}?output_format=${format}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const said = (await res.text()).slice(0, 300);
    const err = new Error(`${pathname} → HTTP ${res.status}: ${said}`);
    err.fatal = res.status === 401 || res.status === 402 || /quota|payment|credit/i.test(said);      // out of money or not allowed: stop asking
    if (err.fatal || i === FORMATS.length - 1 || ![400, 403, 422].includes(res.status)) throw err;   // otherwise the plan may not allow this format: try the next
  }
  return null;
}

function generate(item) {
  if (item.kind === 'sfx') return call('/v1/sound-generation', { text: item.text, duration_seconds: item.seconds, prompt_influence: item.influence ?? 0.4, loop: !!item.loop });
  if (item.kind === 'music') return call('/v1/music', { prompt: item.text, music_length_ms: Math.round(item.seconds * 1000), force_instrumental: true });
  return call(`/v1/text-to-speech/${VOICE[item.who].id}`, { text: item.text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: item.stability ?? 0.5, similarity_boost: 0.75 } });
}

async function credits() {
  try {
    const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': KEY } });
    return Number((await res.json()).character_count) || 0;
  } catch { return null; }
}

/* ---- trimming and levelling what came back ------------------------------------------- */
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
const must = (args) => { const r = ff(args); if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).trim().split('\n').pop()}`); return r; };
const num = (re, text) => { const m = re.exec(text); return m ? Number(m[1]) : NaN; };
const samples = (wav) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration_ts', '-of', 'csv=p=0', wav], { encoding: 'utf8' }).stdout) || 0;
const level = (wav, from, to) => num(/mean_volume: (-?[\d.]+) dB/, ff(['-i', wav, '-af', `atrim=start_sample=${from}:end_sample=${to},volumedetect`, '-f', 'null', '-']).stderr);
const FRAME = 1152, DELAY = 1105;   // an MP3 frame, and the codec delay in front of a stream that does not say how much to skip (samples)

/** How loud a file is: integrated loudness and its loudest 400 ms (LUFS), and its true peak (dBFS). Padded, so that even a blip reads. */
function loudness(file) {
  const log = ff(['-i', file, '-af', 'adelay=500:all=1,apad=pad_dur=0.5,ebur128=peak=true', '-f', 'null', '-']).stderr;
  const summary = log.slice(log.lastIndexOf('Summary:'));
  let M = -Infinity;
  for (const m of log.matchAll(/ M:\s*(-?[\d.]+) S:/g)) M = Math.max(M, Number(m[1]));
  return { I: num(/I:\s+(-?[\d.]+) LUFS/, summary), M, peak: num(/Peak:\s+(-?[\d.]+) dBFS/, summary) };
}

/**
 * One raw take → public/audio. One-shots lose the dead air around them and are heard in their voice's room; loops
 * and songs keep exactly the length that was asked for, so that they come round on the beat. Loudness is set with
 * a single fixed gain, so tails and seams survive it.
 */
function polish(raw, out, item) {
  const loop = !!item.loop, song = item.kind === 'music', shot = !loop && !song;
  const a = `${out}.a.wav`, b = `${out}.b.wav`;
  try {
    // 1 · decode, and find what was asked for. A stream that does not say how much codec delay it carries still has it in front;
    //     and a song that trails off comes round at the first bar line after which it stays quiet, not after the silence
    must(['-i', raw, '-c:a', 'pcm_f32le', '-f', 'wav', a]);
    const want = Math.round(item.seconds * 44100), got = samples(a);
    const skip = !shot && got > want && got % FRAME === 0 ? DELAY : 0;
    let n = Math.min(want, got - skip), faded = false;
    if (song && item.bpm) {
      const bar = Math.round((240 / item.bpm) * 44100), all = level(a, skip, skip + n);
      for (let at = bar * Math.ceil((n / bar) * 0.6); at < n; at += bar) if (level(a, skip + at, skip + n) < all - 18) { n = at; faded = true; break; }
    }
    const exact = shot ? null : `atrim=start_sample=${skip}:end_sample=${skip + n},asetpts=N/SR/TB`;
    // 2 · bring it to a known peak (the thresholds are relative to that). A one-shot loses the rumble no speaker plays and the
    //     dead air at both ends — a voice its breaths too — and only then is put in its room; a loop is filtered twice round,
    //     so that the filter does not open its seam
    const head = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01';
    const cut = (db) => `areverse,silenceremove=start_periods=1:start_threshold=${db}dB:start_silence=0.03,areverse`;
    const room = VOICE[item.who]?.room;
    const first = [exact, `volume=${(-3 - loudness(a).peak).toFixed(1)}dB`,
      ...(shot ? ['apad=pad_dur=1.5', 'highpass=f=45,highpass=f=45', item.fx, head, cut(room ? -42 : -55), ...(room ? ['apad=pad_dur=1.5', room, cut(-55)] : [])]
        : loop && item.fx ? [`aloop=loop=1:size=${n}`, item.fx, `atrim=start_sample=${n},asetpts=N/SR/TB`] : [item.fx])].filter(Boolean);
    must(['-i', a, '-af', first.join(','), '-ac', shot || item.mono ? '1' : '2', '-c:a', 'pcm_f32le', '-f', 'wav', b]);
    // 3 · one gain to the target loudness, kept under the ceiling
    const now = loudness(b);
    const gain = Math.min(shot ? LEVEL.shot - now.M : (loop ? LEVEL.bed : LEVEL.music) - now.I, LEVEL.peak - now.peak);
    // 4 · take the click off both ends (a loop that was made seamless is left alone), and encode
    const fades = loop ? [] : [`afade=t=in:d=${shot ? 0.004 : 0.008}`, `areverse,afade=t=in:d=${item.tail ?? (shot ? 0.08 : faded ? 0.25 : 0.008)},areverse`];
    must(['-i', b, '-af', [...fades, `volume=${gain.toFixed(2)}dB`].join(','), '-map_metadata', '-1', '-ar', '44100',
      '-c:a', 'libmp3lame', '-b:a', song ? (item.mono ? '80k' : '112k') : loop ? '80k' : '64k', '-f', 'mp3', out]);
  } finally { for (const f of [a, b]) fs.rmSync(f, { force: true }); }
}

/* ---- the command ----------------------------------------------------------------------- */
async function main() {
  const args = process.argv.slice(2);
  const has = (flag) => args.includes(flag);
  const value = (flag) => (has(flag) ? args[args.indexOf(flag) + 1] : null);
  if (has('--list')) { for (const m of MANIFEST) console.log(`${m.kind.padEnd(6)} ${m.name.padEnd(18)} ${m.text}`); return; }
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) { console.error('ffmpeg is not on the PATH; it trims and levels what comes back.'); process.exitCode = 1; return; }
  const only = value('--only') ? new Set(value('--only').split(',')) : null;
  const keep = value('--keep');
  for (const dir of [OUT, keep]) if (dir) fs.mkdirSync(dir, { recursive: true });
  const before = has('--polish') ? null : await credits();
  let made = 0;
  for (const item of MANIFEST) {
    if (only && !only.has(item.name)) continue;
    const file = path.join(OUT, `${item.name}.mp3`);
    const raw = keep ? path.join(keep, `${item.name}.mp3`) : `${file}.raw`;
    const kept = !!keep && fs.existsSync(raw);
    if (has('--polish') ? !kept : fs.existsSync(file) && !has('--force')) continue;
    process.stdout.write(`${item.kind.padEnd(6)} ${item.name} … `);
    try {
      if (!kept || (has('--force') && !has('--polish'))) fs.writeFileSync(raw, await generate(item));
      polish(raw, file, item);
      made++;
      console.log(`${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      if (err.fatal) { console.log('Stopping: the account will not make any more.'); break; }
    } finally { if (!keep) fs.rmSync(raw, { force: true }); }
  }
  const after = before === null ? null : await credits();
  console.log(`\n${made} file(s) written to public/audio/${before !== null && after !== null ? ` · credits used: ${after - before}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
