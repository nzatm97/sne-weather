import { CONFIG } from './config.js';

function styleForSeverity(severity = '') {
  const normalized = severity.toLowerCase();
  if (normalized.includes('extreme')) return '#ff4d6d';
  if (normalized.includes('severe')) return '#ff8c42';
  if (normalized.includes('moderate')) return '#ffd166';
  return '#70d6ff';
}

function tempColor(tempF) {
  if (tempF <= 20) return '#66b5ff';
  if (tempF <= 35) return '#7ad7ff';
  if (tempF <= 50) return '#72ffd0';
  if (tempF <= 65) return '#ffd56e';
  if (tempF <= 80) return '#ffa46b';
  return '#ff6e7a';
}

export class WeatherMap {
  constructor(elementId) {
    this.map = L.map(elementId, { zoomControl: true }).setView(
      [CONFIG.defaultLocation.lat, CONFIG.defaultLocation.lon],
      CONFIG.map.initialZoom
    );

    L.tileLayer(CONFIG.map.darkTiles, {
      attribution: CONFIG.map.attribution,
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.radarLayer = null;
    this.radarLayerCache = new Map();
    this.radarFrames = [];
    this.currentFrameIdx = 0;
    this.animTimer = null;
    this.radarOpacity = CONFIG.map.radarOpacity;
    this.radarVisible = true;

    this.tempLayer = L.layerGroup().addTo(this.map);
    this.windLayer = L.layerGroup().addTo(this.map);

    this.alertLayer = L.geoJSON([], {
      style: (feature) => ({ color: styleForSeverity(feature.properties?.severity), weight: 2, fillOpacity: 0.18 })
    }).addTo(this.map);

    this.locationMarker = L.circleMarker([CONFIG.defaultLocation.lat, CONFIG.defaultLocation.lon], {
      radius: 6,
      color: '#81a1ff',
      fillColor: '#81a1ff',
      fillOpacity: 0.9
    }).addTo(this.map);
  }

  setCenter(lat, lon, zoom = 8) {
    this.map.setView([lat, lon], zoom, { animate: true });
    this.locationMarker.setLatLng([lat, lon]);
  }

  setRadarFrames(frames) {
    this.clearCachedRadarLayers();
    this.radarFrames = frames;
    this.currentFrameIdx = Math.max(0, frames.length - 1);
    this.renderRadarFrame();
  }

  clearCachedRadarLayers() {
    this.radarLayerCache.forEach((layer) => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });
    this.radarLayerCache.clear();
    this.radarLayer = null;
  }

  radarUrlForFrame(frame) {
    return `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/6/1_1.png`;
  }

  getRadarLayer(index) {
    if (this.radarLayerCache.has(index)) return this.radarLayerCache.get(index);
    const frame = this.radarFrames[index];
    const layer = L.tileLayer(this.radarUrlForFrame(frame), {
      opacity: 0,
      zIndex: 450,
      attribution: 'RainViewer',
      updateWhenIdle: false,
      keepBuffer: 4
    });
    this.radarLayerCache.set(index, layer);
    return layer;
  }

  fadeBetweenRadarLayers(fromLayer, toLayer) {
    const durationMs = 280;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = progress * (2 - progress);
      if (fromLayer) fromLayer.setOpacity(this.radarOpacity * (1 - eased));
      toLayer.setOpacity(this.radarOpacity * eased);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (fromLayer && fromLayer !== toLayer && this.map.hasLayer(fromLayer)) {
        this.map.removeLayer(fromLayer);
      }
    };
    requestAnimationFrame(animate);
  }

  renderRadarFrame() {
    if (!this.radarFrames.length) return;
    if (!this.radarVisible) return;
    const nextLayer = this.getRadarLayer(this.currentFrameIdx);
    if (!this.map.hasLayer(nextLayer)) nextLayer.addTo(this.map);

    if (!this.radarLayer || this.radarLayer === nextLayer) {
      nextLayer.setOpacity(this.radarOpacity);
      this.radarLayer = nextLayer;
      return;
    }

    const previous = this.radarLayer;
    this.radarLayer = nextLayer;
    this.fadeBetweenRadarLayers(previous, nextLayer);
  }

  setRadarOpacity(opacity) {
    this.radarOpacity = opacity;
    if (this.radarLayer && this.radarVisible) this.radarLayer.setOpacity(opacity);
  }

  setFrameByIndex(index) {
    this.currentFrameIdx = Math.max(0, Math.min(index, this.radarFrames.length - 1));
    this.renderRadarFrame();
    return this.currentFrameIdx;
  }

  toggleRadar(visible) {
    this.radarVisible = visible;
    if (visible) {
      this.renderRadarFrame();
      return;
    }
    this.radarLayerCache.forEach((layer) => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });
  }

  playRadar(onTick) {
    if (this.animTimer || this.radarFrames.length < 2) return;
    this.animTimer = setInterval(() => {
      const nextIndex = (this.currentFrameIdx + 1) % this.radarFrames.length;
      this.setFrameByIndex(nextIndex);
      onTick?.(nextIndex);
    }, 850);
  }

  pauseRadar() {
    if (this.animTimer) clearInterval(this.animTimer);
    this.animTimer = null;
  }

  updateDerivedLayers(place, forecast) {
    this.tempLayer.clearLayers();
    this.windLayer.clearLayers();

    const baseTemp = forecast.current.temperature_2m;
    const baseWind = forecast.current.wind_speed_10m;
    const direction = forecast.hourly.wind_direction_10m?.[0] ?? 45;

    const offsets = [-0.45, 0, 0.45];
    offsets.forEach((latOffset, i) => {
      offsets.forEach((lonOffset, j) => {
        const lat = place.lat + latOffset;
        const lon = place.lon + lonOffset;
        const temp = baseTemp + (i - 1) * 3 - (j - 1) * 2;
        const wind = Math.max(2, baseWind + (j - 1) * 2);

        const circle = L.circleMarker([lat, lon], {
          radius: 11,
          fillColor: tempColor(temp),
          color: '#0c1225',
          weight: 1,
          fillOpacity: 0.52
        }).bindTooltip(`Temp layer: ${Math.round(temp)}°F`);
        circle.addTo(this.tempLayer);

        const angle = ((direction + i * 14 + j * 9) * Math.PI) / 180;
        const lat2 = lat + 0.08 * Math.cos(angle);
        const lon2 = lon + 0.08 * Math.sin(angle);

        L.polyline(
          [[lat, lon], [lat2, lon2]],
          { color: '#9dd6ff', weight: Math.max(1.5, wind / 10), opacity: 0.8 }
        )
          .bindTooltip(`Wind layer: ${Math.round(wind)} mph`)
          .addTo(this.windLayer);
      });
    });
  }

  toggleTemp(visible) {
    if (visible) this.tempLayer.addTo(this.map);
    else this.map.removeLayer(this.tempLayer);
  }

  toggleWind(visible) {
    if (visible) this.windLayer.addTo(this.map);
    else this.map.removeLayer(this.windLayer);
  }

  updateAlerts(alertFeatures) {
    this.alertLayer.clearLayers();
    this.alertLayer.addData(alertFeatures);
  }

  toggleAlerts(visible) {
    if (visible) this.alertLayer.addTo(this.map);
    else this.map.removeLayer(this.alertLayer);
  }

  zoomToAlert(feature) {
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.5));
  }
}
