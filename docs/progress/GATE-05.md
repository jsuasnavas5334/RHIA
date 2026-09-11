# Registro de gate GATE-05

```text
GATE: GATE-05
STATUS: DONE
COMMIT: No creado; publicación bajo control humano.
```

**Sesion:** SES-20260910-82 (misma sesion/ciclo que cerro `PH08-T004` y `PH08-T005` -- tarea programada, continuacion sin pedir confirmacion segun el Run Order).
**Fecha:** 2026-09-10 (America/Guayaquil).

## Alcance del gate (PLAN_MAESTRO.md, seccion 25)

"GATE-05 -- Outreach. Requiere PH08. Exactly-once logico. Max 3 touches. Opt-out. Approval de descuentos/commitments. Meeting tracking. Si falla: no se habilitan canales reales."

## Por que se evalua este gate ahora

El Run Order real (`PLAN_MAESTRO.md` seccion 26, paso 33) inserta `GATE-05` entre `PH08-T005` (paso 32, cerrado `DONE` en este mismo ciclo) y `PH09-T001` (paso 34) -- el Task Packet de `PH08-T005` dice "Handoff release metrics", pero esa frase describe la intencion del packet, no anula el Run Order numerado, que es la fuente de verdad sobre secuencia real. `PH08` (las 5 tareas) esta `DONE` -- condicion previa del gate cumplida.

## Condiciones verificadas esta sesion

| Condicion | Evidencia real | Resultado |
|---|---|---|
| PH08 completa | `data/project-status.json` tras este ciclo: `PH08-T001`..`PH08-T005` todas `DONE` (`docs/progress/PH08-T001.md`..`PH08-T005.md`) | PASS |
| Exactly-once logico | `@rhia/channel-gateway` (PH08-T001): idempotencia real sobre `core_idempotency` via `IdempotencyStore`, 24/24 tests (retry no duplica, fingerprint mismatch rechazado). `@rhia/meeting-scheduler` (PH08-T005, este ciclo): `bookMeeting` reusa la MISMA `IdempotencyStore` real -- test explicito "misma idempotencyKey no vuelve a llamar al adapter" (`adapter.createEventCalls.length === 1` tras dos llamadas). `apps/core-api` (PH04-T004): retry de job real mantiene `retry_count=1`, un audit, un registro idempotente (evidencia ya cerrada) | PASS |
| Max 3 touches | `@rhia/outreach-policy` (PH03-T003): `planNextTouch`, `maxProactiveTouches` default 3, boundary test real. `@rhia/sequence-engine` (PH08-T002): `runner.test.ts` "3-touch boundary" -- exactamente 3 llamadas reales a `send`, la 4ta devuelve `COMPLETE` SIN invocar `send` (`calls.length` verificado explicitamente) | PASS |
| Opt-out | `@rhia/outreach-policy`/`@rhia/sequence-engine`: ledger `OPTED_OUT` -> `STOPPED`/`OPT_OUT`, `send` nunca invocado (evidencia ya cerrada, PH03-T003/PH08-T002). `@rhia/conversation-agent` (PH08-T004, este mismo ciclo): intencion `OPT_OUT` SIEMPRE devuelve `action: 'SUPPRESS'` con `stopSignal: 'OPT_OUT'`, con PRIORIDAD sobre cualquier intencion comercial en el mismo mensaje (test explicito "opt-out tiene prioridad sobre una intencion comercial") | PASS |
| Approval de descuentos/commitments | Tres capas independientes, todas con evidencia real: (1) `@rhia/policy` (PH03-T002): `OFFER_DISCOUNT`/`CHANGE_COMMERCIAL_TERMS`/`COMMERCIAL_COMMITMENT` son `approval: 'HUMAN_REQUIRED'` en el motor de autorizacion real, permission matrix 7/7. (2) `apps/core-api` `ApprovalService` (PH04-T004): `CreateApproval`/`DecideApproval` reales sobre Postgres, autoaprobacion rechazada, E2E real `PENDING -> APPROVED`. (3) `@rhia/conversation-agent` (PH08-T004, este mismo ciclo): `DISCOUNT_REQUEST`/`COMMERCIAL_TERMS_REQUEST`/`COMMITMENT_REQUEST` SIEMPRE producen `action: 'ESCALATE'` con un `ApprovalDraft` (nunca `'REPLY'` con confirmacion) -- 9 tests reales, incluido el script E2E de objeciones completo | PASS (con brecha de wiring documentada, ver abajo -- no bloquea el gate) |
| Meeting tracking | `@rhia/meeting-scheduler` (PH08-T005, este mismo ciclo): booking/reschedule/no-show/cancel reales contra un `CalendarAdapter` inyectado, `attended`/`qualificationStatus`/`status` separados con evidencia real (18/18 tests), funnel KPI real (`computeMeetingFunnelKpis`) | PASS (con brecha de wiring documentada, ver abajo -- no bloquea el gate) |

## Brecha de wiring documentada (no bloquea el gate)

A diferencia de `GATE-04` (bloqueado por una condicion LITERAL y medible que no podia resolverse sin insumo humano: "Entity resolution supera gold dataset"), ninguna de las 5 condiciones de `GATE-05` exige explicitamente una conexion real a produccion -- exigen que la GARANTIA exista y este probada. Esa garantia existe y tiene evidencia real para las 5 condiciones (tabla arriba). La brecha real, documentada honestamente en cada packet (`PH08-T001` a `PH08-T005`), es que ningun motor tiene todavia un caller que lo conecte a Postgres/un proveedor real de canal o calendario/`apps/core-api`:

- `ApprovalDraft` (conversation-agent) no es un `CreateApproval` real -- le falta el `jobId` de un Job ya existente que solo un caller real conectado a `apps/core-api` puede aportar.
- `CalendarAdapter`/`ChannelProviderAdapter` (meeting-scheduler/channel-gateway) son puertos tipados sin ningun proveedor real (Google Calendar, n8n en produccion, etc.) conectado -- sin credenciales reales autorizadas en ningun ciclo hasta ahora.

Esto es exactamente lo que la consecuencia del gate ya anticipa: **"Si falla: no se habilitan canales reales"** -- hoy NINGUN canal real esta habilitado en el proyecto (documentado consistentemente desde `PH08-T001`), asi que esa consecuencia ya se cumple por diseño, independientemente del resultado de este gate. El gate en si pregunta si la LOGICA (exactly-once, limite de toques, opt-out, approval obligatorio, tracking de reuniones) esta garantizada antes de conectar canales reales -- y lo esta, con tests reales en cada capa.

## Estado de las tareas del plan

`PH08` (`T001` a `T005`) esta **DONE**. Ninguna tarea se reabre por este gate -- cada una ya cerro con su propio "Fuera de alcance" documentado.

## Siguiente paso

`GATE-05` queda `DONE`. El Run Order (`PLAN_MAESTRO.md` seccion 26, paso 34) indica `PH09-T001` (Crear Tool Registry) como siguiente tarea, dentro de `PH09 -- Tools, Playwright y Computer Use` (Context Packet: "permitir a agentes operar herramientas externas con control, seguridad y evidencia", orden "API -> Playwright -> Computer Use"). Este mismo ciclo continua directamente con `PH09-T001` -- releer su Task Packet completo en `PLAN_MAESTRO.md` antes de escribir codigo y confirmar sus dependencias reales, no asumir solo por el resumen de fases.
