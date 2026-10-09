import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { JsonStore } from './store.js';

const run = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t) {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'vitamintrack-store-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(basename(directory).startsWith('vitamintrack-store-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return join(directory, 'db.json');
}

test('readiness creates a new database before it can be used', async (t) => {
  const dataFile = await fixture(t);
  const store = new JsonStore(dataFile);
  await store.ready;
  assert.deepEqual(await store.read(), {
    version: 1,
    users: [],
    sessions: [],
    supplements: [],
    intakes: [],
  });
  assert.deepEqual(JSON.parse(await readFile(dataFile, 'utf8')), await store.read());
});

for (const contents of ['{invalid json', '{"version":2}']) {
  test(`invalid database ${contents} is not reset after failed operations`, async (t) => {
    const dataFile = await fixture(t);
    await writeFile(dataFile, contents);
    const store = new JsonStore(dataFile);
    await assert.rejects(store.ready);
    await assert.rejects(store.read());
    let operationCalled = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(
        store.transaction(() => {
          operationCalled = true;
        }),
      );
    }
    assert.equal(operationCalled, false);
    assert.equal(await readFile(dataFile, 'utf8'), contents);
  });
}

test('startup reports a damaged database and exits before listening', async (t) => {
  const dataFile = await fixture(t);
  const contents = '{invalid json';
  await writeFile(dataFile, contents);
  await assert.rejects(
    run(process.execPath, ['server/index.js'], {
      cwd: projectRoot,
      env: { ...process.env, DATA_FILE: dataFile, PORT: '0' },
      timeout: 5000,
      windowsHide: true,
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /не удалось загрузить базу данных/);
      assert.match(error.stderr, /Существующие данные не сбрасывались/);
      assert.ok(!error.stdout.includes('VitaminTrack API:'));
      return true;
    },
  );
  assert.equal(await readFile(dataFile, 'utf8'), contents);
});
