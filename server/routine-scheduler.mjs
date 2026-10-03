function partsFor(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function offsetAt(date, timezone) {
  const p = partsFor(date, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - date.getTime() + (date.getSeconds() * 1000 + date.getMilliseconds());
}

function localDateTimeToUtc({ year, month, day, hour, minute }, timezone) {
  let candidate = Date.UTC(year, month - 1, day, hour, minute);
  candidate -= offsetAt(new Date(candidate), timezone);
  const check = partsFor(new Date(candidate), timezone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    candidate += (Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(check.year, check.month - 1, check.day, check.hour, check.minute));
  }
  return new Date(candidate);
}

const WEEKDAYS = new Map([
  ['sun', 0], ['sunday', 0], ['mon', 1], ['monday', 1], ['tue', 2], ['tuesday', 2],
  ['wed', 3], ['wednesday', 3], ['thu', 4], ['thursday', 4], ['fri', 5], ['friday', 5],
  ['sat', 6], ['saturday', 6],
]);

export function normalizeSchedule(schedule) {
  const value = String(schedule || '').trim().toLowerCase();
  const daily = value.match(/^daily\s+(\d{1,2}):(\d{2})$/);
  if (daily) return { kind: 'daily', hour: Number(daily[1]), minute: Number(daily[2]) };
  const weekly = value.match(/^weekly\s+([a-z]+)\s+(\d{1,2}):(\d{2})$/);
  if (weekly && WEEKDAYS.has(weekly[1])) {
    return { kind: 'weekly', weekday: WEEKDAYS.get(weekly[1]), hour: Number(weekly[2]), minute: Number(weekly[3]) };
  }
  const hours = value.match(/^every\s+(\d+)\s*(?:h|hr|hrs|hour|hours)$/);
  if (hours) return { kind: 'interval_hours', minutes: Number(hours[1]) * 60 };
  const minutes = value.match(/^every\s+(\d+)\s*(?:m|min|mins|minute|minutes)$/);
  if (minutes) return { kind: 'interval_minutes', minutes: Number(minutes[1]) };
  throw new Error('Unsupported routine schedule. Use daily HH:MM, weekly DAY HH:MM, every N hours, or every N minutes.');
}

export function nextRunAt(schedule, {
  from = new Date(),
  timezone = 'Africa/Lagos',
} = {}) {
  const parsed = normalizeSchedule(schedule);
  const start = new Date(from);
  if (parsed.kind === 'interval_hours' || parsed.kind === 'interval_minutes') {
    return new Date(start.getTime() + parsed.minutes * 60_000);
  }

  const local = partsFor(start, timezone);
  const base = {
    year: local.year,
    month: local.month,
    day: local.day,
    hour: parsed.hour,
    minute: parsed.minute,
  };

  if (parsed.kind === 'daily') {
    let candidate = localDateTimeToUtc(base, timezone);
    if (candidate <= start) {
      const nextDay = new Date(Date.UTC(base.year, base.month - 1, base.day) + 86_400_000);
      candidate = localDateTimeToUtc({
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth() + 1,
        day: nextDay.getUTCDate(),
        hour: parsed.hour,
        minute: parsed.minute,
      }, timezone);
    }
    return candidate;
  }

  let date = new Date(Date.UTC(base.year, base.month - 1, base.day));
  for (let i = 0; i < 8; i += 1) {
    if (date.getUTCDay() === parsed.weekday) {
      const candidate = localDateTimeToUtc({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: parsed.hour,
        minute: parsed.minute,
      }, timezone);
      if (candidate > start) return candidate;
    }
    date = new Date(date.getTime() + 86_400_000);
  }
  throw new Error('Could not calculate the next routine run.');
}
