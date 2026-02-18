import { CONFIG } from './config.js';
import { forecastForLocation, nwsAlertsByPoint } from './api.js';
import { WeatherMap } from './map.js';
import { renderMeteogram } from './chart.js';
import { loadRecentSearches, saveRecentSearch, setupSearch } from './search.js';
import { fetchRadarFrames, formatRadarTimestamp } from './radar/frameFetcher.js';
import { LeafletRadarLayerManager } from './radar/leafletRadarLayerManager.js';
import { RadarController } from './radar/radarController.js';
import { getForecastSource, getForecastSourceOptions } from './forecast/providerRegistry.js';
import { formatEtHourLabel, formatEtWeekday, formatWeekdayFromDateKey, getEtDateKey, getEtHourKey, getEtHourNumber, getMsUntilNextEtMidnight } from './time/easternTime.js';

const FORECAST_SOURCE_STORAGE_KEY = 'sne-forecast-source';
const BAS_WEATHER_ICON_BASE = 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all';

const elements = {
  status: document.getElementById('status'),
  currentPlace: document.getElementById('currentPlace'),
  searchInput: document.getElementById('locationSearch'),
  searchResults: document.getElementById('searchResults'),
  recentSearches: document.getElementById('recentSearches'),
  myLocationBtn: document.getElementById('myLocationBtn'),
  currentIconLarge: document.getElementById('currentIconLarge'),
  tempNow: document.getElementById('tempNow'),
  feelsNow: document.getElementById('feelsNow'),
  windNow: document.getElementById('windNow'),
  summaryNow: document.getElementById('summaryNow'),
  dailyGrid: document.getElementById('dailyGrid'),
  hourlyGrid: document.getElementById('hourlyGrid'),
  alertsList: document.getElementById('alertsList'),
  alertsToggle: document.getElementById('alertsToggle'),
  radarPlayBtn: document.getElementById('radarPlayBtn'),
  radarPrevBtn: document.getElementById('radarPrevBtn'),
  radarNextBtn: document.getElementById('radarNextBtn'),
  radarLatestBtn: document.getElementById('radarLatestBtn'),
  radarFrameRange: document.getElementById('radarFrameRange'),
  radarSpeed: document.getElementById('radarSpeed'),
  radarOpacity: document.getElementById('radarOpacity'),
  radarTimestamp: document.getElementById('radarTimestamp'),
  radarLoadState: document.getElementById('radarLoadState'),
  meteogramRange: document.getElementById('meteogramRange'),
  layerRadar: document.getElementById('layerRadar'),
  forecastSource: document.getElementById('forecastSource'),
  forecastSourceStatus: document.getElementById('forecastSourceStatus')
};

if (!elements.status) throw new Error('Home page elements are missing.');

const weatherMap = new WeatherMap('map');
let activeLocation = { ...CONFIG.defaultLocation };
let latestMeteogramForecast = null;
let latestSourceForecast = null;
let selectedForecastSource = localStorage.getItem(FORECAST_SOURCE_STORAGE_KEY) || 'noaa';

let radarFrameSet = [];
let radarManager;
let radarController;
let radarRefreshTimer = null;
let etDateWatcher = null;
let etMidnightTimeout = null;
let lastEtDateKey = getEtDateKey();
let lastEtHourKey = getEtHourKey();

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
}

function updateRadarTimestamp(index) {
  const frame = radarFrameSet[index];
  if (!frame) return;
  elements.radarTimestamp.textContent = `Radar: ${formatRadarTimestamp(frame.time)}`;
}

function setRadarLoadState({ loading, error }) {
  if (error) {
    elements.radarLoadState.textContent = error;
    elements.radarLoadState.classList.add('error');
    return;
  }
  elements.radarLoadState.classList.remove('error');
  elements.radarLoadState.textContent = loading ? 'Loading radar frames…' : `Radar ready (${radarFrameSet.length} frames)`;
}

function weatherLabel(code) {
  const map = {
    0: 'Clear',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Cloudy',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Heavy freezing drizzle',
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
    81: 'Moderate rain showers',
    82: 'Heavy rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm'
  };
  return map[code] || 'Mixed conditions';
}

function isNightFromEtTimestamp(timestamp) {
  if (!timestamp) return false;
  const hour = getEtHourNumber(timestamp);
  return Number.isFinite(hour) && (hour < 6 || hour >= 18);
}

function weatherIconName({ label, weatherCode, isDay, timestamp } = {}) {
  const l = String(label || '').toLowerCase();
  const code = Number(weatherCode);
  const isNight = isDay === 0 || isDay === false || isNightFromEtTimestamp(timestamp);

  if ([95, 96, 99].includes(code) || l.includes('thunder')) return isNight ? 'thunderstorms-night-rain' : 'thunderstorms-day-rain';
  if ([71, 73, 75, 77, 85, 86].includes(code) || l.includes('snow')) return 'snow';
  if ([51, 53, 55, 56, 57].includes(code) || l.includes('drizzle')) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code) || l.includes('rain') || l.includes('shower')) return 'rain';
  if ([45, 48].includes(code) || l.includes('fog') || l.includes('haze') || l.includes('mist')) return isNight ? 'fog-night' : 'fog-day';
  if (code === 2 || l.includes('partly cloudy')) return isNight ? 'partly-cloudy-night' : 'partly-cloudy-day';
  if (code === 3 || l.includes('overcast')) return 'overcast';
  if (l.includes('cloud')) return 'cloudy';
  if (l.includes('wind')) return 'wind';
  if (code === 0 || code === 1 || l.includes('clear') || l.includes('sunny') || l.includes('fair')) return isNight ? 'clear-night' : 'clear-day';
  return isNight ? 'clear-night' : 'clear-day';
}

function weatherIconMarkup(data = {}, className = 'weather-icon-svg') {
  const name = weatherIconName(data);
  const label = String(data.label || 'Weather');
  const src = `${BAS_WEATHER_ICON_BASE}/${name}.svg`;
  return `<img src="${src}" alt="${label}" class="${className}" loading="lazy" decoding="async" />`;
}

function renderCurrent(data) {
  const current = data.current;
  elements.tempNow.textContent = `${Math.round(current.temperature_2m)}°F`;
  elements.feelsNow.textContent = `${Math.round(current.apparent_temperature)}°F`;
  elements.windNow.textContent = `${Math.round(current.wind_speed_10m)} mph`;
  const summary = weatherLabel(current.weather_code);
  elements.summaryNow.textContent = summary;
  if (elements.currentIconLarge) {
    elements.currentIconLarge.innerHTML = weatherIconMarkup({
      label: summary,
      weatherCode: current.weather_code,
      isDay: current.is_day
    }, 'weather-icon-svg weather-icon-svg--large');
  }
}

function etFilterDaily(daily) {
  const todayKey = getEtDateKey();
  return daily.filter((day) => day.dateKey >= todayKey).slice(0, 5);
}

function etFilterHourly(hourly) {
  const nowHourKey = getEtHourKey();
  return hourly.filter((hour) => getEtHourKey(hour.timestamp) >= nowHourKey).slice(0, 18);
}

function normalizeSourceStatus(model) {
  if (!elements.forecastSourceStatus) return;
  if (model.comingSoon) {
    elements.forecastSourceStatus.textContent = model.message || `${model.sourceLabel} is coming soon.`;
    elements.forecastSourceStatus.classList.remove('error');
    return;
  }

  elements.forecastSourceStatus.textContent = `Selected: ${model.sourceLabel}`;
  elements.forecastSourceStatus.classList.remove('error');
}

function renderHourlyFromSource(model) {
  elements.hourlyGrid.innerHTML = '';
  if (model.comingSoon) {
    elements.hourlyGrid.innerHTML = `<p class="muted">${model.message}</p>`;
    return;
  }

  const visibleHourly = etFilterHourly(model.hourly || []);
  if (!visibleHourly.length) {
    elements.hourlyGrid.innerHTML = '<p class="muted">No hourly data available yet for the current ET hour window.</p>';
    return;
  }

  visibleHourly.forEach((hour) => {
    const rainChance = hour.precipChance === null || hour.precipChance === undefined ? '--' : `${Math.round(hour.precipChance)}%`;
    const windPart = hour.windSpeedMph ? `${Math.round(hour.windSpeedMph)} mph ${hour.windDirection || ''}`.trim() : null;

    const card = document.createElement('article');
    card.className = 'mini-card mini-card--hourly';
    card.innerHTML = `
      <div class="weather-icon">${weatherIconMarkup({ label: hour.shortText, weatherCode: hour.weatherCode, isDay: hour.isDay, timestamp: hour.timestamp })}</div>
      <div>
        <div class="mini-card__title">${formatEtHourLabel(hour.timestamp)} ET</div>
        <div class="mini-card__value">${hour.temp === null || hour.temp === undefined ? '--' : `${Math.round(hour.temp)}°F`}</div>
        <div class="mini-card__meta">${hour.shortText} · Rain ${rainChance}${windPart ? ` · Wind ${windPart}` : ''}</div>
      </div>
    `;
    elements.hourlyGrid.append(card);
  });

  const nowKey = getEtHourKey();
  const firstKey = visibleHourly[0] ? getEtHourKey(visibleHourly[0].timestamp) : null;
  if (firstKey && firstKey < nowKey) {
    console.warn('[forecast-check] Hourly forecast alignment issue', { nowKey, firstKey });
  }
}

function renderDailyFromSource(model) {
  elements.dailyGrid.innerHTML = '';
  if (model.comingSoon) {
    elements.dailyGrid.innerHTML = `<p class="muted">${model.message}</p>`;
    return;
  }

  const visibleDaily = etFilterDaily(model.daily || []);
  if (!visibleDaily.length) {
    elements.dailyGrid.innerHTML = '<p class="muted">No daily data available for upcoming ET days.</p>';
    return;
  }

  visibleDaily.forEach((day) => {
    const details = day.details?.filter((item) => item?.value !== null && item?.value !== undefined && item?.value !== '') || [];
    const detailRows = details.map((item) => `<div class="daily-detail-row"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('');
    const dayName = day.timestamp ? formatEtWeekday(day.timestamp) : formatWeekdayFromDateKey(day.dateKey);
    const highDisplay = day.high === null || day.high === undefined ? '--' : `${Math.round(day.high)}°`;
    const lowDisplay = day.low === null || day.low === undefined ? '--' : `${Math.round(day.low)}°`;

    const card = document.createElement('article');
    card.className = 'daily-accordion';
    card.innerHTML = `
      <details>
        <summary>
          <div class="daily-summary-main">
            <div class="weather-icon">${weatherIconMarkup({ label: day.shortText, weatherCode: day.weatherCode, isDay: day.isDay, timestamp: day.timestamp })}</div>
            <div>
              <div class="mini-card__title">${dayName}</div>
              <div class="mini-card__meta">${day.shortText}</div>
            </div>
          </div>
          <div class="daily-summary-temp">${highDisplay} / ${lowDisplay}</div>
        </summary>
        <div class="daily-details-wrap">
          ${detailRows || '<p class="muted">Additional fields unavailable for this day.</p>'}
        </div>
      </details>
    `;

    elements.dailyGrid.append(card);
  });

  const todayKey = getEtDateKey();
  const firstKey = visibleDaily[0]?.dateKey;
  if (firstKey && firstKey < todayKey) {
    console.warn('[forecast-check] Daily forecast alignment issue', { todayKey, firstKey });
  }
}

function renderForecastPanels() {
  if (!latestSourceForecast) return;
  normalizeSourceStatus(latestSourceForecast);
  renderHourlyFromSource(latestSourceForecast);
  renderDailyFromSource(latestSourceForecast);
}

function renderAlerts(alerts) {
  elements.alertsList.innerHTML = '';
  if (!alerts.length) {
    elements.alertsList.innerHTML = '<li class="muted">No active NWS alerts for this forecast zone.</li>';
    return;
  }

  alerts.forEach((alert) => {
    const p = alert.properties;
    const li = document.createElement('li');
    li.className = 'alert-item';
    li.innerHTML = `
      <button>
        <strong>${p.event}</strong>
        <span>${p.severity || 'Unknown severity'} · ${p.urgency || 'Unknown urgency'}</span>
        <small>${new Date(p.effective).toLocaleString()} - ${new Date(p.expires).toLocaleString()}</small>
      </button>
    `;
    li.querySelector('button').addEventListener('click', () => weatherMap.zoomToAlert(alert));
    elements.alertsList.append(li);
  });
}

function renderRecents() {
  const recents = loadRecentSearches();
  elements.recentSearches.innerHTML = '';
  recents.forEach((entry) => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = entry.name.split(',').slice(0, 2).join(',');
    btn.addEventListener('click', () => updateLocation(entry));
    elements.recentSearches.append(btn);
  });
}

async function loadSourceForecast(place, sourceId, { showLoading = false } = {}) {
  const source = getForecastSource(sourceId);
  if (showLoading) {
    elements.forecastSourceStatus.textContent = `Loading ${source.label}...`;
  }

  const model = await source.load(place);
  latestSourceForecast = model;
  selectedForecastSource = source.id;
  localStorage.setItem(FORECAST_SOURCE_STORAGE_KEY, source.id);
  if (elements.forecastSource) elements.forecastSource.value = source.id;
  renderForecastPanels();
}

async function refreshForecastForEtBoundary() {
  if (!latestSourceForecast) return;
  const currentDateKey = getEtDateKey();
  const currentHourKey = getEtHourKey();

  if (currentDateKey !== lastEtDateKey) {
    lastEtDateKey = currentDateKey;
    lastEtHourKey = currentHourKey;
    try {
      await loadSourceForecast(activeLocation, selectedForecastSource, { showLoading: false });
      setStatus(`Forecast auto-refreshed for new ET day (${currentDateKey}).`);
    } catch (error) {
      setStatus(`Forecast refresh failed after ET midnight: ${error.message}`, true);
    }
    return;
  }

  if (currentHourKey !== lastEtHourKey) {
    lastEtHourKey = currentHourKey;
    renderForecastPanels();
  }
}

function startEtBoundaryWatch() {
  if (etDateWatcher) clearInterval(etDateWatcher);
  if (etMidnightTimeout) clearTimeout(etMidnightTimeout);

  etDateWatcher = setInterval(() => {
    refreshForecastForEtBoundary().catch((error) => console.warn('[forecast] ET watcher failed', error));
  }, 60_000);

  const msToMidnight = getMsUntilNextEtMidnight();
  etMidnightTimeout = setTimeout(() => {
    refreshForecastForEtBoundary().catch((error) => console.warn('[forecast] ET midnight refresh failed', error));
    startEtBoundaryWatch();
  }, msToMidnight + 1000);
}

async function updateLocation(place) {
  activeLocation = place;
  elements.currentPlace.textContent = place.name;
  weatherMap.setCenter(place.lat, place.lon);
  saveRecentSearch(place);
  renderRecents();

  setStatus('Loading forecast, radar, and alerts…');
  try {
    const [meteogramForecast, alerts] = await Promise.all([forecastForLocation(place.lat, place.lon), nwsAlertsByPoint(place.lat, place.lon)]);
    latestMeteogramForecast = meteogramForecast;

    renderCurrent(meteogramForecast);
    renderMeteogram('meteogram', meteogramForecast.hourly, Number(elements.meteogramRange.value));
    renderAlerts(alerts);
    weatherMap.updateAlerts(alerts.filter((a) => a.geometry));

    await loadSourceForecast(place, selectedForecastSource, { showLoading: true });

    lastEtDateKey = getEtDateKey();
    lastEtHourKey = getEtHourKey();
    setStatus(`Updated ${place.name}`);
  } catch (error) {
    setStatus(`Unable to load all weather data: ${error.message}`, true);
  }
}

async function initRadar() {
  try {
    radarFrameSet = await fetchRadarFrames({ force: true });
    elements.radarFrameRange.max = String(radarFrameSet.length - 1);
    elements.radarFrameRange.value = String(radarFrameSet.length - 1);
    updateRadarTimestamp(radarFrameSet.length - 1);

    radarManager = new LeafletRadarLayerManager(weatherMap.map, {
      opacity: Number(elements.radarOpacity.value),
      maxCachedFrames: CONFIG.map.radarCacheSize,
      prefetchAhead: CONFIG.map.radarPrefetchAhead,
      onStateChange: setRadarLoadState
    });

    radarManager.setFrames(radarFrameSet);
    await radarManager.setFrame(radarFrameSet.length - 1, { animate: false });

    radarController = new RadarController({
      getFrameCount: () => radarFrameSet.length,
      onFrame: async (idx, options) => radarManager.setFrame(idx, options),
      onTick: (idx) => {
        elements.radarFrameRange.value = String(idx);
        updateRadarTimestamp(idx);
      },
      onState: ({ playing }) => {
        if (typeof playing === 'boolean') elements.radarPlayBtn.textContent = playing ? 'Pause' : 'Play';
      }
    });

    radarController.baseFps = CONFIG.map.radarFps;
    radarController.setSpeed(Number(elements.radarSpeed.value));
    setRadarLoadState({ loading: false, error: null });
    radarManager.prefetchFrom(radarFrameSet.length - 1, CONFIG.map.radarPrefetchAhead);

    if (!radarRefreshTimer) {
      radarRefreshTimer = setInterval(() => {
        refreshRadarFrames({ jumpLatest: false }).catch((error) => {
          console.warn('[radar] Periodic refresh failed', error);
        });
      }, 1000 * 60 * 3);
    }
  } catch (error) {
    setRadarLoadState({ loading: false, error: error.message });
    setStatus(`Radar unavailable: ${error.message}`, true);
  }
}

async function refreshRadarFrames({ jumpLatest = false } = {}) {
  if (!radarManager) return;

  const previousIndex = Number(elements.radarFrameRange.value || 0);
  const previousTime = radarFrameSet[previousIndex]?.time;
  const frames = await fetchRadarFrames({ force: true });
  if (!frames.length) return;

  radarFrameSet = frames;
  elements.radarFrameRange.max = String(frames.length - 1);

  let targetIndex = frames.length - 1;
  if (!jumpLatest && previousTime) {
    const matched = frames.findIndex((frame) => frame.time === previousTime);
    if (matched >= 0) targetIndex = matched;
  }

  radarManager.setFrames(frames);
  await radarManager.setFrame(targetIndex, { animate: false });

  if (radarController) radarController.currentIndex = targetIndex;
  elements.radarFrameRange.value = String(targetIndex);
  updateRadarTimestamp(targetIndex);
  setRadarLoadState({ loading: false, error: null });
}

function setupForecastSourceOptions() {
  if (!elements.forecastSource) return;
  const options = getForecastSourceOptions();
  elements.forecastSource.innerHTML = options.map((option) => `<option value="${option.id}">${option.label}</option>`).join('');

  if (!options.some((option) => option.id === selectedForecastSource)) selectedForecastSource = 'noaa';
  elements.forecastSource.value = selectedForecastSource;
}

function setupControls() {
  elements.radarPlayBtn.addEventListener('click', async () => {
    if (!radarController) return;
    if (!radarController.playing) radarManager.prefetchAll();
    radarController.toggle();
  });

  elements.radarPrevBtn.addEventListener('click', async () => {
    if (!radarController) return;
    radarController.pause();
    await radarController.step(-1);
  });

  elements.radarNextBtn.addEventListener('click', async () => {
    if (!radarController) return;
    radarController.pause();
    await radarController.step(1);
  });

  elements.radarLatestBtn.addEventListener('click', async () => {
    if (!radarController) return;
    radarController.pause();
    await refreshRadarFrames({ jumpLatest: true });
  });

  elements.radarFrameRange.addEventListener('input', async (event) => {
    if (!radarController) return;
    radarController.pause();
    await radarController.setIndex(Number(event.target.value), false);
  });

  elements.radarSpeed.addEventListener('change', (event) => {
    if (!radarController) return;
    radarController.setSpeed(Number(event.target.value));
  });

  elements.radarOpacity.addEventListener('input', (event) => radarManager?.setOpacity(Number(event.target.value)));
  elements.layerRadar.addEventListener('change', (event) => radarManager?.setVisible(event.target.checked));
  elements.alertsToggle.addEventListener('change', (event) => weatherMap.toggleAlerts(event.target.checked));

  elements.meteogramRange.addEventListener('change', () => {
    if (!latestMeteogramForecast) return;
    renderMeteogram('meteogram', latestMeteogramForecast.hourly, Number(elements.meteogramRange.value));
  });

  if (elements.forecastSource) {
    elements.forecastSource.addEventListener('change', async (event) => {
      try {
        await loadSourceForecast(activeLocation, event.target.value, { showLoading: true });
        setStatus(`Switched forecast source to ${getForecastSource(event.target.value).label}.`);
      } catch (error) {
        elements.forecastSourceStatus.textContent = `Failed to load source: ${error.message}`;
        elements.forecastSourceStatus.classList.add('error');
      }
    });
  }

  elements.myLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported in this browser.', true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => updateLocation({ name: 'My Location', lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => setStatus(`Unable to access your location: ${error.message}`, true),
      { timeout: 10000 }
    );
  });
}

async function init() {
  setupForecastSourceOptions();
  setupControls();
  setupSearch({
    input: elements.searchInput,
    resultsList: elements.searchResults,
    onSelect: updateLocation,
    onError: (error) => setStatus(`Search error: ${error.message}`, true)
  });

  renderRecents();
  await initRadar();
  await updateLocation(activeLocation);
  startEtBoundaryWatch();
}

init();
