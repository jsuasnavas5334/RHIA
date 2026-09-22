# Registro de gate GATE-06

```text
GATE: GATE-06
STATUS: DONE
COMMIT: No creado; publicación bajo control humano.
```

**Sesión:** SES-20260918-181 (tarea programada, cron horario, ~05:12 UTC del
2026-09-18, continuación sin pedir confirmación según el Run Order --
inmediatamente después de que `PH10-T004` (paso 40) pasó a `DONE` en
`SES-20260918-CHAT (continuación)`, sesión atendida en vivo con George que
se solapó parcialmente en el tiempo con el arranque de este ciclo
automatizado).
**Fecha:** 2026-09-18 (UTC).

## Alcance del gate (PLAN_MAESTRO.md, sección 25)

"GATE-06 -- Tools y seguridad. Requiere PH09-PH10. Tool permissions.
Computer Use sandbox. Threat model. Backup restore. Si falla: no
producción."

## Por qué se evalúa este gate ahora

El Run Order real (`PLAN_MAESTRO.md` sección 26, paso 41) inserta
`GATE-06` inmediatamente después de `PH10-T004` (paso 40), que pasó de
`PARTIAL` a `DONE` en `SES-20260918-CHAT (continuación)` (ver
`docs/progress/PH10-T004.md` y `docs/runbooks/disaster-recovery-runbook.md`,
commit `e8d4806`). `PH09` (4 tareas) y `PH10` (4 tareas) están ambas
completas -- condición previa del gate cumplida.

## Condiciones verificadas esta sesión

| Condición | Evidencia real | Resultado |
|---|---|---|
| Tool permissions | `PH09-T001` (`@rhia/tool-registry`, `docs/progress/PH09-T001.md`): autorización de invocación reusando el modelo de capabilities real de `@rhia/policy`, health check fail-closed | PASS |
| Computer Use sandbox | `PH09-T003` (`@rhia/computer-use`, `docs/progress/PH09-T003.md`): sandbox aislado, observación real antes/después de cada acción, step limits, risk checkpoints con aprobación humana real, fallback humano explícito | PASS |
| Threat model | `PH10-T003` (`docs/security/threat-model.md` + `docs/progress/PH10-T003.md`): modelo STRIDE-like con pruebas adversariales reales para "Adversarial evidence", "Malicious URL", "Role escalation", más "Tool abuse"/"Data exfiltration" sin prueba nombrada -- 1 hallazgo real documentado explícitamente, no corregido ese ciclo (ver "Fuera de alcance" de `PH10-T003`, no bloquea este gate porque el hallazgo está documentado y no oculto) | PASS |
| Backup restore | `PH10-T004` (`docs/progress/PH10-T004.md`, sección `SES-20260918-CHAT (continuación)`): backup automático real (Task Scheduler diario probado, `rhia-postgres-20260918T043321Z`), full restore drill real contra PostgreSQL 18 real de producción (185/185 tablas, `verify-postgres-backup.sh` sin modificar, sin tocar `rhia-postgres` real -- contenedor temporal aislado autodestruido) y corrupt backup test real (truncado real de 2000 bytes + SHA256SUMS recalculado sobre contenido dañado, rechazo real confirmado por GnuPG + `pg_restore`). Corroborado de forma independiente este mismo ciclo (ver abajo) | PASS |

## Corroboración independiente de este ciclo (no requerida para cerrar el gate, evidencia adicional)

Antes de confirmar que `SES-20260918-CHAT` ya había cerrado `PH10-T004` con
evidencia contra producción real, esta sesión ejecutó por su cuenta -- en
el contenedor cloud efímero de Claude, nunca en el dispositivo del usuario
-- un restore drill y un corrupt backup test independientes contra
PostgreSQL 16 real (vía `apt`, sin Docker), replicando exactamente la
secuencia de comandos de `scripts/backup-postgres.sh`/
`scripts/verify-postgres-backup.sh` sobre el schema real capturado
(`docs/baseline/database/{rhia_core,n8n}.schema.sql`, 133 tablas) con
57,688 filas sintéticas en `city_context` (volumen representativo de
producción, no solo una fila de prueba como en `SES-20260916-130`).
Resultado: 133/133 tablas restauradas con conteos idénticos (RTO medido:
1.7s sobre este dataset), y el archivo corrupto (200 bytes dispersos
alterados) fue rechazado correctamente por `pg_restore`
(`could not read from input file: end of file`) con hashes SHA256
divergentes confirmando la capa de detección adicional. Todos los recursos
de prueba (clústeres, bases de datos, passphrase) se destruyeron al
terminar; nunca se tocaron datos ni infraestructura reales. Esta
corroboración es redundante frente a la evidencia de `SES-20260918-CHAT`
(que sí corrió contra PostgreSQL 18 real de producción, más fuerte), pero
confirma independientemente que el pipeline real (`backup-postgres.sh` +
`verify-postgres-backup.sh` + `check-backup-age.sh`) funciona
correctamente y de forma reproducible en un entorno completamente distinto.

## Brecha documentada (no bloquea el gate)

`Age monitor` (parte de los criterios de aceptación originales de
`PH10-T004`, no de este gate) sigue siendo un script correcto
(`scripts/check-backup-age.sh`, confirmado funcional este ciclo) invocado
manualmente por cada sesión automatizada horaria, no por un segundo Task
Scheduler/cron real independiente. Esto ya fue suficiente en la práctica
para detectar y escalar una incidencia real (backup de 28+ días, `SES-171`
a `SES-178`) que resultó en acción humana correctiva. Se documenta como
mejora futura recomendada (agregar `check-backup-age.sh` como una segunda
acción en la tarea `RHIA - Backup diario` de Task Scheduler, cambio de
~2 minutos vía la GUI de Windows, solo George puede hacerlo), no como
bloqueo de este gate ni de `PH10-T004` -- el Task Packet de `PH10-T004`
solo exige "Age monitor" como criterio de aceptación (script que
funciona), no "monitor con alerta automática 24/7 en canal externo".

## Estado de las tareas del plan

`PH09` (`T001` a `T004`) y `PH10` (`T001` a `T004`) están ambas **DONE**.
Ninguna tarea se reabre por este gate.

## Siguiente paso

`GATE-06` queda `DONE`. El Run Order (`PLAN_MAESTRO.md` sección 26, pasos
42-44) indica `PH11-T002` (ya `DONE`, ver `docs/progress/PH11-T002.md`),
luego `PH11-T003` (Crear deployment local-prod reproducible) y `PH11-T004`.
`PH11-T003` exige como criterios de aceptación reales "Arranque tras
reboot" y "Reinicio de PC recupera servicios", con pruebas requeridas
"Cold boot" y "Unexpected restart" -- un reinicio/apagado real de la
máquina de producción de George. Esto es una acción exclusivamente humana
(nadie debe reiniciar remotamente la PC de producción de otra persona sin
su presencia y supervisión directa, y el guardrail fijo del proyecto
"Sin reinicios antes de baseline y backup" refuerza la misma cautela) --
no algo que este ciclo automatizado deba o pueda intentar. `PH11-T004`
depende además de `PH11-T003`, así que tampoco es tratable todavía. El
Run Order queda bloqueado en el paso 43 pendiente de que George, en una
sesión atendida, decida programar y supervisar personalmente un
reinicio/cold boot real de su máquina de producción cuando le convenga.
