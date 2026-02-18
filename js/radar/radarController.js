export class RadarController {
  constructor(options) {
    this.getFrameCount = options.getFrameCount;
    this.onFrame = options.onFrame;
    this.onState = options.onState;
    this.onTick = options.onTick;

    this.playing = false;
    this.currentIndex = 0;
    this.speed = 1;
    this.baseFps = 10;
    this.lastTime = 0;
    this.accumulator = 0;
    this.rafId = null;
    this.transitionInFlight = false;
  }

  setSpeed(multiplier) {
    this.speed = multiplier;
    this.onState?.({ speed: this.speed });
  }

  async setIndex(index, animate = true) {
    this.currentIndex = await this.onFrame(index, { animate });
    this.onTick?.(this.currentIndex);
    return this.currentIndex;
  }

  async step(delta) {
    const count = this.getFrameCount();
    if (!count) return 0;
    const idx = (this.currentIndex + delta + count) % count;
    return this.setIndex(idx);
  }

  async latest() {
    const count = this.getFrameCount();
    if (!count) return 0;
    return this.setIndex(count - 1, false);
  }

  play() {
    if (this.playing || this.getFrameCount() < 2) return;
    this.playing = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.onState?.({ playing: true });

    const loop = async (now) => {
      if (!this.playing) return;

      const frameTime = 1000 / (this.baseFps * this.speed);
      const delta = now - this.lastTime;
      this.lastTime = now;
      this.accumulator += delta;

      if (this.accumulator >= frameTime && !this.transitionInFlight) {
        this.accumulator %= frameTime;
        this.transitionInFlight = true;
        try {
          await this.step(1);
        } finally {
          this.transitionInFlight = false;
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  pause() {
    this.playing = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.onState?.({ playing: false });
  }

  toggle() {
    if (this.playing) {
      this.pause();
      return;
    }
    this.play();
  }
}
