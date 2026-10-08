import { Link } from 'react-router-dom';
import { CheckCheck, History } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { EmptyState, PageHeading, PillIcon } from '../components/UI';
import { formatDate, todayISO } from '../lib/dates';

export function HistoryPage() {
  const { intakes, supplements, loading } = useTracker();
  const entries = [...intakes].sort((a, b) =>
    `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`),
  );
  const distinctDays = new Set(intakes.map((item) => item.date)).size;
  const todayCount = intakes.filter((item) => item.date === todayISO()).length;

  return (
    <>
      <PageHeading
        eyebrow="Ваш путь к привычке"
        title="История приёмов"
        description="Каждая отметка — маленький шаг. Здесь сохраняется ваша история заботы о себе."
      />
      <div className="stat-grid history-page-stats">
        <div className="stat-card">
          <span className="eyebrow">За всё время</span>
          <strong>{intakes.length}</strong>
          <span className="muted">отметок о приёме</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Дни с отметками</span>
          <strong>{distinctDays}</strong>
          <span className="muted">дней в истории</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Сегодня</span>
          <strong>{todayCount}</strong>
          <span className="muted">приёмов отмечено</span>
        </div>
      </div>
      {loading ? (
        <div className="loading-state" role="status">
          <span className="spinner" /> Загружаем историю…
        </div>
      ) : entries.length ? (
        <section className="panel history-panel">
          <div className="panel-heading">
            <h2>Записи о приёмах</h2>
            <span className="tag">
              <CheckCheck size={15} /> {entries.length} отметок
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Добавка</th>
                  <th>Дата</th>
                  <th>Время по плану</th>
                  <th>Дозировка</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-supplement">
                        <PillIcon color={item.color} size="small" />
                        <span>
                          {item.name ||
                            supplements.find(
                              (supplement) => String(supplement.id) === String(item.supplementId),
                            )?.name ||
                            'Удалённая добавка'}
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.time || '—'}</td>
                    <td>{item.dose || '—'}</td>
                    <td>
                      <span className="tag tag-success">Принято</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={History}
          title="Ваша история начинается сегодня"
          description="Отметьте приём в сегодняшнем расписании. Он появится здесь автоматически."
        >
          <Link className="button button-primary" to="/">
            К расписанию
          </Link>
        </EmptyState>
      )}
    </>
  );
}

export default HistoryPage;
