import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const projectRoot = resolve(import.meta.dirname, '..');
const port = Number.parseInt(process.env.RHIA_PORT ?? '4173', 10);
const pidFile = resolve(process.env.RHIA_PID_FILE ?? join(projectRoot, '.rhia-server.pid'));
const allowedFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/assets/styles.css', 'assets/styles.css'],
  ['/assets/app.js', 'assets/app.js'],
  ['/data/project-status.json', 'data/project-status.json'],
  ['/data/session-log.json', 'data/session-log.json'],
]);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
]);

const gitCandidates = [
  process.env.RHIA_GIT,
  'C:\\Program Files\\Git\\cmd\\git.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Git', 'cmd', 'git.exe'),
  join(process.env.USERPROFILE ?? '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'native', 'git', 'cmd', 'git.exe'),
].filter(Boolean);
const git = gitCandidates.find((candidate) => existsSync(candidate));

const countFiles = (directory) => {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.rhia-server.pid' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += countFiles(path);
    else if (entry.isFile() && extname(entry.name).toLowerCase() !== '.zip') count += 1;
  }
  return count;
};

const gitText = (...args) => execFileSync(git, ['-C', projectRoot, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
}).trim();

const liveStatus = () => {
  const project = JSON.parse(readFileSync(join(projectRoot, 'data', 'project-status.json'), 'utf8'));
  let branch = 'main';
  let commit = null;
  let changes = [];
  if (git && existsSync(join(projectRoot, '.git'))) {
    try { branch = gitText('branch', '--show-current') || branch; } catch {}
    try { commit = gitText('rev-parse', '--short', 'HEAD') || null; } catch {}
    try {
      changes = gitText('status', '--porcelain=v1').split(/\r?\n/).filter(Boolean).map((line) => ({
        code: line.slice(0, 2).trim(), path: line.slice(3),
      }));
    } catch {}
  }
  return {
    generatedAt: new Date().toISOString(),
    project,
    git: { available: Boolean(git), branch, commit, changes },
    files: { count: countFiles(projectRoot) },
  };
};

const send = (response, statusCode, contentType, body) => {
  response.writeHead(statusCode, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(body);
};

const server = createServer((request, response) => {
  try {
    const path = new URL(request.url ?? '/', `http://localhost:${port}`).pathname;
    if (path === '/health') return send(response, 200, 'application/json; charset=utf-8', '{"status":"ok"}');
    if (path === '/api/status') return send(response, 200, 'application/json; charset=utf-8', JSON.stringify(liveStatus()));
    const relative = allowedFiles.get(path);
    if (!relative) return send(response, 404, 'text/plain; charset=utf-8', 'No encontrado');
    const file = join(projectRoot, relative);
    return send(response, 200, contentTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream', readFileSync(file));
  } catch {
    return send(response, 500, 'application/json; charset=utf-8', '{"error":"RHIA_LOCAL_SERVER_FAILURE"}');
  }
});

const cleanup = () => {
  try {
    if (existsSync(pidFile) && readFileSync(pidFile, 'utf8').trim() === String(process.pid)) unlinkSync(pidFile);
  } catch {}
};

writeFileSync(pidFile, String(process.pid), 'utf8');
server.listen(port, '127.0.0.1');
server.on('error', (error) => {
  cleanup();
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { cleanup(); process.exit(0); }));
process.on('exit', cleanup);
