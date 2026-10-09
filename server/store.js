import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const emptyDatabase = () => ({ version: 1, users: [], sessions: [], supplements: [], intakes: [] });

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.ready = this.initialize();
    this.queue = this.ready.catch(() => {});
  }

  async initialize() {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'));
      if (
        this.data.version !== 1 ||
        ['users', 'sessions', 'supplements', 'intakes'].some(
          (key) => !Array.isArray(this.data[key]),
        )
      ) {
        throw new Error('Unsupported database schema');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = emptyDatabase();
      await this.persist(this.data);
    }
  }

  async persist(data) {
    const temporaryFile = `${this.file}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporaryFile, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryFile, this.file);
    } finally {
      if (handle) await handle.close();
      await rm(temporaryFile, { force: true });
    }
  }

  async read() {
    await this.ready;
    await this.queue;
    return structuredClone(this.data);
  }

  async transaction(operation) {
    await this.ready;
    const transaction = this.queue.then(async () => {
      const next = structuredClone(this.data);
      const result = await operation(next);
      await this.persist(next);
      this.data = next;
      return structuredClone(result);
    });

    this.queue = transaction.catch(() => {});
    return transaction;
  }
}
