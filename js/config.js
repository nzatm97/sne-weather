export const CONFIG = {
    defaultLocation: { name: 'Providence, RI', lat: 41.824, lon: -71.4128 },
    map: {
      initialZoom: 7,
      maxRadarFrames: 40,
      radarOpacity: 0.72,
      radarFps: 10,
      radarPrefetchAhead: 5,
      radarCacheSize: 18,
      darkTiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; OpenStreetMap contributors &copy; CARTO &copy; NOAA'
    },
    endpoints: {
      geocode: 'https://nominatim.openstreetmap.org/search',
      reverseGeocode: 'https://nominatim.openstreetmap.org/reverse',
      forecast: 'https://api.open-meteo.com/v1/forecast',
      noaaRadarTimeStops: 'https://new.nowcoast.noaa.gov/layerinfo',
      noaaRadarTiles: 'https://new.nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/tile',
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
  
