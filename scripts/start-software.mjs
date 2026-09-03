import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const projectRoot = resolve(import.meta.dirname, '..');
const webRoot = resolve(projectRoot, 'apps', 'web');
const nextBin = resolve(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const url = 'http://127.0.0.1:3000/';

if (!existsSync(nextBin)) {
  process.stderr.write('ERROR: No se encontró el ejecutable local de Next.js.\n');
  process.exit(3);
}

const inspectFrontend = async () => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    const body = await response.text();
    return { online: response.ok, rhia: /RHIA|Revenue Intelligence/i.test(body) };
  } catch {
    return { online: false, rhia: false };
  }
};

const openBrowser = () => {
  if (process.env.RHIA_SOFTWARE_NO_BROWSER === '1') return;
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', 'http://localhost:3000/'], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  browser.unref();
};

const existing = await inspectFrontend();
if (existing.online) {
  if (!existing.rhia) {
    process.stderr.write('ERROR: El puerto 3000 está ocupado por otra aplicación.\n');
    process.exit(4);
  }
  process.stdout.write('RHIA Software ya estaba activo. Abriendo el navegador...\n');
  openBrowser();
  process.exit(0);
}

const frontend = spawn(process.execPath, [nextBin, 'dev', webRoot, '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit',
});

let stopping = false;
const stop = (signal) => {
  if (stopping) return;
  stopping = true;
  if (!frontend.killed) frontend.kill(signal);
};
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

for (let attempt = 0; attempt < 60; attempt += 1) {
  if (frontend.exitCode !== null) break;
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  const state = await inspectFrontend();
  if (state.online && state.rhia) {
    process.stdout.write('\nRHIA Software está listo en http://localhost:3000/\n');
    openBrowser();
    break;
  }
}

const exitCode = await new Promise((resolveExit) => {
  if (frontend.exitCode !== null) resolveExit(frontend.exitCode);
  else frontend.once('exit', (code) => resolveExit(code ?? 1));
});
process.exitCode = exitCode;
