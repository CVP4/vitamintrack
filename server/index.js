import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const app = createApp({ ...(process.env.DATA_FILE ? { dataFile: process.env.DATA_FILE } : {}) });
try {
  await app.locals.ready;
} catch (error) {
  console.error('VitaminTrack: не удалось загрузить базу данных.', error.message);
  console.error('Проверьте файл базы и права доступа. Существующие данные не сбрасывались.');
  process.exit(1);
}
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`VitaminTrack API: http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
