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
| `scripts/sync-backups-to-external.sh` | Copia bundles válidos a un disco externo (segunda copia), verificando checksums antes y después | Ninguno (solo lee/copia archivos y verifica SHA256SUMS) |

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

## Procedimiento: sincronización a disco externo (segunda copia)

Contexto: `docs/architecture/adr/ADR-0002-produccion-pc-local.md` (2026-09-16)
confirma que producción corre en la PC personal de George -- la "segunda
copia" que exige el "Errores que debe evitar" del Task Packet ("Mismo disco
como única copia") no puede ser otra carpeta del mismo disco. **Decisión
confirmada por George: disco externo USB**, conectado periódicamente (no
backup en la nube por ahora).

```bash
# Sincroniza todos los bundles válidos que falten en el disco externo
# (no solo el más reciente, para no dejar huecos entre conexiones):
bash scripts/sync-backups-to-external.sh /ruta/segura/backups-rhia /ruta/al/disco-externo

# Vista previa sin copiar nada:
bash scripts/sync-backups-to-external.sh /ruta/segura/backups-rhia /ruta/al/disco-externo --dry-run

# Solo el bundle más reciente (disco con poco espacio):
bash scripts/sync-backups-to-external.sh /ruta/segura/backups-rhia /ruta/al/disco-externo --latest-only
```

No requiere Docker, PostgreSQL ni GnuPG -- opera solo sobre los archivos ya
cifrados por `backup-postgres.sh` y su `SHA256SUMS`. Verifica los checksums
del bundle de origen antes de copiar (para no propagar una corrupción ya
existente) y del bundle copiado después (para confirmar que la copia es
idéntica byte a byte); nunca sobrescribe un bundle ya presente en destino,
y nunca deja una copia parcial o corrupta como si fuera válida (la borra y
reporta el fallo). Exige que el destino ya exista (el disco debe estar
conectado y montado) -- no crea la carpeta destino solo, para evitar
escribir por accidente en el disco interno por una ruta mal tecleada.

**Frecuencia de conexión recomendada:** hasta que el punto 1 de "Qué falta"
(backup automático) esté implementado, la cadencia real de backups es
manual e irregular -- conectar el disco externo y correr este script cada
vez que se ejecute un backup manual es lo mínimo razonable. Una vez el
backup automático diario esté funcionando, se recomienda conectar el disco
al menos **una vez por semana** (con retención de 7 bundles en el origen
via `prune-postgres-backups.sh --keep 7`, conectar semanalmente asegura que
ningún bundle se pierda entre sincronizaciones antes de ser podado). El
script sincroniza todos los bundles faltantes en cada corrida, no solo el
más reciente, así que una conexión menos frecuente que la retención no
pierde bundles intermedios mientras no supere la ventana de retención.

Pendiente, exclusivamente humano: comprar/designar el disco externo físico,
conectarlo con la cadencia recomendada, y (opcional, fuera de alcance de
este script) considerar cifrado a nivel de disco (BitLocker to Go) como
capa adicional -- los bundles ya viajan cifrados con AES-256 vía GPG, así
que esto es defensa en profundidad, no un requisito para que la segunda
copia sea válida.

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

## Evidencia real de esta sesión (`SES-20260916-130`)

Primer **full restore drill** y **corrupt backup test end-to-end** con
PostgreSQL real ejecutados en cualquier sesión de Claude sobre este
proyecto. Entorno: el contenedor cloud propio de esta sesión (no
`device_bash`, que sigue sin Docker/Postgres/sudo -- verificado de nuevo
esta sesión, sin cambios). Se instaló `postgresql-16` (16.13, paquete
Ubuntu real vía `apt`, sin necesidad de Docker) y se crearon dos clusters
reales y completamente aislados entre sí (`source` puerto 5432, `verify`
puerto 5433). Se aplicó el schema real ya capturado del proyecto
(`docs/baseline/database/rhia_core.schema.sql` + `n8n.schema.sql`, 133
tablas, coincide con el baseline de `PH01-T002`) y se sembró una única
fila sintética de prueba. Se ejecutaron los mismos comandos reales que
usan `scripts/backup-postgres.sh`/`scripts/verify-postgres-backup.sh`
(`pg_dump --format=custom --compress=gzip:6 --create --no-owner
--no-privileges` → `gpg --symmetric --cipher-algo AES256` → `sha256sum
--check` → `gpg --decrypt | pg_restore --create --exit-on-error
--no-owner --no-privileges`) directamente contra PostgreSQL (no vía
`docker exec`, ya que la imagen `postgres:18` sigue bloqueada por
política de egress 403 en este contenedor -- Docker Hub no está
allowlisted). Resultado: restore real exitoso, 133/133 tablas, 0
discrepancias de conteo; 0.31s de backup + 1.39s de restore (RTO real,
dataset de prueba pequeño). Corrupt backup test: con `SHA256SUMS`
deliberadamente válido sobre contenido ya corrupto (200 bytes alterados),
`pg_restore` real rechazó el archivo con `exit code 1` real (`could not
read from input file: end of file`). Todos los recursos de prueba
(clusters, bases, passphrase) se destruyeron al finalizar; no se tocó
infraestructura ni datos reales del usuario. Detalle completo, incluyendo
las limitaciones honestas de esta evidencia (PostgreSQL 16 vía `apt` en
vez de 18 vía Docker; scripts reproducidos, no ejecutados sin modificar;
datos sintéticos, no de producción; RTO no representativo del volumen
real), en `docs/progress/PH10-T004.md`, sección `SES-20260916-130`.

## Evidencia real de esta sesión (`SES-20260916-134`)

Tras 14 ciclos consecutivos (`SES-120`..`SES-133`) reconfirmando el mismo
bloqueo estructural de Docker/Postgres/`no_new_privileges` sin encontrar
nada nuevo que hacer dentro de ese bloqueo, esta sesión revisó de nuevo el
Task Packet completo y el runbook buscando trabajo real y no bloqueado
antes de repetir una decimoquinta reconfirmación idéntica. Hallazgo: el ADR
nuevo (`docs/architecture/adr/ADR-0002-produccion-pc-local.md`, integrado
como referencia desde `SES-131` pero sin acción concreta hasta ahora)
confirma explícitamente la decisión de negocio del punto 2 de "Qué falta"
(disco externo USB) y pide, literalmente, dos cosas ejecutables sin
Docker/Postgres: documentar la frecuencia de conexión recomendada, y un
script que copie el backup más reciente a la ruta que el usuario indique.

Se implementó `scripts/sync-backups-to-external.sh` (copia todos los
bundles válidos que falten en el destino, no solo el más reciente, para no
dejar huecos entre conexiones del disco; soporta `--latest-only` y
`--dry-run`; verifica `SHA256SUMS` del bundle de origen antes de copiar y
del bundle copiado después; nunca sobrescribe ni deja una copia parcial
como si fuera válida; rechaza un destino inexistente, igual al origen, o
dentro del propio repositorio) y `scripts/test-sync-backups-to-external.sh`
con 7 casos reales sobre bundles ficticios (contenido aleatorio, nunca
datos reales) con `SHA256SUMS` reales calculados sobre ese contenido:
destino no montado (rechazado), destino == origen (rechazado), destino
dentro del repo (rechazado), `--dry-run` no copia nada y reporta los 3
bundles del fixture, `--latest-only` copia solo el más reciente y pasa su
propio checksum, una segunda corrida sin `--latest-only` omite el ya
sincronizado y copia los 2 restantes (contenido verificado byte a byte con
`cmp` contra el original, no solo por nombre), y un bundle de origen
corrupto (`SHA256SUMS` alterado tras el hecho) se rechaza explícitamente
sin copiarse. **`TODOS LOS TESTS PASARON`** en dos entornos independientes:
el bridge `device_bash` real sobre el dispositivo del usuario, y el
contenedor cloud propio de esta sesión (mismos scripts, staged
byte-idénticos entre ambos, no reescritos). `shellcheck` (0.11.0) sobre
ambos scripts nuevos: un único warning `SC2207` en el mismo patrón
(`sorted_names=($(... | sort))`) que ya existe sin cambios en
`scripts/prune-postgres-backups.sh` -- no es una regresión de estilo nueva.

No se tocó ningún backup real ni el bundle real de `2026-08-20`
(`RHIA-Backups\rhia-postgres-20260820T195344Z`, visible en el listado de
carpetas del usuario pero fuera de las carpetas conectadas a esta sesión --
no se solicitó acceso a él porque esta es una sesión desatendida
[tarea programada] y una solicitud de acceso a carpeta generaría una
aprobación pendiente que nadie respondería; queda como nota para una sesión
interactiva: podría ya ser, o servir de base para, la primera copia externa
real si el usuario confirma su contenido y ubicación). No se hizo
commit/push (guardrail "Publicación Git únicamente bajo control humano").
No se repitió la reconfirmación del bloqueo Docker Hub/`no_new_privileges`
(sin motivo para esperar cambios en ~1h desde `SES-133`, y esta sesión
encontró trabajo real no bloqueado en su lugar).

## Evidencia real de esta sesión (`SES-20260916-135`)

Verificación mínima habitual en `device_bash`: `git log -1` local vs
`origin/main` -> ambos `49b5f80` (sin push nuevo); `git status --short` ->
mismos 5 archivos modificados + 1 sin trackear (ADR-0002) que dejó
`SES-134`; `.git/index.lock` -> sigue existiendo, se deja intacto; `which
psql pg_dump pg_restore docker` (los cuatro ausentes), puerto `5432` y
puerto `5678` (n8n, ambos "Connection refused"), `sudo -n true` (rechazado
por `no_new_privileges`) -- decimosexto ciclo consecutivo sin cambios en
ese bloqueo (primera vez que se confirma explícitamente también el puerto
de n8n, no solo Postgres).

Siguiendo la recomendación dejada por `SES-134` ("revisar GitHub
Actions/Nightly después de las 07:00 UTC sobre `49b5f80`"), y ya pasada
esa hora (~07:11 UTC), esta sesión consultó la API pública de GitHub
(`api.github.com`, sin token -- `jsuasnavas5334/RHIA` es un repositorio
público) para el historial del workflow `Nightly`, algo que ninguna
sesión anterior había hecho con este nivel de detalle (solo confirmaban
que el `head_sha` del último run no coincidía con el commit actual):

- Las últimas 4 ejecuciones programadas (`2026-09-12` a `2026-09-15`)
  corrieron todas sobre el commit `3d30fdb` (no sobre `49b5f80`) y
  **fallaron las 4** en el mismo paso: "Instalar dependencias (lockfile
  real)" (`npm ci`), `exit code 1`.
- **Causa raíz investigada y confirmada real** (sin tocar el repositorio
  del usuario): se clonó `https://github.com/jsuasnavas5334/RHIA.git`
  (público) en el contenedor cloud propio de esta sesión, se hizo `git
  worktree add` al commit exacto `3d30fdb`, y se comparó cada
  `package.json` de workspace contra `package-lock.json`. En `3d30fdb`,
  `apps/core-api/package.json` declara dependencias en
  `@rhia/entity-resolver` y `@rhia/search-health` que **no** están en la
  entrada `apps/core-api` de `package-lock.json` (lockfile
  desincronizado). Más grave: `packages/threat-model` y
  `packages/observability` dependen de `@rhia/secrets`, pero en `3d30fdb`
  el workspace `packages/secrets/` **no existe en absoluto** y no tiene
  entrada en el lockfile. Reproducido real con `npm ci --no-engine-strict
  --ignore-scripts --no-audit --no-fund` sobre el worktree exacto de
  `3d30fdb`: `npm error 404 Not Found - GET
  https://registry.npmjs.org/@rhia%2fsecrets` -- npm intenta resolverlo
  como paquete público porque no lo reconoce como workspace enlazado.
- **Ya corregido en el HEAD actual:** en `49b5f80`, `packages/secrets/`
  existe y está en el lockfile, y `apps/core-api` ya declara ambas
  dependencias nuevas en `package-lock.json`. Confirmado real: `rm -rf
  node_modules && npm ci --no-engine-strict --ignore-scripts --no-audit
  --no-fund` sobre el mismo clon -> **125 paquetes instalados sin
  error** (solo el warning esperado de `EBADENGINE`, ver siguiente punto).
- **El `--no-engine-strict` no oculta un problema real de CI:** verificado
  en el changelog oficial (`nodejs/node`,
  `doc/changelogs/CHANGELOG_V24.md`, vía `raw.githubusercontent.com`) que
  Node `24.19.0` (la versión que usa `actions/setup-node@v4` en
  `nightly.yml`) trae empaquetado `npm 11.17.0`, que sí satisface el
  rango declarado en `package.json` (`"npm": ">=11.17.0 <12"`). El bypass
  fue necesario solo porque el contenedor cloud de esta sesión corre Node
  22/npm 10.9.7 (fuera de ese rango) -- el runner real de GitHub Actions
  no tiene ese problema.
- **Conclusión:** el bloqueo que hizo fallar `Nightly` 4 noches seguidas
  ya está resuelto en `49b5f80`, y no tiene relación con el bloqueo de
  Docker Hub/`no_new_privileges` que documentan `SES-119..134` (ese
  bloqueo es de red/entorno local; este era un lockfile desincronizado en
  un commit ya superado). La próxima ejecución real del `Nightly` sobre
  `49b5f80` (o posterior) debería pasar el paso `npm ci` por primera vez
  en varios días -- el resto del pipeline (migraciones, seeds, test
  suite, baseline comercial) sigue sin confirmarse hasta que esa
  ejecución ocurra de verdad.
- **Hallazgo adicional sobre el cronograma real de `Nightly`:** el cron
  declarado es `0 7 * * *` (07:00 UTC), pero las 4 ejecuciones históricas
  revisadas dispararon en realidad entre las 11:20 y 13:28 UTC (retraso
  real de 4-6h respecto al cron declarado, consistente los 4 días) -- no
  a las 07:00 UTC como asumieron `SES-130..134` al planear "revisar
  después de las 07:00 UTC". Esta sesión llegó a la ventana declarada
  (~07:11 UTC) pero no a la ventana real observada; no corresponde
  esperar todavía una ejecución sobre `49b5f80`. Una sesión futura
  debería revisar de nuevo aproximadamente entre las 11:00 y 14:00 UTC
  del día siguiente al último push (`2026-09-15` -> `2026-09-16` en esa
  ventana), no justo después de las 07:00 UTC.

No se tocó ningún archivo del repositorio real del usuario en esta
investigación -- todo ocurrió en un clon público desechable
(`git clone` + `git worktree add`) dentro del contenedor cloud propio de
esta sesión, nunca en `device_bash`. No se hizo commit/push (guardrail
"Publicación Git únicamente bajo control humano"). No se repitió el
restore drill ni el corrupt backup test (sin cambio de acceso a
Docker/Postgres real). No se repitió el intento de reconfigurar el
trigger (rechazado permanentemente desde `SES-126`).

## Qué falta (para poder declarar `PH10-T004` `DONE`)

1. **Backup automático real:** programar `backup-postgres.sh` con Task
   Scheduler de Windows o cron de WSL (acción humana -- ningún tipo de
   sesión de Claude disponible hoy puede configurar un scheduler nativo
   del sistema operativo del usuario). Sin esto, el RPO propuesto de 24h
   es aspiracional, no real.
2. **Segunda copia física o remota** de los bundles (ya señalado como
   pendiente desde `docs/baseline/backup-plan.md`, punto 7). **Decisión de
   negocio ya tomada** (`docs/architecture/adr/ADR-0002-produccion-pc-local.md`,
   confirmada por George el 2026-09-16): disco externo USB, no backup en la
   nube por ahora. Esta sesión (`SES-20260916-134`) implementó y probó con
   evidencia real `scripts/sync-backups-to-external.sh` (ver "Procedimiento:
   sincronización a disco externo" arriba), que copia los bundles válidos
   del directorio de backups hacia la ruta del disco externo que el usuario
   indique, verificando checksums antes y después. Lo que queda pendiente
   **es exclusivamente humano y no ejecutable por ninguna sesión
   automatizada**: adquirir/designar el disco USB físico y conectarlo con la
   cadencia recomendada (ver esa misma sección) para correr el script -- ni
   `device_bash` ni el contenedor cloud de una sesión de Claude tienen forma
   de detectar o requerir hardware físico del usuario.
3. **Full restore drill con RTO medido:** **sustancialmente cubierto
   con evidencia real desde `SES-20260916-130`** (ver esa sección para el
   detalle completo) -- se ejecutó un restore real de punta a punta
   (`pg_dump` real → `gpg` AES-256 real → `pg_restore` real hacia un
   segundo cluster PostgreSQL real y aislado) usando PostgreSQL 16.13
   real (paquete `apt`, no Docker) en el contenedor cloud de esta sesión,
   contra el schema real ya capturado del proyecto (133/133 tablas, 0
   discrepancias de conteo). RTO real medido: 0.31s backup + 1.39s
   restore, **sobre un dataset de prueba pequeño, no el volumen de
   producción**. Salvedad pendiente: no se corrió literalmente
   `verify-postgres-backup.sh` (exige el binario `docker`, cuya imagen
   `postgres:18` sigue bloqueada por política de red 403 en este
   contenedor cloud -- Docker Hub no está en el allowlist de egress; y
   `device_bash` sigue sin Docker/Postgres en absoluto). Repetir con
   Docker/PostgreSQL 18 reales y datos de producción reales, cuando el
   usuario habilite ese acceso, para cerrar la brecha de versión/volumen
   y poder ejecutar los scripts sin modificar.
4. **Corrupt backup test (end-to-end, con Postgres real):** **sustancialmente
   cubierto con evidencia real desde `SES-20260916-130`** -- con la capa de
   checksum `SHA256SUMS` deliberadamente válida (para aislar la siguiente
   capa), un `pg_restore` real rechazó un archivo `pg_dump` corrupto
   (200 bytes alterados / truncamiento al 60%) con `exit code 1` real
   (`could not read from input file: end of file`). Complementa (no
   reemplaza) `scripts/test-backup-checksum-integrity.sh` (`SES-120`), que
   ya prueba la capa de checksum por sí sola. Misma salvedad que el punto
   3: PostgreSQL 16 vía `apt`, no Docker/PostgreSQL 18 reales -- pendiente
   repetir con `verify-postgres-backup.sh` sin modificar cuando haya
   acceso real a Docker.
5. **Integrar `check-backup-age.sh` a un canal de alerta real** (p. ej.
   `packages/alerting`, o el scheduler del punto 1) en vez de un script
   standalone que hay que correr a mano -- fuera de alcance de esta
   sesión, no bloqueado por infraestructura, queda como mejora futura.
6. **Export n8n real:** `scripts/export-n8n-workflows.sh` existe desde
   antes de esta sesión; no se re-verificó en este runbook (no es parte
   del hallazgo de esta sesión) -- una sesión futura con acceso a n8n
   real debería confirmarlo como parte del *full restore drill*. `SES-135`
   reconfirmó puerto `5678` (n8n) cerrado en `device_bash` -- mismo
   bloqueo estructural que Postgres/Docker, no un hallazgo nuevo. Nota:
   el diagnóstico de `npm ci` de `SES-135` (ver evidencia arriba) es
   sobre el `Nightly` de CI, no sobre `export-n8n-workflows.sh` -- no
   cambia este punto.

## Nota -- SES-20260916-136

Ciclo hourly (~08:12 UTC), demasiado temprano para la ventana real del
`Nightly` (11:00-14:00 UTC, ver `SES-135`) y sin señal de cambio en
Docker/Postgres/n8n (decimoseptimo ciclo consecutivo igual). No se
repitió ninguna investigación nueva. Dado el tiempo total acumulado
(42+ ciclos) bloqueado por acción exclusivamente humana (puntos 1 y 2
de "Qué falta" arriba), esta sesión avisó proactivamente al usuario.
Ver `docs/progress/PH10-T004.md`, sección `SES-20260916-136`, para el
detalle completo.


## Nota -- SES-20260916-137

Ciclo hourly (~09:11 UTC), todavia antes de la ventana real del
`Nightly` (11:00-14:00 UTC, ver `SES-135`) y sin señal de cambio en
Docker/Postgres/n8n (decimoctavo ciclo consecutivo igual, confirmado con
`git fetch` real). No se repitio ninguna investigacion nueva. A
diferencia de `SES-136`, esta sesion **no envio otro aviso proactivo** al
usuario: el aviso de `SES-136` (hace ~1h) ya cubre el mismo estado sin
cambios -- repetirlo seria ruido. Ver `docs/progress/PH10-T004.md`,
seccion `SES-20260916-137`, para el detalle completo.

## Nota -- SES-20260916-138

Ciclo hourly (~10:11 UTC), todavia antes de la ventana real del
`Nightly` (11:00-14:00 UTC, ver `SES-135`) y sin señal de cambio en
Docker/Postgres/n8n (decimonoveno ciclo consecutivo igual, confirmado con
`git fetch` real). No se repitio ninguna investigacion nueva. A
diferencia de `SES-136`, esta sesion **no envio otro aviso proactivo** al
usuario: el aviso de `SES-136` (hace ~2h) ya cubre el mismo estado sin
cambios -- repetirlo seria ruido. Ver `docs/progress/PH10-T004.md`,
seccion `SES-20260916-138`, para el detalle completo.

## Nota -- SES-20260916-139

Ciclo hourly (~11:1x UTC), la primera vez que un ciclo cae dentro de la
ventana real del `Nightly` (11:00-14:00 UTC, ver `SES-135`). Se consulto
`api.github.com` (real, sin token) para el workflow `Nightly`:
`total_count` sigue en `4`, sin corrida nueva sobre `49b5f80`+ todavia --
esperable, ya que las 4 corridas historicas dispararon entre las 11:20 y
13:28 UTC y esta revision ocurrio justo al inicio de esa ventana.
Corresponde revisar de nuevo mas cerca de las 13:00-14:00 UTC antes de
concluir si corrio o no. Sin cambios en el bloqueo Docker/Postgres/n8n
(vigesimo ciclo consecutivo). Se evaluo y se descarto explicitamente
conectar `packages/alerting` (regla `backup.ts`) a una fuente real -- ver
`docs/progress/PH10-T004.md`, seccion `SES-20260916-139`, para el
detalle completo de por que eso es una decision de arquitectura nueva
fuera de alcance de este packet, no un bloqueo tecnico. No se envio otro
aviso proactivo (sin informacion nueva desde `SES-136`).

## Nota -- SES-20260916-140

Ciclo hourly (~12:15 UTC), vigesimo primer ciclo consecutivo sin cambios
en el bloqueo Docker/Postgres/n8n. Segunda revision del `Nightly` dentro
de la ventana observada (11:00-14:00 UTC): `total_count` sigue en `4`,
sin corrida nueva sobre `49b5f80`+ todavia -- se revisara de nuevo mas
cerca de las 13:00-14:00 UTC antes de concluir. No se repitio el aviso
proactivo al usuario (ya enviado en `SES-136`, sin informacion nueva que
justifique otro). Ver `docs/progress/PH10-T004.md`, seccion
`SES-20260916-140`, para el detalle completo.

## Nota -- SES-20260916-141

Hallazgo real relacionado con el punto 6 de "Que falta" (`export n8n` /
`Nightly` de CI): la corrida del `Nightly` sobre el HEAD actual
(`49b5f809`, `run_id=35095036869`, 2026-09-16T12:18:13Z) fue la primera
en superar `npm ci`/`build` (confirmando que la falla anterior
diagnosticada por `SES-135` era transitoria) pero fallo en el paso
"Aplicar migraciones reales del repo" con `exit code 3` real de `psql`.
Se reprodujo el error exacto (`syntax error at or near ":"` en
`0001_domain_v1.sql:606`, variable `:'migration_checksum'` sin definir)
en PostgreSQL 16 real (via `apt`, contenedor cloud de esta sesion, ya
que `device_bash` sigue sin Docker/Postgres). Causa raiz: el paso 7 de
`.github/workflows/nightly.yml` era el unico lugar del repo que aplicaba
`packages/db/migrations/*.sql` sin `-v migration_checksum=$(sha256sum
"$f" | cut -d' ' -f1)`, a diferencia de `aplicar-migraciones.sh` y
`scripts/test-domain-migration.sh`, que si lo hacen. Se corrigio
`nightly.yml` para seguir el mismo patron y se verifico con evidencia
real: las 8 migraciones + 3 seeds reales aplicaron sin error sobre una
base Postgres 16 efimera nueva, con los 8 checksums reales grabados en
`rhia.schema_migration` y 52 tablas en el schema `rhia`. **No se hizo
commit/push** (guardrail "Publicacion Git unicamente bajo control
humano") -- el fix queda en el working tree, pendiente de que el usuario
lo revise y publique. Ver `docs/progress/PH10-T004.md`, seccion
`SES-20260916-141`, para el detalle completo de diagnostico y
verificacion.


## Nota -- SES-20260916-142

Ciclo hourly (~14:12 UTC), vigesimo tercer ciclo consecutivo sin cambios
en el bloqueo Docker/Postgres/n8n en `device_bash` (confirmado de nuevo
con evidencia real: `which`, puertos `5432`/`5678`, `sudo -n`). Sin
push nuevo del fix de `nightly.yml` de `SES-141` (`git fetch` real,
sigue en `49b5f809`). El Nightly no genero corrida nueva desde
`run_id=35095036869` (`2026-09-16T12:18:13Z`) ya documentado por
`SES-141`. Se reconfirmo ademas, desde el contenedor cloud de esta
sesion, que Docker Hub sigue bloqueado por politica de egress y que
solo `PostgreSQL 16` esta disponible via `apt` -- misma brecha de los
puntos 3/4 de "Que falta" desde `SES-130`, sin cambios. No se repitio
el aviso proactivo (ya cubierto por `SES-141`). Ver
`docs/progress/PH10-T004.md`, seccion `SES-20260916-142`, para el
detalle completo.
