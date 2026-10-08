import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Check,
  Pill,
  CalendarCheck2,
  Sparkles,
  Sun,
  Moon,
  Sunrise,
  Sprout,
  Leaf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracker } from '../context/TrackerContext';
import { todayISO, getLastDays, isScheduled } from '../lib/dates';
import { EmptyState, LoadingState, Modal, PageHeading } from '../components/UI';
import { SupplementForm } from '../components/SupplementForm';
import { IntakeRow } from '../components/IntakeRow';
import { WeeklyChart } from '../components/WeeklyChart';

const timeGroups = [
  ['Утро', Sunrise, (time) => time < '12:00'],
  ['День', Sun, (time) => time >= '12:00' && time < '18:00'],
  ['Вечер', Moon, (time) => time >= '18:00'],
];

export function DashboardPage() {
  const { user } = useAuth();
  const { supplements, intakes, loading, createSupplement, markIntake, unmarkIntake } =
    useTracker();
  const date = todayISO();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const scheduled = supplements
    .filter((item) => isScheduled(item, date))
    .sort((a, b) => a.time.localeCompare(b.time));
  const completed = scheduled.filter((item) =>
    intakes.some((log) => log.supplementId === item.id && log.date === date),
  );
  const progress = scheduled.length ? Math.round((completed.length / scheduled.length) * 100) : 0;
  const lastDays = getLastDays(7);
  const daysWithLogs = lastDays.filter((day) => intakes.some((log) => log.date === day)).length;
  const weekCount = intakes.filter((log) => lastDays.includes(log.date)).length;
  const next = scheduled.find((item) => !completed.some((entry) => entry.id === item.id));
  const toggle = async (item) => {
    if (pending) return;
    setPending(item.id);
    setError('');
    const intake = intakes.find((entry) => entry.supplementId === item.id && entry.date === date);
    try {
      if (intake) await unmarkIntake(intake.id);
      else await markIntake(item.id, date);
    } catch (err) {
      setError(err.message);
    }
    setPending('');
  };
  return (
    <>
      <PageHeading
        eyebrow="КАЖДЫЙ ДЕНЬ — МАЛЕНЬКИЙ ШАГ"
        title={`Привет, ${user.name.split(' ')[0]} 👋`}
        description="Пусть забота о себе станет приятной привычкой."
      >
        <button className="button button-primary" onClick={() => setAdding(true)}>
          <Plus size={18} />
          Добавить добавку
        </button>
      </PageHeading>
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <section className="welcome-banner">
            <div className="welcome-copy">
              <span className="banner-kicker">
                <span className="live-dot" />
                ВАШ ПЛАН НА СЕГОДНЯ
              </span>
              <h2>
                {progress === 100 && scheduled.length
                  ? 'Вы всё отметили. Отличный ритм!'
                  : 'Хорошие привычки начинаются с вас.'}
              </h2>
              <p>
                {scheduled.length
                  ? `В плане ${scheduled.length} ${scheduled.length === 1 ? 'добавка' : scheduled.length < 5 ? 'добавки' : 'добавок'}. Отмечайте приёмы в своём темпе.`
                  : 'Добавьте первый курс и соберите своё расписание.'}
              </p>
              <a href="#daily-plan" className="banner-link">
                Перейти к моему плану <ArrowRight size={17} />
              </a>
            </div>
            <div
              className="progress-ring"
              style={{ '--progress': `${progress}%` }}
              role="img"
              aria-label={`Принято ${completed.length} из ${scheduled.length}`}
            >
              <div>
                <strong>
                  {completed.length}
                  <span>/{scheduled.length}</span>
                </strong>
                <small>принято сегодня</small>
              </div>
            </div>
            <span className="banner-decoration" aria-hidden="true">
              <Sprout size={130} strokeWidth={0.7} />
            </span>
          </section>
          <div className="stat-grid dashboard-stats">
            <div className="stat-card">
              <span className="stat-icon sage">
                <Pill size={21} />
              </span>
              <div>
                <p>Активные курсы</p>
                <strong>
                  {supplements.filter((item) => isScheduled(item, todayISO())).length}
                  <span>в вашем плане</span>
                </strong>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon apricot">
                <CalendarCheck2 size={21} />
              </span>
              <div>
                <p>Дни с отметками</p>
                <strong>
                  {daysWithLogs}
                  <span>из последних 7 дней</span>
                </strong>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon lavender">
                <Check size={21} />
              </span>
              <div>
                <p>Приёмы за неделю</p>
                <strong>
                  {weekCount}
                  <span>сохранено в истории</span>
                </strong>
              </div>
            </div>
          </div>
          <div className="dashboard-grid">
            <section className="panel daily-panel" id="daily-plan">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ВАШЕ РАСПИСАНИЕ</p>
                  <h2>
                    План на день <span className="count-badge">{scheduled.length}</span>
                  </h2>
                </div>
                <div className="date-picker">
                  <span className="date-label">Сегодня</span>
                </div>
              </div>
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              {scheduled.length ? (
                <div className="daily-list">
                  {timeGroups.map(([label, Icon, test]) => {
                    const items = scheduled.filter((item) => test(item.time));
                    return items.length ? (
                      <div className="time-group" key={label}>
                        <div className="time-group-label">
                          <Icon size={16} />
                          <span>{label}</span>
                          <span className="time-group-line" />
                        </div>
                        {items.map((item) => {
                          const taken = completed.some((entry) => entry.id === item.id);
                          return (
                            <IntakeRow
                              key={item.id}
                              supplement={item}
                              taken={taken}
                              disabled={Boolean(pending)}
                              pending={pending === item.id}
                              onToggle={toggle}
                            />
                          );
                        })}
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <EmptyState
                  title="На этот день план пока пуст"
                  description="Добавьте название, дозировку и время ежедневного приёма."
                >
                  <button className="button button-secondary" onClick={() => setAdding(true)}>
                    <Plus size={16} />
                    Добавить курс
                  </button>
                </EmptyState>
              )}
              <Link className="panel-bottom-link" to="/supplements">
                Все мои добавки <ArrowRight size={16} />
              </Link>
            </section>
            <div className="dashboard-side">
              <section className="panel weekly-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">ПОСЛЕДНИЕ 7 ДНЕЙ</p>
                    <h2>Ваш ритм</h2>
                  </div>
                  <span className="icon-bubble">
                    <CalendarCheck2 size={20} />
                  </span>
                </div>
                <p className="weekly-caption">Каждая отметка — шаг к привычке.</p>
                <WeeklyChart days={lastDays} intakes={intakes} />
                <Link className="quiet-link" to="/history">
                  Открыть историю <ArrowUpRight size={15} />
                </Link>
              </section>
              <section className="next-card">
                <div className="next-card-top">
                  <span className="next-icon">
                    <Sparkles size={18} />
                  </span>
                  <span>{next ? 'ЕЩЁ В ПЛАНЕ' : 'ВСЁ В СВОЁМ ТЕМПЕ'}</span>
                </div>
                <h3>
                  {next ? next.name : scheduled.length ? 'План выполнен' : 'Начнём с первого курса'}
                </h3>
                <p>
                  {next
                    ? `${next.dose} · ${next.time}`
                    : scheduled.length
                      ? 'Все отметки за выбранный день сохранены.'
                      : 'Соберите расписание, которое подходит вам.'}
                </p>
                {next ? (
                  <Link to={`/supplements/${next.id}`}>
                    Открыть курс <ArrowUpRight size={16} />
                  </Link>
                ) : (
                  <button className="text-button" onClick={() => setAdding(true)}>
                    Добавить добавку <Plus size={16} />
                  </button>
                )}
              </section>
            </div>
          </div>
          <div className="catalog-strip">
            <span className="catalog-strip-icon">
              <Leaf size={24} />
            </span>
            <div>
              <h3>Соберите свой план быстрее</h3>
              <p>Найдите добавку в каталоге и перенесите название и бренд в свой план.</p>
            </div>
            <Link className="button button-secondary" to="/catalog">
              Открыть каталог <ArrowUpRight size={17} />
            </Link>
          </div>
        </>
      )}
      {adding && (
        <Modal
          title="Новая добавка"
          onClose={() => {
            if (!saving) setAdding(false);
          }}
        >
          <SupplementForm
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              setSaving(true);
              try {
                await createSupplement(values);
                setAdding(false);
              } finally {
                setSaving(false);
              }
            }}
          />
        </Modal>
      )}
    </>
  );
}
