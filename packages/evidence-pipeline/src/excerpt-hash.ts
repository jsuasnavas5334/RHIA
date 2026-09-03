// PH06-T003, acción 2 ("Hash excerpt"): sha256 hex del excerpt normalizado.
// Puro y determinista — mismo excerpt (tras normalizar espacios/mayúsculas)
// siempre produce el mismo hash, lo que permite detectar evidencia
// duplicada exacta sin comparar ni almacenar el texto completo (ver
// EvidenceSchema.excerptHash y el error a evitar "guardar texto entero sin
// necesidad" del Task Packet).

import { createHash } from 'node:crypto';

/**
 * Normaliza espacios (colapsa cualquier run de whitespace a un solo
 * espacio, recorta extremos) y pasa a minúsculas antes de hashear, para que
 * diferencias triviales de formato (saltos de línea, espacios dobles,
 * capitalización) no produzcan excerpts "distintos" que en realidad son el
 * mismo contenido.
 */
const normalizeExcerpt = (excerpt: string): string => excerpt.trim().replace(/\s+/g, ' ').toLowerCase();

export const hashExcerpt = (excerpt: string): string =>
  createHash('sha256').update(normalizeExcerpt(excerpt), 'utf8').digest('hex');
