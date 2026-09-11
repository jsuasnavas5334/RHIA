// Sequence Engine (PH08-T002) -- runner. Este es el punto que justifica la
// dependencia real del packet en PH08-T001 (Channel Gateway): el comentario
// de cierre de `@rhia/channel-gateway/gateway.ts` (PH08-T001) dice
// textualmente que el Gateway "no decide QUE proveedor usar para cada envio
// -- eso lo decide el caller (Sequence Engine, PH08-T002)". `advanceSequence`
// es ese caller: decide, para el SIGUIENTE toque que ya calculo
// OutreachPolicy.planNextTouch (via touch-plan/holidays), a que proveedor de
// canal enviarlo, arma el `ChannelSendRequest` normalizado y lo entrega a
// una funcion `send` inyectada (nunca importa ni construye un
// `ChannelGateway` real aqui -- Transport/IdempotencyStore reales son
// wiring de infraestructura fuera de alcance de un paquete puro, mismo
// limite honesto que declaro PH08-T001 para si mismo).
//
// "Errores que debe evitar" (packet, heredado de PH03-T003): "Crear
// secuencia nueva para evadir limite". `advanceSequence` SIEMPRE calcula el
// siguiente toque llamando a `planNextTouch` sobre el `context.ledger` real
// que le entrega el caller -- nunca inventa un ledger vacio ni un
// `sequenceId` nuevo por su cuenta. Si el caller le pasa el ledger real de
// una secuencia que ya alcanzo el limite, `advanceSequence` devuelve
// `COMPLETE` y jamas invoca `send`.

import { planNextTouch, type OutreachChannel, type OutreachPolicy, type SequenceContext, type StopSignal, type TouchLedgerEntry } from '@rhia/outreach-policy';
import type { ChannelId, ChannelSendFailure, ChannelSendRequest, ChannelSendResult, ChannelSendSuccess } from '@rhia/channel-gateway';
import { rescheduleAroundHolidays, type HolidayCalendar } from './holidays.js';

/**
 * OutreachPolicy (PH03-T003) trabaja con `OutreachChannel` en mayusculas
 * (`'EMAIL' | 'LINKEDIN' | 'WHATSAPP'`, alineado a `RhiaSettings.cadence`).
 * Channel Gateway (PH08-T001) trabaja con `ChannelId` en minuscula y admite
 * mas canales (`'form' | 'chat' | 'social'`) que hoy no tiene contraparte en
 * OutreachPolicy porque el packet de OutreachPolicy solo modela outreach
 * proactivo, no formularios/chat entrantes. El `switch` es exhaustivo
 * (`never` en el default) para que agregar un `OutreachChannel` nuevo a
 * OutreachPolicy sin mapearlo aqui sea un error de compilacion, no un bug
 * silencioso en produccion.
 */
export const toChannelId = (channel: OutreachChannel): ChannelId => {
  switch (channel) {
    case 'EMAIL':
      return 'email';
    case 'LINKEDIN':
      return 'linkedin';
    case 'WHATSAPP':
      return 'whatsapp';
    default: {
      const exhaustive: never = channel;
      throw new Error(`OutreachChannel sin mapeo a ChannelId: ${String(exhaustive)}`);
    }
  }
};

export type ChannelProviderResolver = (channel: OutreachChannel) => string;

export type SequenceMessage = Readonly<{
  to: string;
  subject: string | null;
  body: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type SequenceMessageBuilder = (touch: TouchLedgerEntry, context: SequenceContext) => SequenceMessage;

export type SendCapability = (
  request: ChannelSendRequest,
  options: Readonly<{ timeoutMs: number; signal?: AbortSignal }>,
) => Promise<ChannelSendResult>;

export type AdvanceSequenceInput = Readonly<{
  context: SequenceContext;
  policy: OutreachPolicy;
  resolveProvider: ChannelProviderResolver;
  buildMessage: SequenceMessageBuilder;
  send: SendCapability;
  holidays?: HolidayCalendar;
  now?: Date;
  timeoutMs?: number;
}>;

export type AdvanceSequenceOutcome =
  | Readonly<{ outcome: 'STOPPED'; reason: StopSignal | 'SUPPRESSED' }>
  | Readonly<{ outcome: 'COMPLETE'; reason: 'MAX_TOUCHES_REACHED' | 'NO_CHANNEL_ENABLED' }>
  | Readonly<{ outcome: 'DUPLICATE'; touch: TouchLedgerEntry }>
  | Readonly<{ outcome: 'DEFERRED'; touch: TouchLedgerEntry }>
  | Readonly<{ outcome: 'SENT'; touch: TouchLedgerEntry; sendResult: ChannelSendSuccess }>
  | Readonly<{ outcome: 'SEND_FAILED'; touch: TouchLedgerEntry; sendResult: ChannelSendFailure }>;

/**
 * Avanza UNA secuencia UN paso. No hace loop interno sobre los 3 toques --
 * cada llamada calcula el siguiente toque legitimo (o el motivo de parada)
 * contra el ledger real que recibe, y el caller es quien decide cuando
 * volver a llamar (tipicamente: cuando el toque anterior ya se registro como
 * SENT/FAILED en el ledger real, fuera de este paquete puro).
 */
export const advanceSequence = async (input: AdvanceSequenceInput): Promise<AdvanceSequenceOutcome> => {
  const now = input.now ?? new Date();
  const result = planNextTouch(input.context, input.policy, now);

  if (result.outcome === 'STOPPED') return { outcome: 'STOPPED', reason: result.reason };
  if (result.outcome === 'COMPLETE') return { outcome: 'COMPLETE', reason: result.reason };
  if (result.outcome === 'DUPLICATE') return { outcome: 'DUPLICATE', touch: result.touch };

  const plannedAt = rescheduleAroundHolidays(result.touch.plannedAt, input.context.timezone, input.policy, input.holidays);
  const touch: TouchLedgerEntry = { ...result.touch, plannedAt };

  if (new Date(plannedAt).getTime() > now.getTime()) {
    return { outcome: 'DEFERRED', touch };
  }

  const provider = input.resolveProvider(touch.channel);
  const message = input.buildMessage(touch, input.context);
  const request: ChannelSendRequest = {
    idempotencyKey: touch.idempotencyKey,
    organizationId: input.context.organizationId,
    channel: toChannelId(touch.channel),
    provider,
    to: message.to,
    subject: message.subject,
    body: message.body,
    metadata: message.metadata,
  };

  const sendResult = await input.send(request, { timeoutMs: input.timeoutMs ?? 10_000 });
  if (sendResult.status === 'SUCCEEDED') {
    return { outcome: 'SENT', touch: { ...touch, status: 'SENT' }, sendResult };
  }
  return { outcome: 'SEND_FAILED', touch: { ...touch, status: 'FAILED' }, sendResult };
};
