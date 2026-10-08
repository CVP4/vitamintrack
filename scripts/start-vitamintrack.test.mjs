import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { inspectRunningApp, isPortOccupied } from './start-vitamintrack.mjs';

const responses = {
  '/': '<title>VitaminTrack</title><div id="root"></div>',
  '/api/health': '{"ok":true}',
  '/api/auth/me': '{"user":null}',
  '/src/pages/SupplementDetailPage.jsx': 'export { SupplementDetailPage };',
};
const mockFetch =
  (overrides = {}) =>
  async (url) => ({
    ok: true,
    text: async () => ({ ...responses, ...overrides })[new URL(url).pathname],
  });

test('reuses only the complete VitaminTrack frontend and API', async () => {
  assert.equal(await inspectRunningApp({ fetchImpl: mockFetch() }), true);
  assert.equal(
    await inspectRunningApp({ fetchImpl: mockFetch({ '/': '<title>Another app</title>' }) }),
    false,
  );
  assert.equal(
    await inspectRunningApp({ fetchImpl: mockFetch({ '/api/health': '{"ok":false}' }) }),
    false,
  );
  assert.equal(await inspectRunningApp({ fetchImpl: mockFetch({ '/api/auth/me': '{}' }) }), false);
});

test('rejects a cached empty module before opening the browser', async () => {
  assert.equal(
    await inspectRunningApp({
      fetchImpl: mockFetch({
        '/src/pages/SupplementDetailPage.jsx': '//# sourceMappingURL=data:...',
      }),
    }),
    false,
  );
});

test('handles unavailable servers and invalid API JSON', async () => {
  assert.equal(
    await inspectRunningApp({
      fetchImpl: async () => {
        throw new Error('Connection refused');
      },
    }),
    false,
  );
  assert.equal(
    await inspectRunningApp({ fetchImpl: mockFetch({ '/api/health': '<html>Not an API</html>' }) }),
    false,
  );
});

test('detects an occupied port and a port released after shutdown', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await isPortOccupied(port), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(await isPortOccupied(port), false);
});
