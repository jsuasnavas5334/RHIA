# Agent Runtime v1

## Objetivo

Ejecutar jobs por pasos recuperables sin conservar el estado autoritativo en memoria. PostgreSQL decide ownership, intentos, checkpoints y transición final; un proceso worker puede desaparecer en cualquier punto y otro debe continuar sin repetir una acción confirmada.

## Máquina de estados

```text
PENDING | QUEUED | RETRY_SCHEDULED
                 │ claim atómico (FOR UPDATE SKIP LOCKED)
                 ▼
              RUNNING ── success ──► SUCCEEDED | PARTIAL
                 │
                 ├─ error retryable + intentos disponibles ─► RETRY_SCHEDULED
                 ├─ error final / intentos agotados ─────────► DEAD_LETTER
                 └─ lease vencido ──► nuevo claim y nuevo execution attempt
```

`CANCELLED` solo se acepta antes de iniciar mientras no exista cancelación cooperativa. Un worker vuelve a leer el estado antes de cada step y nunca inicia trabajo nuevo para un job cancelado.

## Invariantes

1. El claim usa una transacción y `FOR UPDATE SKIP LOCKED`; dos workers no reciben el mismo lease vigente.
2. Cada claim crea un `execution` con `attempt` único por job y un lease con vencimiento.
3. Cada step tiene una clave estable única por job. Un checkpoint `SUCCEEDED` se reutiliza tras crash y evita duplicar la action.
4. El resultado de un step y su action/checkpoint se confirman en una sola transacción.
5. Backoff se calcula en servidor con límite de tres retries y jitter acotado; nunca existe retry infinito.
6. Un lease vencido puede recuperarse, pero el execution anterior queda cerrado con causa verificable.
7. Payloads completos y secretos no entran en logs; eventos usan códigos, IDs y resúmenes seguros.

## Fronteras

- Core crea/cancela/reintenta jobs y aplica policy humana.
- Agent Runtime reclama y ejecuta steps autorizados.
- AI Gateway y tools se conectarán mediante handlers inyectables; no forman parte del store.
- PostgreSQL es la única fuente de verdad para reanudación e idempotencia.

## Orden de implementación

1. Migration aditiva para lease y checkpoints.
2. Store PostgreSQL con claim/reclaim y finalización transaccional.
3. Orquestador por steps con handlers inyectables.
4. Pruebas de concurrencia, retry y crash/reanudación sobre PostgreSQL temporal.
5. Worker CLI local con shutdown cooperativo.
