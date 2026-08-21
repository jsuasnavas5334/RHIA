# Registro de cambios de RHIA

Este archivo documenta las entregas visibles y verificables del proyecto. La fuente de verdad de ejecución continúa siendo `PLAN_MAESTRO.md`.

## 1.0.24-monitor — 2026-08-21

### Intento de publicación autorizado

- El usuario autorizó el commit `Baseline inicial RHIA` y push sin force a `origin/main`.
- Se reconfirmaron 161 archivos publicables, la rama `main` y el remoto esperado.
- La identidad prevista usa el noreply de GitHub y no expone correo personal.

### Bloqueo verificable

- El entorno denegó la creación de `.git/config` y `.git/index.lock`; no existe commit nuevo.
- La conexión a `github.com:443` está bloqueada; no se consultó ni modificó el remoto.
- `PH02-T001` y `GATE-02` permanecen abiertos hasta verificar commit, push y clone limpio.

## 1.0.23-monitor — 2026-08-21

### Completado

- `PH03-T003`: OutreachPolicy v1 con timezone, quiet hours, stop/suppression, idempotencia y override aprobado.
- Persistencia versionada `DRAFT`, suppression hash-only y tenant guard.
- Drizzle actualizado a 45 tablas.

### Pruebas

- 6/6 tests dirigidos y simulación de 100/100 secuencias aprobados.
- Cuatro migrations, seeds dobles, constraints y segundo restore limpio aprobados.

### Bloqueo

- `GATE-02` espera el primer commit/push y clone limpio de `PH02-T001`.
- La restricción prohíbe commit/push automáticos; no se inicia `PH04` fuera del DAG.

## 1.0.22-monitor — 2026-08-21

### Completado

- `PH03-T002`: RBAC humano y capability ceilings para Agent, n8n y Worker Service.
- Seed idempotente con 17 permisos, 4 roles, 40 grants, 8 capabilities y 18 grants de servicio.
- Tenant guards PostgreSQL para roles, approvals y autoelevación de capabilities.

### Pruebas

- 8/8 pruebas TypeScript aprobadas.
- Cross-tenant role/approval y capability prohibida rechazados en PostgreSQL temporal.
- Tres migrations, seeds dobles, conteos legacy y restore limpio aprobados.

### Estado

- `PH03-T003` pasa a ser la tarea activa.
- No se modificó la base activa ni se creó commit/push.

## 1.0.21-monitor — 2026-08-21

### Corregido

- `STAR.BAT` ya no depende de `HttpListener`, incompatible con el runtime disponible.
- Nuevo servidor Node local sin dependencias para `/`, `/health` y `/api/status`.
- Control Center nuevamente disponible en `http://localhost:4173/`.

### Avance

- `PH03-T002`: evaluador RBAC/capabilities con mínimo privilegio y approval humano separado.
- 7/7 pruebas de autorización aprobadas; seed PostgreSQL queda en el siguiente checkpoint.

## 1.0.20-monitor — 2026-08-21

### Completado

- `PH03-T004`: máquinas de estado únicas para jobs, evidence, opportunities, messages y meetings.
- Catálogo cerrado de 18 errores con categoría, retry y terminalidad explícitos.
- Migration aditiva `0002_state_taxonomy` con restricciones PostgreSQL contra strings libres.

### Pruebas

- Dominio: 5/5 tests y typecheck aprobados.
- Contratos: 8/8 tests y typecheck aprobados.
- Backup aislado: ambas migrations, seed, constraints, conteos legacy y segundo restore limpio aprobados.

### Estado

- `PH03-T002` pasa a ser la tarea activa y desbloqueará `PH03-T003`.
- No se modificó la base activa ni se creó commit/push.

## 1.0.19-monitor — 2026-08-21

### Completado

- `PH03-T001`: migration aditiva del dominio v1 verificada desde el backup cifrado baseline.
- Seed mínimo idempotente, constraints, índices y rollback mediante segundo restore limpio.
- Mapping Drizzle y typecheck Linux para las 43 tablas.

### Resultados

- Conteos de las ocho tablas legacy permanecieron idénticos antes y después de la migration.
- Constraints de país ISO2, máximo de toques, idempotencia y evidence obligatorio rechazaron casos inválidos.
- Diez índices críticos presentes y cero recursos Docker temporales restantes.

### Estado

- `PH03-T004` pasa a ser la tarea activa; `PH03-T002` queda disponible en paralelo.
- No se modificó la base activa ni se creó commit/push.

## 1.0.18-monitor — 2026-08-21

### Añadido

- Generador reproducible de schema Drizzle desde la migration SQL del dominio.
- Mapping runtime y manifest de las 43 tablas de `rhia`.
- Prueba de paridad entre migration, manifest y columnas Drizzle.

### Estado

- `PH03-T001` continúa parcial únicamente por las pruebas PostgreSQL/restore que requieren WSL/Docker.
- El segundo intento WSL volvió a fallar con `E_ACCESSDENIED`; no se repitió.

### Pruebas

- 43/43 tablas y todas sus columnas coinciden.
- Schema Drizzle cargó correctamente con Node 24.19.
- Dos generaciones consecutivas produjeron hashes idénticos.

## 1.0.17-monitor — 2026-08-21

### Añadido

- Primera migration aditiva del dominio v1 en un schema `rhia` separado.
- Seed mínimo inactivo y registro de checksum.
- Mapeo explícito de las ocho tablas legacy y test de migration sobre backup/restore.

### Estado

- `PH03-T001` queda en progreso: el SQL y las guardas estáticas están listos.
- La ejecución PostgreSQL 18 queda pendiente porque WSL fue bloqueado por permisos de la sesión antes de iniciar Docker.

### Validación

- 43 tablas, 27 índices, 68 referencias y 41 constraints detectados.
- Cero operaciones destructivas y cero escrituras a `public.*`.
- Cobertura ISO2: 5/5 campos de país/mercado.

## 1.0.16-monitor — 2026-08-20

### Añadido

- Paquete `@rhia/config` con settings v1, defaults seguros, JSON Schema y preview redactado.
- Configuración operativa de mercados, cadencias, scoring, budgets, providers y runtime sin editar workflows.
- Clasificación explícita de hot reload, restart de worker e infraestructura fuera de la UI.

### Estado

- `PH02-T004` quedó completada; PH03-T001/PH03-T004 quedan preparadas como siguiente paso del Run Order.
- `PH02-T001` permanece parcial únicamente hasta la primera publicación humana y clone limpio.

### Pruebas

- Typecheck/build aprobados y 8/8 validation tests verdes.
- Inputs inválidos y campos de secreto se rechazan sin reflejar valores.
- El preview redacta credentialRef y señala correctamente los cambios que requieren restart.

## 1.0.15-monitor — 2026-08-20

### Añadido

- Paquete `@rhia/contracts` con once contratos estrictos y versionados Core ↔ n8n ↔ Worker.
- JSON Schemas draft 2020-12 y once ejemplos sintéticos reproducibles.
- Documentación de callbacks, idempotencia, versionado y taxonomía retryable/non-retryable.

### Estado

- `PH02-T003` quedó completada y `PH02-T004` pasa a ser la tarea activa.
- Los nombres legacy de n8n quedaron mapeados en bordes, sin adoptarlos como payloads internos libres.

### Pruebas

- Typecheck, build y 7/7 contract tests aprobados.
- 11/11 ejemplos y 11/11 documentos JSON válidos.
- Cero nombres de campos sensibles y cero vulnerabilidades npm de producción.

## 1.0.14-monitor — 2026-08-20

### Añadido

- Política y estructura del repositorio fuente documentadas.
- Verificador preventivo de archivos sensibles, remoto, rama, estructura y datos del monitor.
- Prueba de snapshot publicable con instalación exacta, build y boot temporal.

### Estado

- `PH02-T001` queda parcial únicamente por falta del primer commit humano, clone limpio y SHA baseline.
- `PH02-T003` pasa a ser la tarea activa porque sus dependencias están completas.

### Pruebas

- 22 controles de repositorio aprobaron sobre 78 archivos publicables.
- Snapshot aislado aprobó `npm ci`, typecheck, build, `/health` y `/api/status`.
- El Control Center activo no fue reiniciado ni interrumpido.

## 1.0.13-monitor — 2026-08-20

### Añadido

- Stack RHIA v1 congelado con ADR, convenciones y configuración TypeScript/npm reproducible.
- Spike Prisma/Drizzle con SQL guardado y dry-run independiente en PostgreSQL 18.
- Prueba automatizada de equivalencia del catálogo generado por ambos candidatos.

### Estado

- `PH02-T002` quedó completada con typecheck, build y migration dry-run aprobados.
- Drizzle fue elegido para persistencia y Prisma retirado de las dependencias instaladas.
- `PH02-T001` pasa a ser la tarea activa, sin crear commits ni realizar push.

### Riesgo controlado

- Producción tiene 0 vulnerabilidades reportadas; quedan 4 moderadas transitivas en tooling de desarrollo. No se fuerza un downgrade breaking.

## 1.0.12-monitor — 2026-08-20

### Añadido

- Dataset de cuatro casos comerciales reproducibles con expected results explícitos.
- Runner aislado que reutiliza tres nodos Code actuales sin red, credenciales ni bases activas.
- Verificador reproducible de `GATE-01` para tareas PH01, exports n8n y backup externo.

### Estado

- `PH01-T004` quedó completada: 4/4 casos aprobaron dos ejecuciones equivalentes.
- `GATE-01` quedó aprobado con las cuatro tareas de baseline en `DONE`.
- PH02 queda desbloqueada; `PH02-T002` inicia como tarea activa y `PH02-T001` permanece disponible en paralelo.

### Deuda registrada

- El parser observado reporta 0 dominios para 20 URLs en el fixture degradado.
- Las consultas vacías con motores bloqueados todavía indican reformular en lugar de backoff/fallback.

## 1.0.11-monitor — 2026-08-20

### Añadido

- Primer backup completo y cifrado de `rhia_core` y n8n fuera del repositorio.
- Custodia de passphrase mediante ACL privada de Windows.
- Restore PostgreSQL 18 aislado con integridad y comparación completa de conteos.

### Mejorado

- Compatibilidad segura de los scripts con passphrases protegidas por ACL en unidades Windows montadas en WSL.
- Validación completa del cifrado antes de inspeccionar la estructura del archive `pg_dump`.
- Limpieza estricta de artefactos parciales cuando falla la construcción del bundle.

### Estado

- `PH01-T002` quedó completada: 133/133 tablas restauradas con conteos idénticos.
- `PH01-T004` quedó desbloqueada e inicia como siguiente tarea del DAG.
- Retención inicial definida en 7 bundles; la segunda copia independiente sigue como riesgo para `PH10-T004`.

## 1.0.10-monitor — 2026-08-19

### Añadido

- Exports sanitizados y versionables de los 10 workflows n8n.
- Detector preventivo de posibles secretos embebidos.
- Import test aislado con preservación de IDs, 103 nodos, desactivación y ausencia de credenciales.
- Smoke test exitoso de un workflow manual sin acciones externas.

### Estado

- `PH01-T003` quedó completada.
- `PH01-T002` es la única tarea pendiente antes de iniciar el baseline funcional PH01-T004.

## 1.0.9-monitor — 2026-08-19

### Añadido

- Primer baseline verificable de los 10 workflows n8n y sus 103 nodos.
- Clasificación inicial, dependencias internas, entradas/salidas estructurales y referencias de credenciales por tipo.

### Estado

- `PH01-T003` está en curso sin modificar ni ejecutar workflows.
- Exports sanitizados e import test continúan pendientes.

## 1.0.8-monitor — 2026-08-19

### Añadido

- Topología Docker desechable para probar PostgreSQL, n8n, SearXNG y Ollama sin usar volúmenes ni secretos activos.
- Prueba automatizada de inicio, reinicio, recuperación de health y limpieza del entorno aislado.

### Estado

- `PH01-T001` quedó completada con inventario, health y reinicio controlado verificables.
- `PH01-T003` queda desbloqueada mientras `PH01-T002` continúa parcial.

## 1.0.7-monitor — 2026-08-19

### Mejorado

- Publicación atómica del bundle PostgreSQL: el nombre definitivo aparece únicamente al completar dumps, conteos, metadata y hashes.
- Protección contra colisiones tanto con bundles finales como con ejecuciones parciales.

### Estado

- Sintaxis y guardas validadas sin crear backups ni acceder a datos.
- El backup real continúa pendiente de las decisiones de custodia.

## 1.0.6-monitor — 2026-08-19

### Mejorado

- Validación de estructura, unicidad y cobertura del manifest de conteos del backup.
- El restore ya no puede aprobar si falta una tabla restaurada en `counts.tsv`.

### Estado

- Scripts y consultas de catálogo validados sin crear dumps ni modificar PostgreSQL.
- `PH01-T002` continúa parcial hasta ejecutar el backup y restore reales.

## 1.0.5-monitor — 2026-08-19

### Mejorado

- El backup PostgreSQL registra conteos de todas las tablas de aplicación, no solo una muestra crítica.
- El restore aislado compara automáticamente las 8 tablas de `rhia_core` y las 125 tablas actuales de n8n.

### Estado

- La sintaxis y la enumeración segura fueron validadas sin crear backups ni leer filas sensibles.
- La ejecución con datos continúa pendiente de las decisiones de destino, custodia y retención.

## 1.0.4-monitor — 2026-08-19

### Añadido

- Verificador reproducible y de solo lectura del baseline de infraestructura.
- Controles automáticos de Compose, versiones, imágenes, red, volúmenes, puerto y salud de los cuatro servicios.

### Estado

- Los 24 controles pasaron sin desviaciones ni exposición de secretos.
- `PH01-T001` permanece parcial hasta ejecutar el reinicio controlado después del backup/restore aprobado de `PH01-T002`.

## 1.0.3-monitor — 2026-08-19

### Añadido

- Procedimiento de backup PostgreSQL cifrado con AES‑256 y hashes SHA‑256.
- Restore aislado automatizado con comparación de conteos críticos.
- Guardas que bloquean destinos dentro del repositorio, passphrases inseguras y sobrescrituras.

### Estado

- Los scripts están probados sin acceder a datos.
- La ejecución real requiere aprobar destino, custodia de passphrase y retención.

## 1.0.2-monitor — 2026-08-19

### Añadido

- Baseline de `rhia_core` y la base interna de n8n sin exportar filas sensibles.
- Exports DDL reproducibles y prueba de importación en PostgreSQL 18 aislado.
- Conteo visible de tareas simultáneamente en curso.

### Estado

- `PH01-T001` y `PH01-T002` están en curso.
- El backup completo permanece pendiente de definir destino, cifrado y retención fuera del repositorio.

## 1.0.1-monitor — 2026-08-19

### Añadido

- Bitácora visible de cada sesión con Task ID, estado, cambios, pruebas, evidencia, riesgos, decisiones y siguiente paso.
- Primer baseline verificable de WSL2, Docker, red, volúmenes y servicios activos para `PH01-T001`.

### Estado

- `PH01-T001` está en curso; el reinicio controlado se difiere hasta disponer de backup/restore verificado.

## 1.0.0-monitor — 2026-08-19

### Añadido

- RHIA Control Center con seguimiento de fase, tarea, gates y avance del Plan Maestro.
- Lectura en vivo de rama, commit y cambios locales del repositorio Git.
- `STAR.BAT` para iniciar el servidor local y abrir el monitor sin preguntas.
- `STOP.BAT` para detener de forma segura el servidor oculto.
- Vista estática de respaldo compatible con despliegues web sin API local.

### Corregido

- `SUBIRALGIT.BAT` ya no bloquea los saltos de línea Markdown intencionales.
- Compatibilidad con repositorios recién inicializados que todavía no tienen su primer commit.
- Codificación UTF-8 y diseño responsivo para pantallas móviles.

### Límites

- Esta versión es el monitor de construcción y control de cambios, no la aplicación comercial RHIA completa.
- No crea commits ni publica cambios automáticamente.
