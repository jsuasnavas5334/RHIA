// PH06-T003, acciones 5 y 6 ("Guardar freshness", "Relacionar
// evidence→fact") y los 3 criterios de aceptación del packet:
//   - "Cada fact importante tiene supporting evidence" -> FactSchema exige
//     `supportingEvidenceIds` no vacío; nunca se construye un Fact sin al
//     menos una Evidence real detrás.
//   - "Duplicados colapsan" -> evidencia ACTIVE con el mismo
//     (organizationId, subjectId, claimType, valor observado) se combina en
//     UN solo Fact, agregando su reliability (no se crean facts repetidos).
//   - "Fecha/fuente preservadas" -> `validFrom` es la freshness más antigua
//     del grupo y `supportingEvidenceIds` permite trazar cada Evidence (y
//     por tanto su `EvidenceSource`) que sostiene el Fact.
//
// Errores a evitar cubiertos aquí:
//   - "Promover inferencia a fact sin support": evidencia contradictoria
//     (mismo claim, valores distintos) NUNCA se fusiona en un único Fact
//     "ganador" — se emite un Fact por cada valor observado, cada uno
//     penalizado y trazable solo a SU propia evidencia, para que quien
//     consuma el Fact vea explícitamente que hay versiones en conflicto en
//     vez de una confianza inflada y falsamente única.
//   - Evidencia obsoleta (`STALE`, ver `staleAfterDays`) nunca sostiene un
//     Fact nuevo por sí sola: si TODA la evidencia de un claim está vieja,
//     no se emite Fact (insuficiente soporte) en vez de inventar
//     confianza sobre datos caducos.

import { randomUUID } from 'node:crypto';
import { FactSchema, type Evidence, type Fact } from './schema.js';

export type CollapseToFactsOptions = Readonly<{
  newId?: () => string;
}>;

const DEFAULT_STALE_AFTER_DAYS = 365;
const CONTRADICTION_PENALTY = 0.6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const isStaleEvidence = (evidence: Evidence, now: Date, staleAfterDays: number): boolean => {
  const ageMs = now.getTime() - new Date(evidence.freshnessAt).getTime();
  return ageMs > staleAfterDays * MS_PER_DAY;
};

/** Combinación "noisy-or": cada evidencia adicional que corrobora sube la confianza, pero nunca llega a certeza absoluta. */
const combineConfidence = (confidences: readonly number[]): number => {
  const combined = 1 - confidences.reduce((acc, confidence) => acc * (1 - confidence), 1);
  return Math.min(0.99, Math.max(0, combined));
};

/** Serialización estable (claves ordenadas) para agrupar por valor observado sin depender del orden de propiedades. */
const stableValueKey = (value: unknown): string => {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input !== null && typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = sortKeys(val);
        return acc;
      }, {});
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
};

const groupKey = (evidence: Evidence): string => `${evidence.organizationId}::${evidence.subjectType}::${evidence.subjectId}::${evidence.claimType}`;

const earliestFreshness = (group: readonly Evidence[]): string =>
  group.reduce((earliest, item) => (item.freshnessAt < earliest ? item.freshnessAt : earliest), group[0]!.freshnessAt);

/**
 * Colapsa una lista de Evidence en Facts. Flujo esperado: el llamador
 * corre primero `markStaleEvidence` (que transiciona a `STALE` la
 * evidencia vieja) y recién entonces pasa el resultado aquí.
 * `collapseToFacts` solo considera evidencia `status: 'ACTIVE'` como
 * candidata; si para un claim TODA la evidencia quedó `STALE`, ese grupo no
 * produce ningún Fact (evidencia caduca no sostiene un fact nuevo por sí
 * sola — ver comentario de cabecera). No muta ni descarta la evidencia
 * recibida — solo decide qué subconjunto sostiene qué fact.
 */
export const collapseToFacts = (evidenceList: readonly Evidence[], options: CollapseToFactsOptions = {}): Fact[] => {
  const newId = options.newId ?? randomUUID;

  const groups = new Map<string, Evidence[]>();
  for (const evidence of evidenceList) {
    if (evidence.status !== 'ACTIVE') continue; // evidencia STALE nunca sostiene un fact nuevo por sí sola.
    const key = groupKey(evidence);
    const existing = groups.get(key);
    if (existing) existing.push(evidence);
    else groups.set(key, [evidence]);
  }

  const facts: Fact[] = [];

  for (const group of groups.values()) {
    const byValue = new Map<string, Evidence[]>();
    for (const evidence of group) {
      const key = stableValueKey(evidence.observedValue);
      const existing = byValue.get(key);
      if (existing) existing.push(evidence);
      else byValue.set(key, [evidence]);
    }

    const isContradictory = byValue.size > 1;

    for (const subgroup of byValue.values()) {
      const first = subgroup[0]!;
      const rawConfidence = combineConfidence(subgroup.map((evidence) => evidence.confidence));
      const confidence = isContradictory ? Math.min(0.99, Math.max(0, rawConfidence * CONTRADICTION_PENALTY)) : rawConfidence;

      facts.push(
        FactSchema.parse({
          id: newId(),
          organizationId: first.organizationId,
          subjectType: first.subjectType,
          subjectId: first.subjectId,
          predicate: first.claimType,
          value: first.observedValue,
          confidence,
          validFrom: earliestFreshness(subgroup),
          supportingEvidenceIds: subgroup.map((evidence) => evidence.id),
        }),
      );
    }
  }

  return facts;
};

/**
 * Marca como `STALE` la evidencia cuya freshness excede `staleAfterDays`.
 * Función pura separada de `collapseToFacts` para que el llamador pueda
 * persistir la transición de estado (evidence.status en la BD) de forma
 * explícita en vez de que quede implícita dentro del collapse.
 */
export const markStaleEvidence = (
  evidenceList: readonly Evidence[],
  options: Readonly<{ now?: () => Date; staleAfterDays?: number }> = {},
): Evidence[] => {
  const now = options.now?.() ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  return evidenceList.map((evidence) =>
    evidence.status === 'ACTIVE' && isStaleEvidence(evidence, now, staleAfterDays)
      ? { ...evidence, status: 'STALE' as const }
      : evidence,
  );
};
