export const CONFIG = {
    defaultLocation: { name: 'Providence, RI', lat: 41.824, lon: -71.4128 },
    map: {
      initialZoom: 7,
      maxRadarFrames: 12,
      radarOpacity: 0.72,
      radarFps: 1.6,
      radarPrefetchAhead: 3,
      radarCacheSize: 12,
      darkTiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; OpenStreetMap contributors &copy; CARTO &copy; RainViewer'
    },
    endpoints: {
      geocode: 'https://nominatim.openstreetmap.org/search',
      reverseGeocode: 'https://nominatim.openstreetmap.org/reverse',
      forecast: 'https://api.open-meteo.com/v1/forecast',
      radarMeta: 'https://api.rainviewer.com/public/weather-maps.json',
      nwsPoint: 'https://api.weather.gov/points',
      nwsAlertsActive: 'https://api.weather.gov/alerts/active'
    },
    cacheTtlMs: {
      geocode: 1000 * 60 * 30,
      forecast: 1000 * 60 * 15,
      alerts: 1000 * 60 * 5,
      radar: 1000 * 60 * 4
    }
  };
  
