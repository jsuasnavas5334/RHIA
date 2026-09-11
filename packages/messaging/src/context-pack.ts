// Messaging (PH08-T003), accion 1 ("Construir context pack") y accion 2
// ("Separar facts de inferences"). "Contexto necesario" del packet:
// "Facts/inferences/policies". El `ContextPack` es la UNICA fuente de datos
// que `generate.ts` puede usar para redactar un mensaje -- nada fuera de
// `facts`/`inferences` puede entrar al texto generado (asi se evita, por
// construccion, el criterio "No afirma dato sin soporte" en vez de confiar
// solo en el lint posterior).

import type { Fact } from '@rhia/evidence-pipeline';
import type { Inference } from './schema.js';

export type ContextPack = Readonly<{
  organizationId: string;
  subjectType: string;
  subjectId: string;
  facts: readonly Fact[];
  inferences: readonly Inference[];
}>;

export type BuildContextPackInput = Readonly<{
  organizationId: string;
  subjectType: string;
  subjectId: string;
  facts: readonly Fact[];
  inferences: readonly Inference[];
}>;

export type BuildContextPackResult = Readonly<{
  contextPack: ContextPack;
  /** Inferencias descartadas por no tener soporte real dentro de `facts` (nunca se filtra en silencio sin dejar rastro). */
  droppedInferences: readonly Readonly<{ inference: Inference; reason: 'NO_SUPPORTING_FACTS' | 'SUPPORTING_FACT_NOT_IN_PACK' }>[];
}>;

/**
 * Separa facts de inferences (accion 2) de forma activa, no solo
 * organizativa: una `Inference` sin `supportingFactIds` reales, o cuyos
 * `supportingFactIds` no apuntan a ningun `Fact` presente en el mismo pack,
 * se DESCARTA -- nunca se pasa a `generate.ts` como si tuviera soporte.
 * Mismo principio que `fact-collapse.ts` (PH06-T003) aplica entre evidence y
 * fact: nunca promover algo sin respaldo real a una categoria de mayor
 * confianza.
 */
export const buildContextPack = (input: BuildContextPackInput): BuildContextPackResult => {
  const factIds = new Set(input.facts.map((fact) => fact.id));
  const droppedInferences: Array<{ inference: Inference; reason: 'NO_SUPPORTING_FACTS' | 'SUPPORTING_FACT_NOT_IN_PACK' }> = [];
  const validInferences: Inference[] = [];

  for (const inference of input.inferences) {
    if (inference.supportingFactIds.length === 0) {
      droppedInferences.push({ inference, reason: 'NO_SUPPORTING_FACTS' });
      continue;
    }
    const allSupported = inference.supportingFactIds.every((factId) => factIds.has(factId));
    if (!allSupported) {
      droppedInferences.push({ inference, reason: 'SUPPORTING_FACT_NOT_IN_PACK' });
      continue;
    }
    validInferences.push(inference);
  }

  return {
    contextPack: {
      organizationId: input.organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      facts: input.facts,
      inferences: validInferences,
    },
    droppedInferences,
  };
};
