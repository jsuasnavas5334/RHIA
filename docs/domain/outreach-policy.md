# OutreachPolicy v1

**Task ID:** `PH03-T003`  
**Estado:** `DONE`  
**Fuente ejecutable:** `packages/outreach-policy/src/index.ts`

## Invariantes

- Máximo predeterminado de tres toques proactivos únicos por secuencia.
- Cadencia predeterminada en días hábiles: día 0, +3 y +7.
- Ventana local: 08:00 inclusive a 20:00 exclusiva, lunes a viernes.
- La zona horaria pertenece al contacto/secuencia; nunca se toma del servidor.
- Un retry reutiliza el mismo `idempotencyKey` y no crea ni cuenta un toque nuevo.
- Respuesta, opt-out, reunión, rebote permanente, riesgo o suppression detienen la secuencia.
- Sin canales habilitados no se programa ningún toque.

## Override controlado

Una excepción solo se considera cuando identifica la misma organización y secuencia, está aprobada por una persona, no expiró y fija un máximo entre 4 y 5. El override cambia únicamente el máximo; no puede desactivar quiet hours, stop rules, suppression ni idempotencia.

## Persistencia esperada

`outreach_sequence` conserva policy/version, timezone, quiet hours y límite. `outreach_touch` es el ledger de idempotencia. PH08 implementará el scheduler y el envío; esta policy solo decide y no contacta personas ni proveedores.

La migration `0004_outreach_policy` agrega policy versionada y suppression hash-only. El seed `1.0` permanece `DRAFT`, incluso al reaplicarlo, hasta una aprobación humana posterior.
