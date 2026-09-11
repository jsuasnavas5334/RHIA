// Conversation Agent (PH08-T004), accion 5 ("Escalar descuento/commitment").
// Criterios de aceptacion "Descuento crea approval" y "Commitment no
// aprobado se bloquea", y ADR-010/ADR-011 (PLAN_MAESTRO.md lineas 848-849,
// "AI no modifica precios" / "AI no asume compromisos vinculantes" --
// "Approval obligatorio" en ambos casos).
//
// `ApprovalActionDraft` refleja 1:1 el enum real
// `ApprovalActionSchema`/`ApprovalRecord.action` de
// apps/core-api/src/contracts.ts (linea 261: `'CHANGE_PRICE' |
// 'GRANT_DISCOUNT' | 'CHANGE_COMMERCIAL_TERMS' | 'BINDING_COMMITMENT'`) --
// se define aqui como tipo LOCAL (no se importa desde `apps/core-api`)
// porque este es un paquete puro de `packages/*` y `apps/core-api` es una
// app, no un workspace del que otros paquetes deban depender (misma capa
// que ya respetan `channel-gateway`/`sequence-engine`/`messaging`, ninguno
// importa nada de `apps/*`). Mismo principio que `Inference` en
// `messaging/schema.ts`: mirror local y documentado de un contrato real ya
// cerrado, no un modelo nuevo.
//
// `ApprovalDraft` NO es un `CreateApproval` real (le faltan `jobId`,
// `targetRef` e `idempotencyKey` -- esos los tiene que aportar el caller
// real que conecte este paquete a `apps/core-api` -- `ApprovalService.create`
// exige un `jobId` de un Job YA EXISTENTE en el tenant, algo que este
// paquete puro no crea ni conoce). Es, deliberadamente, el mismo tipo de
// "punto de extension" que ya documento `SequenceMessageBuilder` en
// `sequence-engine/runner.ts`: un caller real (wiring de infraestructura,
// fuera de alcance de este ciclo) es quien arma el `CreateApproval`
// completo a partir de este draft.

import type { ConversationIntent } from './intent.js';

export const approvalActionDrafts = ['CHANGE_PRICE', 'GRANT_DISCOUNT', 'CHANGE_COMMERCIAL_TERMS', 'BINDING_COMMITMENT'] as const;
export type ApprovalActionDraft = (typeof approvalActionDrafts)[number];

export type ApprovalDraft = Readonly<{
  action: ApprovalActionDraft;
  /** Coincide con el patron real `/^RHIA_APPROVAL_[A-Z0-9_]+$/` de `CreateApprovalSchema.reasonCode` (apps/core-api/src/contracts.ts linea 265). */
  reasonCode: string;
  summary: string;
  requiresHumanApproval: true;
}>;

const REASON_CODE_PATTERN = /^RHIA_APPROVAL_[A-Z0-9_]+$/;

/**
 * Solo las 3 intenciones que el packet marca como "siempre requieren
 * aprobacion humana" (PLAN_MAESTRO.md linea 705-711: modificar precio
 * oficial / ofrecer descuento / cambiar terminos de pago / asumir
 * compromiso) producen un draft. Cualquier otra intencion devuelve
 * `undefined` -- nunca se crea una approval de mas.
 */
export const buildApprovalDraft = (
  intent: ConversationIntent,
  context: Readonly<{ subjectId: string; inboundExcerpt: string }>,
): ApprovalDraft | undefined => {
  const excerpt = context.inboundExcerpt.trim().slice(0, 240);
  switch (intent) {
    case 'DISCOUNT_REQUEST':
      return {
        action: 'GRANT_DISCOUNT',
        reasonCode: 'RHIA_APPROVAL_DISCOUNT_REQUESTED',
        summary: `Prospecto ${context.subjectId} solicito descuento en conversacion: "${excerpt}"`,
        requiresHumanApproval: true,
      };
    case 'COMMERCIAL_TERMS_REQUEST':
      return {
        action: 'CHANGE_COMMERCIAL_TERMS',
        reasonCode: 'RHIA_APPROVAL_COMMERCIAL_TERMS_REQUESTED',
        summary: `Prospecto ${context.subjectId} solicito cambiar terminos comerciales/contractuales: "${excerpt}"`,
        requiresHumanApproval: true,
      };
    case 'COMMITMENT_REQUEST':
      return {
        action: 'BINDING_COMMITMENT',
        reasonCode: 'RHIA_APPROVAL_COMMITMENT_REQUESTED',
        summary: `Prospecto ${context.subjectId} solicito un compromiso vinculante: "${excerpt}"`,
        requiresHumanApproval: true,
      };
    default:
      return undefined;
  }
};

/** Autoverificacion (nunca confiar solo en el `switch` de arriba): todo `ApprovalDraft` real que produce este modulo debe tener un `reasonCode` valido segun el contrato real de Core. */
export const isValidReasonCode = (reasonCode: string): boolean => REASON_CODE_PATTERN.test(reasonCode);
