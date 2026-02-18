import { getNoaaNwsForecast } from './providers/noaaNwsProvider.js';
import { getGfsForecast } from './providers/gfsProvider.js';
import { getEcmwfForecast } from './providers/ecmwfProvider.js';

export const FORECAST_SOURCES = {
  noaa: { id: 'noaa', label: 'NOAA / NWS', load: getNoaaNwsForecast },
  gfs: { id: 'gfs', label: 'GFS', load: getGfsForecast },
  ecmwf: { id: 'ecmwf', label: 'ECMWF', load: getEcmwfForecast }
};

export function getForecastSource(id) {
  return FORECAST_SOURCES[id] ?? FORECAST_SOURCES.noaa;
}

export function getForecastSourceOptions() {
  return Object.values(FORECAST_SOURCES);
}

