// A bounded 40 ms, mono 16 kHz PCM packet. Private-alpha transport, no recording.
export const VOICE_RATE = 16000;
export const VOICE_SAMPLES = 640;
export function validVoicePacket(m) {
  return m?.type === 'voice' && Number.isSafeInteger(m.seq) && m.seq >= 0
    && typeof m.pcm === 'string' && m.pcm.length === 1708
    && /^[A-Za-z0-9+/]{1707}=$/.test(m.pcm);
}
