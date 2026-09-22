// PH11-T003 -- Espera activa de dependencias de infraestructura antes de
// arrancar el resto de RHIA (dashboard/frontend). Pensado para ejecutarse
// desde scripts/rhia-boot.ps1 en la PC de produccion de George (ver
// docs/runbooks/deployment-runbook.md).
//
// No asume Docker Compose (ADR-0002: v1 corre sobre contenedores Docker
// individuales ya existentes -- rhia-postgres, rhia-n8n -- no orquestados
// por compose). Este script solo hace polling de red (TCP/HTTP), nunca
// arranca ni detiene contenedores.

import { createConnection } from 'node:net';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

export const DEFAULT_DEPENDENCIES = [
  { name: 'rhia-postgres', kind: 'tcp', host: '127.0.0.1', port: 5432 },
  {
    name: 'rhia-n8n',
    kind: 'http',
    // Asuncion no verificada contra la instancia real (sin acceso de red
    // desde el sandbox/bridge a 127.0.0.1:5678, confirmado en
    // docs/runbooks/disaster-recovery-runbook.md): n8n expone /healthz
    // desde la version usada en produccion. Si el endpoint real difiere,
    // ajustar aqui o via RHIA_N8N_HEALTH_URL.
    url: 'http://127.0.0.1:5678/healthz',
  },
];

export function checkTcp({ host, port, timeoutMs = 1500 }) {
  return new Promise((resolvePromise) => {
    let settled = false;
    const socket = createConnection({ host, port });
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

export async function checkHttp({ url, timeoutMs = 1500 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkDependency(dependency) {
  if (dependency.kind === 'tcp') return checkTcp(dependency);
  if (dependency.kind === 'http') return checkHttp(dependency);
  throw new Error(`Tipo de dependencia desconocido: ${dependency.kind} (${dependency.name})`);
}

function defaultSleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export async function waitForDependency(dependency, options = {}) {
  const {
    retries = 30,
    intervalMs = 2000,
    now = () => Date.now(),
    sleep = defaultSleep,
    check = checkDependency,
  } = options;
  const attempts = [];
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const startedAt = now();
    // eslint-disable-next-line no-await-in-loop
    const ok = await check(dependency);
    attempts.push({ attempt, ok, at: new Date(startedAt).toISOString() });
    if (ok) return { name: dependency.name, ok: true, attempts };
    if (attempt < retries) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(intervalMs);
    }
  }
  return { name: dependency.name, ok: false, attempts };
}

export async function waitForAllDependencies(dependencies, options = {}) {
  const results = [];
  for (const dependency of dependencies) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await waitForDependency(dependency, options));
  }
  return results;
}

export function resolveDependenciesFromEnv(env = process.env) {
  const dependencies = DEFAULT_DEPENDENCIES.map((dependency) => ({ ...dependency }));
  const postgres = dependencies.find((dependency) => dependency.name === 'rhia-postgres');
  if (postgres) {
    if (env.RHIA_POSTGRES_HOST) postgres.host = env.RHIA_POSTGRES_HOST;
    if (env.RHIA_POSTGRES_PORT) postgres.port = Number.parseInt(env.RHIA_POSTGRES_PORT, 10);
  }
  const n8n = dependencies.find((dependency) => dependency.name === 'rhia-n8n');
  if (n8n && env.RHIA_N8N_HEALTH_URL) n8n.url = env.RHIA_N8N_HEALTH_URL;
  return dependencies;
}

async function appendBootLog(entry) {
  const logPath = resolve(new URL('../logs/rhia-boot.ndjson', import.meta.url).pathname);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return logPath;
}

async function main() {
  const dependencies = resolveDependenciesFromEnv();
  const startedAt = new Date().toISOString();
  const results = await waitForAllDependencies(dependencies);
  const allOk = results.every((result) => result.ok);
  const entry = {
    event: 'rhia-boot-dependency-wait',
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: allOk,
    results: results.map((result) => ({
      name: result.name,
      ok: result.ok,
      attempts: result.attempts.length,
      firstAttemptAt: result.attempts[0]?.at ?? null,
      lastAttemptAt: result.attempts.at(-1)?.at ?? null,
    })),
  };
  let logPath = null;
  try {
    logPath = await appendBootLog(entry);
  } catch (error) {
    console.error(`No se pudo escribir el log de boot (${error.message}); continuo sin log.`);
  }
  for (const result of results) {
    console.log(`[rhia-boot] ${result.name}: ${result.ok ? 'OK' : 'TIMEOUT'} (${result.attempts.length} intentos)`);
  }
  if (logPath) console.log(`[rhia-boot] entrada registrada en ${logPath}`);
  if (!allOk) {
    console.error('[rhia-boot] una o mas dependencias no respondieron a tiempo.');
    process.exitCode = 1;
    return;
  }
  console.log('[rhia-boot] todas las dependencias responden. Listo para arrancar el resto de RHIA.');
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
if (isMain) {
  main();
}
