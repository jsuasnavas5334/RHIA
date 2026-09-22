# Runbook de deployment local-prod — PH11-T003

**Estado del packet:** `PARTIAL`. Ver `docs/progress/PH11-T003.md` para el
detalle completo. Este runbook documenta lo que ya existe con evidencia
real (script de espera de dependencias, probado) y lo que está escrito
pero sin ejecutar todavía (los tres scripts de PowerShell, sin acceso real
a la máquina de George desde este ciclo) y lo que sigue exigiendo acción
humana (probar un reinicio real).

## Alcance y decisión de diseño

Producción de RHIA v1 es la PC personal de George, siempre encendida
(`docs/architecture/adr/ADR-0002-produccion-pc-local.md`). Esa misma ADR
rechaza explícitamente orquestación de contenedores para v1 ("no hace
falta orquestación de contenedores en la nube ni multi-servidor").

Por eso este packet **no entrega un `docker-compose.yml`**: los
contenedores reales (`rhia-postgres`, `rhia-n8n`, `rhia-searxng`,
`rhia-ollama`, ver `CLAUDE.md`) ya existen, creados a mano por George.
Convertirlos a un proyecto Compose arriesgaría recrearlos (posible pérdida
de nombre/red/volúmenes si el proyecto Compose no coincide exactamente) --
eso violaría la regla fija de este proyecto de no tocar infraestructura de
producción de forma no aditiva. En su lugar, "Compose final" (acción 1 del
Task Packet) se resuelve como la topología documentada abajo más restart
policies individuales sobre los contenedores existentes -- mismo efecto
práctico (auto-recuperación), sin recrear nada.

## Topología real (equivalente a "compose final")

| Contenedor | Rol | Puerto | Dependencia de arranque |
| --- | --- | --- | --- |
| `rhia-postgres` | Bases `rhia_core` + `n8n` (PostgreSQL) | 5432 | Ninguna (primero) |
| `rhia-n8n` | Orquestador de workflows | 5678 | `rhia-postgres` |
| `rhia-searxng` | Meta-búsqueda (PH06) | -- | Ninguna |
| `rhia-ollama` | Modelos locales (PH05) | -- | Ninguna |
| Monitor local (`STAR.BAT` / `scripts/start-local.mjs`) | Bitácora `http://localhost:4173/` | 4173 | `rhia-postgres`, `rhia-n8n` (lee `data/project-status.json`, no la BD directamente hoy, pero el arranque orquestado espera igual por consistencia) |

`apps/core-api` y `apps/agent-runtime` **no son servicios corriendo hoy**
(confirmado en `docs/progress/PH11-T002.md`: son paquetes puros, sin
wiring real a un servidor/worker) -- no forman parte del arranque
automatizado todavía. Cuando un ciclo futuro los convierta en procesos
reales, deben agregarse a `scripts/wait-for-rhia-dependencies.mjs` y a
`scripts/rhia-boot.ps1`.

## Componentes nuevos de este packet

| Script | Qué hace | Evidencia |
| --- | --- | --- |
| `scripts/wait-for-rhia-dependencies.mjs` | Espera activa (TCP a `rhia-postgres:5432`, HTTP a `rhia-n8n:5678/healthz`) con reintentos y backoff; registra cada corrida en `logs/rhia-boot.ndjson` (gitignored) | **Real**: `node scripts/test-wait-for-rhia-dependencies.mjs` -- 8/8 bloques, incluida una sección con I/O de red real contra un servidor TCP efímero en loopback (no mockeada) |
| `scripts/rhia-configure-restart-policies.ps1` | Pone `restart=unless-stopped` en los 4 contenedores existentes vía `docker update` (no detiene/recrea nada); idempotente | Sin ejecutar -- ver "Qué falta" |
| `scripts/rhia-register-startup-task.ps1` | Registra la tarea programada `RHIA-Boot` (`AtLogOn`) que corre `rhia-boot.ps1`; no crea duplicados si ya existe | Sin ejecutar -- ver "Qué falta" |
| `scripts/rhia-boot.ps1` | Orquesta el arranque real: asegura Docker Desktop corriendo, espera contenedores `Running`, corre `wait-for-rhia-dependencies.mjs`, arranca `STAR.BAT`; registra cada paso en `logs/rhia-boot.ndjson` | Sin ejecutar -- ver "Qué falta" |

`logs/rhia-boot.ndjson` queda cubierto por la regla `logs/` de
`.gitignore` -- no se versiona, pero sirve de evidencia real para que un
ciclo futuro (o George) confirme si un arranque automatizado funcionó, sin
necesitar que alguien lo reporte a mano en el chat.

## Procedimiento: puesta en marcha (a ejecutar por George, una sola vez)

Desde PowerShell, en la carpeta del proyecto:

```powershell
cd "C:\Users\jesfu\Desktop\Software RHIA"
.\scripts\rhia-configure-restart-policies.ps1
.\scripts\rhia-register-startup-task.ps1
```

Para probar el arranque completo sin esperar un reinicio real:

```powershell
.\scripts\rhia-boot.ps1
Get-Content .\logs\rhia-boot.ndjson -Tail 20
```

Si `rhia-boot.ps1` termina con `RHIA boot: dependencias listas, monitor
local arrancado.` y `http://localhost:4173/` responde, el flujo funciona
sin necesidad todavía de un reinicio real.

## Procedimiento: actualizar RHIA (acción 6 del Task Packet)

1. Publicar cambios como siempre, exclusivamente manual: `SUBIRALGIT.BAT`
   (nunca commits/push automáticos -- ver `CLAUDE.md`).
2. En la PC de producción: `git pull` (o volver a correr `SUBIRALGIT.BAT`
   del lado que corresponda), luego `npm run build`.
3. Reiniciar solo el monitor local: `STOP.BAT` seguido de `STAR.BAT` (o
   dejar que la tarea programada lo haga en el próximo inicio de sesión).
4. Los contenedores (`rhia-postgres`, `rhia-n8n`, etc.) no se tocan en una
   actualización de código de la app -- solo si cambia su imagen, lo cual
   es una decisión aparte y explícita, nunca parte de este procedimiento.

No hace falta reiniciar Docker ni los contenedores para una actualización
normal de código.

## Qué falta (no tratable desde este ciclo)

1. **Ejecutar los 3 scripts de PowerShell una vez en la máquina real.**
   Este ciclo no tiene acceso a PowerShell/Docker/Task Scheduler reales
   (solo al repositorio vía el bridge de carpeta conectada) -- confirmado
   con `which docker`/`which pwsh` (ambos ausentes) y un intento de
   descargar PowerShell bloqueado por el proxy de red de este entorno. Los
   3 scripts están escritos siguiendo los patrones ya usados en
   `scripts/start-local.ps1`, revisados a mano (balance de `{}`/`()`
   verificado programáticamente), pero **sin ejecutar** -- evidencia
   honesta, no simulada.
2. **Criterios de aceptación reales del packet** ("Arranque tras reboot",
   validación final "Reinicio de PC recupera servicios") y **pruebas
   requeridas** ("Cold boot", "Unexpected restart"): exigen un reinicio
   real de la PC de producción de George. Ningún ciclo automatizado debe
   intentar esto (guardrail fijo del proyecto: "Sin reinicios antes de
   baseline y backup"; además `CLAUDE.md` -- "No reinicies WSL ni estos
   servicios sin comprobar estado, baseline y backup"). `PH10-T004`
   (backup real) ya está `DONE`, así que el backup previo ya no es el
   bloqueante -- pero la acción del reinicio en sí sigue siendo
   exclusivamente humana.

## Próximo paso para George (cuando le convenga)

1. Correr el "Procedimiento: puesta en marcha" de arriba (3 comandos, ~2
   minutos, ninguno reinicia nada).
2. Cuando le convenga, reiniciar la PC normalmente (Windows Update,
   mantenimiento, o el reinicio que se documentó como pendiente desde
   `SES-20260918-181`).
3. Después del reinicio, revisar `logs\rhia-boot.ndjson` y confirmar que
   `http://localhost:4173/` responde solo, sin abrir ninguna terminal a
   mano.
4. Un ciclo futuro puede leer `logs/rhia-boot.ndjson` (vía el bridge, sin
   pedirle nada a George) para cerrar `PH11-T003` con evidencia real del
   reinicio, y desbloquear `PH11-T004`.
