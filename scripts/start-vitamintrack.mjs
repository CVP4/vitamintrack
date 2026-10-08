import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const appUrl = 'http://127.0.0.1:5173';

export async function inspectRunningApp({ fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const paths = ['/', '/api/health', '/api/auth/me', '/src/pages/SupplementDetailPage.jsx'];
  const responses = await Promise.allSettled(
    paths.map(async (requestPath) => {
      const response = await fetchImpl(`${appUrl}${requestPath}`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }),
  );
  if (responses.some((response) => response.status !== 'fulfilled')) return false;
  const [html, health, session, detailModule] = responses.map((response) => response.value);
  try {
    return (
      html.includes('VitaminTrack') &&
      html.includes('id="root"') &&
      JSON.parse(health).ok === true &&
      Object.hasOwn(JSON.parse(session), 'user') &&
      /export\s+(?:function\s+SupplementDetailPage|\{[^}]*\bSupplementDetailPage\b)/s.test(
        detailModule,
      )
    );
  } catch {
    return false;
  }
}

export function isPortOccupied(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (occupied) => {
      socket.destroy();
      resolve(occupied);
    };
    socket.setTimeout(750);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function openBrowser() {
  const command = process.platform === 'win32' ? 'rundll32.exe' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', appUrl] : [appUrl];
  const browser = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  browser.on('error', () => console.log(`Откройте страницу вручную: ${appUrl}`));
  browser.unref();
}

function runNpm(argumentsList) {
  const nodeDirectory = path.dirname(process.execPath);
  const npmCli = path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (!existsSync(npmCli)) throw new Error(`Не найден npm: ${npmCli}`);
  const child = spawn(process.execPath, [npmCli, ...argumentsList], {
    cwd: projectDirectory,
    stdio: 'inherit',
    env: { ...process.env, PATH: `${nodeDirectory}${path.delimiter}${process.env.PATH || ''}` },
    windowsHide: true,
  });
  const state = { child, finished: false, exitCode: null };
  state.completion = new Promise((resolve, reject) => {
    child.once('error', (error) => {
      state.finished = true;
      reject(error);
    });
    child.once('close', (code) => {
      state.finished = true;
      state.exitCode = code ?? 1;
      resolve(state.exitCode);
    });
  });
  return state;
}

async function stopOwnedServer(state) {
  if (!state || state.finished || !state.child.pid) return;
  if (process.platform !== 'win32') {
    state.child.kill('SIGTERM');
    return;
  }
  await new Promise((resolve) => {
    const stopper = spawn('taskkill.exe', ['/PID', String(state.child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    stopper.once('error', resolve);
    stopper.once('close', resolve);
  });
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function main(args = process.argv.slice(2)) {
  const noOpen = args.includes('--no-open');
  if (args.some((argument) => argument !== '--no-open')) {
    console.error('Доступный параметр: --no-open (запуск без открытия браузера).');
    return 1;
  }
  if (await inspectRunningApp()) {
    console.log(`VitaminTrack уже работает: ${appUrl}`);
    if (!noOpen) openBrowser();
    return 0;
  }
  const occupiedPorts = (await Promise.all([5173, 3001].map(isPortOccupied)))
    .map((occupied, index) => (occupied ? [5173, 3001][index] : null))
    .filter(Boolean);
  if (occupiedPorts.length) {
    console.error(`Не удалось запустить VitaminTrack: заняты порты ${occupiedPorts.join(', ')}.`);
    console.error('Закройте предыдущее окно запуска приложения и запустите его снова.');
    console.error('Если эти порты использует другая программа, сначала освободите их.');
    return 1;
  }

  let server;
  const stop = () => void stopOwnedServer(server);
  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'),
    );
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    if (
      Object.keys(dependencies).some(
        (name) => !existsSync(path.join(projectDirectory, 'node_modules', name, 'package.json')),
      )
    ) {
      console.log('Устанавливаем зависимости VitaminTrack…');
      if ((await runNpm(['ci']).completion) !== 0)
        throw new Error('Не удалось установить зависимости. Проверьте подключение к интернету.');
    }
    console.log('Запускаем VitaminTrack…');
    server = runNpm(['run', 'dev']);

    server.completion.catch(() => {});
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const deadline = Date.now() + 45_000;
    while (!(await inspectRunningApp({ timeoutMs: 1000 }))) {
      if (server.finished) throw new Error('Сервер завершился до открытия страницы.');
      if (Date.now() >= deadline) throw new Error('Сервер не ответил за 45 секунд.');
      await pause(500);
    }
    console.log(`VitaminTrack готов: ${appUrl}`);
    if (!noOpen) openBrowser();
    console.log('Оставьте это окно открытым, пока пользуетесь приложением.');
    return await server.completion;
  } catch (error) {
    await stopOwnedServer(server);
    console.error(`Не удалось запустить VitaminTrack: ${error.message}`);
    return 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
