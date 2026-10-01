/** Owns one explicit mouse-capture intent; stale browser grants cannot restart a session. */
export interface PointerSurface {
  available(): boolean;
  request(raw: boolean): Promise<void> | void;
  owns(): boolean;
  release(): void;
}

export class PointerCapture {
  private surface: PointerSurface;
  private generation = 0;
  private armed = false;
  private captured = false;
  private pending = false;
  private rawAvailable = true;
  raw = false;

  constructor(surface: PointerSurface) {
    this.surface = surface;
  }

  async request(): Promise<'requested' | 'failed' | 'cancelled' | 'ignored'> {
    if (this.pending || this.armed || !this.surface.available()) return 'ignored';
    const generation = ++this.generation;
    const current = () => this.armed && this.generation === generation && this.surface.available();
    this.pending = this.armed = true;
    this.captured = false;
    this.raw = this.rawAvailable;
    try {
      try {
        await this.surface.request(this.raw);
      } catch (error) {
        if ((error as { name?: string }).name === 'NotSupportedError') this.rawAvailable = false;
        if (!current()) return 'cancelled';
        if ((error as { name?: string }).name !== 'NotSupportedError') throw error;
        this.raw = false;
        await this.surface.request(false);
      }
      if (!current()) {
        this.cancel();
        return 'cancelled';
      }
      return 'requested';
    } catch {
      if (!current()) return 'cancelled';
      this.cancel();
      return 'failed';
    } finally {
      this.pending = false;
    }
  }

  /** Called for native lock changes, including grants arriving after blur/exit. */
  acceptChange(): boolean {
    if (!this.surface.owns()) {
      // An earlier exit notification can arrive while a fresh request is awaiting its grant.
      if (this.armed && !this.captured && this.surface.available()) return false;
      this.cancel();
      return false;
    }
    if (this.armed && this.surface.available()) {
      this.captured = true;
      return true;
    }
    this.cancel();
    return false;
  }

  /** Raw-input rejection can emit an error after the ordinary-input grant succeeded. */
  handleError(): boolean {
    if (this.pending || (this.armed && this.surface.owns() && this.surface.available()))
      return false;
    this.cancel();
    return true;
  }

  cancel() {
    this.armed = false;
    this.captured = false;
    this.generation++;
    if (this.surface.owns()) this.surface.release();
  }
}
