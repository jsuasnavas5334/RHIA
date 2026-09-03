# Registro de gate GATE-03

```text
GATE: GATE-03
STATUS: DONE
COMMIT: No creado; publicación bajo control humano.
```

## Alcance del gate (PLAN_MAESTRO.md, sección 25)

"Requiere PH04-PH05. App, auth, Core, runtime, AI gateway y router funcionales. Si falla: no se conecta outreach real."

## Condiciones verificadas (evidencia real, esta sesión y sesiones previas)

| Condición | Evidencia | Resultado |
|---|---|---|
| PH04 completa (App/Auth/Core) | `docs/progress/PH04-T001..T004.md`; gate cifrado del 2026-08-28 en `CLAUDE.md` — Core PostgreSQL 2/2, Operations E2E (Auth cookie → App client → Core policy → PostgreSQL) `PASS`, Better Auth real 4/4 | PASS (heredado, no repetido en esta sesión) |
| PH05-T001 Agent Runtime | `docs/progress/PH05-T001.md`; kill real + recuperación con PostgreSQL real, gate cifrado aprobado 2026-08-28 | PASS (heredado) |
| PH05-T002 AI Gateway | `docs/progress/PH05-T002.md`; 17/17 pruebas, re-verificadas con `typescript@7.0.2` nativo (idéntico al repo) en la sesión de PH05-T004 | PASS |
| PH05-T003 Model Router | `docs/progress/PH05-T003.md`; 8/8 pruebas, re-verificadas con `typescript@7.0.2` nativo | PASS |
| PH05-T004 Benchmark | `docs/progress/PH05-T004.md`; 15/15 pruebas, `router-integration.test.ts` prueba Router+Gateway juntos | PASS |
| **Wiring Runtime ↔ AI Gateway ↔ Model Router** | `apps/agent-runtime/src/ai-gateway-integration.test.ts`; re-verificado con el toolchain real (`npm test`, 11/11) | PASS |
| **E2E real Auth→App→Core→PostgreSQL con el esquema `rhia` migrado** | `scripts/test-operations-e2e.mjs` contra PostgreSQL real — ver "Actualización 2026-09-02 (cierre)" abajo | PASS |

## Actualización de esta sesión (2026-09-01): wiring mínimo cerrado

Se cerró el punto 1 de "qué faltaba" (ver más abajo, versión anterior de este documento): `apps/agent-runtime` ahora sí importa y ejecuta `@rhia/ai-gateway` y `@rhia/model-router` dentro de un job real, no como piezas sueltas.

**Qué se construyó:**
- `apps/agent-runtime/package.json`: se agregaron las dependencias `@rhia/ai-gateway: 0.1.0` y `@rhia/model-router: 0.1.0` (junto a `pg`, que ya existía).
- `apps/agent-runtime/src/ai-gateway-integration.test.ts` (nuevo): dos pruebas que ejecutan un `RuntimePlan` cuyo `step.execute` llama a `ModelRouter.route()` (que internamente llama a `AiGateway.invoke()`), a través de `AgentRuntime.runOnce()` completo (`claim → beginStep → reserveAction → execute → completeStep → finish`).
  1. **Camino feliz**: el router elige el modelo `economy` (openai), el runtime completa el checkpoint con la decisión (`provider`, `model`, `tier`, `explanation`) y termina el job con `SUCCEEDED`. Se verifica que el transporte (fake) se llamó exactamente una vez y que el ledger de presupuesto registró el gasto.
  2. **Camino de fallo controlado**: cuando el budget diario no alcanza para ningún candidato, el router devuelve `chosen: null`, el step lanza un error de dominio (`RHIA_AI_NO_MODEL_AVAILABLE`) y el runtime lo clasifica correctamente como `RETRY_SCHEDULED` (no pierde el job, no revienta el worker) sin haber llamado al transporte real.

**Cómo se validó (mismo protocolo que PH05-T002/T003, sin red):**
- Se armó un harness aislado en el entorno cloud con `typescript@6.0.3` (global, preinstalado) + `@types/node` copiados localmente — sin necesidad de red.
- Se copiaron los archivos REALES existentes del repositorio (`runner.ts`, `store.ts`, `index.ts`, `worker.ts`, `cli.ts`, y sus tests) vía el puente de dispositivo (`device_stage_files`), para tipar contra el contrato real, no una reconstrucción aproximada.
- Se copiaron los `dist/` ya compilados de `@rhia/ai-gateway` y `@rhia/model-router` (verificados en sesiones previas) a `node_modules/@rhia/...` para resolución de tipos cross-package.
- Como `store.ts` importa el paquete npm real `pg` (no instalable sin red), se declaró un stub de tipos ambiental mínimo (`declare module 'pg'` con `Pool`/`PoolClient`/`QueryResult`, cubriendo exactamente el uso real verificado por grep en `store.ts`: `connect()`, `query()`, `release()`, `.rows`, `.rowCount`) — usado **solo para poder tipar el paquete completo en este harness aislado**, no se agrega al repositorio ni reemplaza `@types/pg` (que ya está en `package.json` como devDependency real).
- `tsc -p tsconfig.json --noEmit` sobre el paquete **completo** (todo `apps/agent-runtime/src`, código preexistente + el archivo nuevo): **0 errores**.
- `tsc -p tsconfig.json` (build real) + `node --test dist/*.test.js`: **8/9 passing** — el único test que no corre en este harness es `store.test.ts` (falla con `ERR_MODULE_NOT_FOUND: pg`), porque el harness aislado solo tiene el *stub de tipos* de `pg`, no el paquete real instalado (no hay red en este entorno). Esto es una limitación conocida del harness cloud, no una regresión: `store.test.ts` no fue tocado, ya pasaba antes en el toolchain real del repo (que sí tiene `pg` instalado), y las 2 pruebas nuevas junto con `runner.test.ts` (7 casos) y `worker.test.ts` (2 casos) — 8 en total — pasan en verde.

**Alcance real de esta evidencia (por qué el gate sigue PARTIAL):** esto prueba que el *wiring* de código funciona — el Runtime puede ejecutar un job que use el Router y el Gateway, y maneja tanto el éxito como el fallo del router correctamente — pero corre sobre `FakeStore` (no PostgreSQL real) y `FakeTransport` (no un proveedor de IA real). No sustituye la verificación con infraestructura real (punto 2 de la sección "Qué falta" original, sin cambios: `scripts/test-operations-e2e.mjs` con `RHIA_TEST_DATABASE_URL` real y el toolchain real del repo), que sigue fuera del alcance de esta sesión de Cowork.

## Actualización 2026-09-02: build y test completos del monorepo, con el toolchain real, en verde

El usuario corrió (en su propia terminal de Windows, con Node 24.19.0 y npm 11.17.0 reales — no a través de esta sesión de Cowork, que no tiene forma de ejecutar nada allí) el build y el test completos del monorepo:

```powershell
npm install
npm run build 2>&1 | Out-File -Encoding utf8 build-output.txt
npm test 2>&1 | Out-File -Encoding utf8 test-output.txt
```

Resultado real (archivos leídos directamente del repositorio, no una descripción del usuario):

- **`npm run build`: 0 errores** en todos los workspaces (`domain`, `config`, `contracts`, `policy`, `db`, `ai-gateway`, `model-router`, `benchmarks`, `outreach-policy`, `spike-drizzle`, `auth`, `core-api`, `agent-runtime`, `web`, ...). Esto usa el compilador real fijado por el repo (`typescript@7.0.2` nativo vía `tsc`), no el genérico `6.0.3` usado en las validaciones aisladas de sesiones anteriores.
- **`npm test`: todos los paquetes en verde**, `fail 0` repetido en cada suite (~12 suites de workspace), sin ningún `npm error`. Incluye `apps/agent-runtime`: **11/11 tests**, con las 2 pruebas nuevas de `ai-gateway-integration.test.ts` pasando de verdad contra el código real (no el harness aislado de la sesión anterior): "un job real invoca el router y completa el checkpoint con la decisión" y el camino de fallo controlado (`RHIA_AI_NO_MODEL_AVAILABLE` → `RETRY_SCHEDULED`). Los 2 tests de `store.test.ts` que necesitan PostgreSQL real (`claim concurrente, crash, checkpoint...`, `un proceso terminado a mitad del step...`) salieron `SKIP` porque no había `RHIA_TEST_DATABASE_URL` en ese momento — comportamiento condicional esperado, documentado en el propio test, no una falla.

Esto cierra, con evidencia real, la mitad del punto 2 original ("qué falta"): el toolchain real del repo compila y prueba limpio con todo el trabajo de PH05/GATE-03 incluido — no era solo un harness aislado dando 0 errores, es el `tsc` de verdad del proyecto.

## Actualización 2026-09-02 (cierre): E2E real con PostgreSQL, PASS

Se resolvió el bloqueo de red (puerto de `rhia-postgres` no publicado) levantando un contenedor auxiliar y desechable (`alpine/socat`) conectado a la misma red Docker `rhia_internal`, que solo reenvía el puerto 5432 a `127.0.0.1` en el host — sin modificar, reiniciar ni tocar de ninguna forma el contenedor `rhia-postgres` activo. Se eliminó al terminar.

Al conectar por primera vez aparecieron dos condiciones reales adicionales, ambas esperadas y ambas resueltas de forma aditiva (ningún `DROP`, `TRUNCATE` ni modificación de datos existentes):

1. **El esquema `rhia` no existía en la base `rhia_core` real.** Las migraciones `0001`–`0008` (`packages/db/migrations/`) nunca se habían aplicado contra esta instancia — solo existía el esquema `public` histórico (documentado en `docs/baseline/database.md`, PH01-T002), que no se tocó. Se aplicaron las 8 migraciones (cada una con su `migration_checksum` real, calculado con `sha256sum` del propio archivo, como exige `rhia.schema_migration`) y las 3 semillas (`packages/db/seeds/`), con el usuario `rhia_admin`, en orden, sin errores.
2. **El usuario de aplicación (`rhia_orchestrator`) no tenía permisos sobre el esquema `rhia` recién creado** (los permisos documentados en el baseline solo cubrían `public`). Se otorgó `USAGE` sobre el esquema y `SELECT/INSERT/UPDATE/DELETE` sobre sus tablas (más privilegios por defecto para tablas futuras creadas por `rhia_admin`), replicando el mismo modelo de permisos que ya tenía sobre `public` según `docs/baseline/database.md`.

Con eso, `scripts/test-operations-e2e.mjs` corrió contra el PostgreSQL real (`rhia_core`, vía el puente temporal) y devolvió:

```json
{"status":"PASS","flow":"Auth cookie -> App client -> Core policy -> PostgreSQL","approvalId":"f38d1f72-6343-4f6a-ab88-f847b75070b3"}
```

Es el mismo flujo end-to-end que ya había aprobado PH04 (cookie de Auth → cliente de App → policy de Core → PostgreSQL), ahora reproducido con: Node 24.19.0 y npm 11.17.0 reales, el `tsc` real del repo, el esquema `rhia` real recién migrado, y un `approvalId` real generado por la corrida (`f38d1f72-6343-4f6a-ab88-f847b75070b3`) — no un mock ni un harness aislado.

## Qué se cerró para llegar a DONE

1. ~~Wiring mínimo: agregar un `job_type` en `apps/agent-runtime` que invoque `ModelRouter`/`AiGateway`~~ — cerrado 2026-09-01.
2. ~~Build y test completos del monorepo con el toolchain real~~ — cerrado 2026-09-02: 0 errores, todo verde.
3. ~~E2E real con PostgreSQL~~ — cerrado 2026-09-02: `PASS` real (ver arriba).
4. Opcional, no bloqueante: prueba manual contra un proveedor de IA real con credenciales reales — decisión exclusiva del usuario, fuera del alcance de un gate de plataforma (no lo exige el enunciado del gate: "App, auth, Core, runtime, AI gateway y router funcionales", que ya está cubierto por PH05-T002/T003/T004 más el wiring de esta sesión).

## Decisión

`GATE-03` queda **DONE**. Las cuatro condiciones del enunciado (App, auth, Core, runtime, AI gateway y router funcionales) tienen evidencia real: código, tests unitarios/integración, build/test completos del monorepo con el toolchain real, y ahora el E2E real contra PostgreSQL real con el flujo completo Auth→App→Core→PostgreSQL en `PASS`. Nada de esta evidencia es simulada ni de un harness aislado en su tramo final. El repositorio real de `rhia_core` quedó con el esquema `rhia` migrado y permisos otorgados a `rhia_orchestrator` — un cambio real, aditivo y documentado sobre la infraestructura del usuario, hecho con su participación directa en cada paso (nunca de forma unilateral). Siguiente paso del Run Order: `PH06` (Search, evidencia y resolución de identidad).
