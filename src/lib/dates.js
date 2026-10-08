export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftDate(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function getLastDays(count = 7, end = todayISO()) {
  return Array.from({ length: count }, (_, index) => shiftDate(end, index - count + 1));
}

export function formatDate(value, options = { day: 'numeric', month: 'long' }) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('ru-RU', {
    ...options,
    timeZone: 'Europe/Moscow',
  });
}

export function isScheduled(supplement, date = todayISO()) {
  return (
    supplement.status === 'active' &&
    supplement.startDate <= date &&
    (!supplement.endDate || supplement.endDate >= date)
  );
}
