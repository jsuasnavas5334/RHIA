// PH06-T005, acción 4 ("Invalidation").

import type { ManualInvalidation } from './schema.js';

/**
 * Devuelve la invalidación manual más reciente registrada para una key
 * (si hay varias, solo la última importa). Una invalidación descarta
 * evidencia recolectada ANTES de `invalidatedAt` para esa key, pero no es
 * permanente: evidencia recolectada DESPUÉS de `invalidatedAt` vuelve a
 * considerarse válida sin necesitar una segunda acción manual — de lo
 * contrario una sola invalidación bloquearía el cache para siempre, que es
 * el mismo error de fondo que "cache eterno" pero en la dirección opuesta.
 */
export const findLatestInvalidation = (
  key: string,
  invalidations: readonly ManualInvalidation[],
): ManualInvalidation | undefined =>
  invalidations
    .filter((entry) => entry.key === key)
    .reduce<ManualInvalidation | undefined>(
      (latest, entry) => (!latest || entry.invalidatedAt > latest.invalidatedAt ? entry : latest),
      undefined,
    );
