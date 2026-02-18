import { CONFIG } from '../../config.js';
import { getCached, setCached } from '../../cache.js';
import { getEtDateKey } from '../../time/easternTime.js';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function weatherLabel(code) {
  const value = Number(code);
  const map = {
    0: 'Clear',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Cloudy',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Moderate showers',
    82: 'Heavy showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm'
  };
  return map[value] || 'Mixed conditions';
}

function average(values) {
  const nums = values.map(toNumber).filter((value) => value !== null);
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function sum(values) {
  const nums = values.map(toNumber).filter((value) => value !== null);
  if (!nums.length) return null;
  return nums.reduce((total, value) => total + value, 0);
}

function buildHourlySummaryByDate(hourly) {
  const summary = new Map();
  const times = hourly.time ?? [];
  times.forEach((unixTime, idx) => {
    const date = new Date(Number(unixTime) * 1000);
    const dateKey = getEtDateKey(date);
    if (!summary.has(dateKey)) {
      summary.set(dateKey, {
        humidity: [],
        cloudCover: [],
        rain: [],
        snowfall: []
      });
    }

    const bucket = summary.get(dateKey);
    bucket.humidity.push(hourly.relative_humidity_2m?.[idx]);
    bucket.cloudCover.push(hourly.cloud_cover?.[idx]);
    bucket.rain.push(hourly.rain?.[idx]);
    bucket.snowfall.push(hourly.snowfall?.[idx]);
  });
  return summary;
}

function normalizeHourly(data) {
  const hourly = data.hourly ?? {};
  const times = hourly.time ?? [];
  return times.map((unixTime, idx) => {
    const date = new Date(Number(unixTime) * 1000);
    return {
      timestamp: date.toISOString(),
      shortText: weatherLabel(hourly.weather_code?.[idx]),
      iconUrl: null,
      temp: toNumber(hourly.temperature_2m?.[idx]),
      windSpeedMph: toNumber(hourly.wind_speed_10m?.[idx]),
      windDirection: toNumber(hourly.wind_direction_10m?.[idx]) !== null ? `${Math.round(hourly.wind_direction_10m[idx])}°` : '',
      precipChance: toNumber(hourly.precipitation_probability?.[idx]),
      humidity: toNumber(hourly.relative_humidity_2m?.[idx]),
      cloudCover: toNumber(hourly.cloud_cover?.[idx]),
      rainAmountIn: toNumber(hourly.rain?.[idx]),
      snowAmountIn: toNumber(hourly.snowfall?.[idx])
    };
  });
}

function normalizeDaily(data) {
  const daily = data.daily ?? {};
  const times = daily.time ?? [];
  const hourlySummary = buildHourlySummaryByDate(data.hourly ?? {});

  return times.map((unixTime, idx) => {
    const date = new Date(Number(unixTime) * 1000);
    const dateKey = getEtDateKey(date);
    const perDay = hourlySummary.get(dateKey);

    const high = toNumber(daily.temperature_2m_max?.[idx]);
    const low = toNumber(daily.temperature_2m_min?.[idx]);
    const pop = toNumber(daily.precipitation_probability_max?.[idx]);
    const windSpeed = toNumber(daily.wind_speed_10m_max?.[idx]);
    const windDirection = toNumber(daily.wind_direction_10m_dominant?.[idx]);
    const rainSum = toNumber(daily.rain_sum?.[idx]);
    const snowSum = toNumber(daily.snowfall_sum?.[idx]);
    const humidity = perDay ? average(perDay.humidity) : null;
    const cloudCover = perDay ? average(perDay.cloudCover) : null;
    const hourlyRainSum = perDay ? sum(perDay.rain) : null;
    const hourlySnowSum = perDay ? sum(perDay.snowfall) : null;

    const details = [];
    if (high !== null || low !== null) {
      details.push({
        label: 'High / Low',
        value: `${high === null ? '--' : `${Math.round(high)}°F`} / ${low === null ? '--' : `${Math.round(low)}°F`}`
      });
    }
    if (pop !== null) details.push({ label: 'Precip Chance', value: `${Math.round(pop)}%` });
    if (windSpeed !== null || windDirection !== null) {
      details.push({
        label: 'Wind',
        value: `${windSpeed === null ? '--' : `${Math.round(windSpeed)} mph`} ${windDirection === null ? '' : `${Math.round(windDirection)}°`}`.trim()
      });
    }
    if (humidity !== null) details.push({ label: 'Humidity', value: `${humidity}%` });
    if (cloudCover !== null) details.push({ label: 'Cloud Cover', value: `${cloudCover}%` });

    const rainAmount = rainSum ?? hourlyRainSum;
    if (rainAmount !== null) details.push({ label: 'Rain Amount', value: `${rainAmount.toFixed(2)} in` });

    const snowAmount = snowSum ?? hourlySnowSum;
    if (snowAmount !== null) details.push({ label: 'Snow Amount', value: `${snowAmount.toFixed(2)} in` });

    return {
      dateKey,
      timestamp: date.toISOString(),
      shortText: weatherLabel(daily.weather_code?.[idx]),
      iconUrl: null,
      high: high === null ? null : Math.round(high),
      low: low === null ? null : Math.round(low),
      windSpeedMph: windSpeed === null ? null : Math.round(windSpeed),
      windDirection: windDirection === null ? '' : `${Math.round(windDirection)}°`,
      precipChance: pop === null ? null : Math.round(pop),
      details
    };
  });
}

export async function getOpenMeteoModelForecast({ endpoint, cacheNamespace, sourceId, sourceLabel, location }) {
  const key = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
  const cached = getCached(cacheNamespace, key, CONFIG.cacheTtlMs.forecast);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    timezone: 'America/New_York',
    timeformat: 'unixtime',
    forecast_days: '7',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,cloud_cover,rain,snowfall',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,rain_sum,snowfall_sum'
  });

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${endpoint}`);
  const data = await response.json();

  const normalized = {
    sourceId,
    sourceLabel,
    comingSoon: false,
    message: '',
    daily: normalizeDaily(data),
    hourly: normalizeHourly(data)
  };

  setCached(cacheNamespace, key, normalized);
  return normalized;
}

