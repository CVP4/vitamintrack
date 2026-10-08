import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const credentials = {
  name: 'Александра',
  email: 'alex@example.com',
  password: 'secure-password-2026',
};
const supplementInput = {
  name: 'Витамин D3',
  brand: 'Мой бренд',
  category: 'vitamin',
  dose: 'По моему плану: 1 капсула',
  time: '09:00',
  startDate: '2026-10-01',
  endDate: '',
  notes: 'Личная заметка',
  color: 'sage',
  status: 'active',
};

async function fixture(t) {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'vitamintrack-test-'));
  const dataFile = join(directory, 'db.json');
  let server;
  let base;

  async function start() {
    server = createApp({
      dataFile,
      now: () => NOW,
      distDir: join(directory, 'missing-dist'),
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    server.closeAllConnections();
    await new Promise((success, failure) =>
      server.close((error) => (error ? failure(error) : success())),
    );
  }
  await start();
  t.after(async () => {
    await stop();
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(basename(directory).startsWith('vitamintrack-test-'));
    await rm(directory, { recursive: true, force: true });
  });

  return {
    dataFile,
    async restart() {
      await stop();
      await start();
    },
    async request(method, path, body, cookie, headers = {}) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
        headers: response.headers,
      };
    },
  };
}

test('catalog requires an authenticated session', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('GET', '/api/catalog?q=Vitamin%20D')).status, 401);
  assert.equal((await api.request('GET', '/api/catalog/20581')).status, 401);
});

test('a five-field edit preserves previously saved course dates, status, notes and color', async (t) => {
  const api = await fixture(t);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const legacy = {
    ...supplementInput,
    status: 'paused',
    endDate: '2026-12-31',
    notes: 'Старая заметка',
    color: 'lavender',
  };
  const created = await api.request('POST', '/api/supplements', legacy, cookie);
  assert.equal(created.status, 201);
  const updated = await api.request(
    'PATCH',
    `/api/supplements/${created.body.supplement.id}`,
    {
      name: 'Новое название',
      brand: 'Новый бренд',
      category: 'mineral',
      dose: 'Мой план',
      time: '18:00',
    },
    cookie,
  );
  assert.equal(updated.status, 200);
  for (const key of ['startDate', 'endDate', 'status', 'notes', 'color']) {
    assert.equal(updated.body.supplement[key], legacy[key]);
  }
});

test('registration hashes passwords and session tokens; profile, login and logout work', async (t) => {
  const api = await fixture(t);
  assert.deepEqual((await api.request('GET', '/api/auth/me')).body, { user: null });
  const registration = await api.request('POST', '/api/auth/register', {
    ...credentials,
    email: 'Alex@Example.com',
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.email, 'alex@example.com');
  assert.equal(registration.body.user.name, credentials.name);
  assert.equal(registration.body.user.passwordHash, undefined);
  assert.match(registration.headers.get('set-cookie'), /HttpOnly/);
  assert.match(registration.headers.get('set-cookie'), /SameSite=Lax/);
  const cookie = registration.cookie;
  const db = JSON.parse(await readFile(api.dataFile, 'utf8'));
  assert.notEqual(db.users[0].passwordHash, credentials.password);
  assert.equal(db.users[0].passwordHash.length, 128);
  assert.equal(db.users[0].salt.length, 32);
  assert.ok(!JSON.stringify(db).includes(cookie.split('=')[1]));
  assert.equal((await api.request('POST', '/api/auth/register', credentials)).status, 409);
  assert.equal(
    (await api.request('PATCH', '/api/auth/profile', { name: 'Саша' }, cookie)).body.user.name,
    'Саша',
  );
  assert.equal(
    (await api.request('GET', '/api/auth/me', undefined, cookie)).body.user.name,
    'Саша',
  );
  assert.equal(
    (
      await api.request('POST', '/api/auth/login', {
        email: credentials.email,
        password: 'wrong-password',
      })
    ).status,
    401,
  );
  const login = await api.request('POST', '/api/auth/login', credentials, cookie);
  assert.equal(login.status, 200);
  assert.equal(
    (await api.request('GET', '/api/auth/me', undefined, cookie)).body.user,
    null,
    'the previous session is rotated on login',
  );
  await api.request('POST', '/api/auth/logout', undefined, login.cookie);
  assert.equal((await api.request('GET', '/api/auth/me', undefined, login.cookie)).body.user, null);
});

test('private supplement CRUD persists after a new app instance; only allowed fields change', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('GET', '/api/supplements')).status, 401);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const added = await api.request('POST', '/api/supplements', supplementInput, cookie);
  assert.equal(added.status, 201);
  const id = added.body.supplement.id;
  const userId = added.body.supplement.userId;
  const updated = await api.request(
    'PATCH',
    `/api/supplements/${id}`,
    {
      name: 'Моя добавка',
      dose: 'Моя дозировка',
      userId: 'attacker',
      id: 'overwrite',
      createdAt: 'overwrite',
    },
    cookie,
  );
  assert.equal(updated.body.supplement.name, 'Моя добавка');
  assert.equal(updated.body.supplement.id, id);
  assert.equal(updated.body.supplement.userId, userId);
  assert.equal(updated.body.supplement.createdAt, NOW.toISOString());
  await api.restart();
  assert.equal(
    (await api.request('GET', `/api/supplements/${id}`, undefined, cookie)).body.supplement.dose,
    'Моя дозировка',
  );
  assert.equal(
    (await api.request('GET', '/api/supplements', undefined, cookie)).body.supplements.length,
    1,
  );
  assert.equal(
    (await api.request('DELETE', `/api/supplements/${id}`, undefined, cookie)).status,
    200,
  );
  assert.equal((await api.request('GET', `/api/supplements/${id}`, undefined, cookie)).status, 404);
});

test('one user cannot read, edit, delete or mark another user’s supplements or intakes', async (t) => {
  const api = await fixture(t);
  const owner = await api.request('POST', '/api/auth/register', credentials);
  const other = await api.request('POST', '/api/auth/register', {
    ...credentials,
    email: 'other@example.com',
  });
  const added = await api.request('POST', '/api/supplements', supplementInput, owner.cookie);
  const id = added.body.supplement.id;
  const intake = await api.request(
    'POST',
    '/api/intakes',
    { supplementId: id, date: '2026-10-08', time: '09:00' },
    owner.cookie,
  );
  assert.deepEqual(
    (await api.request('GET', '/api/supplements', undefined, other.cookie)).body.supplements,
    [],
  );
  assert.deepEqual(
    (await api.request('GET', '/api/intakes', undefined, other.cookie)).body.intakes,
    [],
  );
  assert.equal(
    (await api.request('GET', `/api/supplements/${id}`, undefined, other.cookie)).status,
    404,
  );
  assert.equal(
    (await api.request('PATCH', `/api/supplements/${id}`, { name: 'Attacker' }, other.cookie))
      .status,
    404,
  );
  assert.equal(
    (await api.request('DELETE', `/api/supplements/${id}`, undefined, other.cookie)).status,
    404,
  );
  assert.equal(
    (
      await api.request(
        'POST',
        '/api/intakes',
        { supplementId: id, date: '2026-10-08', time: '09:00' },
        other.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await api.request('DELETE', `/api/intakes/${intake.body.intake.id}`, undefined, other.cookie))
      .status,
    404,
  );
  assert.equal(
    (await api.request('GET', '/api/intakes', undefined, owner.cookie)).body.intakes.length,
    1,
  );
});

test('parallel intake confirmations are idempotent; snapshots survive edits and removal', async (t) => {
  const api = await fixture(t);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const added = await api.request('POST', '/api/supplements', supplementInput, cookie);
  const id = added.body.supplement.id;
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      api.request(
        'POST',
        '/api/intakes',
        { supplementId: id, date: '2026-10-08', time: '09:00' },
        cookie,
      ),
    ),
  );
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(new Set(results.map((result) => result.body.intake.id)).size, 1);
  await api.request(
    'PATCH',
    `/api/supplements/${id}`,
    { name: 'Новое имя', dose: 'Новая доза', color: 'blue' },
    cookie,
  );
  await api.request('DELETE', `/api/supplements/${id}`, undefined, cookie);
  const intakes = (
    await api.request('GET', '/api/intakes?from=2026-10-08&to=2026-10-08', undefined, cookie)
  ).body.intakes;
  assert.equal(intakes.length, 1);
  assert.equal(intakes[0].name, supplementInput.name);
  assert.equal(intakes[0].dose, supplementInput.dose);
  assert.equal(intakes[0].color, supplementInput.color);
  assert.equal(intakes[0].userId, undefined);
  assert.equal(
    (await api.request('DELETE', `/api/intakes/${intakes[0].id}`, undefined, cookie)).status,
    200,
  );
  assert.deepEqual((await api.request('GET', '/api/intakes', undefined, cookie)).body.intakes, []);
});

test('validation rejects impossible dates, unsupported fields, future dates and paused courses', async (t) => {
  const api = await fixture(t);
  assert.equal(
    (await api.request('POST', '/api/auth/register', { ...credentials, password: 'short' })).status,
    400,
  );
  assert.equal(
    (await api.request('POST', '/api/auth/register', { ...credentials, email: 'invalid' })).status,
    400,
  );
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  for (const invalid of [
    { startDate: '2026-02-30' },
    { time: '25:00' },
    { dose: 10 },
    { endDate: '2026-09-01' },
    { category: 'drug' },
    { color: 'red' },
    { status: 'completed' },
  ]) {
    assert.equal(
      (await api.request('POST', '/api/supplements', { ...supplementInput, ...invalid }, cookie))
        .status,
      400,
    );
  }
  const added = await api.request(
    'POST',
    '/api/supplements',
    { ...supplementInput, endDate: '2026-10-07' },
    cookie,
  );
  const id = added.body.supplement.id;
  const mark = (date, time = '09:00') =>
    api.request('POST', '/api/intakes', { supplementId: id, date, time }, cookie);
  assert.equal((await mark('2026-10-09')).status, 400);
  assert.equal((await mark('2026-09-30')).status, 400);
  assert.equal((await mark('2026-10-08')).status, 400);
  assert.equal((await mark('2026-10-07', '99:99')).status, 400);
  await api.request('PATCH', `/api/supplements/${id}`, { status: 'paused' }, cookie);
  assert.equal((await mark('2026-10-07')).status, 409);
  assert.equal(
    (await api.request('GET', '/api/intakes?from=wrong&to=2026-10-08', undefined, cookie)).status,
    400,
  );
  assert.equal(
    (await api.request('GET', '/api/intakes?from=2026-10-08&to=2026-10-01', undefined, cookie))
      .status,
    400,
  );
  assert.deepEqual((await api.request('GET', '/api/intakes', undefined, cookie)).body.intakes, []);
  const valid = await api.request('POST', '/api/supplements', supplementInput, cookie);
  assert.equal(valid.status, 201, 'invalid transactions do not poison the write queue');
});

test('concurrent supplement writes are serialized without lost updates', async (t) => {
  const api = await fixture(t);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      api.request(
        'POST',
        '/api/supplements',
        { ...supplementInput, name: `Добавка ${index}` },
        cookie,
      ),
    ),
  );
  assert.ok(results.every((result) => result.status === 201));
  await api.restart();
  assert.equal(
    (await api.request('GET', '/api/supplements', undefined, cookie)).body.supplements.length,
    10,
  );
});

test('demo accounts have isolated, saved plans and six days of example history', async (t) => {
  const api = await fixture(t);
  const first = await api.request('POST', '/api/auth/demo');
  const second = await api.request('POST', '/api/auth/demo');
  assert.equal(first.status, 201);
  assert.equal(first.body.user.isDemo, true);
  assert.equal(first.body.user.name, 'Макс');
  assert.equal(second.body.user.name, 'Макс');
  assert.notEqual(first.body.user.id, second.body.user.id);
  const firstPlan = (await api.request('GET', '/api/supplements', undefined, first.cookie)).body
    .supplements;
  const secondPlan = (await api.request('GET', '/api/supplements', undefined, second.cookie)).body
    .supplements;
  assert.equal(firstPlan.length, 4);
  assert.equal(secondPlan.length, 4);
  assert.notEqual(firstPlan[0].id, secondPlan[0].id);
  const history = (await api.request('GET', '/api/intakes', undefined, first.cookie)).body.intakes;
  assert.equal(new Set(history.map((intake) => intake.date)).size, 6);
  assert.ok(history.every((intake) => intake.date < '2026-10-08'));
  await api.request('DELETE', `/api/supplements/${firstPlan[0].id}`, undefined, first.cookie);
  await api.restart();
  assert.equal(
    (await api.request('GET', '/api/supplements', undefined, first.cookie)).body.supplements.length,
    3,
  );
  assert.equal(
    (await api.request('GET', '/api/supplements', undefined, second.cookie)).body.supplements
      .length,
    4,
  );
});

test('session expiry is enforced using the injected clock', async (t) => {
  const api = await fixture(t);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const expiredApp = createApp({
    dataFile: api.dataFile,
    now: () => new Date('2026-10-16T12:00:00Z'),
  }).listen(0, '127.0.0.1');
  await once(expiredApp, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${expiredApp.address().port}/api/auth/me`, {
      headers: { cookie },
    });
    assert.deepEqual(await response.json(), { user: null });
  } finally {
    expiredApp.closeAllConnections();
    await new Promise((resolve) => expiredApp.close(resolve));
  }
});

test('default intake history includes entries older than thirty days', async (t) => {
  const api = await fixture(t);
  const { cookie } = await api.request('POST', '/api/auth/register', credentials);
  const added = await api.request(
    'POST',
    '/api/supplements',
    { ...supplementInput, startDate: '2026-01-01' },
    cookie,
  );
  const result = await api.request(
    'POST',
    '/api/intakes',
    { supplementId: added.body.supplement.id, date: '2026-01-02', time: '09:00' },
    cookie,
  );
  assert.equal(result.status, 201);
  const history = (await api.request('GET', '/api/intakes', undefined, cookie)).body.intakes;
  assert.equal(history.length, 1);
  assert.equal(history[0].date, '2026-01-02');
  assert.deepEqual(
    (await api.request('GET', '/api/intakes?from=2026-10-01', undefined, cookie)).body.intakes,
    [],
  );
});

test('cross-site mutations are rejected while local Vite requests work', async (t) => {
  const api = await fixture(t);
  const rejected = await api.request('POST', '/api/auth/register', credentials, undefined, {
    Origin: 'https://untrusted.example',
  });
  assert.equal(rejected.status, 403);
  assert.equal(
    (
      await api.request('POST', '/api/auth/register', credentials, undefined, {
        Origin: 'http://localhost:5173',
      })
    ).status,
    201,
  );
});
