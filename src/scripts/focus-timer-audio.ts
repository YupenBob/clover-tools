export type Environment = "white" | "rain" | "cafe";
/** One track graph at a time. No media requests. */
export class FocusAudio {
  private context: AudioContext | null = null;
  private graph: {
    gain: GainNode;
    nodes: AudioNode[];
    sources: AudioScheduledSourceNode[];
  } | null = null;
  private generation = 0;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  enabled = false;
  get active() {
    return this.playing;
  }
  private playing = false;
  private failed = false;
  constructor(private report: (playing: boolean, failed: boolean) => void) {}
  async enable(): Promise<boolean> {
    const generation = ++this.generation;
    try {
      if (!this.context || this.context.state === "closed")
        this.context = new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return false;
      if (this.context.state !== "running") throw new Error("audio-suspended");
      this.context.onstatechange = () => {
        if (this.playing && this.context?.state !== "running") {
          this.failed = true;
          this.stop();
        }
      };
      this.enabled = true;
      this.failed = false;
      this.report(false, false);
      return true;
    } catch {
      if (generation === this.generation) {
        this.enabled = false;
        this.failed = true;
        this.report(false, true);
      }
      return false;
    }
  }
  play(
    environment: Environment,
    volume: number,
    muted: boolean,
    preview = false,
  ) {
    this.stop();
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") {
      if (this.enabled) {
        this.failed = true;
        this.report(false, true);
      }
      return;
    }
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const nodes: AudioNode[] = [gain],
        sources: AudioScheduledSourceNode[] = [];
      this.graph = { gain, nodes, sources };
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < data.length; i++) {
        const n = Math.random() * 2 - 1;
        smooth = (smooth + 0.02 * n) / 1.02;
        data[i] = environment === "cafe" ? smooth * 4 : n * 0.25;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      sources.push(noise);
      nodes.push(noise);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value =
        environment === "white" ? 18000 : environment === "rain" ? 2400 : 500;
      nodes.push(filter);
      noise.connect(filter);
      filter.connect(gain);
      noise.start();
      if (environment !== "white") {
        const drops = ctx.createBuffer(1, ctx.sampleRate * 7, ctx.sampleRate),
          samples = drops.getChannelData(0);
        for (
          let start = 0.3;
          start < 7;
          start +=
            environment === "rain"
              ? 0.17 + Math.random() * 0.6
              : 0.7 + Math.random()
        ) {
          const freq =
            environment === "rain"
              ? 1000 + Math.random() * 1700
              : 700 + Math.random() * 1100;
          for (let j = 0; j < ctx.sampleRate * 0.09; j++) {
            const at = Math.floor(start * ctx.sampleRate) + j;
            if (at < samples.length)
              samples[at] +=
                Math.sin((j / ctx.sampleRate) * freq * Math.PI * 2) *
                Math.exp((-j / ctx.sampleRate) * 70) *
                0.08;
          }
        }
        const detail = ctx.createBufferSource();
        detail.buffer = drops;
        detail.loop = true;
        detail.connect(gain);
        sources.push(detail);
        nodes.push(detail);
        detail.start();
      }
      gain.gain.linearRampToValueAtTime(
        muted ? 0 : (volume / 100) * 0.45,
        ctx.currentTime + 0.08,
      );
      this.playing = true;
      this.report(true, false);
      if (preview) this.previewTimer = setTimeout(() => this.stop(), 5000);
    } catch {
      this.failed = true;
      this.stop();
    }
  }
  volume(volume: number, muted: boolean) {
    if (this.graph && this.context)
      this.graph.gain.gain.setTargetAtTime(
        muted ? 0 : (volume / 100) * 0.45,
        this.context.currentTime,
        0.03,
      );
  }
  stop(clearFailure = false) {
    if (clearFailure) this.failed = false;
    this.generation++;
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = null;
    const graph = this.graph;
    this.graph = null;
    this.playing = false;
    if (graph && this.context) {
      const ctx = this.context;
      graph.gain.gain.cancelScheduledValues(ctx.currentTime);
      graph.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      for (const source of graph.sources) {
        try {
          source.stop(ctx.currentTime + 0.06);
        } catch {
          /* already stopped */
        }
      }
      setTimeout(() => {
        for (const n of graph.nodes) n.disconnect();
      }, 90);
    }
    this.report(false, this.failed);
  }
  dispose() {
    this.stop(true);
    this.enabled = false;
    if (this.context) {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
    }
    this.context = null;
  }
}
