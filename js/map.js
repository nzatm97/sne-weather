import { CONFIG } from './config.js';

function styleForSeverity(severity = '') {
  const normalized = severity.toLowerCase();
  if (normalized.includes('extreme')) return '#ff4d6d';
  if (normalized.includes('severe')) return '#ff8c42';
  if (normalized.includes('moderate')) return '#ffd166';
  return '#70d6ff';
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
