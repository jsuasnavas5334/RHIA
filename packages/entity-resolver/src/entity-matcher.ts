// PH06-T004 — combina las acciones 1+2+3 (nombre, legal identifier,
// ubicación) para decidir si un candidato de entrada es el MISMO grupo que
// alguno de los `KnownEntity` ya cargados por el llamador, o uno nuevo.
//
// Regla central (evita el error "resolver por string similarity
// solamente" y sostiene el criterio "no mezcla San José CR/US/Belize"):
// una coincidencia de NOMBRE nunca es suficiente por sí sola cuando hay
// países distintos en juego. "Acme Corp" en EE. UU. y "Acme Corp" en Costa
// Rica, sin legal identifier compartido ni señal de ownership que los
// ligue, son tratados como entidades DISTINTAS aunque el nombre sea
// idéntico (ver prueba requerida "Same name different company"). En
// cambio, un legal identifier compartido es concluyente sin importar
// similitud de nombre (alias/traducciones no cambian el identificador
// legal), y una relación de ownership explícita (ver
// relationship-resolver.ts) liga el grupo común de una multinacional
// cruzando países a propósito (ver criterio "Multinacional conserva grupo
// común") — ninguna de las dos rutas pasa por este matcher de nombre, que
// solo cubre el caso "mismo nombre, probablemente misma entidad, en el
// mismo país o sin conflicto de país declarado".

import { normalizeLegalIdentifier } from './legal-identifier.js';
import { nameSimilarity, normalizeCompanyName } from './name-normalization.js';
import type { KnownEntity, LegalIdentifierSignal, LocationResolution, NameSignal } from './schema.js';

const NAME_MATCH_THRESHOLD = 0.6;

export type LegalIdentifierMatch = Readonly<{ known: KnownEntity; confidence: number }>;

/**
 * Compara el identificador normalizado sin importar el país si el
 * `KnownEntity` no tiene país declarado (dato incompleto, no se descarta
 * el match solo por eso); si ambos lados declaran país, deben coincidir —
 * el mismo número de identificador puede reutilizarse en esquemas de
 * numeración de países distintos.
 */
export const matchByLegalIdentifier = (
  signals: readonly LegalIdentifierSignal[],
  knownEntities: readonly KnownEntity[],
): LegalIdentifierMatch | undefined => {
  for (const signal of signals) {
    const normalizedSignal = normalizeLegalIdentifier(signal.identifier);
    for (const known of knownEntities) {
      if (known.countryCode && known.countryCode !== signal.countryCode) continue;
      const matches = known.legalIdentifiers.some((identifier) => normalizeLegalIdentifier(identifier) === normalizedSignal);
      if (matches) return { known, confidence: signal.confidence };
    }
  }
  return undefined;
};

export type NameLocationMatch = Readonly<{
  known: KnownEntity;
  similarity: number;
  /** true si hubo un segundo candidato con similitud comparable (ambigüedad de nombre, no de país). */
  tied: boolean;
}>;

/**
 * Compara cada `NameSignal` de entrada contra cada `KnownEntity`, pero
 * DESCARTA de plano cualquier candidato cuyo país declarado sea distinto
 * del país ya resuelto para el candidato de entrada (`resolvedLocation`) —
 * el nombre nunca "gana" sobre un conflicto de país explícito.
 */
export const matchByNameAndLocation = (
  names: readonly NameSignal[],
  knownEntities: readonly KnownEntity[],
  resolvedLocation: LocationResolution,
): NameLocationMatch | undefined => {
  const scored: { known: KnownEntity; similarity: number }[] = [];

  for (const name of names) {
    const normalizedInput = normalizeCompanyName(name.name);
    for (const known of knownEntities) {
      if (resolvedLocation.status === 'RESOLVED' && resolvedLocation.countryCode && known.countryCode && resolvedLocation.countryCode !== known.countryCode) {
        continue; // conflicto de país explícito: descalifica el candidato sin importar el nombre.
      }
      const candidateNames = [known.canonicalName, ...known.aliases];
      const bestForKnown = candidateNames.reduce(
        (best, candidateName) => Math.max(best, nameSimilarity(normalizedInput, normalizeCompanyName(candidateName))),
        0,
      );
      if (bestForKnown > 0) scored.push({ known, similarity: bestForKnown });
    }
  }

  if (scored.length === 0) return undefined;

  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored[0]!;
  if (top.similarity < NAME_MATCH_THRESHOLD) return undefined;

  const runnerUp = scored.find((entry) => entry.known.companyGroupId !== top.known.companyGroupId);
  const tied = runnerUp !== undefined && top.similarity - runnerUp.similarity < 0.05;

  return { known: top.known, similarity: top.similarity, tied };
};
