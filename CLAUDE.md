# CLAUDE.md — Handoff maestro de RHIA

## Mandato

Claude asume la construcción de RHIA desde este checkpoint. Trabaja en `C:\Users\jesfu\Desktop\Software RHIA` hasta completar `PLAN_MAESTRO.md`, respetando el DAG, dependencias, Run Order, Quality Gates y restricciones de seguridad.

No interpretes este archivo como sustituto del plan. La precedencia es:

1. Instrucción humana más reciente.
2. `PLAN_MAESTRO.md` para alcance, dependencias, aceptación y gates.
3. `data/project-status.json` para el checkpoint actual.
4. `docs/progress/<TASK-ID>.md` y `data/session-log.json` para evidencia ya producida.
5. Este archivo para procedimiento operativo y contexto de handoff.

Lee únicamente las secciones necesarias del plan para la tarea actual; no reproceses el documento completo en cada ciclo.

## Punto exacto del handoff

```text
Fecha: 2026-08-28 (America/Guayaquil)
Fase actual: PH05 — Runtime de agentes y AI Gateway
Última tarea cerrada: PH05-T001 — Agent Runtime
Siguiente tarea: PH05-T002 — AI Gateway provider-agnostic
Estado: READY
Tareas terminadas: 17/51
Gates terminados: 2/8
Commit/push de estos avances: PENDIENTE DE PUBLICACIÓN HUMANA
```

`PH01`, `PH02`, `PH03` y `PH04` están `DONE`. `PH05-T001` está `DONE`. No reabras tareas cerradas sin evidencia de regresión o drift.

El worktree contiene numerosos cambios legítimos sin commit. No los descartes, reviertas ni reemplaces. Antes de editar ejecuta `git status --short` y trabaja alrededor de cambios ajenos. Nunca uses `git reset --hard`, `git checkout --`, force push ni limpieza destructiva.

## Evidencia más reciente

El gate cifrado completo de plataforma existente aprobó el 2026-08-28:

- Core PostgreSQL real: `2/2`.
- Operations E2E `Auth cookie -> App client -> Core policy -> PostgreSQL`: `PASS`.
- Better Auth real: `4/4`.
- Agent Runtime PostgreSQL: `3/3`.
- La prueba de Agent Runtime mata un proceso durante un step; otro worker recupera `attempt 2` con un único checkpoint y una única action.
- Restore limpio final y conteos legacy: `PASS`.
- Repository baseline: `22` controles, `240` archivos publicables, sin secretos detectados.

Registro detallado: `docs/progress/PH05-T001.md` y sesión `SES-20260828-48` en `data/session-log.json`.

## Arquitectura implementada

- Monorepo npm workspaces, Node `24.19`, TypeScript strict.
- PostgreSQL 18 es la fuente de verdad operacional.
- Drizzle tiene paridad verificada con 52 tablas.
- Core API tenant-aware con contratos, RBAC, policies, idempotencia y auditoría.
- Better Auth separado de `app_user`, cookies estrictas y bootstrap de primer admin.
- Frontend Next.js 16 / React 19:
  - shell, navegación, dashboard y diseño responsive;
  - Operations Center de Jobs y Approvals;
  - datos preview cuando Core/Auth no están configurados;
  - demás módulos todavía presentan estados vacíos.
- Agent Runtime:
  - claim concurrente `FOR UPDATE SKIP LOCKED`;
  - leases y heartbeat;
  - steps/checkpoints persistentes;
  - action/idempotency key estable;
  - retries, backoff y dead-letter;
  - worker CLI y shutdown cooperativo;
  - recuperación comprobada tras kill real.
- n8n sigue siendo orquestador, nunca propietario del estado.

Documentos relevantes:

- `docs/architecture/agent-runtime.md`
- `docs/architecture/operations-center.md`
- `docs/architecture/app-shell.md`
- `docs/architecture/contracts.md`
- `docs/architecture/stack.md`
- `docs/architecture/repository.md`

## Experiencia local visible

- `STAR.BAT`: monitor/bitácora en `http://localhost:4173/`.
- `STARSOFTWARE.BAT`: frontend real en `http://localhost:3000/` con logs visibles.
- `STOP.BAT`: detiene el monitor local.
- `SUBIRALGIT.BAT`: publicación manual validada; no reemplazarla por commits/push automáticos.

El frontend real no debe confundirse con la bitácora. Jobs y Approvals son preview seguro hasta conectar Core/Auth; sus acciones permanecen deshabilitadas.

## Servicios y precaución WSL

Servicios observados activos en WSL/Docker:

- `rhia-postgres`
- `rhia-n8n`
- `rhia-searxng`
- `rhia-ollama`

No reinicies WSL ni estos servicios sin comprobar estado, baseline y backup. En el último gate `/mnt/c` presentó `Input/output error`; se evitó el reinicio montando temporalmente `C:` en `/mnt/rhia-c-recovery`. El montaje fue retirado y los servicios quedaron intactos.

Backup cifrado autorizado para gates:

```text
/mnt/c/Users/jesfu/RHIA-Backups/rhia-postgres-20260820T195344Z
/mnt/c/Users/jesfu/.rhia-secrets/backup-passphrase
```

Nunca copies la passphrase al repositorio, logs, chat o fixtures. Si `/mnt/c` vuelve a fallar y hay servicios activos, usa un montaje alternativo temporal y retíralo al terminar; no reinicies WSL por comodidad.

## Comandos reproducibles

Runtime Node disponible:

```text
C:\Users\jesfu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

npm CLI disponible:

```text
C:\Users\jesfu\.cache\rhia-tools\npm-11.17.0\package\bin\npm-cli.js
```

Ejemplo PowerShell:

```powershell
$node = 'C:\Users\jesfu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$npm = 'C:\Users\jesfu\.cache\rhia-tools\npm-11.17.0\package\bin\npm-cli.js'
$env:Path = (Split-Path -Parent $node) + ';' + $env:Path
& $node $npm run build --workspace=@rhia/agent-runtime
& $node $npm run test --workspace=@rhia/agent-runtime
```

Validaciones de repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-repository-baseline.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-repository-snapshot.ps1
git diff --check
```

Gate cifrado:

```powershell
wsl.exe --cd / env `
  RHIA_BACKUP_BUNDLE=/mnt/c/Users/jesfu/RHIA-Backups/rhia-postgres-20260820T195344Z `
  RHIA_BACKUP_PASSPHRASE_FILE=/mnt/c/Users/jesfu/.rhia-secrets/backup-passphrase `
  RHIA_NODE_BIN=/mnt/c/Users/jesfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe `
  bash '/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/test-domain-migration.sh'
```

No repitas el gate cifrado si no cambió schema, persistencia, Auth/Core/Runtime o el propio gate.

## Siguiente tarea: PH05-T002

Lee `docs/progress/PH05-T002.md` y solo el packet `PH05-T002` de `PLAN_MAESTRO.md`.

Objetivo: unificar OpenAI, Anthropic/Claude, DeepSeek, Qwen y Ollama con un contrato neutral, sin lógica de negocio en adapters.

Orden recomendado:

1. Definir contratos neutrales de request, message, response, structured JSON, tool call, usage, costo, capabilities y error.
2. Definir timeouts, cancelación, retries permitidos y fallback sin duplicar acciones.
3. Crear adapters aislados con transporte inyectable; usar fakes/sandboxes, nunca secretos reales.
4. Normalizar diferencias de features sin fingir capacidades inexistentes.
5. Probar response normalizada, JSON/tool calls, timeout, provider outage y fallback.
6. Registrar decisiones y evidencia; cerrar solo con los criterios del Task Packet.

Después sigue estrictamente:

```text
PH05-T003 -> PH05-T004 -> GATE-03
PH06-T001 -> PH06-T002 -> PH06-T003 -> PH06-T004/PH06-T005
PH07-T001..T005 -> GATE-04
PH08-T001..T005 -> GATE-05
PH09-T001..T004
PH10-T001/PH10-T002/PH11-T001 -> PH10-T003 -> PH10-T004 -> GATE-06
PH11-T002..T004
PH12-T001..T003 -> GATE-07 -> PH12-T004 -> GATE-08
```

La lista normativa completa está en `PLAN_MAESTRO.md`, sección `26. Run Order`.

## Cadencia operativa solicitada

Si Claude se ejecuta de forma programada, usar esta cadencia:

- Un ciclo cada 60 minutos.
- Duración máxima de cada ciclo: 50 minutos.
- Minuto 0: leer `data/project-status.json`, el registro actual y solo el Task Packet necesario; revisar `git status --short`.
- Minutos 1–44: implementar la tarea desbloqueada que más dependencias libere y ejecutar pruebas dirigidas.
- Minuto 45: no iniciar tareas nuevas; llevar el trabajo a checkpoint seguro.
- Antes del minuto 50: actualizar bitácora/estado, ejecutar validación proporcional, publicar informe final y cerrar el proceso.
- La siguiente ejecución reanuda desde el checkpoint persistente.

Reglas de eficiencia:

- Agrupa inspecciones/comandos independientes.
- Reutiliza lockfiles, caches, scripts y evidencia.
- Pruebas dirigidas primero; gate relevante después.
- No reinstales ni reconstruyas sin necesidad.
- Máximo dos intentos equivalentes ante un fallo.
- Si pasan 15 minutos sin cambio, prueba, comando largo activo o decisión verificable, cambia de enfoque.
- Si no existe otra tarea válida, registra el bloqueo y termina el ciclo; no repitas comprobaciones.
- Si detectas otro agente/proceso editando el mismo componente, no dupliques trabajo.

## Registro obligatorio

Por cada ciclo:

1. Actualiza `docs/progress/<TASK-ID>.md`.
2. Actualiza `data/project-status.json` con versión, fecha, fase, tarea y contadores coherentes.
3. Agrega una sesión a `data/session-log.json` con:
   - Task ID y estado;
   - cambios y archivos;
   - pruebas y resultados;
   - evidencia;
   - riesgos;
   - decisiones;
   - siguiente tarea.
4. Ejecuta parseo JSON y `git diff --check`.
5. Ejecuta `scripts/verify-repository-baseline.ps1` antes de entregar cambios materiales.

No declares `DONE` sin evidencia. No falsifiques resultados ni conviertas una prueba omitida en aprobada.

## Restricciones no negociables

Autorizado sin nueva interacción:

- editar código, documentación y tests del proyecto;
- ejecutar inspecciones, builds y pruebas locales;
- hacer refactors reversibles y corregir bugs evidentes;
- usar el backup cifrado ya autorizado conforme al procedimiento existente.

Requiere autorización humana específica:

- borrar datos o realizar cambios irreversibles;
- reiniciar servicios activos sin baseline/backup y revisión de impacto;
- usar secretos o permisos nuevos;
- gastar dinero significativo o invocar proveedores pagos fuera de sandbox;
- desplegar a producción;
- contactar personas/prospectos reales;
- modificar precios, descuentos o condiciones comerciales;
- asumir compromisos legales/comerciales;
- realizar acciones sensibles de seguridad;
- crear commits o hacer push automáticamente.

Ante uno de esos límites, documenta el bloqueo. Continúa con una tarea independiente segura si existe.

## Git y publicación

Remoto esperado:

```text
https://github.com/jsuasnavas5334/RHIA.git
rama main
```

No hagas commit ni push automático. Deja cambios locales para revisión humana y publicación mediante `SUBIRALGIT.BAT`, salvo autorización humana puntual y explícita para una publicación concreta.

## Criterio final de RHIA

No consideres el proyecto terminado hasta satisfacer la sección `31. Definition of Done` de `PLAN_MAESTRO.md`, todos los gates requeridos y la evidencia operativa. El objetivo no es completar archivos: es entregar el flujo comercial gobernado, auditable y recuperable de empresa a reunión, sin comprometer precios, condiciones, privacidad ni seguridad.

## Ajustes operativos añadidos por Claude — 2026-08-28

Estos ajustes son decisiones locales/reversibles (protocolo de cambios, sección 29) y no requieren nueva autorización humana. Quedan documentados aquí para que cada ciclo futuro los reutilice sin volver a investigarlos.

### Hallazgo: build local roto vía puente de dispositivo

`node_modules/typescript` presenta `Input/output error` de forma persistente al ejecutarse a través del puente `device_bash` (probablemente por symlinks/junctions de Windows no resueltos correctamente por el puente FUSE). `npm run build`/`typecheck`/`test` fallan con `Cannot find module '.../node_modules/typescript/bin/tsc'` incluso para paquetes ya `DONE` (`@rhia/domain`, `@rhia/policy`, `@rhia/contracts`). No se tocó `node_modules` local (no se reinstaló ni se borró nada) para no arriesgar el entorno del usuario.

**Corrección 2026-08-28 17:35 (America/Guayaquil):** el workaround "compilar en el workspace cloud" descrito originalmente aquí NO es viable: el contenedor cloud tiene egress bloqueado hacia `registry.npmjs.org` (`403 host_not_allowed`), así que `npm install`/`npm ci` fallan ahí también, y además `typescript@7.0.2` en este repo es el compilador nativo (binario específico de plataforma vía `getExePath.js`, no un script `tsc.js` clásico); el `node_modules/typescript` instalado en Windows no tiene el binario Linux, y aunque lo tuviera no se puede descargar. Es decir: `tsc`/`npm run build`/`typecheck` NO son ejecutables hoy ni en el dispositivo local (I/O error del puente sobre `node_modules/typescript/bin`) ni en el contenedor cloud (sin red de registro). Esto requiere una decisión humana futura: reparar `node_modules` local (`npm install` local reinstalando `typescript`) o habilitar egress al registro npm en el contenedor cloud.

**Corrección 2026-08-29 07:15 UTC — SÍ hay type-check real disponible:** el contenedor cloud trae preinstalado globalmente `typescript@6.0.3` (no la versión nativa 7.0.2 del repo, pero un `tsc` real y moderno) en `/home/claude/.npm-global/lib/node_modules/typescript`, junto con varias copias de `@types/node` bajo paquetes globales (p.ej. `.../ts-node/node_modules/@types/node`). Ninguno de los dos requiere red.

**Workaround real adoptado y validado — type-check real para paquetes aislados:**

1. Para un paquete NUEVO y aislado (sin importar otros `@rhia/*`, como `packages/ai-gateway`): escribir el código en el workspace cloud, copiar `typescript` global y un `@types/node` global a un `node_modules/` local del paquete (`cp -r`, sin red), correr `tsc -p tsconfig.json --noEmit` real (strict, `exactOptionalPropertyTypes`, etc. — las mismas opciones de `tsconfig.base.json`) y `node --test dist/**/*.test.js` tras compilar. Esto SÍ es type-check real, no solo runtime.
2. Empaquetar el paquete terminado (`package.json`, `tsconfig.json`, `src/`, nunca `node_modules`/`dist`) en un único `.tar.gz`, entregarlo con `SendUserFile` y escribirlo con `device_commit_files` dentro de `.rhia-cloud-sync/` en la carpeta del usuario; luego extraerlo con `device_bash` (`tar -xzf .rhia-cloud-sync/<paquete>.tar.gz -C packages/<paquete>`) — evita subir archivo por archivo y evita el I/O error de `node_modules` porque nunca tocamos `node_modules` reales del repo.
3. Para un paquete que SÍ depende de otros `@rhia/*` (cross-package), este truco no alcanza sin más: se necesitaría copiar también los `dist/` ya compilados de esos paquetes o sus tipos. Evalúa caso por caso; si no es viable, cae al fallback de `node --experimental-strip-types` (valida solo runtime, no tipos) y dilo explícito en `docs/progress/<TASK-ID>.md`.
4. Revisa siempre que `tsconfig.json` del paquete nuevo apunte a `../../tsconfig.base.json` (dos niveles, como `packages/domain`) antes de darlo por bueno — es un error fácil de copiar mal desde un directorio de prueba.
5. Cuando el toolchain real del repo (`typescript@7.0.2` nativo) se repare (local o con red habilitada en cloud), corre la suite real del monorepo (`npm run build`/`test` en la raíz) al menos una vez para confirmar paridad antes de confiar solo en este workaround para tareas nuevas.

**Corrección 2026-09-03 — hay un camino MEJOR cuando la carpeta del repo está conectada directamente a Cowork (Read/Write/Edit/Grep/Glob + `mcp__workspace__bash` sobre el mismo árbol, sin bridge `device_bash`):** el sandbox de `mcp__workspace__bash` de ese tipo de sesión trae preinstalado un TypeScript nativo real, misma versión que el repo (`7.0.2`), en `/usr/local/lib/node_modules_global/bin/tsc` (con `@typescript/typescript-linux-x64` ya resuelto). Ese `tsc` SÍ compila y prueba el árbol real del repo directamente — `tsc -p apps/<paquete>/tsconfig.json --noEmit` usando el `tsconfig.base.json` real, sin copiar nada a un directorio aislado — para cualquier paquete cuyos symlinks en `node_modules/@rhia/*` no den `Input/output error` (verificar con `ls -la node_modules/@rhia/`; a la fecha, `contracts`, `db`, `domain`, `policy`, `outreach-policy`, `search-health`, `core-api` funcionan, `agent-runtime`/`ai-gateway`/`auth`/`benchmarks`/`model-router`/`web` no). Si un paquete nuevo del workspace todavía no tiene symlink (porque nadie corrió `npm install` desde que se agregó), se puede crear a mano exactamente el symlink que `npm install` habría creado (`ln -s ../../packages/<paquete> node_modules/@rhia/<paquete>`; `node_modules/` está en `.gitignore`, cero impacto en el repo) en vez de empaquetar `.tar.gz` con `SendUserFile`/`device_commit_files`. Ver `docs/progress/PH06-T001.md` (sección de cierre 2026-09-03) para un ejemplo real end-to-end (build + 27 tests reales en verde). El workaround de los pasos 1-5 arriba sigue siendo válido para sesiones que SÍ dependen del bridge `device_bash` (sin carpeta conectada); para sesiones con carpeta conectada, preferir el `tsc` global.

### Decisión: ubicación del AI Gateway

`PLAN_MAESTRO.md` (packet PH05-T002) indica solo `ai/providers` como área afectada, sin workspace previo. Se crea `packages/ai-gateway` como nuevo workspace npm, hermano de `packages/domain`, `packages/policy`, `packages/contracts`, `packages/db` — consistente con el patrón ya establecido del monorepo y reutilizable sin acoplarse a `apps/agent-runtime` por `PH05-T003` (router) y `PH09` (tools).

### Programación horaria

La continuidad autónoma de RHIA con Claude corre como scheduled task (trigger `trig_01QjozwhTV7Npxv58NzWvNXh`, "RHIA — Ciclo autónomo horario (PLAN_MAESTRO)") horaria, siguiendo la cadencia ya documentada arriba (ciclo cada 60 min, máx. 50 min de trabajo, checkpoint al minuto 45). Cada disparo es una sesión nueva sin memoria de sesiones previas: por eso este archivo, `data/project-status.json`, `docs/progress/<TASK-ID>.md` y `data/session-log.json` son la única fuente de continuidad real.

**RESUELTO (2026-09-03):** el bloqueo original de 2026-08-29 (`not_bound: no_signed_approval`, sin acceso a la carpeta vía `device_bash`) se resolvió de otra forma: el usuario conectó la carpeta `C:\Users\jesfu\Desktop\Software RHIA` directamente a Cowork (`mcp__cowork__request_cowork_directory`), lo que da acceso de archivos vía `Read`/`Write`/`Edit`/`Grep`/`Glob` y vía `mcp__workspace__bash` (bajo `/sessions/<session>/mnt/Software RHIA`) sin necesitar el bridge `device_bash`/`device_list_dir`/`device_stage_files`/`device_commit_files`/`SendUserFile` en absoluto — esas herramientas ya no existen en este tipo de sesión y el prompt de la tarea programada (`rhia--ciclo-autnomo-horario-plan_maestro`) se actualizó para reflejarlo. Si un ciclo futuro detecta que la carpeta NO está conectada (p. ej. `request_cowork_directory` falla o Read/Write no encuentran el repo), debe registrarlo como bloqueo nuevo (no asumir que es el mismo bloqueo de 2026-08-29) y terminar el ciclo.

Si el ciclo encuentra un bloqueo que exige autorización humana (protocolo de cambios, sección 29: irreversible, gasto relevante, producción, secretos/permisos nuevos, compromiso legal/comercial, riesgo de seguridad alto), debe: (1) documentar el bloqueo en `docs/progress/<TASK-ID>.md` y `session-log.json`, (2) dejar el checkpoint seguro, y (3) terminar el informe final de forma explícita como bloqueo — el mecanismo de notificación por email de la tarea programada se activa sobre resúmenes de cierre "noteworthy", así que un cierre de ciclo que documente un bloqueo real debe quedar redactado con esa palabra o claridad equivalente ("BLOQUEO:", "requiere autorización humana") para que se note. El usuario revisa el estado manualmente a diario además del correo.
