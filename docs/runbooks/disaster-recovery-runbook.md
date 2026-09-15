# Runbook de Disaster Recovery — PH10-T004

**Estado del packet:** `PARTIAL`. Este runbook documenta lo que ya existe
con evidencia real y lo que sigue pendiente. No declara el packet `DONE`
-- para eso faltan un *full restore drill* end-to-end reciente con RTO
medido y un *corrupt backup test* explícito (ver "Qué falta" al final).

## Alcance

Backup y restore de las dos bases PostgreSQL de RHIA (`rhia_core`, `n8n`)
que corren en el contenedor `rhia-postgres` (WSL/Docker, ver `CLAUDE.md`).
No cubre `packages/secrets/` ni ningún archivo del sistema operativo --
solo los datos en PostgreSQL y los workflows de n8n.

## Componentes

| Script | Qué hace | Requiere |
| --- | --- | --- |
| `scripts/backup-postgres.sh` | Crea un bundle cifrado (`rhia_core` + `n8n`) | Docker, GnuPG, `rhia-postgres` activo |
| `scripts/verify-postgres-backup.sh` | Restaura un bundle en un contenedor PostgreSQL 18 temporal y compara conteos tabla por tabla | Docker, GnuPG |
| `scripts/check-backup-age.sh` | Monitor de antigüedad: falla (`exit 1`) si el bundle válido más reciente supera el umbral de horas indicado | Ninguno (solo lee el directorio de bundles) |
| `scripts/prune-postgres-backups.sh` | Retención: conserva los N bundles válidos más recientes; por defecto es dry-run, borra solo con `--apply` | Ninguno (solo lee/borra directorios de bundles) |
| `scripts/export-n8n-workflows.sh` | Exporta los workflows de n8n | n8n accesible |
| `scripts/sanitize-n8n-export.mjs` | Sanitiza el export de n8n antes de versionarlo | Node |

`check-backup-age.sh` y `prune-postgres-backups.sh` se agregaron en esta
sesión (`SES-20260915-119`) y están cubiertos por pruebas reales en
`scripts/test-backup-retention.sh` (fixtures en disco, sin Docker/Postgres
-- ver "Evidencia" abajo). `backup-postgres.sh`/`verify-postgres-backup.sh`
ya existían desde `PH01-T002` (`docs/baseline/backup-plan.md`), con un
restore real verificado el 2026-08-20 (133/133 tablas).

## Procedimiento: backup manual (hoy; automatización pendiente, ver "Qué falta")

Ejecutar desde Ubuntu WSL, igual que documenta `docs/baseline/backup-plan.md`:

```bash
RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/passphrase \
  bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/backup-postgres.sh" \
  /ruta/segura/backups-rhia

RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/passphrase \
  bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/verify-postgres-backup.sh" \
  /ruta/segura/backups-rhia/rhia-postgres-YYYYMMDDTHHMMSSZ
```

## Procedimiento: monitor de antigüedad (Age monitor)

```bash
bash scripts/check-backup-age.sh /ruta/segura/backups-rhia --max-age-hours 26
```

Sale con `exit 1` y un mensaje `ALERTA:` si el bundle válido más reciente
supera el umbral, o si no hay ningún bundle válido. Sale `0` con `OK:` en
caso contrario. Pensado para integrarse a un scheduler (Task Scheduler de
Windows o cron de WSL) que corra este chequeo periódicamente y notifique
si falla -- esa integración en sí (el "Backup automático" del punto 1 del
Task Packet) sigue sin implementarse, ver "Qué falta".

El umbral por defecto (`26` horas) es **provisional**: asume una cadencia
diaria de backup con margen. Debe ajustarse una vez exista una cadencia
real y automatizada (punto 1 de "Qué falta").

## Procedimiento: retención (Retención)

```bash
# Dry-run (por defecto) -- solo reporta, no borra nada:
bash scripts/prune-postgres-backups.sh /ruta/segura/backups-rhia --keep 7

# Borrado real, solo tras revisar el dry-run:
bash scripts/prune-postgres-backups.sh /ruta/segura/backups-rhia --keep 7 --apply
```

Nunca borra bundles incompletos (`*.part` o con archivos faltantes) --
esos requieren revisión manual, para no borrar por accidente un backup
interrumpido a medio escribir. Nunca opera dentro del repositorio RHIA
(mismo guardrail que `backup-postgres.sh`). `--apply` es obligatorio y
explícito -- por defecto es un reporte, nunca borra solo.

## Restore drill completo (pasos)

1. Confirmar que `rhia-postgres` NO es el contenedor objetivo del
   restore -- usar siempre un contenedor aislado, nunca sobrescribir el
   activo (así lo hace `verify-postgres-backup.sh`).
2. Elegir el bundle a restaurar (el más reciente que pase
   `check-backup-age.sh`, o uno específico para el drill).
3. Correr `verify-postgres-backup.sh` contra ese bundle.
4. Confirmar en la salida: hashes `SHA256SUMS` OK, cobertura de
   `counts.tsv` completa, conteos por tabla idénticos.
5. **Pendiente de capturar en un drill futuro:** tiempo de inicio a fin
   (RTO real) -- ver "Qué falta", punto 3.
6. Registrar el resultado (fecha, bundle, hash, duración si se midió) en
   `docs/baseline/database.md`.

## RPO / RTO inicial

- **RPO (Recovery Point Objective) propuesto:** 24 horas, una vez el
  backup automático diario (punto 1 de "Qué falta") esté implementado.
  Hoy, sin automatización, el RPO real es "desde el último backup manual
  ejecutado" -- no hay garantía de cadencia. El único backup real
  ejecutado hasta la fecha de este runbook es el del 2026-08-20
  (`docs/baseline/backup-plan.md`).
- **RTO (Recovery Time Objective):** **no medido con evidencia real
  todavía.** El restore del 2026-08-20 confirmó éxito funcional completo
  (133/133 tablas, conteos idénticos) pero ninguna sesión registró su
  duración en reloj. No se inventa un número aquí -- queda como pendiente
  explícito (punto 3 de "Qué falta"): la próxima vez que se corra
  `verify-postgres-backup.sh` o un restore real, medir con `time` (o
  equivalente) desde el inicio del restore hasta la confirmación de
  conteos, y registrar el resultado real en este documento y en
  `docs/baseline/database.md`.

## Evidencia real de esta sesión (`SES-20260915-119`)

`check-backup-age.sh` y `prune-postgres-backups.sh` se probaron con
`scripts/test-backup-retention.sh` contra bundles ficticios (archivos
vacíos con nombres/metadata realistas, **nunca datos reales**) en un
directorio temporal fuera del repositorio, en dos entornos: el
contenedor cloud de esta sesión y, de forma independiente, el bridge
`device_bash` real sobre el dispositivo del usuario. Ambas corridas:
`TODOS LOS TESTS PASARON`. Casos cubiertos: backup reciente → `OK`;
solo backups viejos → `ALERTA` de antigüedad; directorio vacío →
`ALERTA`; poda en dry-run no borra nada; poda con `--apply` borra
exactamente los bundles fuera de la retención y preserva bundles
incompletos/`*.part`; rechazo explícito de operar dentro del
repositorio. Esto **no** sustituye un restore drill real contra
PostgreSQL real -- ningún entorno accesible desde Claude en esta sesión
tiene Docker/PostgreSQL disponible (ver "Qué falta", punto 4) para
correr `verify-postgres-backup.sh` de punta a punta.

## Evidencia real de esta sesión (`SES-20260915-120`)

Se agregó `scripts/test-backup-checksum-integrity.sh`, que aísla y prueba
con evidencia real (dos entornos independientes -- contenedor cloud y
bridge `device_bash` sobre el dispositivo del usuario, **`TODOS LOS TESTS
PASARON` en ambos**) la capa de checksum `SHA256SUMS` que
`verify-postgres-backup.sh` usa como primera línea de defensa contra
corrupción, usando bundles ficticios (nunca datos reales). Casos
cubiertos: bundle válido (4/4 archivos `OK`); byte volteado en
`rhia_core.dump.gpg` (`FAILED`, `exit != 0`); `n8n.dump.gpg` truncado
(`FAILED`, `exit != 0`); `n8n.dump.gpg` borrado tras firmar el
`SHA256SUMS` (`FAILED open or read`, `exit != 0`). **Esto cubre solo una
capa de defensa (verificación de checksums) y explícitamente NO es
equivalente al "corrupt backup test" completo del punto 4 de "Qué falta"**,
que exige un `pg_restore`/`docker` real rechazando el bundle corrupto de
punta a punta -- eso sigue bloqueado por la misma falta de Docker/Postgres
real documentada en los puntos 3 y 4 abajo.

Esta misma sesión confirmó de nuevo, con evidencia directa, que la VM
aislada del bridge `device_bash` no puede ni siquiera instalar Docker:
`apt-get update` falla por permisos (`Could not open lock file
/var/lib/apt/lists/lock`) y `sudo -n true` es rechazado explícitamente por
el flag `no new privileges` del contenedor. Es un límite estructural del
entorno, no una ausencia temporal de paquete -- no debe reintentarse en
cada ciclo salvo que la plataforma anuncie un cambio concreto.

## Qué falta (para poder declarar `PH10-T004` `DONE`)

1. **Backup automático real:** programar `backup-postgres.sh` con Task
   Scheduler de Windows o cron de WSL (acción humana -- ningún tipo de
   sesión de Claude disponible hoy puede configurar un scheduler nativo
   del sistema operativo del usuario). Sin esto, el RPO propuesto de 24h
   es aspiracional, no real.
2. **Segunda copia física o remota** de los bundles (ya señalado como
   pendiente desde `docs/baseline/backup-plan.md`, punto 7) -- decisión
   y ejecución humana (destino, credenciales/almacenamiento).
3. **Full restore drill con RTO medido:** correr
   `verify-postgres-backup.sh` (o un restore real) midiendo el tiempo de
   punta a punta, y registrar el resultado real -- requiere Docker y
   PostgreSQL reales, no disponibles en ningún entorno de Claude usado
   hasta ahora (el contenedor cloud no tiene Docker; el bridge
   `device_bash`, aunque volvió a funcionar el 2026-09-15, es una VM
   Linux aislada sin Docker ni acceso de red al `rhia-postgres` real del
   usuario -- verificado esta sesión: `which docker` vacío, puerto 5432
   inalcanzable). Solo ejecutable por el usuario directamente, o por una
   sesión de Claude con acceso real a esa infraestructura si en el
   futuro existe un tipo de sesión distinto que sí lo tenga.
4. **Corrupt backup test (end-to-end, con Docker/Postgres real):** repetir
   el punto 3 pero con un bundle deliberadamente corrompido (p. ej.
   truncar un byte del `.dump.gpg` o de `SHA256SUMS`) y confirmar que
   `verify-postgres-backup.sh` lo rechaza (falla el `sha256sum --check` o
   el `pg_restore`) en vez de restaurar datos corruptos silenciosamente --
   mismo bloqueo de infraestructura que el punto 3. **Parcialmente
   cubierto:** `scripts/test-backup-checksum-integrity.sh` (`SES-120`, ver
   "Evidencia" arriba) ya prueba con evidencia real que la capa de
   checksum `SHA256SUMS` por sí sola rechaza los mismos tipos de
   corrupción (byte volteado, archivo truncado, archivo borrado); falta
   solo la verificación equivalente dentro de `verify-postgres-backup.sh`
   contra un `pg_restore` real, que sí requiere Docker/Postgres reales.
5. **Integrar `check-backup-age.sh` a un canal de alerta real** (p. ej.
   `packages/alerting`, o el scheduler del punto 1) en vez de un script
   standalone que hay que correr a mano -- fuera de alcance de esta
   sesión, no bloqueado por infraestructura, queda como mejora futura.
6. **Export n8n real:** `scripts/export-n8n-workflows.sh` existe desde
   antes de esta sesión; no se re-verificó en este runbook (no es parte
   del hallazgo de esta sesión) -- una sesión futura con acceso a n8n
   real debería confirmarlo como parte del *full restore drill*.
