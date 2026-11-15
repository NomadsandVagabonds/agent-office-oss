import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validVoicePacket,VOICE_RATE,VOICE_SAMPLES} from '../core/coop-voice.js';
test('voice frames have a fixed 40 ms PCM budget',()=>{
 const frame={type:'voice',seq:0,pcm:Buffer.alloc(VOICE_SAMPLES*2).toString('base64')};
 assert.equal(VOICE_SAMPLES/VOICE_RATE,.04);assert.ok(validVoicePacket(frame));
 for(const bad of [{...frame,seq:-1},{...frame,seq:1.2},{...frame,pcm:frame.pcm+'A'},{...frame,pcm:'?'.repeat(1707)+'='},{...frame,type:'input'},null])assert.equal(validVoicePacket(bad),false);
});
