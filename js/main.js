import { CONFIG } from './config.js';
import { forecastForLocation, nwsAlertsByPoint, radarFrames } from './api.js';
import { WeatherMap } from './map.js';
import { renderMeteogram } from './chart.js';
import { loadRecentSearches, saveRecentSearch, setupSearch } from './search.js';

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
  radarFrameRange: document.getElementById('radarFrameRange'),
  radarOpacity: document.getElementById('radarOpacity'),
  radarTimestamp: document.getElementById('radarTimestamp'),
  meteogramRange: document.getElementById('meteogramRange'),
  layerRadar: document.getElementById('layerRadar'),
  layerTemp: document.getElementById('layerTemp'),
  layerWind: document.getElementById('layerWind')
};

if (!elements.status) {
  throw new Error('Home page elements are missing.');
}

const weatherMap = new WeatherMap('map');
let activeLocation = { ...CONFIG.defaultLocation };
let latestForecast = null;
let radarFrameSet = [];

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
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

    weatherMap.updateDerivedLayers(place, forecast);
    const geoAlerts = alerts.filter((a) => a.geometry);
    weatherMap.updateAlerts(geoAlerts);
    setStatus(`Updated ${place.name}`);
  } catch (error) {
    setStatus(`Unable to load all weather data: ${error.message}`, true);
  }
}

async function initRadar() {
  try {
    radarFrameSet = await radarFrames();
    weatherMap.setRadarFrames(radarFrameSet);
    elements.radarFrameRange.max = String(radarFrameSet.length - 1);
    elements.radarFrameRange.value = String(radarFrameSet.length - 1);
    elements.radarTimestamp.textContent = new Date(radarFrameSet.at(-1).time * 1000).toLocaleTimeString();

    elements.radarFrameRange.addEventListener('input', (event) => {
      const idx = weatherMap.setFrameByIndex(Number(event.target.value));
      elements.radarTimestamp.textContent = new Date(radarFrameSet[idx].time * 1000).toLocaleTimeString();
    });
  } catch (error) {
    setStatus(`Radar unavailable: ${error.message}`, true);
  }
}

function setupControls() {
  let playing = false;
  elements.radarPlayBtn.addEventListener('click', () => {
    if (playing) {
      weatherMap.pauseRadar();
      elements.radarPlayBtn.textContent = 'Play';
      playing = false;
      return;
    }
    weatherMap.playRadar((idx) => {
      elements.radarFrameRange.value = String(idx);
      if (radarFrameSet[idx]) elements.radarTimestamp.textContent = new Date(radarFrameSet[idx].time * 1000).toLocaleTimeString();
    });
    elements.radarPlayBtn.textContent = 'Pause';
    playing = true;
  });

  elements.radarOpacity.addEventListener('input', (event) => weatherMap.setRadarOpacity(Number(event.target.value)));
  elements.alertsToggle.addEventListener('change', (event) => weatherMap.toggleAlerts(event.target.checked));
  elements.layerRadar.addEventListener('change', (event) => weatherMap.toggleRadar(event.target.checked));
  elements.layerTemp.addEventListener('change', (event) => weatherMap.toggleTemp(event.target.checked));
  elements.layerWind.addEventListener('change', (event) => weatherMap.toggleWind(event.target.checked));

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
  setupSearch({ input: elements.searchInput, resultsList: elements.searchResults, onSelect: updateLocation, onError: (error) => setStatus(`Search error: ${error.message}`, true) });

  renderRecents();
  await initRadar();
  await updateLocation(activeLocation);
}

init();
