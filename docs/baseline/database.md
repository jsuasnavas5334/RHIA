# PH01-T002 — Baseline de PostgreSQL

## Estado

- Captura: 2026-08-19 17:34 UTC-05:00
- Cierre: 2026-08-20 14:55 UTC-05:00
- Estado de tarea: `DONE`
- Método: consultas de catálogo, exports `schema-only`, backup cifrado y restore aislado
- Escrituras en bases activas: ninguna
- Filas o valores sensibles fuera de las bases activas: únicamente dentro de dumps cifrados y fuera del repositorio

La auditoría se ejecutó mediante el socket local del contenedor con el rol administrador existente. No se leyó ni copió ninguna contraseña.

## Servidor

| Propiedad | Valor observado |
|---|---|
| PostgreSQL | 18.4 (Debian 18.4-1.pgdg13+1) |
| Encoding | UTF8 |
| Collation / Ctype | en_US.utf8 / en_US.utf8 |
| Timezone del servidor | Etc/UTC |
| Extensiones en `rhia_core` | `plpgsql` 1.0 |

### Bases existentes

| Base | Owner | Tamaño |
|---|---|---:|
| `rhia_core` | `rhia_admin` | 36 MB |
| `n8n` | `n8n` | 35 MB |
| `postgres` | `rhia_admin` | 7,678 kB |

## Roles observados

| Rol | Login | Superuser | Create DB | Create role |
|---|---|---|---|---|
| `rhia_admin` | sí | sí | sí | sí |
| `rhia_orchestrator` | sí | no | no | no |
| `n8n` | sí | no | no | no |

`rhia_orchestrator` tiene permisos de lectura/escritura sobre tablas operativas y solo lectura sobre catálogos geográficos. Este modelo debe revisarse en PH03 contra least privilege. No se modificaron grants.

## Schema `rhia_core`

- Schema de aplicación: `public`.
- 8 tablas, 124 columnas, 26 índices, 11 foreign keys.
- 3 secuencias explícitas y 1 identity sequence.
- 1 función SQL: `rhia_resolve_location(text, text, integer)`.
- Sin views ni triggers de aplicación.
- Export DDL: `database/rhia_core.schema.sql`.
- SHA-256: `3FE36D38E3F248411EDEDDD826E82D7FFCD12B55F0D55321E2172669847A3068`.

### Tablas, conteos y clasificación

| Tabla | Filas | Tamaño observado | Clasificación inicial | Motivo |
|---|---:|---:|---|---|
| `city_context` | 57,688 | 27 MB | CONSERVAR / MODIFICAR | Catálogo geográfico regional ya poblado. |
| `country_context` | 249 | 168 kB | CONSERVAR / MODIFICAR | Catálogo y prioridades multipaís. |
| `execution_registry` | 119 | 144 kB | CONSERVAR / MODIFICAR | Base de idempotencia y heartbeat; debe evolucionar al modelo job/execution. |
| `prospect_contact_candidates` | 2 | 32 kB | CONSERVAR / MIGRAR | Staging comercial existente; requiere alineación con Contact/Contact Point. |
| `commercial_entities` | 0 | 32 kB | CONSERVAR / MIGRAR | Inicio de identidad empresarial; falta jerarquía Group/Entity/Location completa. |
| `entity_relationships` | 0 | 40 kB | CONSERVAR / MIGRAR | Relaciones y evidencia ya modeladas parcialmente. |
| `entity_resolution_cache` | 0 | 16 kB | CONSERVAR / MODIFICAR | Cache reutilizable con freshness/estado. |
| `location_resolution_cache` | 0 | 32 kB | CONSERVAR / MODIFICAR | Cache de resolución geográfica. |

Ninguna tabla se clasifica para eliminación. Cualquier migración futura debe ser aditiva y partir de un backup verificado.

### `execution_registry`

- 119 filas exactas.
- Todas tienen `task_type = system_heartbeat` y `status = completed`.
- Rango observado: 2026-08-12 20:21:51 UTC a 2026-08-19 17:30:23 UTC.
- Clave única de deduplicación presente.
- Índices por `status`, `task_type` y `(entity_type, entity_id)`.
- Constraint de intentos no negativos y catálogo cerrado de estados.

No se inspeccionaron `payload`, `result`, hashes ni mensajes de error.

## Base de n8n

- 125 tablas y aproximadamente 35 MB.
- 10 workflows; 6 activos y 4 inactivos.
- 257 ejecuciones: 249 `success`, 8 `error`.
- 257 filas de execution data.
- 84 versiones en workflow history.
- 2 registros de credenciales; su contenido no se leyó ni exportó como datos.
- 1 webhook y 1 usuario.
- Export DDL: `database/n8n.schema.sql`.
- SHA-256: `036F736CC54C8A8B5BDFF4974A818320FD4CE5FD44E2B6ACE90ABF7FD427C93C`.

La auditoría de nombres, inputs/outputs y exports JSON de workflows pertenece a `PH01-T003`.

## Prueba de reconstrucción de schema

Se inició un contenedor temporal aislado `postgres:18`, sin puertos publicados y sin conexión a volúmenes RHIA.

| Export | Resultado de importación | Validación |
|---|---|---|
| `rhia_core.schema.sql` | exit 0 | 8 tablas y 1 función reconstruidas |
| `n8n.schema.sql` | exit 0 | 125 tablas reconstruidas |

El contenedor temporal se eliminó al finalizar. Los servicios y bases activas no fueron reiniciados ni modificados.

## Backup cifrado y restore verificado

El 2026-08-20 se creó el primer bundle completo fuera del repositorio y se comprobó mediante una restauración real en PostgreSQL 18 aislado.

| Propiedad | Evidencia |
|---|---|
| Bundle | `%USERPROFILE%\RHIA-Backups\rhia-postgres-20260820T195344Z` |
| Tamaño total | 12,165,485 bytes |
| Formato | `pg_dump` custom + gzip + GPG AES-256 |
| Integridad | 5/5 artefactos aprobados mediante SHA-256 |
| Cobertura | 133/133 tablas: 8 `rhia_core` y 125 `n8n` |
| Conteos | 133/133 iguales después del restore |
| Entorno de restore | contenedor temporal `postgres:18`, sin puertos ni volúmenes RHIA |
| Limpieza | 0 contenedores temporales restantes |
| Servicios activos | 4/4 continuaron activos; PostgreSQL permaneció healthy |

La passphrase se generó aleatoriamente y se custodia en `%USERPROFILE%\.rhia-secrets\backup-passphrase`. Su ACL está protegida, sin herencia, y concede acceso únicamente al usuario propietario, `SYSTEM` y `Administrators`. La passphrase nunca fue impresa ni ingresó al repositorio.

El restore comprobó tanto la cobertura exacta del catálogo como el conteo de cada tabla. En la captura del backup, `execution_registry` tenía 144 filas; las tablas geográficas conservaron 57,688 ciudades y 249 países. Estos valores no reemplazan la fotografía inicial de auditoría: documentan el estado exacto incluido en el bundle.

## Riesgos y gaps

1. `rhia_admin` es superuser; las identidades de servicio deben usar least privilege.
2. Existe una sola copia local del bundle; una falla del disco de Windows puede afectar origen y backup simultáneamente.
3. La base n8n contiene credenciales y datos operativos; el bundle debe mantenerse cifrado y nunca entrar al repositorio.
4. La retención inicial está definida en 7 bundles, pero su poda automática queda diferida a `PH10-T004`; en esta sesión no se eliminó ningún backup válido.
5. No existen todavía automatización ni monitor de antigüedad del backup.
6. La configuración observada no demuestra aún RPO/RTO.

## Validación y siguiente paso

El schema está inventariado y versionado; cada tabla RHIA fue clasificada; el backup completo fue cifrado, restaurado y comparado contra las 133 tablas de aplicación. Los criterios de aceptación y las pruebas requeridas de `PH01-T002` están cumplidos.

`PH01-T002` queda `DONE`. El riesgo residual de una sola ubicación física se entrega a `PH10-T004`, donde corresponderá automatizar la frecuencia, hacer cumplir la retención, definir RPO/RTO y agregar una segunda copia independiente. El DAG desbloquea `PH01-T004`.
