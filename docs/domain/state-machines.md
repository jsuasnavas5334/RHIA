# Máquinas de estado y catálogo de errores RHIA

**Task ID:** `PH03-T004`  
**Versión:** `1.0`  
**Fuente ejecutable:** `packages/domain/src/states.ts` y `packages/domain/src/errors.ts`

## Reglas comunes

- Los estados y códigos son valores cerrados, en mayúsculas y sin texto libre.
- Una transición solo es válida cuando aparece en la máquina correspondiente. `assertTransition` produce `RHIA_STATE_INVALID_TRANSITION` en cualquier otro caso.
- Los estados terminales no tienen transiciones de salida.
- La base de datos rechaza estados y códigos desconocidos mediante `0002_state_taxonomy.sql`.
- Cambiar un estado o código exige cambiar código, migración, documentación y pruebas en la misma versión.

## Job

```text
PENDING -> QUEUED -> RUNNING -> SUCCEEDED*
   |         |          |----> PARTIAL*
   |         |          |----> FAILED*
   |         |          |----> RETRY_SCHEDULED -> QUEUED
   |         |          |              |--------> DEAD_LETTER*
   +---------+----------+-----------------------> CANCELLED*
```

Terminales: `SUCCEEDED`, `PARTIAL`, `FAILED`, `CANCELLED`, `DEAD_LETTER`. Un error reintentable lleva a `RETRY_SCHEDULED`; agotar intentos lleva a `DEAD_LETTER` con `RHIA_JOB_RETRY_EXHAUSTED`.

| Desde | Transiciones permitidas |
|---|---|
| PENDING | QUEUED, CANCELLED |
| QUEUED | RUNNING, CANCELLED |
| RUNNING | SUCCEEDED, PARTIAL, FAILED, RETRY_SCHEDULED, CANCELLED |
| RETRY_SCHEDULED | QUEUED, DEAD_LETTER, CANCELLED |
| SUCCEEDED, PARTIAL, FAILED, CANCELLED, DEAD_LETTER | ninguna |

## Evidence

```text
COLLECTED -> VALIDATED -> ACTIVE -> STALE -> VALIDATED
    |           |          |          |
    |           +----------+----------+-> CONTRADICTED -> VALIDATED
    |                                         |          
    +-----------------------------------------+-> REJECTED*
                         ACTIVE/STALE/CONTRADICTED -> SUPERSEDED*
```

Terminales: `REJECTED`, `SUPERSEDED`. `STALE` y `CONTRADICTED` no son terminales porque admiten revalidación.

| Desde | Transiciones permitidas |
|---|---|
| COLLECTED | VALIDATED, REJECTED |
| VALIDATED | ACTIVE, CONTRADICTED, REJECTED |
| ACTIVE | STALE, CONTRADICTED, SUPERSEDED |
| STALE | VALIDATED, SUPERSEDED |
| CONTRADICTED | VALIDATED, REJECTED, SUPERSEDED |
| REJECTED, SUPERSEDED | ninguna |

## Opportunity

```text
DISCOVERED -> QUALIFYING -> QUALIFIED -> OUTREACH_ACTIVE -> ENGAGED
    |            |             |                |              |
    |            +-----------> NURTURE <---------+--------------+
    |                              |             |
    |                              +-----------> MEETING_BOOKED -> WON*
    +---------------------------> DISQUALIFIED*          |------> LOST*
```

Terminales: `WON`, `LOST`, `DISQUALIFIED`. `opportunity.stage` expresa el estado comercial; `opportunity.status` es solo el ciclo de vida del registro (`OPEN`, `CLOSED`, `ARCHIVED`) y no reemplaza la máquina.

| Desde | Transiciones permitidas |
|---|---|
| DISCOVERED | QUALIFYING, DISQUALIFIED |
| QUALIFYING | QUALIFIED, NURTURE, DISQUALIFIED |
| QUALIFIED | OUTREACH_ACTIVE, NURTURE, DISQUALIFIED |
| NURTURE | QUALIFYING, OUTREACH_ACTIVE, LOST |
| OUTREACH_ACTIVE | ENGAGED, MEETING_BOOKED, NURTURE, LOST |
| ENGAGED | MEETING_BOOKED, NURTURE, LOST |
| MEETING_BOOKED | WON, NURTURE, LOST |
| WON, LOST, DISQUALIFIED | ninguna |

## Message

La entrega se persiste en `outreach_touch`; `rhia.message` conserva el mensaje observado de una conversación.

```text
DRAFT -> PENDING_APPROVAL -> APPROVED -> PLANNED -> SENDING -> SENT -> DELIVERED -> REPLIED*
   |             |             |          |          |        |          |
   +-------------+-------------+----------+----------+-------> CANCELLED*
                                           +---------> OPTED_OUT*
                                                      +------> BOUNCED*
                                                      +------> FAILED*
```

Terminales: `REPLIED`, `BOUNCED`, `FAILED`, `CANCELLED`, `OPTED_OUT`. `OPTED_OUT` nunca se reintenta.

| Desde | Transiciones permitidas |
|---|---|
| DRAFT | PENDING_APPROVAL, APPROVED, CANCELLED |
| PENDING_APPROVAL | APPROVED, CANCELLED |
| APPROVED | PLANNED, CANCELLED |
| PLANNED | SENDING, CANCELLED, OPTED_OUT |
| SENDING | SENT, FAILED, OPTED_OUT |
| SENT | DELIVERED, REPLIED, BOUNCED, FAILED, OPTED_OUT |
| DELIVERED | REPLIED, OPTED_OUT |
| REPLIED, BOUNCED, FAILED, CANCELLED, OPTED_OUT | ninguna |

## Meeting

```text
BOOKED -> CONFIRMED -> ATTENDED*
   |          |------> NO_SHOW*
   |          |------> CANCELLED*
   +----------+------> RESCHEDULED*
```

Terminales: `ATTENDED`, `NO_SHOW`, `CANCELLED`, `RESCHEDULED`. Una reprogramación crea una nueva reunión `BOOKED`; no revive el registro terminal. La calificación usa exclusivamente `UNQUALIFIED`, `POTENTIAL` o `QUALIFIED`.

| Desde | Transiciones permitidas |
|---|---|
| BOOKED | CONFIRMED, ATTENDED, NO_SHOW, CANCELLED, RESCHEDULED |
| CONFIRMED | ATTENDED, NO_SHOW, CANCELLED, RESCHEDULED |
| ATTENDED, NO_SHOW, CANCELLED, RESCHEDULED | ninguna |

## Catálogo de errores y retry

| Código | Categoría | Retry | Terminal |
|---|---|---:|---:|
| `RHIA_STATE_INVALID_TRANSITION` | CONFLICT | no | no |
| `RHIA_CONTRACT_INVALID_PAYLOAD` | VALIDATION | no | sí |
| `RHIA_SEARCH_PROVIDER_DEGRADED` | DEPENDENCY | sí | no |
| `RHIA_SEARCH_PROVIDER_UNAVAILABLE` | DEPENDENCY | sí | no |
| `RHIA_SEARCH_RATE_LIMITED` | RATE_LIMIT | sí | no |
| `RHIA_SEARCH_CAPTCHA_BLOCKED` | DEPENDENCY | sí | no |
| `RHIA_SEARCH_TIMEOUT` | TIMEOUT | sí | no |
| `RHIA_WORKFLOW_TIMEOUT` | TIMEOUT | sí | no |
| `RHIA_ENTITY_AMBIGUOUS` | CONFLICT | no | no |
| `RHIA_APPROVAL_REQUIRED` | POLICY | no | no |
| `RHIA_POLICY_DENIED` | POLICY | no | sí |
| `RHIA_JOB_RETRY_EXHAUSTED` | INTERNAL | no | sí |
| `RHIA_OUTREACH_OPTED_OUT` | POLICY | no | sí |
| `RHIA_OUTREACH_PERMANENT_BOUNCE` | DEPENDENCY | no | sí |
| `RHIA_MODEL_RATE_LIMITED` | RATE_LIMIT | sí | no |
| `RHIA_MODEL_PROVIDER_UNAVAILABLE` | DEPENDENCY | sí | no |
| `RHIA_TOOL_FORBIDDEN` | POLICY | no | sí |
| `RHIA_CORE_UNEXPECTED_FAILURE` | INTERNAL | no | sí |

Un resultado de búsqueda vacío con proveedores `HEALTHY` no es error: el flujo debe reformular. `DEGRADED` tiene su código propio y no puede confundirse con evidencia negativa. El runtime solo reintenta cuando el catálogo marca `retryable=true`, aplicando límite y backoff; nunca infiere retry a partir del mensaje humano.

## Evidencia de sincronía

- `packages/domain/src/domain.test.ts` comprueba cobertura, terminales y transiciones.
- `packages/contracts/test/contracts.test.ts` rechaza códigos libres y clasificaciones inconsistentes.
- `scripts/test-domain-migration.sh` aplica las migrations sobre un restore aislado y verifica que PostgreSQL rechace valores libres.
