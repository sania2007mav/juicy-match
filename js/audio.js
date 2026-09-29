/** Tiny synthesized juice-bar sounds. No samples, no third-party audio. */

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
  }

  tone(freq, dur, type, gain, when = 0, slide) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain) {
    if (!this.ctx || this.muted) return;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    src.buffer = buffer;
    amp.gain.value = gain;
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start();
  }

  swap() {
    this.unlock();
    this.noise(0.04, 0.15);
    this.tone(520, 0.07, "sine", 0.18, 0, 740);
  }

  bad() {
    this.unlock();
    this.tone(220, 0.12, "triangle", 0.16, 0, 140);
  }

  match() {
    this.unlock();
    this.tone(523, 0.09, "triangle", 0.2);
    this.tone(659, 0.1, "triangle", 0.16, 0.04);
    this.tone(784, 0.12, "sine", 0.14, 0.08);
  }

  special() {
    this.unlock();
    this.tone(320, 0.22, "sawtooth", 0.08, 0, 880);
    this.tone(480, 0.18, "triangle", 0.16, 0.05, 960);
  }

  combo() {
    this.unlock();
    [523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, 0.12, "triangle", 0.16, i * 0.05));
  }

  drop() {
    this.unlock();
    this.tone(180, 0.1, "sine", 0.2, 0, 90);
  }

  button() {
    this.unlock();
    this.tone(660, 0.05, "sine", 0.12, 0, 880);
  }

  win() {
    this.unlock();
    [523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, 0.22, "triangle", 0.18, i * 0.09));
  }

  lose() {
    this.unlock();
    [494, 392, 330].forEach((freq, i) => this.tone(freq, 0.18, "sine", 0.14, i * 0.1, freq * 0.8));
  }
}
