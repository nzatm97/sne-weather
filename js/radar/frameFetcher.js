import { CONFIG } from '../config.js';
import { getCached, setCached } from '../cache.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function normalizeNoaaFrames(timeStops) {
  const sorted = [...timeStops].sort((a, b) => a - b);
  return sorted.slice(-CONFIG.map.maxRadarFrames).map((timeMs) => ({
    time: timeMs,
    provider: 'NOAA',
    tileUrl: `${CONFIG.endpoints.noaaRadarTiles}/{z}/{y}/{x}?blankTile=false&time=${timeMs}`
  }));
}

function generateFallbackFrames() {
  const stepMs = 5 * 60 * 1000;
  const now = Date.now();
  const latest = now - (now % stepMs);
  const frames = [];
  for (let i = CONFIG.map.maxRadarFrames - 1; i >= 0; i -= 1) {
    const timeMs = latest - i * stepMs;
    frames.push({
      time: timeMs,
      provider: 'NOAA',
      tileUrl: `${CONFIG.endpoints.noaaRadarTiles}/{z}/{y}/{x}?blankTile=false&time=${timeMs}`
    });
  }
  return frames;
}

function collectNumericTimes(value, acc = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumericTimes(item, acc));
    return acc;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectNumericTimes(item, acc));
    return acc;
  }
  if (typeof value === 'number' && value > 1000000000000) acc.push(value);
  return acc;
}

export function formatRadarTimestamp(rawTime) {
  const timeMs = rawTime > 1e12 ? rawTime : rawTime * 1000;
  return new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export async function fetchRadarFrames() {
  const cached = getCached('radar', 'frames', CONFIG.cacheTtlMs.radar);
  if (cached) return cached;

  const params = new URLSearchParams({
    request: 'timestamps',
    service: 'radar_meteo_imagery_nexrad_time',
    layers: '3',
    format: 'json',
    displaytime: 'now'
  });

  let frames = [];
  try {
    const data = await fetchJson(`${CONFIG.endpoints.noaaRadarTimeStops}?${params.toString()}`, {
      mode: 'cors'
    });
    const timesFromLayer = data.layers?.[0]?.timeStops ?? [];
    const discovered = timesFromLayer.length ? timesFromLayer : collectNumericTimes(data);
    frames = normalizeNoaaFrames(discovered);
  } catch (error) {
    console.warn('[radar] NOAA timestops fetch failed, using fallback timeline', error);
  }

  if (frames.length < 2) {
    frames = generateFallbackFrames();
  }

  if (frames.length < 2) {
    throw new Error('Unable to build NOAA radar timeline.');
  }

  setCached('radar', 'frames', frames);
  console.info('[radar] Frames loaded', { count: frames.length, first: frames[0].time, last: frames.at(-1).time });
  return frames;
}
