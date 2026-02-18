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

export function formatRadarTimestamp(rawTime) {
  const timeMs = rawTime > 1e12 ? rawTime : rawTime * 1000;
  return new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export async function fetchRadarFrames() {
  const cached = getCached('radar', 'frames', CONFIG.cacheTtlMs.radar);
  if (cached) return cached;

  const params = new URLSearchParams({
    request: 'timestops',
    service: 'radar_meteo_imagery_nexrad_time',
    layers: '3',
    format: 'json'
  });

  const data = await fetchJson(`${CONFIG.endpoints.noaaRadarTimeStops}?${params.toString()}`);
  const timeStops = data.layers?.[0]?.timeStops ?? [];
  const frames = normalizeNoaaFrames(timeStops);
  if (frames.length < 2) throw new Error('Insufficient radar frames available.');
  setCached('radar', 'frames', frames);
  console.info('[radar] Frames loaded', { count: frames.length, first: frames[0].time, last: frames.at(-1).time });
  return frames;
}
