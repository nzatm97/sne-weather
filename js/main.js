import { CONFIG } from './config.js';
import { forecastForLocation, nwsAlertsByPoint } from './api.js';
import { WeatherMap } from './map.js';
import { renderMeteogram } from './chart.js';
import { loadRecentSearches, saveRecentSearch, setupSearch } from './search.js';
import { fetchRadarFrames, formatRadarTimestamp } from './radar/frameFetcher.js';
import { LeafletRadarLayerManager } from './radar/leafletRadarLayerManager.js';
import { RadarController } from './radar/radarController.js';

const elements = {
  status: document.getElementById('status'),
  currentPlace: document.getElementById('currentPlace'),
  searchInput: document.getElementById('locationSearch'),
  searchResults: document.getElementById('searchResults'),
  recentSearches: document.getElementById('recentSearches'),
  myLocationBtn: document.getElementById('myLocationBtn'),
  tempNow: document.getElementById('tempNow'),
  feelsNow: document.getElementById('feelsNow'),
  windNow: document.getElementById('windNow'),
  summaryNow: document.getElementById('summaryNow'),
  dailyGrid: document.getElementById('dailyGrid'),
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
  layerRadar: document.getElementById('layerRadar')
};

if (!elements.status) throw new Error('Home page elements are missing.');

const weatherMap = new WeatherMap('map');
let activeLocation = { ...CONFIG.defaultLocation };
let latestForecast = null;
let radarFrameSet = [];
let radarManager;
let radarController;
let radarRefreshTimer = null;

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
  const map = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 51: 'Drizzle', 53: 'Moderate drizzle', 61: 'Rain', 63: 'Moderate rain', 65: 'Heavy rain', 71: 'Snow', 80: 'Rain showers', 95: 'Thunderstorm' };
  return map[code] || 'Mixed conditions';
}

function weatherIcon(label) {
  const l = label.toLowerCase();
  if (l.includes('thunder')) return '⛈️';
  if (l.includes('snow')) return '❄️';
  if (l.includes('rain') || l.includes('drizzle')) return '🌧️';
  if (l.includes('cloud')) return '☁️';
  if (l.includes('fog')) return '🌫️';
  return '☀️';
}

function renderCurrent(data) {
  const current = data.current;
  elements.tempNow.textContent = `${Math.round(current.temperature_2m)}°F`;
  elements.feelsNow.textContent = `${Math.round(current.apparent_temperature)}°F`;
  elements.windNow.textContent = `${Math.round(current.wind_speed_10m)} mph`;
  elements.summaryNow.textContent = weatherLabel(current.weather_code);
}

function renderDaily(data) {
  elements.dailyGrid.innerHTML = '';
  data.daily.time.slice(0, 5).forEach((date, idx) => {
    const label = weatherLabel(data.daily.weather_code[idx]);
    const card = document.createElement('article');
    card.className = 'mini-card';
    card.innerHTML = `
      <div class="weather-icon" aria-hidden="true">${weatherIcon(label)}</div>
      <div>
        <div class="mini-card__title">${new Date(date).toLocaleDateString([], { weekday: 'short' })}</div>
        <div class="mini-card__value">${Math.round(data.daily.temperature_2m_max[idx])}° / ${Math.round(data.daily.temperature_2m_min[idx])}°</div>
        <div class="mini-card__meta">${label} · Rain ${Math.round(data.daily.precipitation_probability_max[idx])}%</div>
      </div>
    `;
    elements.dailyGrid.append(card);
  });
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

async function updateLocation(place) {
  activeLocation = place;
  elements.currentPlace.textContent = place.name;
  weatherMap.setCenter(place.lat, place.lon);
  saveRecentSearch(place);
  renderRecents();

  setStatus('Loading forecast, radar, and alerts…');
  try {
    const [forecast, alerts] = await Promise.all([forecastForLocation(place.lat, place.lon), nwsAlertsByPoint(place.lat, place.lon)]);
    latestForecast = forecast;

    renderCurrent(forecast);
    renderDaily(forecast);
    renderMeteogram('meteogram', forecast.hourly, Number(elements.meteogramRange.value));
    renderAlerts(alerts);

    weatherMap.updateAlerts(alerts.filter((a) => a.geometry));
    setStatus(`Updated ${place.name}`);
  } catch (error) {
    setStatus(`Unable to load all weather data: ${error.message}`, true);
  }
}

async function initRadar() {
  try {
    radarFrameSet = await fetchRadarFrames();
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
        if (typeof playing === 'boolean') {
          elements.radarPlayBtn.textContent = playing ? 'Pause' : 'Play';
        }
      }
    });

    radarController.baseFps = CONFIG.map.radarFps;
    radarController.setSpeed(Number(elements.radarSpeed.value));
    setRadarLoadState({ loading: false, error: null });
    radarManager.prefetchFrom(radarFrameSet.length - 1, CONFIG.map.radarPrefetchAhead);
    console.info('[radar] Controller initialized', { count: radarFrameSet.length });

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
    if (!latestForecast) return;
    renderMeteogram('meteogram', latestForecast.hourly, Number(elements.meteogramRange.value));
  });

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
}

init();
