#!/usr/bin/env node
// make-audio.mjs — how the office's sounds were made, and how to remake them.
//
// The office never calls a sound service at runtime: everything under
// public/audio/ is a small static file, and the client falls back to its own
// built-in synth when one is missing (public/world/ui/extras.js). This script
// is the one-off that generated those files with the ElevenLabs API.
//
//   ELEVENLABS_API_KEY=… node tools/make-audio.mjs            # make what is missing
//   node tools/make-audio.mjs --only lift-ding,bell --force   # redo some
//   node tools/make-audio.mjs --list
//
// Prompts are generic descriptions of sounds — nothing about you or your
// projects is sent. Voices are ElevenLabs' stock ones. If ffmpeg is on the
// PATH, each file is trimmed and levelled afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio');
const API = 'https://api.elevenlabs.io';
// In a sandbox whose network proxy injects the credential there is no variable to read; the placeholder is overwritten.
const KEY = process.env.ELEVENLABS_API_KEY || 'proxy-injected';

const VOICE = {                      // ElevenLabs stock voices
  lift: 'Xb7hH8MSUJpSbSDYk0k2',      // Alice — clear, British, professional
  hollow: 'nPczCjzI2devNBz1zQrb',    // Brian — deep, resonant
  pa: 'onwK4e9ZLuTAKqWW03F9',        // Daniel — steady broadcaster
  arcade: 'IKne3meq5aSn9XLyUdCD',    // Charlie — hyped
};

const sfx = (name, text, seconds, extra = {}) => ({ name, kind: 'sfx', text, seconds, ...extra });
const music = (name, text, seconds) => ({ name, kind: 'music', text, seconds });
const voice = (name, who, text, extra = {}) => ({ name, kind: 'voice', who, text, ...extra });

export const MANIFEST = [
  // ---- things that happen in the office
  sfx('needs-you', 'Gentle friendly two note notification chime played on a soft marimba, like a polite knock, clean, no background', 1.0, { influence: 0.6 }),
  sfx('lift-ding', 'A single soft elevator arrival chime, one bright ding with a short tail, clean, no background noise', 1.5, { influence: 0.7 }),
  sfx('lift-doors', 'Elevator doors sliding open, smooth mechanical hum and a soft thunk, indoors, clean', 2.2),
  sfx('bell', 'One tap on a small brass reception desk bell, bright ringing ding, close and clean', 1.8, { influence: 0.7 }),
  sfx('coffee', 'Drip coffee machine gurgling and pouring coffee into a mug with a little hiss of steam, close', 3.5),
  sfx('vend', 'Vending machine motor whirring, then a snack bar drops into the tray with a clunk', 2.6),
  sfx('water', 'Office water cooler dispensing water, a big glug of bubbles rising in the bottle', 2.2),
  sfx('printer', 'Old office laser printer whirring and feeding out one sheet of paper', 3.2),
  sfx('paper-plane', 'A light paper airplane whooshing past, quick soft swish', 0.9),
  sfx('confetti', 'Party popper pop with a burst of confetti and a small sparkle', 1.4),
  sfx('sticky', 'A paper sticky note being peeled off and pressed onto a board, small paper tap', 0.7),
  sfx('purr', 'A contented cat purring, close, warm and steady', 3.0),
  sfx('duck', 'A single squeak of a rubber duck bath toy', 0.6, { influence: 0.7 }),
  sfx('discovery', 'Magical discovery chime, a short ascending sparkle glissando with a shimmering tail', 1.8),
  sfx('typing', 'A burst of typing on a mechanical keyboard, close, no other sound', 2.5),
  sfx('coin', 'A coin dropping into a retro arcade machine slot, followed by a short 8-bit ready jingle', 1.6),
  sfx('squash', 'A very short 8-bit squish blip, a video game enemy being squashed', 0.5, { influence: 0.7 }),
  sfx('noclip', 'Reality glitching: a low digital warble and a tape slowing down as something falls through a wall into silence', 2.6),
  // ---- beds that loop
  sfx('office-bed', 'Quiet open plan office room tone: soft air conditioning, very distant keyboard typing and a faint murmur, calm and steady', 20, { loop: true }),
  sfx('backrooms-hum', 'Constant fluorescent tube light buzz with a low mains electrical hum in an empty carpeted room, eerie and steady', 12, { loop: true }),
  // ---- music
  music('elevator-muzak', 'Cheesy elevator muzak: light bossa nova lounge instrumental with a vibraphone melody, soft nylon guitar, gentle brushed drums and upright bass, pleasant and slightly corny, 1960s easy listening', 30),
  music('jukebox-disco', 'Joyful 1970s disco funk instrumental: four on the floor drums, bouncy slap bass, bright string stabs, wah guitar and hand claps, very danceable', 32),
  music('arcade-chiptune', 'Energetic 8-bit chiptune arcade game music, catchy square wave melody with fast arpeggios, classic console style', 22),
  music('rooftop-lofi', 'Calm lo-fi hip hop instrumental, warm electric piano chords, soft dusty drums and vinyl crackle, a relaxed evening on a city rooftop', 40),
  // ---- voices
  voice('lift-lobby', 'lift', 'Lobby.'),
  voice('lift-roof', 'lift', 'Rooftop garden.'),
  voice('lift-up', 'lift', 'Going up.'),
  voice('lift-down', 'lift', 'Going down.'),
  voice('lift-closing', 'lift', 'Doors closing.'),
  voice('lift-13', 'lift', 'Floor… thirteen. Please mind the gap in reality.'),
  voice('hollow-fool', 'hollow', 'Fool.', { stability: 0.75 }),
  voice('hollow-fine', 'hollow', '…Fine.', { stability: 0.75 }),
  voice('pa-meeting', 'pa', 'Attention please. The three o\'clock meeting has been moved to the ceiling.'),
  voice('pa-cabinet', 'pa', 'Would the owner of a beige filing cabinet please return to it. It misses you.'),
  voice('pa-exit', 'pa', 'A reminder: the exit is exactly where you left it. Thank you.'),
  voice('arcade-title', 'arcade', 'Bug Squash!'),
];

async function call(pathname, body, query = '') {
  const res = await fetch(`${API}${pathname}${query}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': KEY }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generate(item) {
  if (item.kind === 'sfx') {
    return call('/v1/sound-generation', { text: item.text, duration_seconds: item.seconds, prompt_influence: item.influence ?? 0.4, loop: !!item.loop },
      '?output_format=mp3_44100_96');
  }
  if (item.kind === 'music') {
    return call('/v1/music', { prompt: item.text, music_length_ms: Math.round(item.seconds * 1000), force_instrumental: true }, '?output_format=mp3_44100_128');
  }
  return call(`/v1/text-to-speech/${VOICE[item.who]}`, { text: item.text, model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: item.stability ?? 0.5, similarity_boost: 0.75 } }, '?output_format=mp3_44100_96');
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
/** Trim silence off one-shots, level everything, and keep files small. Loops are only levelled (trimming would break the seam). */
function polish(file, item) {
  if (!hasFfmpeg) return;
  const tmp = file + '.tmp.mp3';
  // cut the dead air before the sound; keep its tail down to a whisper, then fade the last few milliseconds
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01,areverse,silenceremove=start_periods=1:start_threshold=-62dB:start_silence=0.02,afade=t=in:d=0.03,areverse';
  const level = item.kind === 'music' ? 'loudnorm=I=-20:TP=-2:LRA=11' : item.loop ? 'loudnorm=I=-26:TP=-3' : 'loudnorm=I=-18:TP=-2';
  const chain = item.loop || item.kind === 'music' ? level : `${trim},${level}`;
  const rate = item.kind === 'music' ? '112k' : item.loop ? '80k' : '72k';
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-af', chain, '-ar', '44100', '-ac', item.kind === 'music' || item.loop ? '2' : '1', '-b:a', rate, tmp]);
  if (r.status === 0) fs.renameSync(tmp, file); else { try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ } }
}

async function credits() {
  try {
    const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': KEY } });
    const d = await res.json();
    return Number(d.character_count) || 0;
  } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
  const force = args.includes('--force');
  if (args.includes('--list')) { for (const m of MANIFEST) console.log(`${m.kind.padEnd(6)} ${m.name.padEnd(18)} ${m.text}`); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const before = await credits();
  let made = 0;
  for (const item of MANIFEST) {
    if (only && !only.has(item.name)) continue;
    const file = path.join(OUT, `${item.name}.mp3`);
    if (fs.existsSync(file) && !force) continue;
    process.stdout.write(`${item.kind.padEnd(6)} ${item.name} … `);
    try {
      fs.writeFileSync(file, await generate(item));
      polish(file, item);
      made++;
      console.log(`${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    } catch (err) { console.log(`FAILED — ${err.message}`); }
  }
  const after = await credits();
  console.log(`\n${made} file(s) written to public/audio/${before !== null && after !== null ? ` · credits used: ${after - before}` : ''}`);
}
