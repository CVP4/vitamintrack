import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Clock3, Pencil, Pill, RefreshCw } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { SupplementForm } from '../components/SupplementForm';
import { EmptyState, Modal, PillIcon } from '../components/UI';
import { formatDate, getLastDays, isScheduled, todayISO } from '../lib/dates';

import { categoryLabels } from '../lib/supplements';

export function SupplementDetailPage() {
  const { id } = useParams();
  const {
    supplements,
    intakes,
    loading,
    error: trackerError,
    refresh,
    updateSupplement,
  } = useTracker();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const supplement = supplements.find((item) => String(item.id) === String(id));

  if (loading)
    return (
      <div className="loading-state" role="status">
        <span className="spinner" /> Загружаем добавку…
      </div>
    );
  if (trackerError && !supplement)
    return (
      <EmptyState icon={Pill} title="Не удалось загрузить добавку" description={trackerError}>
        <button className="button button-primary" onClick={() => refresh()}>
          <RefreshCw size={17} /> Попробовать снова
        </button>
      </EmptyState>
    );
  if (!supplement)
    return (
      <EmptyState
        icon={Pill}
        title="Добавка не найдена"
        description="Возможно, она уже удалена из вашего списка."
      >
        <Link className="button button-primary" to="/supplements">
          К моим добавкам
        </Link>
      </EmptyState>
    );

  const ownIntakes = intakes.filter((item) => String(item.supplementId) === String(supplement.id));
  const todayIntake = ownIntakes.find((item) => item.date === todayISO());
  const canTakeToday = isScheduled(supplement, todayISO());

  async function save(values) {
    setBusy(true);
    try {
      await updateSupplement(supplement.id, values);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link className="back-link" to="/supplements">
        <ArrowLeft size={17} /> Мои добавки
      </Link>
      <div className="detail-heading">
        <div className="detail-heading-main">
          <PillIcon color={supplement.color} size="large" />
          <div>
            <span className="page-kicker">{categoryLabels[supplement.category] || 'Добавка'}</span>
            <h1>{supplement.name}</h1>
            <p className="page-description">{supplement.brand || 'Ваша персональная добавка'}</p>
          </div>
        </div>
        <button className="button button-secondary" onClick={() => setEditing(true)}>
          <Pencil size={17} /> Изменить
        </button>
      </div>
      <div className="detail-grid">
        <section className="panel detail-panel">
          <div className="panel-heading">
            <h2>Ваш план приёма</h2>
            <span className={`tag ${supplement.status === 'active' ? 'tag-success' : 'tag-muted'}`}>
              {supplement.status === 'active' ? 'Активная' : 'На паузе'}
            </span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Дозировка</dt>
              <dd>{supplement.dose}</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={15} /> Время
              </dt>
              <dd>{supplement.time}</dd>
            </div>
            <div>
              <dt>Периодичность</dt>
              <dd>Каждый день</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={15} /> Начало
              </dt>
              <dd>{formatDate(supplement.startDate)}</dd>
            </div>
            <div>
              <dt>Окончание</dt>
              <dd>{supplement.endDate ? formatDate(supplement.endDate) : 'Не указано'}</dd>
            </div>
          </dl>
          {supplement.notes && (
            <div className="detail-note">
              <h3>Заметка для себя</h3>
              <p>{supplement.notes}</p>
            </div>
          )}
        </section>

        <div className="detail-side">
          <section className={`panel today-detail color-${supplement.color || 'sage'}`}>
            <span className="eyebrow">Сегодня · {formatDate(todayISO())}</span>
            <h2>
              {todayIntake
                ? 'Приём отмечен'
                : canTakeToday
                  ? 'Время позаботиться о себе'
                  : 'Сегодня без приёма'}
            </h2>
            <p className="muted">
              {todayIntake
                ? 'Ваша отметка сохранена в истории.'
                : canTakeToday
                  ? `${supplement.dose} в ${supplement.time}. Отмечайте приём после того, как приняли добавку.`
                  : 'Добавка на паузе или сегодняшний день вне указанного периода.'}
            </p>
            <Link className="button button-primary" to="/">
              К плану на сегодня
            </Link>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Последние 7 дней</h2>
              <span className="muted">{ownIntakes.length} отметок всего</span>
            </div>
            <div className="week-strip">
              {getLastDays(7).map((date) => {
                const taken = ownIntakes.some((item) => item.date === date);
                return (
                  <div
                    className={`week-day ${taken ? 'is-complete' : ''}`}
                    key={date}
                    title={`${formatDate(date)}: ${taken ? 'приём отмечен' : 'без отметки'}`}
                  >
                    <span>
                      {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
                        weekday: 'short',
                      })}
                    </span>
                    <strong>{taken ? <Check size={17} /> : Number(date.slice(-2))}</strong>
                  </div>
                );
              })}
            </div>
          </section>
          <p className="callout muted">
            VitaminTrack помогает вести записи. План приёма и дозировки определяйте вместе со
            специалистом.
          </p>
        </div>
      </div>
      {editing && (
        <Modal
          title="Изменить добавку"
          onClose={() => {
            if (!busy) setEditing(false);
          }}
        >
          <SupplementForm
            initialValues={supplement}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
    </>
  );
}

export default SupplementDetailPage;
