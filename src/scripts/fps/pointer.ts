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
  private pending = false;
  raw = false;

  constructor(surface: PointerSurface) {
    this.surface = surface;
  }

  async request(): Promise<'requested' | 'failed' | 'cancelled' | 'ignored'> {
    if (this.pending || this.armed || !this.surface.available()) return 'ignored';
    const generation = ++this.generation;
    const current = () => this.armed && this.generation === generation && this.surface.available();
    this.pending = this.armed = true;
    this.raw = true;
    try {
      try {
        await this.surface.request(true);
      } catch (error) {
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
      this.cancel();
      return false;
    }
    if (this.armed && this.surface.available()) return true;
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
    this.generation++;
    if (this.surface.owns()) this.surface.release();
  }
}
