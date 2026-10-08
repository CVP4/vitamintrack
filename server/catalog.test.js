import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createCatalogRouter } from './catalog.js';

const label = {
  fullName: 'Vitamin D Gummy Vitamins',
  brandName: 'Nutrition Now',
  thumbnail: '',
  physicalState: { langualCode: 'E0176' },
  productType: { langualCode: 'A1302' },
  entryDate: '2013-05-24',
};
const searchResult = { hits: [{ _id: '20581', _source: label }], stats: { count: 57114 } };
const jsonResponse = (data) =>
  new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

async function fixture(t, fetchImpl, options = {}) {
  const app = express();
  app.use('/api/catalog', createCatalogRouter({ fetchImpl, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return async (query = '') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/catalog${query}`);
    return { status: response.status, body: await response.json() };
  };
}

test('catalog translates a Russian query and returns label cards without an automatic dose', async (t) => {
  let upstream;
  const api = await fixture(t, async (url, options) => {
    upstream = new URL(url);
    assert.ok(options.signal instanceof AbortSignal);
    return jsonResponse(searchResult);
  });
  const { status, body } = await api('?q=%20%D0%92%D0%B8%D1%82%D0%B0%D0%BC%D0%B8%D0%BD%20D%20');
  assert.equal(status, 200);
  assert.equal(upstream.pathname, '/dsld/v9/search-filter');
  assert.equal(upstream.searchParams.get('q'), '"Vitamin D"');
  assert.equal(upstream.searchParams.get('from'), '0');
  assert.equal(upstream.searchParams.get('size'), '12');
  assert.equal(body.externalUrl, upstream.href);
  assert.equal(body.total, 57114);
  assert.equal(body.query, 'Витамин D');
  assert.equal(body.source, 'NIH DSLD');
  assert.deepEqual(body.products, [
    {
      id: '20581',
      name: label.fullName,
      brand: label.brandName,
      form: 'Жевательные витамины',
      category: 'vitamin',
      color: 'sage',
      imageUrl: null,
      sourceUrl: 'https://dsld.od.nih.gov/label/20581',
      labelDate: '2013-05-24',
    },
  ]);
  assert.equal(body.products[0].dose, undefined);
});

test('empty search defaults to Vitamin D and handles an empty result', async (t) => {
  const api = await fixture(t, async (url) => {
    assert.equal(new URL(url).searchParams.get('q'), '"Vitamin D"');
    return jsonResponse({ hits: [], stats: { count: 0 } });
  });
  const { status, body } = await api('?q=%20');
  assert.equal(status, 200);
  assert.equal(body.query, 'Vitamin D');
  assert.deepEqual(body.products, []);
  assert.equal(body.total, 0);
});

test('cache shares pending requests and repeated searches', async (t) => {
  let calls = 0;
  const api = await fixture(t, async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return jsonResponse(searchResult);
  });
  const results = await Promise.all([api('?q=Vitamin%20D'), api('?q=Vitamin%20D')]);
  assert.ok(results.every((result) => result.status === 200));
  await api();
  assert.equal(calls, 1);
});

test('invalid queries are rejected before contacting NIH', async (t) => {
  let calls = 0;
  const api = await fixture(t, async () => {
    calls++;
    return jsonResponse(searchResult);
  });
  for (const query of [`?q=${'x'.repeat(121)}`, '?q=a&q=b', '?q=a%0Ab']) {
    assert.equal((await api(query)).status, 400);
  }
  assert.equal(calls, 0);
});

test('upstream failures and malformed data can be retried; timeout reports a clear error', async (t) => {
  let calls = 0;
  const api = await fixture(t, async () => {
    calls++;
    if (calls === 1) return new Response('', { status: 503 });
    if (calls === 2) return jsonResponse({ message: 'invalid response' });
    return jsonResponse(searchResult);
  });
  assert.equal((await api()).status, 503);
  assert.equal((await api()).status, 503);
  assert.equal((await api()).status, 200);
  assert.equal(calls, 3);
  const timedOut = await fixture(
    t,
    async (_url, { signal }) => {
      await new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      );
    },
    { timeoutMs: 20 },
  );
  assert.equal((await timedOut()).status, 504);
});

test('label images only accept trusted NIH HTTPS URLs', async (t) => {
  const api = await fixture(t, async (url) =>
    jsonResponse({
      hits: [
        {
          _id: '20581',
          _source: {
            ...label,
            thumbnail:
              new URL(url).searchParams.get('q') === 'trusted'
                ? 'https://dsld.od.nih.gov/example.png'
                : 'https://dsld.od.nih.gov.evil.example/image.png',
          },
        },
      ],
      stats: { count: 1 },
    }),
  );
  assert.equal((await api('?q=unsafe')).body.products[0].imageUrl, null);
  assert.equal(
    (await api('?q=trusted')).body.products[0].imageUrl,
    'https://dsld.od.nih.gov/example.png',
  );
});
