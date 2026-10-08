import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { createServer } from 'vite';

test('Vite keeps component exports while an editor is completing a file save', async () => {
  const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const temporaryRoot = join(projectDirectory, '.qa');
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(join(temporaryRoot, 'vitamintrack-watch-'));
  const fixtureFile = join(directory, 'Sample.jsx');
  let server;
  try {
    await writeFile(fixtureFile, 'export function Sample() { return <div>Original</div>; }');
    server = await createServer({
      configFile: join(projectDirectory, 'vite.config.js'),
      root: directory,
      logLevel: 'silent',
      server: { port: 0, strictPort: false, host: '127.0.0.1' },
    });
    await server.listen();
    const port = server.httpServer.address().port;
    const readModule = async () => {
      const response = await fetch(`http://127.0.0.1:${port}/Sample.jsx`);
      const content = await response.text();
      assert.equal(response.status, 200, content.slice(0, 1000));
      return content;
    };
    assert.match(await readModule(), /Original/);

    await writeFile(fixtureFile, '');
    await delay(100);
    assert.match(await readModule(), /export[\s\S]*Sample/);
    await writeFile(fixtureFile, 'export function Sample() { return <div>Updated</div>; }');
    let updated = '';
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(100);
      updated = await readModule();
      if (updated.includes('Updated')) break;
    }
    assert.match(updated, /Updated/);
    assert.match(updated, /export[\s\S]*Sample/);
  } finally {
    if (server) await server.close();
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(basename(directory).startsWith('vitamintrack-watch-'));
    await rm(directory, { recursive: true, force: true });
  }
});
