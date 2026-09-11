// Conversation Agent (PH08-T004) -- orquestador principal. Junta las 6
// acciones del packet en un unico punto de entrada, `handleInboundMessage`,
// exactamente en el orden que describe PLAN_MAESTRO.md seccion "F5 --
// Conversacion" (lineas 808-816):
//   1. Clasificar intencion.
//   2. Recuperar contexto, productos y price book aplicable.
//   3. Responder dentro de politicas.
//   4. Si solicita precio oficial, comunicarlo.
//   5. Si solicita descuento/condicion especial/compromiso, crear approval.
//   6. Si existe intencion de reunion, consultar calendario y agendar.
//
// La accion 2 ("Recuperar contexto... y price book aplicable") es
// responsabilidad del CALLER, no de este paquete puro -- mismo limite que
// ya declararon todos los hermanos de PH08 (channel-gateway/sequence-engine/
// messaging): este paquete no tiene conexion real a Postgres/AI Gateway en
// este ciclo, recibe el `ContextPack`/`PriceBook` YA CONSTRUIDOS. La accion
// 6 ("consultar calendario y agendar") tampoco se implementa aqui --
// PH08-T005 (Meeting Scheduler) es el handoff explicito del propio packet
// ("Handoff scheduling"); este paquete solo DETECTA la señal
// (`meetingIntentDetected`) para que ese futuro caller decida que hacer.

import type { OutreachChannel, StopSignal } from '@rhia/outreach-policy';
import type { ContextPack } from '@rhia/messaging';
import { classifyIntent, detectMeetingIntent, type ConversationIntent } from './intent.js';
import { buildApprovalDraft, type ApprovalDraft } from './escalation.js';
import { communicateOfficialPrice } from './price.js';
import { buildEscalationAcknowledgementReply, buildPriceReply, buildProductQuestionReply, type ConversationReply } from './reply.js';
import type { PriceBook } from './schema.js';

export type ConversationAction = 'REPLY' | 'ESCALATE' | 'SUPPRESS';

export type ConversationTurnResult = Readonly<{
  intent: ConversationIntent;
  action: ConversationAction;
  meetingIntentDetected: boolean;
  reply?: ConversationReply;
  approvalDraft?: ApprovalDraft;
  stopSignal?: StopSignal;
}>;

export type HandleInboundMessageInput = Readonly<{
  subjectId: string;
  channel: OutreachChannel;
  inboundText: string;
  contextPack: ContextPack;
  priceBook?: PriceBook;
  productSku?: string;
  now?: Date;
}>;

/**
 * Punto de entrada unico del Conversation Agent. Nunca envia una respuesta
 * comercial (descuento/terminos/commitment) sin escalar primero -- las 3
 * intenciones que ADR-010/ADR-011 marcan como "siempre requieren aprobacion
 * humana" SIEMPRE devuelven `action: 'ESCALATE'` con un `approvalDraft`,
 * nunca `action: 'REPLY'` con una confirmacion (criterio "Commitment no
 * aprobado se bloquea": el bloqueo ES la escalacion, no una confirmacion
 * condicional).
 */
export const handleInboundMessage = (input: HandleInboundMessageInput): ConversationTurnResult => {
  const meetingIntentDetected = detectMeetingIntent(input.inboundText);
  const { intent } = classifyIntent(input.inboundText);

  if (intent === 'OPT_OUT') {
    return { intent, action: 'SUPPRESS', meetingIntentDetected, stopSignal: 'OPT_OUT' };
  }
  if (intent === 'HOSTILE') {
    return { intent, action: 'SUPPRESS', meetingIntentDetected, stopSignal: 'RISK' };
  }

  const approvalDraft = buildApprovalDraft(intent, { subjectId: input.subjectId, inboundExcerpt: input.inboundText });
  if (approvalDraft) {
    const reply = buildEscalationAcknowledgementReply(input.channel, input.contextPack);
    return { intent, action: 'ESCALATE', meetingIntentDetected, approvalDraft, reply };
  }

  if (intent === 'PRICE_INQUIRY') {
    const priceResult = input.productSku
      ? communicateOfficialPrice(input.priceBook, input.productSku, input.now ?? new Date())
      : ({ communicated: false, reason: 'PRODUCT_NOT_FOUND' } as const);
    const reply = buildPriceReply(input.channel, priceResult, input.contextPack);
    return { intent, action: 'REPLY', meetingIntentDetected, reply };
  }

  // PRODUCT_QUESTION o UNKNOWN: respuesta general dentro de politicas (accion 3), nunca inventa un dato fuera del ContextPack.
  const reply = buildProductQuestionReply(input.channel, input.contextPack);
  return { intent, action: 'REPLY', meetingIntentDetected, reply };
};
