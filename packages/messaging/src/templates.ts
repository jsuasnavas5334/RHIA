// Messaging (PH08-T003), accion 5 ("Versionar templates/prompts"). Cada
// `MessageTemplate` tiene `id`+`version` explicitos -- cambiar el texto de
// una plantilla existente crea una entrada NUEVA con `version` incrementado
// en vez de mutar la anterior in-place (mismo principio append-only que
// `data/session-log.json` del propio proyecto), para que un mensaje ya
// enviado siga siendo trazable a la plantilla exacta que lo genero.
//
// Los `factClauses` solo se incluyen en el mensaje si el `ContextPack`
// realmente trae un Fact con ese `predicate` (ver generate.ts) -- una
// plantilla NUNCA fuerza a mencionar un dato que no existe, eso es
// precisamente lo que evita el criterio "No afirma dato sin soporte" por
// construccion, antes de que policy-lint.ts tenga que detectarlo.

import type { OutreachChannel } from '@rhia/outreach-policy';

export type TemplateFactClause = Readonly<{
  /** Debe coincidir con `Fact.predicate` (== `claimType` de @rhia/evidence-pipeline, p.ej. 'EMPLOYEE_COUNT'). */
  predicate: string;
  /** Contiene el placeholder literal `{{value}}`, sustituido por `renderFactMention`. */
  text: string;
}>;

export type MessageTemplate = Readonly<{
  id: string;
  version: number;
  channel: OutreachChannel;
  touchOrdinal: 1 | 2 | 3;
  hasSubject: boolean;
  subjectTemplate: string | null;
  openingClause: string;
  factClauses: readonly TemplateFactClause[];
  closingClause: string;
}>;

const RECIPIENT_PLACEHOLDER = '{{RECIPIENT_NAME}}';

export const MESSAGE_TEMPLATES: readonly MessageTemplate[] = [
  {
    id: 'email-touch-1',
    version: 1,
    channel: 'EMAIL',
    touchOrdinal: 1,
    hasSubject: true,
    subjectTemplate: `Una pregunta rapida para ${RECIPIENT_PLACEHOLDER}`,
    openingClause: `Hola ${RECIPIENT_PLACEHOLDER}, te escribo porque estamos ayudando a empresas como la tuya a mejorar su proceso comercial.`,
    factClauses: [
      { predicate: 'EMPLOYEE_COUNT', text: 'Vi que el equipo ronda {{value}}.' },
      { predicate: 'FOUNDED_YEAR', text: 'Tambien vi que {{value}}.' },
      { predicate: 'HEADQUARTERS_LOCATION', text: 'Y que {{value}}.' },
    ],
    closingClause: 'Si tiene sentido, me encantaria coordinar 15 minutos esta semana.',
  },
  {
    id: 'email-touch-2',
    version: 1,
    channel: 'EMAIL',
    touchOrdinal: 2,
    hasSubject: true,
    subjectTemplate: `Seguimiento: ${RECIPIENT_PLACEHOLDER}`,
    openingClause: `Hola ${RECIPIENT_PLACEHOLDER}, te escribi hace unos dias y no quiero que se pierda en la bandeja de entrada.`,
    factClauses: [{ predicate: 'EMPLOYEE_COUNT', text: 'Sigo pensando que, con un equipo de {{value}}, esto puede ser relevante.' }],
    closingClause: '¿Tiene sentido conversar brevemente?',
  },
  {
    id: 'email-touch-3',
    version: 1,
    channel: 'EMAIL',
    touchOrdinal: 3,
    hasSubject: true,
    subjectTemplate: `Ultimo mensaje -- ${RECIPIENT_PLACEHOLDER}`,
    openingClause: `Hola ${RECIPIENT_PLACEHOLDER}, este sera mi ultimo mensaje sobre este tema.`,
    factClauses: [],
    closingClause: 'Si en algun momento tiene sentido, quedo disponible.',
  },
  {
    id: 'linkedin-touch-1',
    version: 1,
    channel: 'LINKEDIN',
    touchOrdinal: 1,
    hasSubject: false,
    subjectTemplate: null,
    openingClause: `Hola ${RECIPIENT_PLACEHOLDER}, vi tu perfil y me parecio relevante conectar.`,
    factClauses: [{ predicate: 'HEADQUARTERS_LOCATION', text: 'Vi que {{value}}.' }],
    closingClause: '¿Abierto a una charla breve?',
  },
  {
    id: 'whatsapp-touch-1',
    version: 1,
    channel: 'WHATSAPP',
    touchOrdinal: 1,
    hasSubject: false,
    subjectTemplate: null,
    openingClause: `Hola ${RECIPIENT_PLACEHOLDER}!`,
    factClauses: [],
    closingClause: '¿Tenes 10 min esta semana?',
  },
];

export const findTemplate = (channel: OutreachChannel, touchOrdinal: 1 | 2 | 3): MessageTemplate | undefined =>
  MESSAGE_TEMPLATES.find((template) => template.channel === channel && template.touchOrdinal === touchOrdinal) ??
  MESSAGE_TEMPLATES.find((template) => template.channel === channel && template.touchOrdinal === 1);
