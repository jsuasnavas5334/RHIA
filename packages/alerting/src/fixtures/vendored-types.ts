// Copias textuales de 2 tipos puros (sin logica, sin dependencias propias)
// de otros paquetes reales, usadas UNICAMENTE porque el paquete real que los
// define no se puede depender directamente en el workspace cloud aislado de
// este ciclo (`device_bash` caido, sin red hacia `registry.npmjs.org` -- ver
// docs/progress/PH11-T002.md "Bloqueo de entorno"):
//
// - `BudgetLimits`/`BudgetPeriodUsage`: copia textual de
//   `packages/model-router/src/contracts.ts` (PH05-T003, ya DONE). El
//   `.d.ts` real de `@rhia/model-router` re-exporta (vía `contracts.d.ts`)
//   un `import type { ProviderId } from "@rhia/ai-gateway"` -- inofensivo en
//   si mismo (ai-gateway no tiene dependencias externas), pero arrastrar el
//   arbol completo de `@rhia/ai-gateway` (gateway/adapters/transport/
//   testing, ~15 archivos `dist`) solo para poder importar 2 tipos de datos
//   sin logica fue evaluado como desproporcionado frente a copiarlos
//   textualmente -- decision explicita, ver "Decision de alcance" en
//   docs/progress/PH11-T002.md.
// - `BounceLedgerStatus`: copia textual del enum real de estados de
//   `TouchLedgerEntry.status` en `packages/outreach-policy/src/index.ts`
//   (PH08-T002, ya DONE). `@rhia/outreach-policy` depende en runtime-type de
//   `@rhia/config`, que a su vez depende de `zod` -- no instalable sin red
//   en este ciclo (mismo bloqueo ya documentado para
//   `@rhia/evidence-pipeline` en `docs/progress/PH10-T003.md`). Se copia
//   solo el enum de estados (una lista de strings, cero logica) -- no se
//   reimplementa ninguna regla real de outreach-policy.
//
// Si `@rhia/model-router`/`@rhia/outreach-policy` cambian estos tipos en un
// ciclo futuro, esta copia debe resincronizarse (o, mejor, ese ciclo debe
// resolver el bloqueo de red/zod y depender de los paquetes reales
// directamente).

export type BudgetLimits = Readonly<{
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
}>;

export type BudgetPeriodUsage = Readonly<{
  spentUsd: number;
  taskCount: number;
}>;

/** Copia textual de `TouchLedgerEntry['status']` (@rhia/outreach-policy). */
export const bounceLedgerStatuses = [
  'PLANNED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'REPLIED',
  'BOUNCED',
  'FAILED',
  'CANCELLED',
  'OPTED_OUT',
] as const;
export type BounceLedgerStatus = (typeof bounceLedgerStatuses)[number];
