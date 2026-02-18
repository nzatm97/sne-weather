import { CONFIG } from '../config.js';
import { getCached, setCached } from '../cache.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function sortByTime(frames) {
  return [...frames].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

function normalizeRadarFrames(data) {
  const past = data.radar?.past ?? [];
  const nowcast = data.radar?.nowcast ?? [];
  const deduped = [...past, ...nowcast].filter((frame, idx, all) => all.findIndex((f) => f.path === frame.path) === idx);
  return sortByTime(deduped).slice(-CONFIG.map.maxRadarFrames);
}

export function formatRadarTimestamp(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export async function fetchRadarFrames() {
  const cached = getCached('radar', 'frames', CONFIG.cacheTtlMs.radar);
  if (cached) return cached;

  const data = await fetchJson(CONFIG.endpoints.radarMeta);
  const frames = normalizeRadarFrames(data);
  if (frames.length < 2) throw new Error('Insufficient radar frames available.');
  setCached('radar', 'frames', frames);
  console.info('[radar] Frames loaded', { count: frames.length, first: frames[0].time, last: frames.at(-1).time });
  return frames;
}
