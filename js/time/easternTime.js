export const ET_TIME_ZONE = 'America/New_York';

const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const ET_HOUR_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false
});

const ET_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_TIME_ZONE,
  weekday: 'short'
});

const ET_HOUR_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_TIME_ZONE,
  hour: 'numeric'
});
const UTC_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short'
});

function toDate(input) {
  if (input instanceof Date) return input;
  return new Date(input);
}

function partValue(parts, type) {
  return parts.find((part) => part.type === type)?.value;
}

export function getEtDateKey(input = new Date()) {
  const date = toDate(input);
  const parts = ET_DATE_FORMATTER.formatToParts(date);
  return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}`;
}

export function getEtHourKey(input = new Date()) {
  const date = toDate(input);
  const parts = ET_HOUR_FORMATTER.formatToParts(date);
  return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}T${partValue(parts, 'hour')}`;
}

export function getEtHourNumber(input = new Date()) {
  const date = toDate(input);
  const parts = ET_HOUR_FORMATTER.formatToParts(date);
  return Number(partValue(parts, 'hour'));
}

export function formatEtWeekday(input) {
  return ET_WEEKDAY_FORMATTER.format(toDate(input));
}

export function formatEtHourLabel(input) {
  return ET_HOUR_LABEL_FORMATTER.format(toDate(input));
}

export function formatWeekdayFromDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return UTC_WEEKDAY_FORMATTER.format(date);
}

export function getMsUntilNextEtMidnight() {
  const now = new Date();
  const todayKey = getEtDateKey(now);
  for (let minute = 1; minute <= 36 * 60; minute += 1) {
    const probe = new Date(now.getTime() + minute * 60_000);
    if (getEtDateKey(probe) !== todayKey) return minute * 60_000;
  }
  return 60_000;
}
