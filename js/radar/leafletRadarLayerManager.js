export class LeafletRadarLayerManager {
  constructor(map, options = {}) {
    this.map = map;
    this.frames = [];
    this.currentIndex = 0;
    this.visible = true;
    this.opacity = options.opacity ?? 0.72;
    this.maxCachedFrames = options.maxCachedFrames ?? 16;
    this.prefetchAhead = options.prefetchAhead ?? 4;
    this.stateCallback = options.onStateChange;

    this.layerCache = new Map();
    this.activeLayer = null;
  }

  setState(partial) {
    this.stateCallback?.(partial);
  }

  setFrames(frames) {
    this.clear();
    this.frames = frames;
    this.currentIndex = Math.max(0, frames.length - 1);
  }

  clear() {
    this.layerCache.forEach((entry) => {
      if (this.map.hasLayer(entry.layer)) this.map.removeLayer(entry.layer);
    });
    this.layerCache.clear();
    this.activeLayer = null;
  }

  frameUrl(index) {
    const frame = this.frames[index];
    return frame.tileUrl;
  }

  getOrCreateEntry(index) {
    if (this.layerCache.has(index)) return this.layerCache.get(index);

    const layer = L.tileLayer(this.frameUrl(index), {
      opacity: 0,
      zIndex: 450,
      attribution: 'NOAA',
      updateWhenIdle: false,
      keepBuffer: 4
    });

    const entry = {
      layer,
      status: 'loading',
      tileErrors: 0,
      touchedAt: Date.now(),
      readyPromise: null
    };

    entry.readyPromise = new Promise((resolve) => {
      layer.on('load', () => {
        entry.status = 'ready';
        resolve(true);
      });
      layer.on('tileerror', () => {
        entry.tileErrors += 1;
        if (entry.status === 'loading' && entry.tileErrors >= 3) {
          entry.status = 'error';
          this.setState({ loading: false, error: 'A radar frame failed to load.' });
          resolve(false);
        }
      });
    });

    this.layerCache.set(index, entry);
    return entry;
  }

  async ensureLayerReady(index) {
    const entry = this.getOrCreateEntry(index);
    entry.touchedAt = Date.now();

    if (!this.map.hasLayer(entry.layer)) {
      entry.layer.addTo(this.map);
      entry.layer.setOpacity(0);
    }

    if (entry.status === 'ready') return true;

    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 1200));
    const loaded = await Promise.race([entry.readyPromise, timeout]);
    if (!loaded && entry.status !== 'ready') {
      entry.status = 'error';
      return false;
    }
    return true;
  }

  fadeLayers(fromLayer, toLayer, durationMs = 240) {
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = progress * (2 - progress);
      if (fromLayer) fromLayer.setOpacity(this.opacity * (1 - eased));
      toLayer.setOpacity(this.opacity * eased);

      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      if (fromLayer && fromLayer !== toLayer && this.map.hasLayer(fromLayer)) {
        this.map.removeLayer(fromLayer);
      }
    };

    requestAnimationFrame(step);
  }

  evictOldEntries() {
    if (this.layerCache.size <= this.maxCachedFrames) return;

    const candidates = [...this.layerCache.entries()]
      .filter(([idx]) => idx !== this.currentIndex)
      .sort((a, b) => a[1].touchedAt - b[1].touchedAt);

    while (this.layerCache.size > this.maxCachedFrames && candidates.length) {
      const [idx, entry] = candidates.shift();
      if (this.map.hasLayer(entry.layer)) this.map.removeLayer(entry.layer);
      this.layerCache.delete(idx);
    }
  }

  async setFrame(index, options = {}) {
    if (!this.frames.length) return this.currentIndex;

    const animate = options.animate ?? true;
    const bounded = Math.max(0, Math.min(index, this.frames.length - 1));
    this.currentIndex = bounded;

    if (!this.visible) return this.currentIndex;

    this.setState({ loading: true, error: null });
    const ready = await this.ensureLayerReady(bounded);

    if (!ready) {
      this.setState({ loading: false, error: 'Radar frame timeout; skipping.' });
      return this.currentIndex;
    }

    const nextEntry = this.getOrCreateEntry(bounded);
    const previousLayer = this.activeLayer;
    this.activeLayer = nextEntry.layer;

    if (!animate || !previousLayer || previousLayer === nextEntry.layer) {
      nextEntry.layer.setOpacity(this.opacity);
      if (previousLayer && previousLayer !== nextEntry.layer && this.map.hasLayer(previousLayer)) {
        this.map.removeLayer(previousLayer);
      }
    } else {
      this.fadeLayers(previousLayer, nextEntry.layer);
    }

    this.prefetchFrom(bounded, this.prefetchAhead);
    this.evictOldEntries();
    this.setState({ loading: false, error: null });
    return this.currentIndex;
  }

  async step(delta) {
    return this.setFrame((this.currentIndex + delta + this.frames.length) % this.frames.length);
  }

  jumpToLatest() {
    return this.setFrame(this.frames.length - 1);
  }

  async prefetchFrom(startIndex, count = 4) {
    const jobs = [];
    for (let i = 1; i <= count; i += 1) {
      const idx = (startIndex + i) % this.frames.length;
      jobs.push(this.ensureLayerReady(idx));
    }
    await Promise.allSettled(jobs);
  }

  async prefetchAll() {
    const frameWindow = Math.min(this.frames.length, this.maxCachedFrames);
    const jobs = [];
    for (let i = 0; i < frameWindow; i += 1) {
      const idx = (this.currentIndex + i) % this.frames.length;
      jobs.push(this.ensureLayerReady(idx));
    }
    await Promise.allSettled(jobs);
    this.evictOldEntries();
  }

  setOpacity(opacity) {
    this.opacity = opacity;
    if (this.activeLayer && this.visible) {
      this.activeLayer.setOpacity(opacity);
    }
  }

  setVisible(visible) {
    this.visible = visible;
    if (!visible) {
      this.layerCache.forEach((entry) => {
        if (this.map.hasLayer(entry.layer)) this.map.removeLayer(entry.layer);
      });
      return;
    }
    this.setFrame(this.currentIndex, { animate: false });
  }
}
