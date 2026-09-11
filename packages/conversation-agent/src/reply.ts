// Conversation Agent (PH08-T004), accion 3 ("Responder preguntas
// permitidas"). Reusa (no duplica) `@rhia/messaging`:
// `renderFactMention` para mencionar un Fact real dentro de una respuesta
// de "pregunta de producto", y `lintMessage` como el MISMO guardia
// independiente de policy que ya audita los mensajes salientes de
// Messaging -- ninguna respuesta de este paquete se devuelve sin pasar por
// ese lint (misma filosofia "doble capa" documentada en
// docs/progress/PH08-T003.md: por construccion + por auditoria
// independiente).
//
// TENSION DOCUMENTADA (no oculta): `lintMessage` fue diseñado para
// mensajes de OUTREACH proactivo, donde mencionar cualquier precio es
// SIEMPRE una violacion (`PRICE_OR_DISCOUNT`). Este paquete tiene un caso
// legitimo donde SI debe comunicar un precio real: la accion 4 ("Comunicar
// precio oficial") cuando el `PriceBook` esta `ACTIVE`. Ese es exactamente
// el caso que ADR-010 permite ("la IA puede comunicar estos precios cuando
// estan ACTIVE; no puede editar valores") -- no es lo mismo que "ofrecer un
// descuento". Por eso `isReplySafe` excluye deliberadamente el codigo
// `PRICE_OR_DISCOUNT` SOLO para la respuesta de `PRICE_INQUIRY` con precio
// realmente comunicado (`priceWasCommunicated: true`) -- para cualquier
// otra respuesta (incluida la de "sin precio activo disponible"), los 4
// codigos del lint deben estar limpios, sin excepcion. El resultado
// COMPLETO del lint (los 4 codigos) siempre se devuelve en `lint` para
// trazabilidad -- nunca se oculta un issue real, solo se documenta cual no
// aplica como bloqueante en este caso especifico.

import type { OutreachChannel } from '@rhia/outreach-policy';
import { lintMessage, renderFactMention, type ContextPack, type PolicyLintResult } from '@rhia/messaging';
import type { OfficialPriceResult } from './price.js';

export type ConversationReply = Readonly<{
  subject: string | null;
  body: string;
  lint: PolicyLintResult;
  /** `true` unicamente cuando el lint completo esta limpio, o cuando el UNICO issue es `PRICE_OR_DISCOUNT` sobre una respuesta que en efecto comunico un precio oficial ACTIVE real (ver comentario de cabecera). */
  safe: boolean;
}>;

// Las 3 clausulas comparten literalmente la frase "no continuar
// recibiendo" (reconocida por `OPT_OUT_PATTERN` de @rhia/messaging,
// policy-lint.ts) -- una version anterior de la clausula de LINKEDIN
// ("decime y no insisto") NO era reconocible por ese patron y el lint
// compartido marcaba `MISSING_OPT_OUT` (fallo real detectado por
// reply.test.ts, no solo inferido).
const OPT_OUT_CLAUSE: Readonly<Record<OutreachChannel, string>> = {
  EMAIL: 'Si preferis no continuar recibiendo mensajes mios, respondeme y no te vuelvo a escribir.',
  LINKEDIN: 'Si preferis no continuar recibiendo mensajes mios por aqui, decime y no insisto.',
  WHATSAPP: 'Si preferis no continuar recibiendo mensajes por aca, respondeme y dejo de escribirte.',
};

const buildReply = (
  channel: OutreachChannel,
  bodyLines: readonly string[],
  contextPack: ContextPack,
  priceWasCommunicated: boolean,
): ConversationReply => {
  const body = [...bodyLines, OPT_OUT_CLAUSE[channel]].join(channel === 'WHATSAPP' ? ' ' : '\n\n');
  const lint = lintMessage({ subject: null, body }, contextPack);
  const blockingIssues = lint.issues.filter((issue) => !(priceWasCommunicated && issue.code === 'PRICE_OR_DISCOUNT'));
  return { subject: null, body, lint, safe: blockingIssues.length === 0 };
};

/** Accion 5 (via caller): respuesta de reconocimiento cuando la intencion escala a una approval (descuento/terminos/commitment). Deliberadamente generica -- nunca repite palabras que el propio lint marcaria (p. ej. "descuento") y nunca confirma ni asume la solicitud (evita el error "Asumir compromiso" del packet). */
export const buildEscalationAcknowledgementReply = (channel: OutreachChannel, contextPack: ContextPack): ConversationReply =>
  buildReply(
    channel,
    ['Gracias por tu mensaje. Voy a escalar tu solicitud comercial a un responsable humano para que la revise -- todavia no puedo confirmarla de mi lado y te aviso apenas tenga una respuesta.'],
    contextPack,
    false,
  );

/** Accion 4: respuesta de consulta de precio. Nunca inventa un numero -- si `priceResult.communicated` es `false`, el texto NO menciona ningun precio (evita "Responder con precio stale"). */
export const buildPriceReply = (channel: OutreachChannel, priceResult: OfficialPriceResult, contextPack: ContextPack): ConversationReply => {
  if (priceResult.communicated) {
    return buildReply(
      channel,
      [`El precio oficial vigente para ${priceResult.item.productName} es ${priceResult.priceText}.`],
      contextPack,
      true,
    );
  }
  return buildReply(
    channel,
    ['Todavia no tengo un precio oficial vigente para confirmarte en este momento -- lo reviso y te confirmo apenas lo tenga.'],
    contextPack,
    false,
  );
};

const FACT_PREDICATES_ORDER = ['EMPLOYEE_COUNT', 'FOUNDED_YEAR', 'HEADQUARTERS_LOCATION'] as const;

/** Accion 3: pregunta general de producto/empresa. Solo puede mencionar un Fact real del ContextPack (reusa `renderFactMention`, nunca reimplementado) -- si no hay ningun Fact reconocido, responde sin inventar ningun dato. */
export const buildProductQuestionReply = (channel: OutreachChannel, contextPack: ContextPack): ConversationReply => {
  const mentions: string[] = [];
  for (const predicate of FACT_PREDICATES_ORDER) {
    const fact = contextPack.facts
      .filter((candidate) => candidate.predicate === predicate)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!fact) continue;
    const mention = renderFactMention(predicate, fact.value);
    if (mention) mentions.push(mention);
  }
  const opening = 'Gracias por tu pregunta. Nuestra propuesta ayuda a empresas a mejorar su proceso comercial.';
  const factLine = mentions.length > 0 ? `Vi que ${mentions.join(' y ')}.` : null;
  const closing = 'Si tiene sentido, me encantaria coordinar unos minutos para contarte mas.';
  return buildReply(channel, factLine ? [opening, factLine, closing] : [opening, closing], contextPack, false);
};
