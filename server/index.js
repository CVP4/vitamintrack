import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const app = createApp({ ...(process.env.DATA_FILE ? { dataFile: process.env.DATA_FILE } : {}) });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`VitaminTrack API: http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
