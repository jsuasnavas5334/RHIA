// Conversation Agent (PH08-T004), accion 1 ("Classify intent") y accion 6
// ("Detect meeting intent"). Igual que @rhia/messaging (policy-lint.ts) y
// @rhia/evidence-pipeline (claim-extraction.ts), este clasificador es
// deliberadamente un guardia de PATRONES explicitos, no un LLM real: no hay
// credencial de ningun proveedor de AI Gateway (PH05-T002) autorizada en
// este ciclo (mismo limite honesto que documentaron PH08-T001/T002/T003).
// "mejor pocas reglas explicitas con alta precision que fingir comprension
// semantica" (mismo principio citado por claim-extraction.ts).
//
// Orden de prioridad deliberado (primero el que matchee gana, `classifyIntent`
// evalua en este orden exacto): OPT_OUT y HOSTILE se evaluan ANTES que
// cualquier intencion comercial -- un mensaje que ademas de pedir un
// descuento incluye un opt-out real ("no me escribas mas, y de paso no me
// interesa el descuento") debe tratarse como OPT_OUT (seguridad primero,
// nunca escalar una accion comercial sobre alguien que ya se dio de baja).

export const conversationIntents = [
  'OPT_OUT',
  'HOSTILE',
  'DISCOUNT_REQUEST',
  'COMMERCIAL_TERMS_REQUEST',
  'COMMITMENT_REQUEST',
  'PRICE_INQUIRY',
  'PRODUCT_QUESTION',
  'UNKNOWN',
] as const;
export type ConversationIntent = (typeof conversationIntents)[number];

export type IntentClassification = Readonly<{
  intent: ConversationIntent;
  matchedPattern: string | null;
}>;

const OPT_OUT_PATTERN = /(\bno me escribas? mas\b|\bno quiero mas mensajes\b|\bdame de baja\b|\bdar(?:te|se)?\s+de\s+baja\b|\bunsubscribe\b|\bdejen? de escribirme\b|\bno continuar recibiendo\b|\bopt[- ]?out\b|^\s*stop\s*$)/i;

const HOSTILE_PATTERN = /(\besto es spam\b|\bdejen de molestar\b|\bvoy a denunciar\b|\breportar (como )?spam\b|\bpar de estafadores\b|\bfuck\b|\bmaldito\b|\bestupid[oa]\b|\bidiota\b|\bamenaza\b|\bharassment\b|\bscam\b)/i;

const DISCOUNT_PATTERN = /(\bdescuento\b|\brebaja\b|\bmejor precio\b|\bdiscount\b|\bprecio especial\b|\b%?\s*off\b)/i;

const COMMERCIAL_TERMS_PATTERN = /(\bterminos? (de pago|contractuales)\b|\bcondiciones (de pago|contractuales)\b|\bcambiar (el )?contrato\b|\bcontract terms\b|\bpayment terms\b|\bsla\b|\bgarantia extendida\b)/i;

// Nota: `\bcompromet\w*\b` cubre a proposito varias conjugaciones reales
// ("se comprometan"/"se comprometen"/"comprometerse") en vez de listar cada
// forma verbal por separado -- mismo principio que otros patrones de este
// archivo (mejor una regla explicita algo mas amplia que una lista fragil
// de conjugaciones exactas).
const COMMITMENT_PATTERN = /(\bpueden garantizar\b|\bse compromet\w*\b|\bcomprometerse\b|\bfirman hoy\b|\bnos aseguran\b|\bbinding commitment\b|\bcan you guarantee\b|\bpromise (that|us)\b)/i;

const PRICE_INQUIRY_PATTERN = /(\bprecio\b|\bcosto\b|\bcuanto cuesta\b|\bcuanto vale\b|\bprice\b|\bcost\b|\bpricing\b|\bcuanto sale\b)/i;

const PRODUCT_QUESTION_PATTERN = /(\bque hace\b|\bcomo funciona\b|\bpara que sirve\b|\bfeature\b|\bfuncionalidad\b|\bque incluye\b|\bhow does it work\b|\bwhat does it do\b)/i;

const MEETING_INTENT_PATTERN = /(\breunion\b|\bagendar\b|\bcalendario\b|\bmeeting\b|\bschedule a call\b|\bvideollamada\b|\bcoordinar (una )?llamada\b|\bdisponibilidad\b|\bagenda\b)/i;

// COMMITMENT_REQUEST se evalua ANTES que COMMERCIAL_TERMS_REQUEST a
// proposito: un mensaje real puede mencionar "SLA" (palabra clave de
// COMMERCIAL_TERMS_PATTERN) dentro de un pedido de compromiso vinculante
// ("se comprometan por escrito a este SLA") -- ADR-011 ("AI no asume
// compromisos vinculantes") es la regla mas estricta de las dos, asi que
// gana cuando ambas señales aparecen en el mismo mensaje (verificado con un
// test real, ver conversation-agent.test.ts).
const PATTERNS: readonly Readonly<{ intent: ConversationIntent; pattern: RegExp }>[] = [
  { intent: 'OPT_OUT', pattern: OPT_OUT_PATTERN },
  { intent: 'HOSTILE', pattern: HOSTILE_PATTERN },
  { intent: 'DISCOUNT_REQUEST', pattern: DISCOUNT_PATTERN },
  { intent: 'COMMITMENT_REQUEST', pattern: COMMITMENT_PATTERN },
  { intent: 'COMMERCIAL_TERMS_REQUEST', pattern: COMMERCIAL_TERMS_PATTERN },
  { intent: 'PRICE_INQUIRY', pattern: PRICE_INQUIRY_PATTERN },
  { intent: 'PRODUCT_QUESTION', pattern: PRODUCT_QUESTION_PATTERN },
];

/**
 * Clasifica UNA intencion primaria por mensaje, en el orden de prioridad
 * documentado arriba. Nunca devuelve mas de una intencion -- si un mensaje
 * real necesita tratar varias señales a la vez (p. ej. "quiero un descuento
 * Y ademas agendar una reunion"), la deteccion de reunion es una señal
 * INDEPENDIENTE (`detectMeetingIntent`, accion 6 del packet, separada a
 * proposito de la accion 1) que se evalua por separado y puede coexistir
 * con cualquier intencion primaria.
 */
export const classifyIntent = (inboundText: string): IntentClassification => {
  for (const { intent, pattern } of PATTERNS) {
    const match = pattern.exec(inboundText);
    if (match) return { intent, matchedPattern: match[0] };
  }
  return { intent: 'UNKNOWN', matchedPattern: null };
};

/** Accion 6 del packet ("Detect meeting intent"). Señal independiente de `classifyIntent` -- ver comentario de cabecera. */
export const detectMeetingIntent = (inboundText: string): boolean => MEETING_INTENT_PATTERN.test(inboundText);
