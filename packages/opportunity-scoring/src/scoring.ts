// PH07-T004 -- orquestador: combina las acciones 1+2+3+5+6 del packet en
// `computeOpportunityScore`. Nunca bloquea un mercado (accion 4, "No
// bloquear mercados") -- `geoPriority` (ver geo-priority.ts) nunca devuelve
// 0 para un pais no listado, asi que ningun componente puede llevar el
// score total a un "excluido" solo por geografia.

import { contactabilityScore, evidenceScore, fitScore, signalScore, timingScore, type OpportunitySignalInput } from './components.js';
import { geoPriority, type CityPriorityTable, type CountryPriorityTable } from './geo-priority.js';
import { OpportunityScoreResultSchema, ScoringWeightsSchema, type OpportunityScoreResult, type ScoringWeights } from './schema.js';

// Accion 5, "Versionar score": version por defecto del motor -- cambia
// SOLO cuando cambia la LOGICA de combinacion de componentes (no cuando
// cambian los pesos, que son configuracion en runtime, no una version
// nueva del algoritmo -- ver Pruebas requeridas "Score versioning").
export const DEFAULT_SCORE_VERSION = 'scoring-v1';

// Accion 2, "Configurar pesos": valor por defecto -- nunca usado
// implicitamente dentro del motor, siempre pasa explicito por
// `computeOpportunityScore` (ver abajo, `options.weights ??
// DEFAULT_SCORING_WEIGHTS`), para que quede claro en el breakdown con que
// pesos se calculo cada score.
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = ScoringWeightsSchema.parse({
  FIT: 0.25,
  SIGNAL: 0.2,
  CONTACTABILITY: 0.15,
  TIMING: 0.1,
  GEO_PRIORITY: 0.15,
  EVIDENCE: 0.15,
});

export type ComputeOpportunityScoreInput = Readonly<{
  matchedCriteria: number;
  totalCriteria: number;
  signals: readonly OpportunitySignalInput[];
  sendableContactPoints: number;
  totalContactPoints: number;
  nextActionAt: string | null;
  countryCode: string;
  city?: string | null;
  evidenceCount: number;
}>;

export type ComputeOpportunityScoreOptions = Readonly<{
  weights?: ScoringWeights;
  scoreVersion?: string;
  now?: Date;
  countryPriorityTable?: CountryPriorityTable;
  cityPriorityTable?: CityPriorityTable;
  timingWindowDays?: number;
  evidenceSaturationCount?: number;
}>;

export const computeOpportunityScore = (
  input: ComputeOpportunityScoreInput,
  options: ComputeOpportunityScoreOptions = {},
): OpportunityScoreResult => {
  const weights = options.weights ?? DEFAULT_SCORING_WEIGHTS;
  const now = options.now ?? new Date();

  const raw: Record<keyof ScoringWeights, { score: number; rationale: string }> = {
    FIT: {
      score: fitScore(input.matchedCriteria, input.totalCriteria),
      rationale: input.totalCriteria > 0
        ? `${input.matchedCriteria}/${input.totalCriteria} criterios de encaje cumplidos.`
        : 'Sin criterios de encaje declarados -- score neutro (0.5), no se asume encaje.',
    },
    SIGNAL: {
      score: signalScore(input.signals),
      rationale: input.signals.length > 0
        ? `${input.signals.filter((signal) => signal.hasEvidence).length}/${input.signals.length} señales con evidencia real.`
        : 'Sin señales aportadas -- score 0, nunca se infiere una señal implícita.',
    },
    CONTACTABILITY: {
      score: contactabilityScore(input.sendableContactPoints, input.totalContactPoints),
      rationale: input.totalContactPoints > 0
        ? `${input.sendableContactPoints}/${input.totalContactPoints} puntos de contacto sendable (no INVALID).`
        : 'Sin puntos de contacto registrados -- score 0.',
    },
    TIMING: {
      score: timingScore(input.nextActionAt, now, options.timingWindowDays),
      rationale: input.nextActionAt
        ? `nextActionAt=${input.nextActionAt} evaluado contra una ventana de ${options.timingWindowDays ?? 30} dias.`
        : 'Sin nextActionAt -- score 0, ausencia de timing no es buen timing.',
    },
    GEO_PRIORITY: {
      score: geoPriority(input.countryCode, input.city, options.countryPriorityTable, options.cityPriorityTable),
      rationale: `Prioridad geografica para ${input.countryCode}${input.city ? `/${input.city}` : ''} (tabla configurable, nunca if/else por pais; ningun pais queda excluido).`,
    },
    EVIDENCE: {
      score: evidenceScore(input.evidenceCount, options.evidenceSaturationCount),
      rationale: input.evidenceCount > 0
        ? `${input.evidenceCount} pieza(s) de evidencia real respaldando la oportunidad.`
        : 'Sin evidencia real respaldando la oportunidad -- score 0, nunca se infla sin soporte.',
    },
  };

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const breakdown = (Object.keys(weights) as (keyof ScoringWeights)[]).map((component) => {
    const weight = weights[component];
    const rawScore = raw[component].score;
    const contribution = totalWeight > 0 ? (rawScore * weight) / totalWeight : 0;
    return { component, rawScore, weight, contribution, rationale: raw[component].rationale };
  });

  const score = breakdown.reduce((sum, entry) => sum + entry.contribution, 0);

  return OpportunityScoreResultSchema.parse({
    score: Math.min(1, Math.max(0, score)),
    scoreVersion: options.scoreVersion ?? DEFAULT_SCORE_VERSION,
    breakdown,
  });
};
