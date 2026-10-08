import express from 'express';

const API_BASE = 'https://api.ods.od.nih.gov/dsld/v9/';
const PAGE_SIZE = 12;
const CACHE_DURATION = 10 * 60 * 1000;
const formNames = {
  E0164: 'Батончики',
  E0159: 'Капсулы',
  E0161: 'Мягкие капсулы',
  E0155: 'Таблетки',
  E0176: 'Жевательные витамины',
  E0165: 'Жидкость',
  E0174: 'Пастилки',
  E0162: 'Порошок',
  E0172: 'Другая форма',
  E0177: 'Форма не указана',
};
const searchAliases = {
  'витамин d': 'Vitamin D',
  'витамин д': 'Vitamin D',
  'витамин d3': 'Vitamin D3',
  'витамин c': 'Vitamin C',
  'витамин с': 'Vitamin C',
  'витамин b12': 'Vitamin B12',
  магний: 'Magnesium',
  кальций: 'Calcium',
  цинк: 'Zinc',
  железо: 'Iron',
  'омега-3': 'Omega-3',
  'омега 3': 'Omega-3',
  омега: 'Omega',
  мультивитамины: 'Multivitamin',
};

class CatalogError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(value, limit = 300) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function safeImageUrl(value) {
  try {
    const url = new URL(text(value, 1500));
    return url.protocol === 'https:' &&
      ['dsld.od.nih.gov', 'api.ods.od.nih.gov', 'dsldapi.od.nih.gov'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function productCategory(label) {
  const code = text(label.productType?.langualCode).toUpperCase();
  if (code === 'A1310') return 'omega';
  if (code === 'A1299') return 'mineral';
  if (['A1302', 'A1316', 'A1315'].includes(code)) return 'vitamin';
  return 'other';
}

function normalizeProduct(label, id) {
  if (!label || typeof label !== 'object' || !text(label.fullName)) {
    throw new CatalogError(503, 'Каталог вернул неполные данные. Попробуйте ещё раз.');
  }
  const category = productCategory(label);
  return {
    id,
    name: text(label.fullName),
    brand: text(label.brandName),
    form:
      formNames[text(label.physicalState?.langualCode).toUpperCase()] ||
      text(label.physicalState?.langualCodeDescription) ||
      'Форма не указана',
    category,
    color: { vitamin: 'sage', mineral: 'apricot', omega: 'blue', other: 'lavender' }[category],
    imageUrl: safeImageUrl(label.thumbnail),
    sourceUrl: `https://dsld.od.nih.gov/label/${id}`,
    labelDate: /^\d{4}-\d{2}-\d{2}$/.test(text(label.entryDate)) ? label.entryDate : null,
  };
}

function positiveInteger(value) {
  return (
    typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
  );
}

export function createCatalogRouter({ fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const router = express.Router();
  const cache = new Map();
  const pending = new Map();

  async function load(url) {
    const key = url.href;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    cache.delete(key);
    if (pending.has(key)) return pending.get(key);

    const request = (async () => {
      try {
        const response = await fetchImpl(url.href, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status === 404) throw new CatalogError(404, 'Этикетка не найдена в каталоге.');
        if (!response.ok)
          throw new CatalogError(503, 'Каталог NIH временно недоступен. Попробуйте позже.');
        const data = await response.json();
        cache.set(key, { data, expiresAt: Date.now() + CACHE_DURATION });
        if (cache.size > 100) cache.delete(cache.keys().next().value);
        return data;
      } catch (error) {
        if (error instanceof CatalogError) throw error;
        if (['AbortError', 'TimeoutError'].includes(error?.name)) {
          throw new CatalogError(504, 'Каталог не ответил вовремя. Попробуйте ещё раз.');
        }
        throw new CatalogError(503, 'Не удалось загрузить каталог NIH. Попробуйте ещё раз.');
      }
    })();
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  }

  router.get('/', async (request, response, next) => {
    let url;
    try {
      if (request.query.q !== undefined && typeof request.query.q !== 'string') {
        throw new CatalogError(400, 'Введите один поисковый запрос.');
      }
      const query = request.query.q?.trim() || 'Vitamin D';
      if (query.length > 120 || [...query].some((character) => character.charCodeAt(0) < 32)) {
        throw new CatalogError(400, 'Поисковый запрос должен содержать не больше 120 символов.');
      }
      url = new URL('search-filter', API_BASE);
      const translated = searchAliases[query.toLowerCase()] || query;
      const upstreamQuery = /^vitamin\s+[a-z]\d*$/i.test(translated)
        ? `"${translated}"`
        : translated;
      url.search = new URLSearchParams({
        q: upstreamQuery,
        from: '0',
        size: String(PAGE_SIZE),
      }).toString();
      const data = await load(url);
      const hits = Array.isArray(data?.hits) ? data.hits : data?.hits?.hits;
      if (!Array.isArray(hits))
        throw new CatalogError(503, 'Каталог вернул неполные данные. Попробуйте ещё раз.');
      const products = hits.map((hit) => {
        const id = String(hit?._id ?? hit?._source?.id ?? '');
        if (!positiveInteger(id))
          throw new CatalogError(503, 'Каталог вернул неполные данные. Попробуйте ещё раз.');
        return normalizeProduct(hit._source, id);
      });
      const rawTotal =
        data.hits?.total?.value ??
        data.hits?.total ??
        data.total?.value ??
        data.total ??
        data.stats?.count;
      const total = Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : products.length;
      response.json({
        products,
        total,
        source: 'NIH DSLD',
        query,
        externalUrl: url.href,
      });
    } catch (error) {
      if (url) cache.delete(url.href);
      next(error);
    }
  });

  router.use((error, _request, response, _next) => {
    response.status(error.status || 503).json({ error: error.message });
  });
  return router;
}
