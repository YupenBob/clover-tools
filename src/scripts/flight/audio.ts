/** Original locally synthesized sound: two adjustable, gently filtered layers. */
export class CabinAudio {
  private context: AudioContext | null = null;
  private output: DynamicsCompressorNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private gains: GainNode[] = [];
  private filters: BiquadFilterNode[] = [];
  private revision = 0;
  private lastTear = 0;
  async ready() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
      this.output = this.context.createDynamicsCompressor();
      this.output.threshold.value = -16;
      this.output.knee.value = 6;
      this.output.ratio.value = 20;
      this.output.attack.value = 0.003;
      this.output.release.value = 0.25;
      this.output.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }
  async start(
    volume: number,
    engine: number,
    airflow: number,
    playing: boolean,
  ) {
    const version = ++this.revision,
      ctx = await this.ready();
    if (version !== this.revision) return;
    if (!this.sources.length) {
      for (const layer of [0, 1]) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
        const samples = buffer.getChannelData(0),
          blend = Math.round(ctx.sampleRate * 0.18);
        const raw = new Float32Array(samples.length + blend);
        let slow = 0,
          pink = 0;
        for (let i = 0; i < raw.length; i++) {
          const white = Math.random() * 2 - 1;
          slow = (slow + white * 0.022) / 1.022;
          pink = 0.96 * pink + 0.08 * white;
          raw[i] = layer ? pink * 0.9 : slow * 3.4;
        }
        samples.set(raw.subarray(0, samples.length));
        // Join the continuous tail to the head, avoiding a click at the loop boundary.
        for (let i = 0; i < blend; i++) {
          const p = i / blend;
          samples[i] = raw[samples.length + i] * (1 - p) + raw[i] * p;
        }
        if (!layer)
          for (let i = 0; i < samples.length; i++) {
            // Continuous, low engine harmonics give the filtered noise a cabin body.
            samples[i] +=
              Math.sin((i * 2 * Math.PI * 88) / ctx.sampleRate) * 0.18 +
              Math.sin((i * 2 * Math.PI * 132) / ctx.sampleRate) * 0.06;
          }
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = layer ? 1700 : 210;
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(this.output!);
        source.start();
        this.sources.push(source);
        this.gains.push(gain);
        this.filters.push(filter);
      }
    }
    this.update(volume, engine, airflow, playing);
  }
  update(
    volume: number,
    engine: number,
    airflow: number,
    playing: boolean,
    phase = "cruise",
  ) {
    const ctx = this.context;
    if (!ctx) return;
    const intensity =
      phase === "takeoff" ? 1 : phase === "descent" ? 0.7 : 0.82;
    this.gains.forEach((gain, i) =>
      gain.gain.setTargetAtTime(
        playing ? volume * (i ? airflow : engine) * 1.25 * intensity : 0,
        ctx.currentTime,
        0.8,
      ),
    );
    this.filters.forEach((filter, i) =>
      filter.frequency.setTargetAtTime(
        i
          ? phase === "takeoff"
            ? 2100
            : 1500
          : phase === "takeoff"
            ? 270
            : 180,
        ctx.currentTime,
        1.5,
      ),
    );
  }
  stop() {
    this.revision++;
    const now = this.context?.currentTime ?? 0;
    this.sources.forEach((source, i) => {
      const gain = this.gains[i],
        filter = this.filters[i];
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.025);
      source.stop(now + 0.15);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        filter.disconnect();
      };
    });
    this.sources = [];
    this.gains = [];
    this.filters = [];
  }
  suspend() {
    void this.context?.suspend().catch(() => {});
  }
  tear(progress: number, volume: number) {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      progress <= this.lastTear ||
      progress - this.lastTear < 0.025
    ) {
      if (progress === 0) this.lastTear = 0;
      return;
    }
    this.lastTear = progress;
    const buffer = ctx.createBuffer(
        1,
        Math.round(ctx.sampleRate * 0.06),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 900;
    gain.gain.value = volume * 0.13;
    source.connect(filter).connect(gain).connect(this.output!);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  chime(enabled: boolean, volume: number) {
    const ctx = this.context;
    if (!enabled || !ctx || ctx.state !== "running") return;
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        start = ctx.currentTime + i * 0.17;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume * 0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      oscillator.connect(gain).connect(this.output!);
      oscillator.start(start);
      oscillator.stop(start + 0.75);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
