# Operations Center v1

## Flujo de autoridad

```text
Usuario → sesión Better Auth → Principal Core → policy → servicio transaccional → PostgreSQL
```

La UI nunca decide permisos ni escribe tablas directamente. Los botones se derivan de roles solo para UX; retry, cancel y decisiones de approval vuelven a autorizarse en Core.

## Transiciones de jobs

| Comando | Estados de origen | Estado destino | Regla |
|---|---|---|---|
| Retry | `FAILED`, `PARTIAL` | `RETRY_SCHEDULED` | Máximo tres; idempotente por comando |
| Cancel | `PENDING`, `QUEUED`, `RETRY_SCHEDULED` | `CANCELLED` | Limpia `next_attempt_at` y bloquea nuevas approvals |

`RUNNING` no se cancela desde v1 porque aún no existe handshake cooperativo con el worker. Rechazarlo es más seguro que presentar una cancelación que no pueda detener pasos activos.

## Approvals

Cada tarjeta muestra acción, resumen, motivo, objetivo, solicitante y hora antes de ofrecer decisión. Solicitante y aprobador deben ser identidades humanas distintas; Core persiste reason, correlación, audit e idempotencia, pero no ejecuta la acción comercial al aprobar.

## Puente App → Core

La App usa un cliente exclusivamente de servidor. Reenvía al Core solo `rhia.session_token` o su variante `__Secure-`, nunca el header Cookie completo, y crea correlation/idempotency UUIDs fuera del navegador. `RHIA_CORE_API_URL` admite HTTPS o HTTP loopback; rechaza credenciales embebidas, query y fragment.

Core vuelve a resolver la sesión, organización y roles en PostgreSQL para cada solicitud. `GET /api/v1/session` entrega solo roles humanos y omite IDs técnicos. Los formularios tratan sus campos ocultos como entrada no confiable: validan formato en App y tenant/policy en Core.

La demostración local usa datos no sensibles y mantiene mutaciones deshabilitadas. Producción falla cerrada ante configuración ausente, cookie ausente o respuesta inválida. Falta ejecutar el E2E navegador → App → Auth/Core → PostgreSQL temporal antes de cerrar PH04-T004.
