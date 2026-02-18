import { CONFIG } from '../../config.js';
import { getCached, setCached } from '../../cache.js';
import { getEtDateKey } from '../../time/easternTime.js';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.json();
}

function parseWindSpeed(windSpeedRaw = '') {
  const values = String(windSpeedRaw)
    .match(/\d+/g)
    ?.map(Number)
    .filter(Number.isFinite);
  if (!values?.length) return null;
  if (values.length === 1) return values[0];
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseValidTimeStart(validTime = '') {
  const start = validTime.split('/')[0];
  return start ? new Date(start) : null;
}

function summarizeGridValue(gridSeries, dateKey, method = 'avg') {
  const values = gridSeries?.values ?? [];
  const inDay = values
    .map((entry) => ({ start: parseValidTimeStart(entry.validTime), value: entry.value }))
    .filter((entry) => entry.start && entry.value !== null && getEtDateKey(entry.start) === dateKey)
    .map((entry) => Number(entry.value))
    .filter((value) => Number.isFinite(value));

  if (!inDay.length) return null;
  if (method === 'max') return Math.round(Math.max(...inDay));
  if (method === 'sum') return inDay.reduce((sum, value) => sum + value, 0);
  return Math.round(inDay.reduce((sum, value) => sum + value, 0) / inDay.length);
}

function formatAmount(value, uom) {
  if (!Number.isFinite(value)) return null;
  const lower = String(uom || '').toLowerCase();
  if (lower.includes('mm')) return `${(value / 25.4).toFixed(2)} in`;
  if (lower.includes('in')) return `${value.toFixed(2)} in`;
  return `${value.toFixed(2)}`;
}

function buildDaily(periods, gridData) {
  const days = new Map();

  periods.forEach((period) => {
    const dateKey = getEtDateKey(period.startTime);
    if (!days.has(dateKey)) {
      days.set(dateKey, {
        dateKey,
        dayPeriod: null,
        nightPeriod: null,
        maxTemp: null,
        minTemp: null
      });
    }

    const entry = days.get(dateKey);
    const temp = Number(period.temperature);
    if (Number.isFinite(temp)) {
      entry.maxTemp = entry.maxTemp === null ? temp : Math.max(entry.maxTemp, temp);
      entry.minTemp = entry.minTemp === null ? temp : Math.min(entry.minTemp, temp);
    }

    if (period.isDaytime && !entry.dayPeriod) entry.dayPeriod = period;
    if (!period.isDaytime && !entry.nightPeriod) entry.nightPeriod = period;
  });

  return [...days.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((entry) => {
      const primary = entry.dayPeriod || entry.nightPeriod;
      if (!primary) return null;

      const high = Number.isFinite(entry.dayPeriod?.temperature) ? entry.dayPeriod.temperature : entry.maxTemp;
      const low = Number.isFinite(entry.nightPeriod?.temperature) ? entry.nightPeriod.temperature : entry.minTemp;
      const pop =
        entry.dayPeriod?.probabilityOfPrecipitation?.value ??
        summarizeGridValue(gridData?.properties?.probabilityOfPrecipitation, entry.dateKey, 'max');
      const humidity = summarizeGridValue(gridData?.properties?.relativeHumidity, entry.dateKey, 'avg');
      const cloudCover = summarizeGridValue(gridData?.properties?.skyCover, entry.dateKey, 'avg');
      const rain = summarizeGridValue(gridData?.properties?.quantitativePrecipitation, entry.dateKey, 'sum');
      const snow = summarizeGridValue(gridData?.properties?.snowfallAmount, entry.dateKey, 'sum');

      const details = [];
      const highLabel = Number.isFinite(high) ? `${Math.round(high)}°F` : '--';
      const lowLabel = Number.isFinite(low) ? `${Math.round(low)}°F` : '--';
      details.push({ label: 'High / Low', value: `${highLabel} / ${lowLabel}` });
      if (pop !== null && pop !== undefined) details.push({ label: 'Precip Chance', value: `${Math.round(pop)}%` });

      const windSpeed = parseWindSpeed(primary.windSpeed);
      const windDir = primary.windDirection || '';
      if (windSpeed !== null || windDir) details.push({ label: 'Wind', value: `${windSpeed ?? '--'} mph ${windDir}`.trim() });

      if (humidity !== null) details.push({ label: 'Humidity', value: `${humidity}%` });
      if (cloudCover !== null) details.push({ label: 'Cloud Cover', value: `${cloudCover}%` });

      const rainValue = formatAmount(rain, gridData?.properties?.quantitativePrecipitation?.uom);
      if (rainValue) details.push({ label: 'Rain Amount', value: rainValue });

      const snowValue = formatAmount(snow, gridData?.properties?.snowfallAmount?.uom);
      if (snowValue) details.push({ label: 'Snow Amount', value: snowValue });

      return {
        dateKey: entry.dateKey,
        timestamp: primary.startTime,
        shortText: primary.shortForecast || 'Mixed conditions',
        weatherCode: null,
        isDay: primary.isDaytime ? 1 : 0,
        iconUrl: primary.icon || null,
        high: Number.isFinite(high) ? Math.round(high) : null,
        low: Number.isFinite(low) ? Math.round(low) : null,
        windSpeedMph: windSpeed,
        windDirection: windDir,
        precipChance: pop !== null && pop !== undefined ? Math.round(pop) : null,
        details
      };
    })
    .filter(Boolean);
}

function buildHourly(periods) {
  return periods.map((period) => {
    const windSpeed = parseWindSpeed(period.windSpeed);
    const windDirection = period.windDirection || '';
    const precipChance = period.probabilityOfPrecipitation?.value;
    return {
      timestamp: period.startTime,
      shortText: period.shortForecast || 'Mixed conditions',
      weatherCode: null,
      isDay: period.isDaytime ? 1 : 0,
      iconUrl: period.icon || null,
      temp: Number.isFinite(Number(period.temperature)) ? Math.round(period.temperature) : null,
      windSpeedMph: windSpeed,
      windDirection,
      precipChance: precipChance === null || precipChance === undefined ? null : Math.round(precipChance)
    };
  });
}

export async function getNoaaNwsForecast(location) {
  const key = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
  const cached = getCached('forecast-source-noaa', key, CONFIG.cacheTtlMs.forecast);
  if (cached) return cached;

  const point = await fetchJson(`${CONFIG.endpoints.nwsPoint}/${location.lat},${location.lon}`, {
    headers: { Accept: 'application/geo+json' }
  });

  const dailyUrl = point.properties?.forecast;
  const hourlyUrl = point.properties?.forecastHourly;
  const gridUrl = point.properties?.forecastGridData;

  if (!dailyUrl || !hourlyUrl) {
    throw new Error('NOAA/NWS forecast links were not available for this location.');
  }

  const headers = { Accept: 'application/geo+json' };
  const [dailyForecast, hourlyForecast, gridData] = await Promise.all([
    fetchJson(dailyUrl, { headers }),
    fetchJson(hourlyUrl, { headers }),
    gridUrl ? fetchJson(gridUrl, { headers }) : Promise.resolve(null)
  ]);

  const normalized = {
    sourceId: 'noaa',
    sourceLabel: 'NOAA / NWS',
    comingSoon: false,
    message: '',
    daily: buildDaily(dailyForecast.properties?.periods ?? [], gridData),
    hourly: buildHourly(hourlyForecast.properties?.periods ?? [])
  };

  setCached('forecast-source-noaa', key, normalized);
  return normalized;
}
