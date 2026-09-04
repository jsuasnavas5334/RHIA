// PH06-T004, acción 1 ("Normalizar nombre"). Heurística v1, determinista:
// quita sufijos legales conocidos (multi-idioma/región, cubre EN/ES/otros
// mercados frecuentes en el plan), pliega diacríticos y colapsa espacios
// para poder COMPARAR nombres de forma estable. Nunca se usa el resultado
// de esto como única señal de identidad (ver relationship-resolver.ts y
// entity-resolver.ts: la normalización de nombre es UNA señal entre varias
// — legal identifier y ubicación pesan más — para evitar el error a evitar
// "resolver por string similarity solamente").

const LEGAL_SUFFIXES = [
  // Inglés / genérico internacional
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited',
  'llc', 'llp', 'lp', 'plc', 'holdings', 'holding', 'group',
  // Español (LatAm/España) — variantes con y sin puntos porque la puntuación
  // ya se removió antes de tokenizar ("S.A. de C.V." -> "s a de c v").
  's a', 'sa', 's a de c v', 'sa de cv', 's de r l', 'sde rl',
  's r l', 'srl', 's l', 'sl', 'sac', 's a c', 'cia', 'compania',
  // Otros mercados frecuentes
  'gmbh', 'ag', 'bv', 'nv', 'oy', 'ab', 'kk', 'pty ltd', 'pty', 'as',
];

// Cada sufijo como lista de tokens, ordenados del más largo (más palabras)
// al más corto, para que una frase completa como "s a de c v" (5 tokens)
// se intente ANTES que un sufijo de una sola palabra que podría coincidir
// parcialmente con su cola.
const LEGAL_SUFFIX_TOKEN_LISTS = LEGAL_SUFFIXES.map((suffix) => suffix.split(' ')).sort((a, b) => b.length - a.length);

const stripDiacritics = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Normaliza un nombre de empresa a una forma comparable: minúsculas, sin
 * diacríticos, sin puntuación, sufijos legales conocidos removidos del
 * final, espacios colapsados. NO es el nombre a mostrar (eso sigue siendo
 * `NameSignal.name` tal cual se observó) — solo la clave usada para decidir
 * si dos observaciones probablemente se refieren al mismo nombre.
 */
export const normalizeCompanyName = (raw: string): string => {
  const ascii = stripDiacritics(raw.trim().toLowerCase());
  const noPunctuation = ascii.replace(/[.,;:()'"]/g, ' ').replace(/&/g, ' and ');
  let tokens = noPunctuation.split(/\s+/).filter(Boolean);

  // Quita sufijos legales desde el final, uno o más en cadena (p. ej.
  // "Acme Corp Ltd", o una frase multi-palabra como "S.A. de C.V."). Nunca
  // deja la lista de tokens vacía: un nombre de una sola palabra que
  // coincide con un sufijo (p. ej. "Co" a secas) se conserva tal cual.
  let strippedSomething = true;
  while (strippedSomething && tokens.length > 1) {
    strippedSomething = false;
    for (const suffixTokens of LEGAL_SUFFIX_TOKEN_LISTS) {
      if (suffixTokens.length >= tokens.length) continue; // conserva al menos 1 token.
      const tail = tokens.slice(tokens.length - suffixTokens.length).join(' ');
      if (tail === suffixTokens.join(' ')) {
        tokens = tokens.slice(0, tokens.length - suffixTokens.length);
        strippedSomething = true;
        break;
      }
    }
  }

  return tokens.join(' ').trim();
};

/**
 * Similitud [0,1] entre dos nombres ya normalizados, basada en solapamiento
 * de tokens (Jaccard). Señal ÚTIL pero deliberadamente débil por sí sola —
 * "Acme Costa Rica" y "Acme Panama" comparten "acme" pero son entidades
 * distintas; el llamador siempre debe combinar esto con legal identifier
 * y/o ubicación antes de decidir identidad (ver entity-resolver.ts).
 */
export const nameSimilarity = (normalizedA: string, normalizedB: string): number => {
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;
  if (normalizedA === normalizedB) return 1;

  const tokensA = new Set(normalizedA.split(' ').filter(Boolean));
  const tokensB = new Set(normalizedB.split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};
