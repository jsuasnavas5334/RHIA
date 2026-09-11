# Runbook de alertas — RHIA (PH11-T002)

Este runbook es el destino real de `Alert.runbookRef` producido por
`@rhia/alerting`. Cada sección corresponde a una `AlertCategory` real del
paquete (`packages/alerting/src/contracts.ts`). Este documento no sustituye
el campo `cause`/`action` de cada alerta (que ya son específicos a la señal
real que la disparó) — da el procedimiento operativo general por categoría.

## search-degraded

**Cuándo se dispara:** un componente `search_engine:*` (ver
`@rhia/observability#computeComponentHealthScores`) fue clasificado
`DEGRADED` o `DOWN` en la ventana de evaluación (14 días, decaimiento
exponencial con vida media de 72h — mismos defaults documentados en
`docs/progress/PH11-T001.md`).

**Diagnóstico:**
1. Revisar el `HealthSnapshot` real más reciente — confirmar si es un motor
   específico (`search_engine:google`, `search_engine:bing`, etc.) o varios
   a la vez.
2. Revisar los eventos reales recientes de `rhia.system_health_event` para
   ese componente — ¿son fallos de red, rate-limit del proveedor, o cambios
   de API?
3. Confirmar si `@rhia/search-orchestrator` tiene un fallback real a otro
   motor configurado y si está siendo usado.

**Acción:** si es `DOWN`, considerar deshabilitar temporalmente ese motor en
la configuración real de búsqueda (`@rhia/config`) para evitar que las
tareas fallen esperando un proveedor caído; si es `DEGRADED`, monitorear —
no suspender proactivamente sin evidencia de fallos reales sostenidos.

## component-degraded

Mismo procedimiento que `search-degraded`, generalizado a cualquier otro
`ComponentKind` real (`model_provider`, `tool`, `db`, `app`, `n8n`,
`job_runtime`). El `component` exacto (`kind:name`) viene en `Alert.cause`.

## queue-stalled

**Cuándo se dispara:** el item pendiente más antiguo de una cola real lleva
más tiempo del umbral configurado (default 900s / 15 min).

**Diagnóstico:**
1. Identificar la cola real (`Alert.cause` incluye `queueName` y la edad
   real en segundos).
2. Confirmar si el worker/runtime que procesa esa cola está corriendo.
3. Revisar si el bloqueo es un rate-limit real de un proveedor externo, o
   una aprobación humana pendiente (`REQUEST_APPROVAL`/`DECIDE_APPROVAL` de
   `@rhia/policy`) que nadie ha resuelto.

**Acción:** reiniciar el worker si está caído; escalar a un humano si el
bloqueo es una aprobación pendiente real.

## backup-stale

**Cuándo se dispara:** no hay un backup exitoso reciente registrado (más de
26h desde el último, o ninguno registrado nunca).

**Nota de alcance real:** `PH10-T004` (Backup, restore y disaster recovery)
sigue `NOT_STARTED` a la fecha de este documento — esta categoría de alerta
está lista pero todavía no tiene un mecanismo real de backup que la
alimente. Cuando `PH10-T004` se implemente, debe emitir el timestamp real
del último backup exitoso hacia esta regla.

**Diagnóstico (una vez PH10-T004 exista):** confirmar si el job de backup
automático corrió y por qué falló (espacio en disco, credenciales, destino
de almacenamiento inaccesible).

**Acción de emergencia mientras tanto:** si se necesita un backup real hoy
sin automatización, seguir el procedimiento manual real de `pg_dump`
documentado en `PLAN_MAESTRO.md`/`CLAUDE.md` (verificar cuál aplica al
entorno de producción real antes de ejecutar cualquier comando).

## cost-budget

**Cuándo se dispara:** el gasto real (`BudgetPeriodUsage.spentUsd`, medido
por `@rhia/model-router`) diario o mensual alcanza el umbral soft (80% por
default) o el límite duro (100%).

**Diagnóstico:**
1. Revisar `Alert.cause` para el periodo (`daily`/`monthly`), el gasto real
   y el límite configurado.
2. Revisar qué `TaskClassId`/`ModelTier` está consumiendo más presupuesto —
   ¿un task class está enrutando a un tier más caro de lo necesario?

**Acción (soft):** monitorear, ajustar routing si el patrón no es
legítimo. **Acción (hard):** el router ya debería estar devolviendo
`SKIPPED_BUDGET` para tareas nuevas — confirmar que ese comportamiento real
está activo antes de considerar subir el límite.

## bounce-spike

**Cuándo se dispara:** la tasa real de `BOUNCED` sobre touches
`SENT`/`DELIVERED`/`BOUNCED` supera el umbral (5% por default), con una
muestra mínima real de 20 touches.

**Diagnóstico:**
1. Identificar el canal/secuencia real afectado (`Alert.cause`).
2. Revisar si la lista de contactos reciente tiene una fuente de baja
   calidad (scraping agresivo, datos viejos sin verificar).
3. Revisar la reputación real del dominio/número de envío (blacklists,
   SPF/DKIM/DMARC si aplica a email).

**Acción:** pausar la secuencia/canal afectado (usar el mecanismo real de
`@rhia/outreach-policy` — un `stopSignal` real, o deshabilitar el canal en
la política) hasta confirmar la causa raíz.

## policy-violation

**Cuándo se dispara:** el mismo principal (humano o de servicio) acumula 5+
decisiones `DENY` reales para la misma acción dentro de 15 minutos —
un patrón sostenido, no un rechazo aislado normal.

**Diagnóstico:**
1. Identificar el principal y la acción reales (`Alert.cause`).
2. Revisar si es: (a) un intento real de bypass/ataque, (b) un bug de
   integración reintentando ciegamente sin backoff, o (c) un agente/humano
   mal configurado pidiendo un permiso que nunca tendrá.

**Acción:** si es (a), tratar como incidente de seguridad real — revisar
`docs/security/threat-model.md` para el modelo de amenazas relevante. Si es
(b) o (c), corregir la configuración/integración, no solo silenciar la
alerta.
