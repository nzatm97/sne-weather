import { CONFIG } from '../../config.js';
import { getOpenMeteoModelForecast } from './openMeteoModelProvider.js';

export async function getEcmwfForecast(location) {
  return getOpenMeteoModelForecast({
    endpoint: CONFIG.endpoints.ecmwfForecast,
    cacheNamespace: 'forecast-source-ecmwf',
    sourceId: 'ecmwf',
    sourceLabel: 'ECMWF',
    location
  });
}
