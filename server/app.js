import express from 'express';
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.js';
import { createCatalogRouter } from './catalog.js';

const scrypt = promisify(scryptCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_COOKIE = 'vitamintrack_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const categories = ['vitamin', 'mineral', 'omega', 'other'];
const colors = ['sage', 'apricot', 'lavender', 'blue'];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const publicUser = ({ id, name, email, createdAt, isDemo = false }) => ({
  id,
  name,
  email,
  createdAt,
  isDemo,
});
const publicIntake = ({ userId: _userId, ...intake }) => intake;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isoDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const offsetDate = (date, days) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

function stringField(value, label, minimum, maximum) {
  if (typeof value !== 'string') throw new ApiError(400, `Поле «${label}» должно быть строкой.`);
  const trimmed = value.trim();
  const hasInvalidControl = [...trimmed].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  });
  if (trimmed.length < minimum || trimmed.length > maximum || hasInvalidControl) {
    throw new ApiError(400, `Поле «${label}»: от ${minimum} до ${maximum} символов.`);
  }
  return trimmed;
}

function emailField(value) {
  const email = stringField(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError(400, 'Укажите корректный email.');
  return email;
}

function passwordField(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128)
    throw new ApiError(400, 'Пароль должен содержать от 8 до 128 символов.');
  return value;
}

function objectBody(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    throw new ApiError(400, 'Ожидается JSON-объект.');
  return req.body;
}

function supplementFields(body, existing, today) {
  const value = existing
    ? { ...existing }
    : {
        brand: '',
        category: 'vitamin',
        time: '09:00',
        startDate: today,
        endDate: '',
        notes: '',
        color: 'sage',
        status: 'active',
      };
  const strings = {
    name: ['Название', 1, 100],
    brand: ['Бренд', 0, 100],
    dose: ['Дозировка', 1, 100],
    notes: ['Заметка', 0, 2000],
  };
  for (const [key, [label, minimum, maximum]] of Object.entries(strings)) {
    if (Object.hasOwn(body, key)) value[key] = stringField(body[key], label, minimum, maximum);
  }
  for (const [key, choices] of Object.entries({
    category: categories,
    color: colors,
    status: ['active', 'paused'],
  })) {
    if (Object.hasOwn(body, key)) {
      if (!choices.includes(body[key]))
        throw new ApiError(400, `Недопустимое значение поля «${key}».`);
      value[key] = body[key];
    }
  }
  if (Object.hasOwn(body, 'time')) value.time = body.time;
  if (!validTime(value.time)) throw new ApiError(400, 'Укажите время в формате ЧЧ:ММ.');
  if (Object.hasOwn(body, 'startDate')) value.startDate = body.startDate;
  if (Object.hasOwn(body, 'endDate')) value.endDate = body.endDate === null ? '' : body.endDate;
  if (!isoDate(value.startDate) || (value.endDate !== '' && !isoDate(value.endDate)))
    throw new ApiError(400, 'Укажите корректную дату в формате ГГГГ-ММ-ДД.');
  if (value.endDate && value.endDate < value.startDate)
    throw new ApiError(400, 'Дата окончания не может быть раньше даты начала.');
  if (!value.name || !value.dose)
    throw new ApiError(400, 'Укажите название и дозировку из вашего плана.');
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = Buffer.from(await scrypt(password, salt, 64)).toString('hex');
  return { salt, passwordHash };
}

async function passwordMatches(password, user) {
  const derived = Buffer.from(await scrypt(password, user.salt, 64));
  const expected = Buffer.from(user.passwordHash, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function createApp({
  dataFile = resolve(root, 'server/data/db.json'),
  now = () => new Date(),
  distDir = resolve(root, 'dist'),
} = {}) {
  const app = express();
  const store = new JsonStore(dataFile);
  const getNow = () => new Date(typeof now === 'function' ? now() : now);
  const today = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(getNow());
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, _res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.headers.origin)
      return next();
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    let isLocalDevelopment = false;
    try {
      const origin = new URL(req.headers.origin);
      isLocalDevelopment =
        process.env.NODE_ENV !== 'production' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) &&
        ['localhost', '127.0.0.1', '::1', '[::1]'].includes(req.hostname) &&
        ['http:', 'https:'].includes(origin.protocol);
    } catch {
      isLocalDevelopment = false;
    }
    if (
      req.headers.origin === expectedOrigin ||
      req.headers.origin === process.env.APP_ORIGIN ||
      isLocalDevelopment
    )
      return next();
    next(new ApiError(403, 'Запрос с этого сайта не разрешён.'));
  });

  function readSessionToken(req) {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (!cookie) return null;
    const token = cookie.slice(SESSION_COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? token : null;
  }

  function setSessionCookie(req, res, token) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
      secure: req.secure || process.env.COOKIE_SECURE === 'true',
    });
  }

  function addSession(db, user, token, previousToken) {
    const timestamp = getNow();
    db.sessions = db.sessions.filter(
      (session) =>
        session.expiresAt > timestamp.toISOString() &&
        (!previousToken || session.tokenHash !== hashToken(previousToken)),
    );
    db.sessions.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      createdAt: timestamp.toISOString(),
      expiresAt: new Date(timestamp.getTime() + SESSION_DURATION).toISOString(),
    });
  }

  async function currentUser(req) {
    const token = readSessionToken(req);
    if (!token) return null;
    const db = await store.read();
    const session = db.sessions.find(
      (item) => item.tokenHash === hashToken(token) && item.expiresAt > getNow().toISOString(),
    );
    return session ? db.users.find((user) => user.id === session.userId) || null : null;
  }

  async function requireUser(req, res, next) {
    try {
      req.user = await currentUser(req);
      if (!req.user) throw new ApiError(401, 'Войдите в аккаунт, чтобы продолжить.');
      next();
    } catch (error) {
      next(error);
    }
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/auth/me', async (req, res) => {
    const user = await currentUser(req);
    res.json({ user: user ? publicUser(user) : null });
  });

  app.post('/api/auth/register', async (req, res) => {
    const body = objectBody(req);
    const name = stringField(body.name, 'Имя', 2, 60);
    const email = emailField(body.email);
    const credentials = await hashPassword(passwordField(body.password));
    const token = randomBytes(32).toString('hex');
    const user = await store.transaction((db) => {
      if (db.users.some((item) => item.email === email))
        throw new ApiError(409, 'Аккаунт с таким email уже существует.');
      const account = {
        id: randomUUID(),
        name,
        email,
        ...credentials,
        createdAt: getNow().toISOString(),
        isDemo: false,
      };
      db.users.push(account);
      addSession(db, account, token, readSessionToken(req));
      return publicUser(account);
    });
    setSessionCookie(req, res, token);
    res.status(201).json({ user });
  });

  app.post('/api/auth/login', async (req, res) => {
    const body = objectBody(req);
    const email = emailField(body.email);
    const password = passwordField(body.password);
    const db = await store.read();
    const user = db.users.find((item) => item.email === email && !item.isDemo);
    if (!user || !(await passwordMatches(password, user)))
      throw new ApiError(401, 'Неверный email или пароль.');
    const token = randomBytes(32).toString('hex');
    await store.transaction((next) => addSession(next, user, token, readSessionToken(req)));
    setSessionCookie(req, res, token);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = readSessionToken(req);
    if (token)
      await store.transaction((db) => {
        db.sessions = db.sessions.filter((item) => item.tokenHash !== hashToken(token));
      });
    res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });

  app.patch('/api/auth/profile', requireUser, async (req, res) => {
    const name = stringField(objectBody(req).name, 'Имя', 2, 60);
    const user = await store.transaction((db) => {
      const account = db.users.find((item) => item.id === req.user.id);
      account.name = name;
      return publicUser(account);
    });
    res.json({ user });
  });

  app.post('/api/auth/demo', async (req, res) => {
    const token = randomBytes(32).toString('hex');
    const user = await store.transaction((db) => {
      const id = randomUUID();
      const account = {
        id,
        name: 'Макс',
        email: `demo-${id}@vitamintrack.local`,
        createdAt: getNow().toISOString(),
        isDemo: true,
      };
      db.users.push(account);
      addSession(db, account, token, readSessionToken(req));
      const templates = [
        {
          name: 'Витамин D3',
          brand: 'NOW Foods',
          category: 'vitamin',
          dose: '1 капсула',
          time: '09:00',
          color: 'sage',
        },
        {
          name: 'Омега-3',
          brand: 'Solgar',
          category: 'omega',
          dose: '1 капсула',
          time: '13:00',
          color: 'apricot',
        },
        {
          name: 'Магний',
          brand: 'Doctor’s Best',
          category: 'mineral',
          dose: '1 таблетка',
          time: '21:00',
          color: 'lavender',
        },
        {
          name: 'Витамин C',
          brand: 'California Gold',
          category: 'vitamin',
          dose: '1 таблетка',
          time: '09:00',
          color: 'blue',
        },
      ];
      const supplements = templates.map((template) => ({
        ...template,
        id: randomUUID(),
        userId: id,
        startDate: offsetDate(today(), -14),
        endDate: '',
        notes: 'Пример личной записи для знакомства с приложением.',
        status: 'active',
        createdAt: getNow().toISOString(),
      }));
      db.supplements.push(...supplements);
      for (let day = 6; day >= 1; day--) {
        for (const [index, supplement] of supplements.entries()) {
          if ((day + index) % 5 === 0) continue;
          db.intakes.push({
            id: randomUUID(),
            userId: id,
            supplementId: supplement.id,
            date: offsetDate(today(), -day),
            time: supplement.time,
            name: supplement.name,
            dose: supplement.dose,
            color: supplement.color,
            createdAt: getNow().toISOString(),
          });
        }
      }
      return publicUser(account);
    });
    setSessionCookie(req, res, token);
    res.status(201).json({ user });
  });

  app.use('/api/supplements', requireUser);
  app.get('/api/supplements', async (req, res) => {
    const db = await store.read();
    res.json({ supplements: db.supplements.filter((item) => item.userId === req.user.id) });
  });

  app.post('/api/supplements', async (req, res) => {
    const fields = supplementFields(objectBody(req), null, today());
    const supplement = await store.transaction((db) => {
      const item = {
        ...fields,
        id: randomUUID(),
        userId: req.user.id,
        createdAt: getNow().toISOString(),
      };
      db.supplements.push(item);
      return item;
    });
    res.status(201).json({ supplement });
  });

  app.get('/api/supplements/:id', async (req, res) => {
    const db = await store.read();
    const supplement = db.supplements.find(
      (item) => item.id === req.params.id && item.userId === req.user.id,
    );
    if (!supplement) throw new ApiError(404, 'Добавка не найдена.');
    res.json({ supplement });
  });

  app.patch('/api/supplements/:id', async (req, res) => {
    const body = objectBody(req);
    const supplement = await store.transaction((db) => {
      const index = db.supplements.findIndex(
        (item) => item.id === req.params.id && item.userId === req.user.id,
      );
      if (index === -1) throw new ApiError(404, 'Добавка не найдена.');
      db.supplements[index] = supplementFields(body, db.supplements[index], today());
      return db.supplements[index];
    });
    res.json({ supplement });
  });

  app.delete('/api/supplements/:id', async (req, res) => {
    await store.transaction((db) => {
      const index = db.supplements.findIndex(
        (item) => item.id === req.params.id && item.userId === req.user.id,
      );
      if (index === -1) throw new ApiError(404, 'Добавка не найдена.');
      db.supplements.splice(index, 1);
    });
    res.json({ ok: true });
  });

  app.use('/api/intakes', requireUser);
  app.get('/api/intakes', async (req, res) => {
    const from = req.query.from === undefined ? '0001-01-01' : req.query.from;
    const to = req.query.to === undefined ? today() : req.query.to;
    if (!isoDate(from) || !isoDate(to) || from > to)
      throw new ApiError(400, 'Укажите корректный диапазон дат.');
    const db = await store.read();
    const intakes = db.intakes
      .filter((item) => item.userId === req.user.id && item.date >= from && item.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time))
      .map(publicIntake);
    res.json({ intakes });
  });

  app.post('/api/intakes', async (req, res) => {
    const body = objectBody(req);
    if (!isoDate(body.date)) throw new ApiError(400, 'Укажите корректную дату приёма.');
    if (body.date > today()) throw new ApiError(400, 'Нельзя отмечать приём в будущем.');
    if (!validTime(body.time)) throw new ApiError(400, 'Укажите время в формате ЧЧ:ММ.');
    const result = await store.transaction((db) => {
      const supplement = db.supplements.find(
        (item) => item.id === body.supplementId && item.userId === req.user.id,
      );
      if (!supplement) throw new ApiError(404, 'Добавка не найдена.');
      const existing = db.intakes.find(
        (item) =>
          item.userId === req.user.id &&
          item.supplementId === supplement.id &&
          item.date === body.date,
      );
      if (existing) return { intake: publicIntake(existing), created: false };
      if (supplement.status !== 'active')
        throw new ApiError(409, 'Сначала возобновите приём этой добавки.');
      if (
        body.date < supplement.startDate ||
        (supplement.endDate && body.date > supplement.endDate)
      )
        throw new ApiError(400, 'Дата приёма находится за пределами курса.');
      const intake = {
        id: randomUUID(),
        userId: req.user.id,
        supplementId: supplement.id,
        date: body.date,
        time: body.time,
        name: supplement.name,
        dose: supplement.dose,
        color: supplement.color,
        createdAt: getNow().toISOString(),
      };
      db.intakes.push(intake);
      return { intake: publicIntake(intake), created: true };
    });
    res.status(result.created ? 201 : 200).json({ intake: result.intake });
  });

  app.delete('/api/intakes/:id', async (req, res) => {
    await store.transaction((db) => {
      const index = db.intakes.findIndex(
        (item) => item.id === req.params.id && item.userId === req.user.id,
      );
      if (index === -1) throw new ApiError(404, 'Запись о приёме не найдена.');
      db.intakes.splice(index, 1);
    });
    res.json({ ok: true });
  });

  app.use('/api/catalog', requireUser, createCatalogRouter());
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API-маршрут не найден.' }));
  if (existsSync(resolve(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(distDir, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Некорректный JSON в запросе.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Слишком большой запрос.' });
    const status = error.status || 500;
    if (status >= 500) console.error('VitaminTrack API:', error);
    res.status(status).json({
      error:
        status >= 500
          ? 'Не удалось сохранить или загрузить данные. Попробуйте ещё раз.'
          : error.message,
    });
  });
  return app;
}
