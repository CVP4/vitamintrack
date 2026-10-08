import { formatDate, todayISO } from '../lib/dates';

export function WeeklyChart({ days, intakes }) {
  const counts = days.map((date) => ({
    date,
    count: intakes.filter((item) => item.date === date).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  return (
    <div className="week-chart">
      {counts.map(({ date, count }) => (
        <div className={`chart-column ${date === todayISO() ? 'current' : ''}`} key={date}>
          <div className="chart-value">{count}</div>
          <div className="chart-track">
            <div
              className="chart-bar"
              style={{ height: count ? `${Math.max(12, (count / max) * 100)}%` : '4px' }}
            />
          </div>
          <span>{formatDate(date, { weekday: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}
