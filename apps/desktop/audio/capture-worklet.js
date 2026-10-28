// Runs on the audio thread, after Chromium's WebRTC acoustic echo cancellation.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() { super();this.frame = new Int16Array(320);this.offset = 0;this.energy = 0;this.noise = .0003;this.active = 0;this.silent = 0;this.speaking = false; }
  process(inputs, outputs) {
    for (const channel of outputs[0] || []) channel.fill(0); // Never monitor the microphone.
    const source = inputs[0]?.[0];if (!source) return true;
    for (const sample of source) {
      this.frame[this.offset++] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);this.energy += sample * sample;
      if (this.offset === 320) {
        const level = Math.sqrt(this.energy / 320);
        if (level > Math.max(.0025, this.noise * 4)) { this.active += 20;this.silent = 0;if (this.active >= 100) this.speaking = true; }
        else { this.active = 0;this.silent += 20;if (this.silent >= 600) this.speaking = false;if (!this.speaking) this.noise = this.noise * .99 + level * .01; }
        this.port.postMessage({ pcm: new Uint8Array(this.frame.buffer), level, speech: this.speaking }, [this.frame.buffer]);
        this.frame = new Int16Array(320);this.offset = 0;this.energy = 0;
      }
    }
    return true;
  }
}
registerProcessor('aether-live-capture', CaptureProcessor);
