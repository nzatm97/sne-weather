const LOCATIONS = [
    { id: 'providence', name: 'Providence, RI', latitude: 41.824, longitude: -71.4128, timezone: 'America/New_York' },
    { id: 'new-haven', name: 'New Haven, CT', latitude: 41.3083, longitude: -72.9279, timezone: 'America/New_York' },
    { id: 'new-london', name: 'New London, CT', latitude: 41.3557, longitude: -72.0995, timezone: 'America/New_York' },
    { id: 'westerly', name: 'Westerly, RI', latitude: 41.3776, longitude: -71.8273, timezone: 'America/New_York' },
    { id: 'fall-river', name: 'Fall River, MA', latitude: 41.7015, longitude: -71.155, timezone: 'America/New_York' },
    { id: 'new-bedford', name: 'New Bedford, MA', latitude: 41.6362, longitude: -70.9342, timezone: 'America/New_York' },
    { id: 'hyannis', name: 'Hyannis, MA', latitude: 41.6525, longitude: -70.2881, timezone: 'America/New_York' }
  ];
  
  const MODELS = [
    { id: 'best_match', label: 'Best Match (Open-Meteo blend)' },
    { id: 'gfs_global', label: 'GFS Global (NOAA)' },
    { id: 'icon_global', label: 'ICON Global (DWD)' },
    { id: 'ecmwf_ifs04', label: 'ECMWF IFS' }
  ];
  
  const WEATHER_CODES = {
    0: 'Clear sky',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Frequent showers',
    82: 'Heavy showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm + hail',
    99: 'Severe thunderstorm + hail'
  };
  
  const locationSelect = document.getElementById('location');
  const modelSelect = document.getElementById('model');
  const timeRangeSelect = document.getElementById('timeRange');
  const refreshBtn = document.getElementById('refreshBtn');
  const statusPanel = document.getElementById('status');
  const dailyGrid = document.getElementById('dailyGrid');
  const insightGrid = document.getElementById('insightGrid');
  const tempTrend = document.getElementById('tempTrend');
  const precipTrend = document.getElementById('precipTrend');
  
  const currentCondition = document.getElementById('currentCondition');
  const currentTemp = document.getElementById('currentTemp');
  const feelsLike = document.getElementById('feelsLike');
  const windNow = document.getElementById('windNow');
  const todayRange = document.getElementById('todayRange');
  const rainToday = document.getElementById('rainToday');
  const trendSummary = document.getElementById('trendSummary');
  const precipSummary = document.getElementById('precipSummary');
  
  function populateSelectors() {
    LOCATIONS.forEach((location) => {
      const option = document.createElement('option');
      option.value = location.id;
      option.textContent = location.name;
      locationSelect.append(option);
    });
  
    MODELS.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.label;
      modelSelect.append(option);
    });
  
    locationSelect.value = 'providence';
    modelSelect.value = 'best_match';
    timeRangeSelect.value = '24';
  }
  
  function setStatus(message, type = '') {
    statusPanel.className = `status card${type ? ` ${type}` : ''}`;
    statusPanel.textContent = message;
  }
  
  function weatherCodeToLabel(code) {
    return WEATHER_CODES[code] ?? 'Conditions unavailable';
  }
  
  function formatHour(isoTime) {
    return new Date(isoTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
  }
  
  function renderKpis(location, payload) {
    const now = payload.current;
    const todayHigh = Math.round(payload.daily.temperature_2m_max[0]);
    const todayLow = Math.round(payload.daily.temperature_2m_min[0]);
    const todayRain = Math.round(payload.daily.precipitation_probability_max[0]);
  
    currentCondition.textContent = weatherCodeToLabel(now.weather_code);
    currentTemp.textContent = `${location.name} · ${Math.round(now.temperature_2m)}°F right now`;
  
    feelsLike.textContent = `${Math.round(now.apparent_temperature)}°F`;
    windNow.textContent = `Wind ${Math.round(now.wind_speed_10m)} mph`;
  
    todayRange.textContent = `${todayHigh}° / ${todayLow}°`;
    rainToday.textContent = `Rain chance today: ${todayRain}%`;
  }
  
  function renderDailyForecast(payload) {
    dailyGrid.innerHTML = '';
  
    payload.daily.time.forEach((dayISO, index) => {
      const day = new Date(dayISO).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
  
      const max = Math.round(payload.daily.temperature_2m_max[index]);
      const min = Math.round(payload.daily.temperature_2m_min[index]);
      const precip = Math.round(payload.daily.precipitation_probability_max[index]);
      const weatherCode = payload.daily.weather_code[index];
  
      const card = document.createElement('article');
      card.className = 'daily-card';
      card.innerHTML = `
        <div class="day">${day}</div>
        <div class="temps">${max}° / ${min}°</div>
        <div class="detail">${weatherCodeToLabel(weatherCode)}</div>
        <div class="detail">Rain chance: ${precip}%</div>
      `;
      dailyGrid.append(card);
    });
  }
  
  function buildLinePath(values, width, height, padding) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
  
    return values
      .map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
        const y = height - padding - ((value - min) / span) * (height - padding * 2);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }
  
  function renderTemperatureChart(hourlyTimes, hourlyTemps) {
    tempTrend.innerHTML = '';
    const width = 800;
    const height = 240;
    const padding = 28;
  
    const linePath = buildLinePath(hourlyTemps, width, height, padding);
    const minTemp = Math.min(...hourlyTemps);
    const maxTemp = Math.max(...hourlyTemps);
  
    const areaPath = `${linePath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', String(padding));
    axis.setAttribute('x2', String(width - padding));
    axis.setAttribute('y1', String(height - padding));
    axis.setAttribute('y2', String(height - padding));
    axis.setAttribute('class', 'chart-axis');
    tempTrend.append(axis);
  
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('class', 'temp-area');
    tempTrend.append(area);
  
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('class', 'temp-line');
    tempTrend.append(line);
  
    hourlyTemps.forEach((temp, index) => {
      if (index % Math.ceil(hourlyTemps.length / 8) !== 0 && index !== hourlyTemps.length - 1) {
        return;
      }
  
      const x = padding + (index * (width - padding * 2)) / Math.max(hourlyTemps.length - 1, 1);
      const y = height - padding - ((temp - minTemp) / Math.max(maxTemp - minTemp, 1)) * (height - padding * 2);
  
      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      point.setAttribute('cx', String(x));
      point.setAttribute('cy', String(y));
      point.setAttribute('r', '4');
      point.setAttribute('class', 'temp-point');
      tempTrend.append(point);
  
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(height - 8));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'chart-label');
      label.textContent = formatHour(hourlyTimes[index]);
      tempTrend.append(label);
    });
  
    trendSummary.textContent = `Range ${Math.round(minTemp)}°F to ${Math.round(maxTemp)}°F over selected period.`;
  }
  
  function renderPrecipChart(hourlyTimes, precipValues) {
    precipTrend.innerHTML = '';
    const width = 800;
    const height = 220;
    const padding = 26;
    const maxValue = Math.max(...precipValues, 1);
  
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', String(padding));
    axis.setAttribute('x2', String(width - padding));
    axis.setAttribute('y1', String(height - padding));
    axis.setAttribute('y2', String(height - padding));
    axis.setAttribute('class', 'chart-axis');
    precipTrend.append(axis);
  
    const bucketStep = Math.max(1, Math.floor(precipValues.length / 16));
    const buckets = [];
  
    for (let index = 0; index < precipValues.length; index += bucketStep) {
      const slice = precipValues.slice(index, index + bucketStep);
      const avg = slice.reduce((sum, value) => sum + value, 0) / slice.length;
      buckets.push({
        label: formatHour(hourlyTimes[index]),
        value: avg
      });
    }
  
    buckets.forEach((entry, index) => {
      const barSpace = (width - padding * 2) / buckets.length;
      const barWidth = Math.max(12, barSpace * 0.72);
      const x = padding + index * barSpace + (barSpace - barWidth) / 2;
      const h = (entry.value / maxValue) * (height - padding * 2);
      const y = height - padding - h;
  
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(barWidth));
      rect.setAttribute('height', String(h));
      rect.setAttribute('rx', '4');
      rect.setAttribute('class', entry.value >= 60 ? 'bar bar--highlight' : 'bar');
      precipTrend.append(rect);
  
      if (index % 2 === 0 || index === buckets.length - 1) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(x + barWidth / 2));
        label.setAttribute('y', String(height - 8));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'chart-label');
        label.textContent = entry.label;
        precipTrend.append(label);
      }
    });
  
    const peak = Math.round(Math.max(...precipValues));
    precipSummary.textContent = `Peak hourly rain probability: ${peak}%. Dark bars highlight higher-risk windows.`;
  }
  
  function renderInsights(location, payload, selectedModel) {
    insightGrid.innerHTML = '';
  
    const warmest = Math.max(...payload.daily.temperature_2m_max);
    const coolest = Math.min(...payload.daily.temperature_2m_min);
    const wettest = Math.max(...payload.daily.precipitation_probability_max);
    const windy = Math.max(...payload.hourly.wind_speed_10m.slice(0, 24));
  
    const insights = [
      {
        title: 'Weekly Temperature Spread',
        value: `${Math.round(coolest)}° to ${Math.round(warmest)}°`,
        text: 'Useful for planning commuting layers and weekend outings.'
      },
      {
        title: 'Highest Rain Risk Day',
        value: `${Math.round(wettest)}%`,
        text: 'Consider contingency plans for outdoor events and travel.'
      },
      {
        title: 'Strongest Wind Next 24h',
        value: `${Math.round(windy)} mph`,
        text: 'Helpful for boaters, cyclists, and shore exposure decisions.'
      },
      {
        title: 'Model + Location',
        value: `${MODELS.find((entry) => entry.id === selectedModel)?.label ?? selectedModel}`,
        text: `${location.name} · compare models to improve confidence in edge cases.`
      }
    ];
  
    insights.forEach((insight) => {
      const card = document.createElement('article');
      card.className = 'insight';
      card.innerHTML = `
        <div class="title">${insight.title}</div>
        <div class="value">${insight.value}</div>
        <div class="text">${insight.text}</div>
      `;
      insightGrid.append(card);
    });
  }
  
  function selectHourlyWindow(hourly, hours) {
    return {
      time: hourly.time.slice(0, hours),
      temperature_2m: hourly.temperature_2m.slice(0, hours),
      precipitation_probability: hourly.precipitation_probability.slice(0, hours)
    };
  }
  
  async function loadForecast() {
    const selectedLocation = LOCATIONS.find((location) => location.id === locationSelect.value);
    const selectedModel = modelSelect.value;
    const selectedHours = Number(timeRangeSelect.value);
  
    if (!selectedLocation) {
      setStatus('Please choose a valid location.', 'warning');
      return;
    }
  
    setStatus('Loading latest forecast and visualizations...');
  
    const params = new URLSearchParams({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      timezone: selectedLocation.timezone,
      models: selectedModel,
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      hourly: 'temperature_2m,precipitation_probability,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      forecast_days: '7'
    });
  
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
  
      const payload = await response.json();
      const hourly = selectHourlyWindow(payload.hourly, selectedHours);
  
      renderKpis(selectedLocation, payload);
      renderTemperatureChart(hourly.time, hourly.temperature_2m);
      renderPrecipChart(hourly.time, hourly.precipitation_probability);
      renderInsights(selectedLocation, payload, selectedModel);
      renderDailyForecast(payload);
  
      const nowText = new Date(payload.current.time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
  
      setStatus(`Updated ${selectedLocation.name} using ${MODELS.find((entry) => entry.id === selectedModel)?.label ?? selectedModel} · ${nowText}`, 'success');
    } catch (error) {
      setStatus(`Unable to load forecast: ${error.message}`, 'warning');
    }
  }
  
  populateSelectors();
  loadForecast();
  refreshBtn.addEventListener('click', loadForecast);
  locationSelect.addEventListener('change', loadForecast);
  modelSelect.addEventListener('change', loadForecast);
  timeRangeSelect.addEventListener('change', loadForecast);