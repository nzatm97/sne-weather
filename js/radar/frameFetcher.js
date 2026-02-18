import { CONFIG } from '../config.js';
import { getCached, setCached } from '../cache.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function normalizeRainViewerFrames(data) {
  const past = data.radar?.past ?? [];
  const nowcast = data.radar?.nowcast ?? [];
  const source = past.length ? past : [...past, ...nowcast];
  const deduped = source.filter((frame, idx, all) => all.findIndex((f) => f.path === frame.path) === idx);
  return deduped.slice(-CONFIG.map.maxRadarFrames).map((frame) => ({
    time: frame.time,
    provider: 'RainViewer',
    tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/${CONFIG.map.radarColor}/${CONFIG.map.radarOptions}.png`
  }));
}

export function formatRadarTimestamp(rawTime) {
  return new Date(rawTime * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export async function fetchRadarFrames(options = {}) {
  const { force = false } = options;
  const cached = !force ? getCached('radar', 'frames', CONFIG.cacheTtlMs.radar) : null;
  if (cached) return cached;

  const data = await fetchJson(CONFIG.endpoints.radarMeta);
  const frames = normalizeRainViewerFrames(data);
  if (frames.length < 2) throw new Error('Insufficient RainViewer frames available.');

  setCached('radar', 'frames', frames);
  console.info('[radar] Frames loaded', { count: frames.length, first: frames[0].time, last: frames.at(-1).time });
  return frames;
}
