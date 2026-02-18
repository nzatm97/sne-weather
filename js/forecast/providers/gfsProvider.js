import { CONFIG } from '../../config.js';
import { getOpenMeteoModelForecast } from './openMeteoModelProvider.js';

export async function getGfsForecast(location) {
  return getOpenMeteoModelForecast({
    endpoint: CONFIG.endpoints.gfsForecast,
    cacheNamespace: 'forecast-source-gfs',
    sourceId: 'gfs',
    sourceLabel: 'GFS',
    location
  });
}
