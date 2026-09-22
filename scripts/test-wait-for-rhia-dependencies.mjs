import assert from 'node:assert/strict';
import {
  DEFAULT_DEPENDENCIES,
  waitForDependency,
  waitForAllDependencies,
  resolveDependenciesFromEnv,
} from './wait-for-rhia-dependencies.mjs';

// 1. Exito inmediato: check() responde true en el primer intento, no debe
//    dormir ni reintentar.
{
  let checkCalls = 0;
  let sleepCalls = 0;
  const result = await waitForDependency(
    { name: 'dep-a', kind: 'tcp', host: 'x', port: 1 },
    {
      retries: 5,
      check: async () => { checkCalls += 1; return true; },
      sleep: async () => { sleepCalls += 1; },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.attempts.length, 1);
  assert.equal(checkCalls, 1);
  assert.equal(sleepCalls, 0, 'no debe dormir tras un exito inmediato');
}

// 2. Recuperacion tras fallos: falla 2 veces, responde al 3er intento.
{
  let attempt = 0;
  let sleepCalls = 0;
  const result = await waitForDependency(
    { name: 'dep-b', kind: 'tcp', host: 'x', port: 1 },
    {
      retries: 10,
      check: async () => { attempt += 1; return attempt >= 3; },
      sleep: async () => { sleepCalls += 1; },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.attempts.length, 3);
  assert.deepEqual(result.attempts.map((entry) => entry.ok), [false, false, true]);
  assert.equal(sleepCalls, 2, 'debe dormir exactamente entre intentos fallidos, nunca despues del ultimo');
}

// 3. Timeout real: nunca responde true dentro del limite de reintentos ->
//    ok=false, sin colgarse (retries acotados).
{
  let sleepCalls = 0;
  const result = await waitForDependency(
    { name: 'dep-c', kind: 'tcp', host: 'x', port: 1 },
    {
      retries: 4,
      check: async () => false,
      sleep: async () => { sleepCalls += 1; },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 4);
  assert.equal(sleepCalls, 3, 'se duerme entre intentos pero no despues del ultimo intento fallido');
}

// 4. waitForAllDependencies agrega resultados de varias dependencias
//    independientes (una ok, otra timeout) sin abortar la primera al
//    fallar la segunda.
{
  const dependencies = [
    { name: 'dep-ok', kind: 'tcp', host: 'x', port: 1 },
    { name: 'dep-fail', kind: 'http', url: 'http://x' },
  ];
  const results = await waitForAllDependencies(dependencies, {
    retries: 2,
    sleep: async () => {},
    check: async (dependency) => dependency.name === 'dep-ok',
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
}

// 5. checkDependency real: kind desconocido lanza error explicito (evita
//    fallos silenciosos si se agrega una dependencia mal configurada).
{
  const { checkDependency } = await import('./wait-for-rhia-dependencies.mjs');
  await assert.rejects(
    () => checkDependency({ name: 'dep-bad', kind: 'carrier-pigeon' }),
    /Tipo de dependencia desconocido/,
  );
}

// 6. DEFAULT_DEPENDENCIES real: exactamente rhia-postgres (tcp/5432) y
//    rhia-n8n (http, URL con /healthz), coincide con los puertos
//    documentados en docs/runbooks/disaster-recovery-runbook.md.
{
  assert.equal(DEFAULT_DEPENDENCIES.length, 2);
  const postgres = DEFAULT_DEPENDENCIES.find((d) => d.name === 'rhia-postgres');
  const n8n = DEFAULT_DEPENDENCIES.find((d) => d.name === 'rhia-n8n');
  assert.equal(postgres.kind, 'tcp');
  assert.equal(postgres.port, 5432);
  assert.equal(n8n.kind, 'http');
  assert.equal(n8n.url, 'http://127.0.0.1:5678/healthz');
}

// 7. resolveDependenciesFromEnv: overrides reales via variables de
//    entorno, sin mutar DEFAULT_DEPENDENCIES.
{
  const env = {
    RHIA_POSTGRES_HOST: '10.0.0.5',
    RHIA_POSTGRES_PORT: '55432',
    RHIA_N8N_HEALTH_URL: 'http://10.0.0.5:5678/custom-health',
  };
  const dependencies = resolveDependenciesFromEnv(env);
  const postgres = dependencies.find((d) => d.name === 'rhia-postgres');
  const n8n = dependencies.find((d) => d.name === 'rhia-n8n');
  assert.equal(postgres.host, '10.0.0.5');
  assert.equal(postgres.port, 55432);
  assert.equal(n8n.url, 'http://10.0.0.5:5678/custom-health');
  assert.equal(DEFAULT_DEPENDENCIES.find((d) => d.name === 'rhia-postgres').host, '127.0.0.1', 'no debe mutar el default compartido');
}

// 8. checkTcp real (no mockeado): conexion real contra un servidor TCP
//    efimero en localhost debe resolver true; contra un puerto cerrado
//    real debe resolver false. Esta es la unica seccion con I/O de red
//    real (loopback), para probar la implementacion real de checkTcp, no
//    solo el mock.
{
  const net = await import('node:net');
  const { checkTcp } = await import('./wait-for-rhia-dependencies.mjs');
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const { port } = server.address();
  const okResult = await checkTcp({ host: '127.0.0.1', port, timeoutMs: 1000 });
  assert.equal(okResult, true);
  await new Promise((resolvePromise) => server.close(resolvePromise));
  const closedResult = await checkTcp({ host: '127.0.0.1', port, timeoutMs: 300 });
  assert.equal(closedResult, false, 'un puerto cerrado real debe resolver false, nunca colgarse');
}

console.log('wait-for-rhia-dependencies: 8/8 bloques de prueba reales pasaron.');
