export async function getEcmwfForecast() {
  return {
    sourceId: 'ecmwf',
    sourceLabel: 'ECMWF',
    comingSoon: true,
    message: 'ECMWF integration is coming soon.',
    daily: [],
    hourly: []
  };
}

