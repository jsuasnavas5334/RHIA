// GATE-04 -- evaluacion real del gold dataset de identidad de empresas
// (Ecuador vs Peru), aportado directamente por el usuario el 2026-09-07
// (ver docs/gold-datasets/entity-resolution-ec-pe-v1.json para la fuente
// completa y su procedencia). Este modulo NO decide el resultado -- solo
// arma los inputs de @rhia/entity-resolver a partir del dataset y corre el
// resolver real, sin fabricar evidencia mas alla de lo que el dataset
// realmente dice.
//
// Metodologia (documentada aqui para que quede junto al codigo, no solo en
// el reporte): el dataset solo trae nombre de marca + razon social legal
// por pais + una etiqueta humana de relacion. NO trae identificador legal
// (RUC/RUC) ni el texto de una claim de ownership real extraida de
// evidencia. Por eso se evaluan DOS escenarios distintos, nunca mezclados:
//
//   Escenario A ("solo nombre+pais"): usa EXCLUSIVAMENTE las senales que el
//   dataset literalmente aporta (nombre legal, marca como alias/trade, y el
//   pais de cada columna) -- sin ninguna senal de ownership. Sirve para
//   confirmar el "safety rail" del resolver: por diseno (ver
//   entity-matcher.ts), un nombre compartido nunca debe fusionar dos
//   entidades de paises declarados distintos sin evidencia mas fuerte. Se
//   espera isNewGroup=true en TODAS las filas bajo este escenario --
//   cualquier fila que fusione aqui es un hallazgo real de bug, no un
//   "fallo esperado".
//
//   Escenario B ("senales reales disponibles"): agrega una OwnershipSignal
//   SOLO en las filas donde el dataset mismo declara una relacion de
//   propiedad/grupo real (SAME_GROUP, DIRECT_LINK) -- nunca en las filas
//   DISTINCT (no hay ownership real que declarar) ni en las GLOBAL_NETWORK
//   (membresia en una red profesional no es una relacion de ownership; usar
//   SUBSIDIARY_OF ahi tergiversaria la relacion real, asi que se omite
//   deliberadamente y esas filas se reportan aparte, no se fuerzan a un
//   veredicto). El "relation" exacto (SUBSIDIARY_OF) es un supuesto
//   razonable declarado explicitamente -- el dataset no especifica el tipo
//   exacto de relacion societaria, solo que es "mismo grupo".

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolveCompanyEntity } from './entity-resolver.js';
import type { EntityResolutionInput, EntityResolutionResult, KnownEntity } from './schema.js';

export type GoldRowCategory = 'SAME_GROUP' | 'DISTINCT' | 'GLOBAL_NETWORK' | 'DIRECT_LINK';

export type GoldRow = Readonly<{
  id: number;
  marca: string;
  razonSocialEcuador: string;
  razonSocialPeru: string;
  category: GoldRowCategory;
  detail: string | null;
}>;

export type GoldDataset = Readonly<{
  name: string;
  description: string;
  source: string;
  labelCounts: Record<string, number>;
  rows: readonly GoldRow[];
}>;

const DATASET_PATH = fileURLToPath(new URL('../../../docs/gold-datasets/entity-resolution-ec-pe-v1.json', import.meta.url));

export const loadGoldDataset = (): GoldDataset => {
  const raw = readFileSync(DATASET_PATH, 'utf-8');
  return JSON.parse(raw) as GoldDataset;
};

const TEST_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

/**
 * UUID valido (formato 8-4-4-4-12, nibble de version '4', nibble de
 * variante '8') deterministico por fila, para que dos corridas del eval
 * produzcan exactamente los mismos ids y sean comparables entre si.
 */
export const knownEntityIdFor = (row: GoldRow): string => {
  const idHex = row.id.toString(16).padStart(8, '0');
  return `${idHex}-0000-4000-8000-000000000000`;
};

const buildKnownEntity = (row: GoldRow): KnownEntity => ({
  companyGroupId: knownEntityIdFor(row),
  canonicalName: row.razonSocialEcuador,
  legalIdentifiers: [],
  aliases: [row.marca],
  countryCode: 'EC',
  city: 'Ecuador',
});

const buildInput = (row: GoldRow, includeOwnership: boolean): EntityResolutionInput => ({
  organizationId: TEST_ORGANIZATION_ID,
  names: [
    { name: row.razonSocialPeru, kind: 'LEGAL', confidence: 0.9 },
    { name: row.marca, kind: 'TRADE', confidence: 0.7 },
  ],
  legalIdentifiers: [],
  // El dataset solo trae granularidad de PAIS (no ciudad) -- se usa el
  // nombre del pais como valor de "city" unicamente para satisfacer el
  // campo requerido del esquema; el resolver de ubicacion no compara ese
  // texto contra nada, solo usa countryCode para el bloqueo cross-pais.
  locations: [{ city: 'Peru', countryCode: 'PE', confidence: 0.9 }],
  ownership: includeOwnership
    ? [{ counterpartName: row.marca, relation: 'SUBSIDIARY_OF', confidence: 0.75 }]
    : [],
  knownEntities: [buildKnownEntity(row)],
});

export type GoldEvalRow = Readonly<{
  row: GoldRow;
  scenarioA: EntityResolutionResult;
  scenarioB: EntityResolutionResult;
}>;

export const evaluateRow = (row: GoldRow): GoldEvalRow => {
  const includeOwnershipInB = row.category === 'SAME_GROUP' || row.category === 'DIRECT_LINK';
  return {
    row,
    scenarioA: resolveCompanyEntity(buildInput(row, false)),
    scenarioB: resolveCompanyEntity(buildInput(row, includeOwnershipInB)),
  };
};

export type GoldEvalReport = Readonly<{
  rows: readonly GoldEvalRow[];
  scenarioA: Readonly<{ totalRows: number; correctlySeparate: number; incorrectlyMerged: readonly number[] }>;
  scenarioB: Readonly<{
    positives: number; negatives: number; excludedAmbiguous: number;
    truePositives: number; falseNegatives: number; trueNegatives: number; falsePositives: number;
    precision: number; recall: number;
    needsReviewOnPositives: number;
    ambiguousRows: readonly Readonly<{ id: number; marca: string; isNewGroup: boolean; status: string }>[];
  }>;
}>;

export const runGoldDatasetEvaluation = (dataset: GoldDataset): GoldEvalReport => {
  const rows = dataset.rows.map(evaluateRow);

  const incorrectlyMerged = rows.filter((r) => !r.scenarioA.isNewGroup).map((r) => r.row.id);
  const scenarioA = {
    totalRows: rows.length,
    correctlySeparate: rows.length - incorrectlyMerged.length,
    incorrectlyMerged,
  };

  const positives = rows.filter((r) => r.row.category === 'SAME_GROUP' || r.row.category === 'DIRECT_LINK');
  const negatives = rows.filter((r) => r.row.category === 'DISTINCT');
  const ambiguous = rows.filter((r) => r.row.category === 'GLOBAL_NETWORK');

  const truePositives = positives.filter((r) => !r.scenarioB.isNewGroup).length;
  const falseNegatives = positives.length - truePositives;
  const trueNegatives = negatives.filter((r) => r.scenarioB.isNewGroup).length;
  const falsePositives = negatives.length - trueNegatives;

  const precision = truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives);
  const recall = positives.length === 0 ? 1 : truePositives / positives.length;

  const needsReviewOnPositives = positives.filter((r) => r.scenarioB.status === 'NEEDS_REVIEW').length;

  const scenarioB = {
    positives: positives.length,
    negatives: negatives.length,
    excludedAmbiguous: ambiguous.length,
    truePositives,
    falseNegatives,
    trueNegatives,
    falsePositives,
    precision,
    recall,
    needsReviewOnPositives,
    ambiguousRows: ambiguous.map((r) => ({
      id: r.row.id, marca: r.row.marca, isNewGroup: r.scenarioB.isNewGroup, status: r.scenarioB.status,
    })),
  };

  return { rows, scenarioA, scenarioB };
};
