# Forecast Sources

## Current implementation

### Default forecast source (5-day + hourly)
- Provider: `NOAA / NWS`
- Discovery endpoint: `https://api.weather.gov/points/{lat},{lon}`
- Forecast endpoints discovered from `points` response:
  - `properties.forecast` (daily periods)
  - `properties.forecastHourly` (hourly periods)
  - `properties.forecastGridData` (gridded fields used when available)

### Additional weather feed still used in app
- Provider: Open-Meteo (current conditions + meteogram chart)
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Used for:
  - Current conditions panel
  - Meteogram plotting data

## Units

### NOAA / NWS
- Temperature: Fahrenheit in period objects for US locations
- Wind speed: mph strings (parsed into numeric mph for display)
- Probability of precipitation: percent where available
- Additional grid fields (humidity, cloud cover, rain/snow amounts): shown when present

### Open-Meteo
- Explicitly requested:
  - Temperature: Fahrenheit
  - Wind speed: mph
  - Precipitation: inch

## Refresh / update behavior
- App fetches forecast data on page load and when location changes.
- Daily/hourly display alignment is recomputed in `America/New_York` time.
- ET rollover handling:
  - Minute watcher for ET date/hour boundary changes
  - Scheduled ET-midnight refresh attempt

## Timestamp / timezone behavior
- All “current time” filtering logic for 5-day and hourly display uses `America/New_York`.
- DST is handled via `Intl.DateTimeFormat` timezone conversion helpers.
- NOAA timestamps are parsed from ISO timestamps in period start times.

## Source selector status
- `NOAA / NWS`: fully implemented
- `GFS`: placeholder (“Coming soon”)
- `ECMWF`: placeholder (“Coming soon”)

## Licensing / attribution notes
- NOAA / NWS API: public US government weather data from [weather.gov](https://www.weather.gov/documentation/services-web-api)
- Open-Meteo API: see [Open-Meteo docs](https://open-meteo.com/en/docs)
- Keep map and weather data attributions visible where required by upstream providers.

