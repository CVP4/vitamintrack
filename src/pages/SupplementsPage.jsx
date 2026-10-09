import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, Pill, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { SupplementForm } from '../components/SupplementForm';
import { EmptyState, Modal, PageHeading, PillIcon } from '../components/UI';
import { formatDate, isScheduled } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { categoryLabels } from '../lib/supplements';

export function SupplementsPage() {
  const { supplements, loading, createSupplement, updateSupplement, deleteSupplement } =
    useTracker();
  const date = useToday();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () =>
      supplements.filter((item) => {
        const matchesText = `${item.name} ${item.brand || ''}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        return matchesText && (category === 'all' || item.category === category);
      }),
    [supplements, search, category],
  );
  const activeCount = supplements.filter((item) => isScheduled(item, date)).length;

  function openEditor(item = 'new') {
    setActionError('');
    setEditor(item);
  }

  async function save(values) {
    setActionError('');
    setBusy(true);
    try {
      if (editor === 'new') await createSupplement(values);
      else await updateSupplement(editor.id, values);
      setEditor(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setActionError('');
    setBusy(true);
    try {
      await deleteSupplement(deleting.id);
      setDeleting(null);
    } catch (err) {
      setActionError(err.message || 'Не удалось удалить добавку.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Всё под контролем"
        title="Мои добавки"
        description="Ваш личный набор и расписание приёма — в одном месте."
      >
        <button className="button button-primary" onClick={() => openEditor()}>
          <Plus size={18} /> Добавить добавку
        </button>
      </PageHeading>

      <div className="stat-grid supplement-stats">
        <div className="stat-card">
          <span className="eyebrow">В вашем списке</span>
          <strong>{supplements.length}</strong>
          <span className="muted">добавок всего</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Активные курсы</span>
          <strong>{activeCount}</strong>
          <span className="muted">активных добавок</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Не в плане сегодня</span>
          <strong>{supplements.length - activeCount}</strong>
          <span className="muted">добавок вне расписания</span>
        </div>
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            className="input"
            aria-label="Поиск добавок"
            placeholder="Найти по названию или бренду"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="filter-group">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <select
            className="select"
            aria-label="Категория"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">Все категории</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state" role="status">
          <span className="spinner" /> Загружаем ваш список…
        </div>
      ) : filtered.length ? (
        <div className="cards-grid">
          {filtered.map((item) => (
            <article className={`supplement-card color-${item.color || 'sage'}`} key={item.id}>
              <div className="card-topline">
                <PillIcon color={item.color} />
                <span className={`tag ${isScheduled(item, date) ? 'tag-success' : 'tag-muted'}`}>
                  {isScheduled(item, date)
                    ? 'Активная'
                    : item.status === 'paused'
                      ? 'На паузе'
                      : item.startDate > date
                        ? 'Начнётся позже'
                        : 'Завершена'}
                </span>
              </div>
              <span className="eyebrow">{categoryLabels[item.category] || 'Добавка'}</span>
              <Link className="card-title-link" to={`/supplements/${item.id}`}>
                <h2>{item.name}</h2>
                <ArrowUpRight size={18} />
              </Link>
              <p className="muted card-brand">{item.brand || 'Бренд не указан'}</p>
              <div className="supplement-meta">
                <span>{item.dose}</span>
                <span>{item.time}</span>
              </div>
              <p className="card-date muted">
                {item.endDate ? `До ${formatDate(item.endDate)}` : 'Без даты окончания'}
              </p>
              <div className="card-actions">
                <button
                  className="button button-ghost"
                  onClick={() => openEditor(item)}
                  aria-label={`Изменить ${item.name}`}
                >
                  <Pencil size={16} /> Изменить
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setActionError('');
                    setDeleting(item);
                  }}
                  aria-label={`Удалить ${item.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Pill}
          title={supplements.length ? 'Ничего не нашлось' : 'Начнём с первой добавки'}
          description={
            supplements.length
              ? 'Попробуйте другое название или измените фильтры.'
              : 'Добавьте название, дозировку и время. VitaminTrack поможет вести ваш собственный план.'
          }
        >
          {supplements.length ? (
            <button
              className="button button-secondary"
              onClick={() => {
                setSearch('');
                setCategory('all');
              }}
            >
              Сбросить фильтры
            </button>
          ) : (
            <button className="button button-primary" onClick={() => openEditor()}>
              <Plus size={18} /> Добавить добавку
            </button>
          )}
        </EmptyState>
      )}

      {editor && (
        <Modal
          title={editor === 'new' ? 'Новая добавка' : 'Изменить добавку'}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <p className="muted modal-description">
            Запишите план, который подходит вам. Дозировку укажите по назначению специалиста или
            инструкции к добавке.
          </p>
          {actionError && (
            <div className="callout callout-error" role="alert">
              {actionError}
            </div>
          )}
          <SupplementForm
            initialValues={editor === 'new' ? undefined : editor}
            onSubmit={save}
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Удалить добавку?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p className="muted">
            «{deleting.name}» исчезнет из вашего расписания. Это действие нельзя отменить.
          </p>
          {actionError && (
            <div className="callout callout-error" role="alert">
              {actionError}
            </div>
          )}
          <div className="form-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Оставить
            </button>
            <button className="button button-danger" disabled={busy} onClick={confirmDelete}>
              {busy ? 'Удаляем…' : 'Удалить добавку'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SupplementsPage;
