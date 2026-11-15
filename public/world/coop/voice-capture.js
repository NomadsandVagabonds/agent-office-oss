// Resample microphone input to bounded 16 kHz packets off the rendering thread.
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.phase=0;this.samples=new Int16Array(640);this.used=0;this.on=false;
    this.port.onmessage=e=>{this.on=!!e.data;this.used=0;}; }
  process(inputs,outputs) {
    const input=inputs[0]?.[0];
    if(this.on&&input)for(const sample of input){
      this.phase+=16000;
      if(this.phase>=sampleRate){this.phase-=sampleRate;this.samples[this.used++]=Math.round(Math.max(-1,Math.min(1,sample))*32767);
        if(this.used===640){this.port.postMessage(this.samples);this.samples=new Int16Array(640);this.used=0;}}
    }
    // Microphone is never played locally.
    for(const output of outputs)for(const channel of output)channel.fill(0);
    return true;
  }
}
registerProcessor('coop-voice-capture',Capture);
