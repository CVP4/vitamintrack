import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Globe2, RefreshCw, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useTracker } from '../context/TrackerContext';
import { BottleArt, CatalogCard } from '../components/CatalogCard';
import { SupplementForm } from '../components/SupplementForm';
import { EmptyState, Modal, PageHeading } from '../components/UI';

const topics = [
  { label: 'Витамин D', query: 'Vitamin D' },
  { label: 'Магний', query: 'Magnesium' },
  { label: 'Омега-3', query: 'Omega 3' },
  { label: 'Витамин C', query: 'Vitamin C' },
  { label: 'Мультивитамины', query: 'Multivitamin' },
];
const productKey = (product) =>
  `${product.name.slice(0, 100).trim().toLocaleLowerCase()}\u0000${(product.brand || '').slice(0, 100).trim().toLocaleLowerCase()}`;

export function CatalogPage() {
  const { supplements, createSupplement } = useTracker();
  const searchForm = useRef(null);
  const [request, setRequest] = useState({ query: 'Vitamin D', revision: 0 });
  const [results, setResults] = useState({ products: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api(`/catalog?${new URLSearchParams({ q: request.query })}`, { signal: controller.signal })
      .then((data) => {
        if (!Array.isArray(data.products)) throw new Error('Не удалось прочитать ответ каталога.');
        if (!controller.signal.aborted) setResults(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);

  function search(query) {
    const nextQuery = query.trim() || 'Vitamin D';
    searchForm.current.elements.search.value = nextQuery;
    setRequest((current) => ({ query: nextQuery, revision: current.revision + 1 }));
  }

  async function save(values) {
    setBusy(true);
    try {
      const supplement = await createSupplement(values);
      setSuccess(supplement.name);
      setEditor(null);
    } finally {
      setBusy(false);
    }
  }

  const existing = new Set(supplements.map(productKey));

  return (
    <>
      <PageHeading
        eyebrow="Найдите и добавьте в свой план"
        title="Каталог добавок"
        description="Названия и бренды — из открытой базы этикеток NIH."
      />
      <section className="catalog-hero panel" aria-labelledby="catalog-hero-title">
        <div className="catalog-hero-copy">
          <span className="catalog-source-badge tag">
            <Globe2 size={14} /> NIH · данные этикеток
          </span>
          <h2 id="catalog-hero-title">Добавки для вашего плана</h2>
          <p>Найдите добавку и перенесите название и бренд в свой план.</p>
          <span className="catalog-hero-hint">
            <Sparkles size={16} /> Ваш план начинается с одного поиска
          </span>
        </div>
        <div className="catalog-hero-art">
          <BottleArt color="sage" />
        </div>
      </section>

      <form
        className="catalog-search toolbar"
        ref={searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          search(String(new FormData(event.currentTarget).get('search') || ''));
        }}
      >
        <label className="search-field">
          <Search size={19} />
          <input
            className="input"
            name="search"
            aria-label="Поиск в каталоге добавок"
            placeholder="Название, бренд или ингредиент"
            defaultValue="Vitamin D"
            maxLength={120}
            type="search"
          />
        </label>
        <button className="button button-primary" type="submit" disabled={loading}>
          <Search size={17} /> Найти добавки
        </button>
      </form>
      <div className="catalog-topics" aria-label="Популярные запросы">
        {topics.map((topic) => (
          <button
            type="button"
            key={topic.query}
            className={`catalog-topic ${request.query === topic.query ? 'active' : ''}`}
            aria-pressed={request.query === topic.query}
            onClick={() => search(topic.query)}
          >
            {topic.label}
          </button>
        ))}
      </div>
      <p className="catalog-language-note muted">
        Ищите по-английски или выберите быстрый запрос. Состав можно посмотреть по ссылке «Состав».
      </p>

      {success && (
        <div className="catalog-success callout" role="status">
          <CheckCircle2 size={20} />
          <span>«{success}» добавлена в ваш план.</span>
          <Link to="/supplements">
            Мои добавки <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {loading ? (
        <div className="loading-state" role="status">
          <span className="spinner" /> Ищем добавки в NIH DSLD…
        </div>
      ) : error ? (
        <EmptyState icon={Globe2} title="Каталог временно недоступен" description={error}>
          <button
            className="button button-primary"
            type="button"
            onClick={() =>
              setRequest((current) => ({ ...current, revision: current.revision + 1 }))
            }
          >
            <RefreshCw size={17} /> Попробовать снова
          </button>
        </EmptyState>
      ) : results.products.length ? (
        <>
          <div className="catalog-results-heading section-label">
            <span>Найдено этикеток: {results.total.toLocaleString('ru-RU')}</span>
            <span className="muted">По запросу «{request.query}»</span>
          </div>
          {results.total > results.products.length && (
            <p className="catalog-language-note muted">
              Показаны первые {results.products.length}. Уточните запрос, чтобы найти нужную
              добавку.
            </p>
          )}
          <div className="catalog-grid cards-grid">
            {results.products.map((product) => (
              <CatalogCard
                key={product.id}
                product={product}
                inPlan={existing.has(productKey(product))}
                onImport={(item) => {
                  setSuccess('');
                  setEditor(item);
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="Добавки не найдены"
          description="Попробуйте короткий запрос на английском, название бренда или быстрый запрос."
        />
      )}

      {editor && (
        <Modal title="Добавить в мой план" onClose={() => !busy && setEditor(null)}>
          <p className="muted modal-description">
            Название и бренд заполнены. Укажите свою дозировку и время ежедневного приёма.
          </p>
          <SupplementForm
            initialValues={{
              name: editor.name.slice(0, 100),
              brand: (editor.brand || '').slice(0, 100),
              category: editor.category || 'other',
              color: editor.color || 'sage',
              notes: `Источник: NIH DSLD\n${editor.sourceUrl}`,
            }}
            onSubmit={save}
            onCancel={() => !busy && setEditor(null)}
          />
        </Modal>
      )}
    </>
  );
}
