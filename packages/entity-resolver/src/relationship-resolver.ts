// PH06-T004, acción 4 ("Detectar parent/subsidiary/operator") y criterio
// de aceptación "Multinacional conserva grupo común".
//
// Este módulo NO infiere relaciones desde similitud de nombre — solo
// interpreta señales de ownership ya explícitas (p. ej. producidas por una
// regla de claim-extraction futura tipo "OWNERSHIP_RELATION", fuera de
// este packet) y las liga a un `KnownEntity` existente cuando el nombre de
// la contraparte mencionada matchea razonablemente bien uno ya conocido.
// Si la contraparte no matchea ningún candidato conocido, se devuelve la
// relación igual (útil para registrar la intención) pero sin
// `matchedGroupId` — el llamador decide si eso alcanza para crear un grupo
// nuevo o si debe escalar.

import { normalizeCompanyName, nameSimilarity } from './name-normalization.js';
import type { KnownEntity, OwnershipSignal, RelationshipResolution } from './schema.js';
import { RelationshipResolutionSchema } from './schema.js';

const STRONG_NAME_MATCH_THRESHOLD = 0.5;

/**
 * Si hay varias señales de ownership, se toma la de mayor confidence — un
 * candidato solo declara UNA relación jerárquica primaria en v1 (una
 * entidad con múltiples relaciones simultáneas queda fuera de alcance;
 * documentado, no fingido).
 */
export const detectRelationship = (
  signals: readonly OwnershipSignal[],
  knownEntities: readonly KnownEntity[],
): RelationshipResolution | undefined => {
  if (signals.length === 0) return undefined;

  const strongest = signals.reduce((best, signal) => (signal.confidence > best.confidence ? signal : best), signals[0]!);
  const normalizedCounterpart = normalizeCompanyName(strongest.counterpartName);

  let matchedGroupId: string | undefined;
  let bestSimilarity = 0;
  for (const known of knownEntities) {
    const candidates = [known.canonicalName, ...known.aliases];
    for (const candidateName of candidates) {
      const similarity = nameSimilarity(normalizedCounterpart, normalizeCompanyName(candidateName));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        matchedGroupId = known.companyGroupId;
      }
    }
  }

  const matched = bestSimilarity >= STRONG_NAME_MATCH_THRESHOLD ? matchedGroupId : undefined;

  return RelationshipResolutionSchema.parse({
    relation: strongest.relation,
    counterpartName: strongest.counterpartName,
    matchedGroupId: matched,
    confidence: strongest.confidence,
  });
};
