export async function getGfsForecast() {
  return {
    sourceId: 'gfs',
    sourceLabel: 'GFS',
    comingSoon: true,
    message: 'GFS integration is coming soon.',
    daily: [],
    hourly: []
  };
}

