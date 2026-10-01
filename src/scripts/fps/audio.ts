import { FPS_CONFIG } from '../../../config/fps.mjs';
import type { FeedbackEvent, Settings } from './types.ts';

export type AudioStatus =
  'idle' | 'loading' | 'ready' | 'running' | 'muted' | 'blocked' | 'unavailable';

/** Audio owns its clock and nodes. It consumes feedback, never changes a training session. */
export class RangeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private abort = new AbortController();
  private active = false;
  private prepared = false;
  private closed = false;
  private clock = { simulation: 0, audio: 0 };
  status: AudioStatus = 'loading';
  constructor(
    private settings: Settings,
    private onStatus: (status: AudioStatus) => void,
  ) {
    try {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      for (const [key, value] of Object.entries(FPS_CONFIG.feedback.audio.compressor))
        (limiter[key as keyof typeof FPS_CONFIG.feedback.audio.compressor] as AudioParam).value =
          value;
      this.master.connect(limiter).connect(this.context.destination);
      this.master.gain.value = settings.muted ? 0 : settings.volume / 100;
    } catch {
      this.setStatus('unavailable');
    }
  }
  private setStatus(status: AudioStatus) {
    if (this.closed) return;
    this.status = status;
    this.onStatus(status);
  }
  async prepare() {
    if (!this.context || this.closed) return;
    if (this.settings.muted || this.settings.volume === 0) {
      this.setStatus('muted');
      return;
    }
    this.setStatus('loading');
    const c = FPS_CONFIG.feedback.audio;
    const profile = c.profiles[this.settings.weapon as keyof typeof c.profiles] || c.profiles.ak47;
    const timeout = setTimeout(() => this.abort.abort(), c.loadTimeoutMs);
    try {
      await Promise.all(
        [profile.sample, 'reload', 'action'].map(async (id) => {
          const asset = c.assets[id as keyof typeof c.assets];
          const response = await fetch(asset.file, { signal: this.abort.signal });
          if (!response.ok) throw new Error(`Audio ${response.status}`);
          const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
          if (!this.closed) this.buffers.set(id, buffer);
        }),
      );
      this.prepared = true;
      this.setStatus(
        this.active ? (this.context.state === 'running' ? 'running' : 'blocked') : 'ready',
      );
    } catch {
      this.setStatus('unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
  /** Invoke synchronously inside the explicit begin/resume/test click, before pointer-lock awaits. */
  activate(simulationTime = 0) {
    if (!this.context || this.closed || this.settings.muted || this.settings.volume === 0) return;
    this.active = true;
    this.clock = { simulation: simulationTime, audio: this.context.currentTime };
    void this.context
      .resume()
      .then(() => {
        if (!this.active || this.closed) return;
        this.clock = { simulation: simulationTime, audio: this.context!.currentTime };
        if (this.prepared) this.setStatus('running');
      })
      .catch(() => {
        if (this.active) this.setStatus('blocked');
      });
  }
  syncTime(simulationTime: number) {
    if (this.context) this.clock = { simulation: simulationTime, audio: this.context.currentTime };
  }
  private when(simulationTime: number) {
    const context = this.context;
    if (
      !context ||
      !this.active ||
      context.state !== 'running' ||
      this.closed ||
      this.settings.muted
    )
      return null;
    const scheduled = this.clock.audio + simulationTime - this.clock.simulation;
    if (context.currentTime - scheduled > FPS_CONFIG.feedback.audio.maxLateness) return null;
    return Math.max(context.currentTime, scheduled);
  }
  private register(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    while (this.voices.size >= FPS_CONFIG.feedback.audio.maxVoices) {
      const oldest = this.voices.keys().next().value!;
      oldest.stop();
      this.clean(oldest);
    }
    this.voices.set(source, nodes);
    source.onended = () => this.clean(source);
  }
  private clean(source: AudioScheduledSourceNode) {
    source.disconnect();
    this.voices.get(source)?.forEach((node) => node.disconnect());
    this.voices.delete(source);
  }
  private sample(id: string, at: number, volume: number, rate = 1, lowpass?: number) {
    const context = this.context,
      buffer = this.buffers.get(id);
    if (!context || !this.master || !buffer || volume <= 0) return;
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    const nodes: AudioNode[] = [gain];
    if (lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      source.connect(filter).connect(gain);
      nodes.push(filter);
    } else source.connect(gain);
    gain.connect(this.master);
    this.register(source, nodes);
    source.start(at);
  }
  private tone(at: number, hz: number, seconds: number, volume: number) {
    if (!this.context || !this.master || volume <= 0) return;
    const source = this.context.createOscillator(),
      gain = this.context.createGain();
    source.type = 'sine';
    source.frequency.setValueAtTime(hz, at);
    source.frequency.exponentialRampToValueAtTime(hz / 2, at + seconds);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(FPS_CONFIG.feedback.audio.floorGain, at + seconds);
    source.connect(gain).connect(this.master);
    this.register(source, [gain]);
    source.start(at);
    source.stop(at + seconds);
  }
  feedback(event: FeedbackEvent) {
    const at = this.when(event.time);
    if (at === null) return;
    const c = FPS_CONFIG.feedback.audio;
    const profile = c.profiles[this.settings.weapon as keyof typeof c.profiles] || c.profiles.ak47;
    if (event.kind === 'shot') {
      this.sample(
        profile.sample,
        at,
        (profile.gain * this.settings.shotVolume) / 100,
        profile.rate,
        profile.lowpass,
      );
      if (event.shot.region)
        this.tone(
          at,
          event.completed ? c.completeHz : event.shot.region === 'head' ? c.headHz : c.hitHz,
          event.completed ? c.completeSeconds : c.hitSeconds,
          (c.feedbackGain * this.settings.hitVolume) / 100,
        );
    } else
      this.sample(
        event.kind === 'reload-start' ? 'reload' : 'action',
        at,
        ((event.kind === 'empty' ? c.dryGain : c.reloadGain) * this.settings.shotVolume) / 100,
      );
  }
  test() {
    if (
      !this.context ||
      !this.active ||
      this.context.state !== 'running' ||
      this.closed ||
      this.settings.muted
    )
      return;
    const at = this.context.currentTime;
    const c = FPS_CONFIG.feedback.audio;
    const profile = c.profiles[this.settings.weapon as keyof typeof c.profiles] || c.profiles.ak47;
    this.sample(
      profile.sample,
      at,
      (profile.gain * this.settings.shotVolume) / 100,
      profile.rate,
      profile.lowpass,
    );
    this.tone(at, c.hitHz, c.hitSeconds, (c.feedbackGain * this.settings.hitVolume) / 100);
  }
  stop() {
    this.active = false;
    for (const source of [...this.voices.keys()]) {
      source.stop();
      this.clean(source);
    }
    if (this.status === 'running') this.setStatus('ready');
  }
  dispose() {
    this.stop();
    this.closed = true;
    this.abort.abort();
    this.buffers.clear();
    void this.context?.close().catch(() => {});
  }
}
