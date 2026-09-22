# PH11-T003 — Deployment Local-Prod Reproducible

**Fecha:** 2026-09-22  
**Estado:** READY FOR EXECUTION (George only)  
**Objetivo:** Arrancar RHIA con pocos pasos y auto-restart después de reboot  
**Criterio de aceptación:** "Arranque tras reboot" + "Reinicio de PC recupera servicios"

## Resumen Ejecutivo

Este documento guía a George paso a paso para hacer que RHIA se **reinicie automáticamente** después de que su PC se reinicie, **sin intervención manual**.

Hoy: George arranca manualmente STAR.BAT después de que Docker estuviera corriendo.  
Mañana: PC se reinicia → Docker containers se recuperan solos (`unless-stopped`) → Node.js se arranca solo → todo funciona.

**Tiempo esperado:** ~15 minutos de ejecución manual + 1 reboot real.

---

## Alcance y Decisión de Diseño

**ADR-0002 es la norma:** Producción local en la PC de George, sin orquestación de contenedores para v1.

- ✅ **Decisión:** No recreamos contenedores Docker. Los 4 contenedores activos (`rhia-postgres`, `rhia-n8n`, `rhia-searxng`, `rhia-ollama`) existen ya desde hace semanas en la PC de George.
- ✅ **Lo que sí hacemos:** Capturamos su configuración en `infrastructure/docker-compose.yml` (para documentación y futuras migraciones), configuramos `restart: unless-stopped` (Docker nativo, sin orquestación), y automatizamos el arranque de Node.js vía Task Scheduler de Windows.
- ✅ **Riesgo controlado:** Los scripts que escribimos **nunca detienen, recrean ni reinician contenedores activos**. Solo los vigilan y esperan a que arranquen solos.

---

## Infraestructura Actual (Capturada)

| Componente | Imagen | Puerto | Red | Volumen |
|---|---|---|---|---|
| `rhia-postgres` | `postgres:18` | interno | rhia_internal | rhia_postgres_data |
| `rhia-n8n` | `docker.n8n.io/n8nio/n8n:latest` | 127.0.0.1:5678 | rhia_internal | rhia_n8n_data |
| `rhia-searxng` | `searxng/searxng:latest` | interno:8080 | rhia_internal | rhia_searxng_cache |
| `rhia-ollama` | `ollama/ollama:latest` | interno:11434 | rhia_internal | rhia_ollama_data |

Todos comparten la red `rhia_internal` (172.18.0.0/16).

---

## Qué Hacemos: 5 Pasos

### 1️⃣ Configurar Restart Policies en Docker (Idempotente)

**Archivo:** `scripts/rhia-configure-restart-policies.ps1`

**Qué hace:** Dice a Docker "si mi contenedor se muere o Docker Desktop se reinicia, arranca conmigo solos" (restart policy = `unless-stopped`).

**Importante:** NO detiene, NO recrea, NO reinicia contenedores. Solo cambia la política para la próxima vez.

**Ejecución (desde PowerShell como admin):**
```powershell
cd C:\Users\jesfu\Desktop\Software RHIA
.\scripts\rhia-configure-restart-policies.ps1
```

**Salida esperada:**
```
RHIA: configurando restart policy 'unless-stopped' en 4 contenedores conocidos.
OK    rhia-postgres -- ya tiene 'unless-stopped', sin cambios.
OK    rhia-n8n -- ya tiene 'unless-stopped', sin cambios.
OK    rhia-searxng -- ya tiene 'unless-stopped', sin cambios.
OK    rhia-ollama -- ya tiene 'unless-stopped', sin cambios.
```

Si alguno dice "SKIP" (no existe), revisá `docker ps -a` — probablemente ya está bien.

---

### 2️⃣ Registrar Tarea Automática en Windows (Una sola vez)

**Archivo:** `scripts/rhia-register-startup-task.ps1`

**Qué hace:** Crea una tarea en "Task Scheduler" que corre `rhia-boot.ps1` cada vez que te logueás en Windows. La tarea es idempotente: si ya existe, solo confirma que está bien.

**Ejecución (desde PowerShell como admin):**
```powershell
cd C:\Users\jesfu\Desktop\Software RHIA
.\scripts\rhia-register-startup-task.ps1
```

**Salida esperada:**
```
Registrando tarea 'RHIA-Boot' en Task Scheduler...
Tarea registrada exitosamente o ya existe.
```

**Qué corre la tarea:**
- El script `rhia-boot.ps1` se ejecutará automáticamente al siguiente logon de Windows
- `rhia-boot.ps1` espera a que los contenedores Docker estén listos
- Luego corre `STAR.BAT` (el monitor local del repo, igual que hoy lo hacés a mano)
- Registra cada paso en `logs/rhia-boot.ndjson` (para debugging)

---

### 3️⃣ Probar el Boot Script a Mano (Validación)

**Archivo:** `scripts/rhia-boot.ps1`

**Qué hace:** Simula lo que pasará automáticamente después de cada reboot.

**Ejecución manual (desde PowerShell como admin):**
```powershell
cd C:\Users\jesfu\Desktop\Software RHIA
.\scripts\rhia-boot.ps1
```

**Qué pasa:**
1. Verifica que Docker Desktop esté corriendo (si no, lo intenta abrir)
2. Espera a que `rhia-postgres` responda en puerto 5432 (max 30s)
3. Espera a que `rhia-n8n` responda en puerto 5678 (max 30s)
4. Ejecuta `scripts/wait-for-rhia-dependencies.mjs` (validación completa)
5. Si todo está bien, corre `STAR.BAT` (arranca el monitor local)
6. Registra cada evento en `logs/rhia-boot.ndjson`

**Salida esperada:**
```
RHIA: verificando Docker Desktop...
RHIA: Docker Desktop está corriendo.
RHIA: esperando rhia-postgres:5432...
RHIA: rhia-postgres listo.
RHIA: esperando rhia-n8n:5678...
RHIA: rhia-n8n listo.
RHIA: ejecutando verificación de dependencias...
wait-for-rhia-dependencies: OK (8/8 bloques)
RHIA: iniciando monitor local (STAR.BAT)...
```

**Log:**
```
cat logs/rhia-boot.ndjson
```

Deberías ver líneas JSON con eventos ("rhia-boot-start", "docker-check-ok", "postgres-ready", etc.).

---

### 4️⃣ Reinicio Real de la PC (Validación Final)

**Esto lo hace George manualmente cuando esté listo.**

1. Cierra todas las ventanas de PowerShell/CMD abiertas
2. Cierra Docker Desktop (Ctrl+click en la bandeja → Quit Docker Desktop)
3. **Reinicia la PC** (Win + X → Shutdown → Restart)
4. Espera a que Windows se inicie de nuevo
5. **Observa:** Docker Desktop se abre solo, contenedores inician, monitor aparece en `localhost:4173`

**Verificación:**
```powershell
# Desde PowerShell, después del reboot
docker ps
# Deberías ver los 4 contenedores con estado "Up"

cat logs/rhia-boot.ndjson
# Deberías ver un evento "rhia-boot-start" nuevo, con timestamp del reboot
```

---

### 5️⃣ Configurar Variables de Entorno (Secretos)

Los contenedores Docker necesitan credenciales. Ya existen en tu máquina (se usan en los contenedores activos).

**Opción A: Usar archivo `.env` (recomendado)**

1. Copia `infrastructure/env.example` a `infrastructure/.env`
   ```bash
   copy infrastructure\.env.example infrastructure\.env
   ```

2. Abre `infrastructure/.env` en Notepad y **llena los valores reales:**
   - `POSTGRES_PASSWORD`: contraseña de rhia en PostgreSQL
   - `N8N_DB_PASSWORD`: contraseña de n8n en PostgreSQL
   - `N8N_ENCRYPTION_KEY`: clave de cifrado de n8n (si tienes)
   - `SEARXNG_SECRET`: secreto de SearXNG

3. **Nunca comitas** `infrastructure/.env` — está en `.gitignore`

**Opción B: Variables de entorno del sistema (actual, si lo prefieres)**

Si hoy usás variables de entorno de Windows, seguirán funcionando. Los scripts no las cambian.

---

## Verificación de Criterios

| Criterio | Cómo verificar |
|---|---|
| ✅ Arranque tras reboot | Reboot real → `docker ps` muestra 4 contenedores "Up" |
| ✅ No intervención en n8n | `scripts/rhia-boot.ps1` no toca n8n, solo espera |
| ✅ Version visible | `curl http://127.0.0.1:4173/api/status` → version en JSON |

---

## Troubleshooting

### Problema: "Docker no responde"

```powershell
# Verifica que Docker Desktop esté corriendo
docker ps
# Si da error, abre Docker Desktop desde el menú Inicio
```

### Problema: "Timeout esperando a postgres"

```powershell
# Verifica que el contenedor exista y esté corriendo
docker ps | grep rhia-postgres
# Si no está, fue parado manualmente o se crasheó
docker logs rhia-postgres
# Ver qué salió mal en el log
```

### Problema: "La tarea no se ejecutó después del reboot"

```powershell
# Verifica que la tarea está registrada
Get-ScheduledTask -TaskName "RHIA-Boot"
# Si dice "No tasks are running", se puede haber perdido
# Vuelve a ejecutar: .\scripts\rhia-register-startup-task.ps1

# Ver el log del último intento
Get-ScheduledTaskInfo -TaskName "RHIA-Boot"
```

### Problema: "logs/rhia-boot.ndjson no existe"

Es normal en la primera ejecución. Se crea al ejecutar `rhia-boot.ps1` por primera vez.

---

## Orden de Ejecución (Checklist para George)

**Recomendación:** Hacé esto en este orden, en una sola sesión:

```
[ ] 1. Abre PowerShell como admin
[ ] 2. cd C:\Users\jesfu\Desktop\Software RHIA
[ ] 3. .\scripts\rhia-configure-restart-policies.ps1
       (verifica: "OK" para los 4 contenedores)
[ ] 4. .\scripts\rhia-register-startup-task.ps1
       (verifica: "Tarea registrada o ya existe")
[ ] 5. .\scripts\rhia-boot.ps1
       (verifica: arranca y dice "OK (8/8 bloques)", STAR.BAT aparece)
[ ] 6. cat logs/rhia-boot.ndjson
       (verifica: ves eventos JSON, sin errores)
[ ] 7. Cierra todo y reinicia la PC
[ ] 8. Espera a que Docker + monitor arranquen solos
[ ] 9. docker ps → verifica 4 contenedores Up
[ ]10. curl http://127.0.0.1:4173/api/status → verifica API
```

---

## Próximos Pasos (Automático)

Una vez que confirmes el reboot real:

1. El projeto pasa a estado `DONE` para `PH11-T003`
2. Se desbloquea `PH11-T004` (preparar migración VPS/cloud)
3. Se desbloquea `GATE-07` (evaluación de readiness)

---

## Referencia Técnica

### Scripts Involucrados

- `scripts/rhia-configure-restart-policies.ps1` — `docker update --restart=unless-stopped`
- `scripts/rhia-register-startup-task.ps1` — Registra tarea en Task Scheduler
- `scripts/rhia-boot.ps1` — Orquesta: Docker → espera → dependencias → STAR.BAT
- `scripts/wait-for-rhia-dependencies.mjs` — Espera TCP + HTTP con reintentos
- `infrastructure/docker-compose.yml` — Documentación de infraestructura (no se ejecuta)
- `infrastructure/searxng/settings.yml` — Configuración de SearXNG (opcional, para futuras migraciones)

### Archivos Generados

- `logs/rhia-boot.ndjson` — Log de cada ejecución (JSON Lines, sin pushear)
- `infrastructure/.env` — Secretos (crear desde `.env.example`, no pushear)

### Guardrails en Lugar

- **Sin borrado:** Scripts nunca eliminan contenedores ni datos
- **Idempotentes:** Ejecutar 2+ veces = mismo resultado
- **Transparentes:** Cada paso registra evento en JSON
- **Reversibles:** Si algo falla, `STOP.BAT` sigue funcionando

---

## Dudas Frecuentes

**P: ¿Qué pasa si Docker Desktop se crashea?**  
R: Restart policy lo reinicia solo (Docker nativo). Scripts lo esperan.

**P: ¿Puedo seguir usando STAR.BAT/STOP.BAT manuales?**  
R: Sí. Los scripts son optionales. Si los scripts no están, seguis como hoy.

**P: ¿Qué pasa con datos de n8n/PostgreSQL?**  
R: Están en volúmenes Docker persistentes. Sobreviven reboot.

**P: ¿Cómo desactivo el autoboot si no lo quiero?**  
R: `Get-ScheduledTask -TaskName "RHIA-Boot" | Disable-ScheduledTask`

---

## Contacto y Debugging

Si algo no funciona:

1. Revisá `logs/rhia-boot.ndjson` (si existe)
2. Ejecutá manualmente: `.\scripts\rhia-boot.ps1` (con output en consola)
3. Revisá `docker logs rhia-postgres` (si queda stuck)
4. Abrí un nuevo issue con el error exacto y el contenido de `rhia-boot.ndjson`

---

**Fecha de creación:** 2026-09-22  
**Última actualización:** 2026-09-22  
**Estado:** DRAFT (no pulleado a main hasta que George confirme reboot)
