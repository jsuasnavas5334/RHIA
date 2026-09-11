// Messaging (PH08-T003), accion 3 ("Generar por canal") y criterio
// "Tono por canal". Generador determinista basado en plantillas
// (templates.ts) -- deliberadamente NO invoca ningun LLM real: no hay
// credencial de ningun proveedor de AI Gateway (PH05-T002) autorizada en
// este ciclo (mismo limite honesto que documentaron PH08-T001 para
// email/WhatsApp real), y un generador determinista que solo puede insertar
// valores que existen literalmente en el `ContextPack` es, por
// construccion, incapaz de inventar un claim -- ver comentario de cabecera
// de context-pack.ts. Esto es "Messaging v1"; conectar un LLM real
// (respetando el mismo contrato de salida) es wiring futuro fuera de
// alcance de este ciclo, ver docs/progress/PH08-T003.md.

import type { OutreachChannel } from '@rhia/outreach-policy';
import type { Fact } from '@rhia/evidence-pipeline';
import type { ContextPack } from './context-pack.js';
import { findTemplate, type MessageTemplate } from './templates.js';

export type GeneratedMessage = Readonly<{
  templateId: string;
  templateVersion: number;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
  /** Ids de los Facts que realmente se mencionaron en el texto -- trazabilidad, igual que `supportingEvidenceIds` en Fact. */
  usedFactIds: readonly string[];
}>;

export type GenerateMessageInput = Readonly<{
  contextPack: ContextPack;
  channel: OutreachChannel;
  touchOrdinal: 1 | 2 | 3;
  recipientName: string;
}>;

/**
 * Traduce el `value` (`unknown`, jsonb) de un Fact a una mencion en
 * castellano SOLO para los `predicate` que `@rhia/evidence-pipeline`
 * realmente produce hoy (`DEFAULT_CLAIM_RULES` de claim-extraction.ts,
 * PH06-T003). Un predicate desconocido devuelve `null` (se omite la
 * clausula completa) en vez de intentar adivinar un formato -- nunca se
 * imprime `[object Object]` ni un valor sin validar.
 */
export const renderFactMention = (predicate: string, value: unknown): string | null => {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  switch (predicate) {
    case 'EMPLOYEE_COUNT': {
      const count = record['count'];
      return typeof count === 'number' && Number.isFinite(count) ? `${count} empleados` : null;
    }
    case 'FOUNDED_YEAR': {
      const year = record['year'];
      return typeof year === 'number' && Number.isFinite(year) ? `se fundo en ${year}` : null;
    }
    case 'HEADQUARTERS_LOCATION': {
      const location = record['location'];
      return typeof location === 'string' && location.trim().length > 0 ? `tiene su sede en ${location.trim()}` : null;
    }
    default:
      return null;
  }
};

const REQUIRED_OPT_OUT_CLAUSE: Readonly<Record<OutreachChannel, string>> = {
  EMAIL: 'Si preferis no recibir mas mensajes, respondeme "no" y no te vuelvo a escribir (opt-out inmediato).',
  LINKEDIN: 'Si no te interesa, decime y no insisto (podes dejar de recibir mensajes cuando quieras).',
  WHATSAPP: 'Si preferis no recibir mas mensajes por aca, respondeme "STOP" y dejo de escribirte (unsubscribe).',
};

const pickFact = (facts: readonly Fact[], predicate: string): Fact | undefined =>
  facts
    .filter((fact) => fact.predicate === predicate)
    .sort((a, b) => b.confidence - a.confidence)[0];

const renderClauses = (template: MessageTemplate, contextPack: ContextPack): { clauses: string[]; usedFactIds: string[] } => {
  const clauses: string[] = [];
  const usedFactIds: string[] = [];
  for (const factClause of template.factClauses) {
    const fact = pickFact(contextPack.facts, factClause.predicate);
    if (!fact) continue; // sin fact real, la clausula entera se omite -- nunca se rellena con un valor inventado.
    const mention = renderFactMention(factClause.predicate, fact.value);
    if (mention === null) continue;
    clauses.push(factClause.text.replace('{{value}}', mention));
    usedFactIds.push(fact.id);
  }
  return { clauses, usedFactIds };
};

export const generateMessage = (input: GenerateMessageInput): GeneratedMessage => {
  const template = findTemplate(input.channel, input.touchOrdinal);
  if (!template) throw new Error(`No hay plantilla registrada para el canal '${input.channel}'.`);

  const opening = template.openingClause.replaceAll('{{RECIPIENT_NAME}}', input.recipientName);
  const { clauses: factClauseTexts, usedFactIds } = renderClauses(template, input.contextPack);
  const optOut = REQUIRED_OPT_OUT_CLAUSE[input.channel];

  // Tono por canal (criterio del packet): EMAIL/LINKEDIN usan parrafos
  // separados (mas formal); WHATSAPP concatena corto, sin saltos de
  // parrafo (conversacional, mensajes breves).
  const paragraphs = [opening, ...factClauseTexts, template.closingClause, optOut];
  const body = input.channel === 'WHATSAPP' ? paragraphs.join(' ') : paragraphs.join('\n\n');

  const subject = template.hasSubject && template.subjectTemplate ? template.subjectTemplate.replaceAll('{{RECIPIENT_NAME}}', input.recipientName) : null;

  return {
    templateId: template.id,
    templateVersion: template.version,
    channel: input.channel,
    subject,
    body,
    usedFactIds,
  };
};
