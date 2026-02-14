import { CONFIG } from './config.js';
import { getCached, setCached } from './cache.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

export async function geocodePlaces(query) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const cached = getCached('geocode', normalized, CONFIG.cacheTtlMs.geocode);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'us',
    limit: '6'
  });

  const url = `${CONFIG.endpoints.geocode}?${params.toString()}`;
  const data = await fetchJson(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'sne-weather-dashboard' }
  });

  const places = data.map((entry) => ({
    name: entry.display_name,
    lat: Number(entry.lat),
    lon: Number(entry.lon)
  }));

  setCached('geocode', normalized, places);
  return places;
}

export async function forecastForLocation(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = getCached('forecast', key, CONFIG.cacheTtlMs.forecast);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    current: 'temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m'
  });

  const data = await fetchJson(`${CONFIG.endpoints.forecast}?${params.toString()}`);
  setCached('forecast', key, data);
  return data;
}

export async function radarFrames() {
  const cached = getCached('radar', 'frames', CONFIG.cacheTtlMs.radar);
  if (cached) return cached;

  const data = await fetchJson(CONFIG.endpoints.radarMeta);
  const frames = (data.radar?.past ?? []).slice(-CONFIG.map.maxRadarFrames);
  if (!frames.length) throw new Error('No radar frames available.');
  setCached('radar', 'frames', frames);
  return frames;
}

export async function nwsAlertsByPoint(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = getCached('alerts', key, CONFIG.cacheTtlMs.alerts);
  if (cached) return cached;

  const pointData = await fetchJson(`${CONFIG.endpoints.nwsPoint}/${lat},${lon}`, {
    headers: { Accept: 'application/geo+json' }
  });
  const zone = pointData.properties?.forecastZone?.split('/').pop();

  if (!zone) {
    setCached('alerts', key, []);
    return [];
  }

  const params = new URLSearchParams({
    zone,
    status: 'actual',
    message_type: 'alert'
  });

  const alertsData = await fetchJson(`${CONFIG.endpoints.nwsAlertsActive}?${params.toString()}`, {
    headers: { Accept: 'application/geo+json' }
  });

  const alerts = alertsData.features ?? [];
  setCached('alerts', key, alerts);
  return alerts;
}
