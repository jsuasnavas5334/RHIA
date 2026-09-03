// PH06-T002, acción 3 ("Dedupe URLs/results"): un mismo recurso puede
// aparecer en más de una fuente (p. ej. SEARXNG hoy, WEB_API/BROWSER en el
// futuro) con URLs que difieren solo en detalles no significativos
// (protocolo, `www.`, slash final, orden de query params, fragmento). Este
// módulo es puro (sin I/O) para poder probarse de forma determinista.

/**
 * Normaliza una URL para comparación de duplicados: minúsculas en host,
 * quita `www.`, fuerza `https`, quita slash final (salvo raíz), ordena los
 * query params (algunos trackers cambian el orden sin cambiar el recurso) y
 * descarta el fragmento (`#...`). Si la URL no es parseable, devuelve el
 * texto recortado tal cual (mejor deduplicar por texto exacto que fallar).
 */
export const canonicalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const params = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = params.length > 0 ? `?${params.map(([key, value]) => `${key}=${value}`).join('&')}` : '';

  return `https://${host}${pathname}${query}`;
};

/** Resultado crudo de un adapter, antes de asignar `rank` final. */
export type DedupableResult = Readonly<{
  url: string;
  title: string;
  snippet: string;
  provider: string;
}>;

/**
 * Deduplica resultados por URL canónica, conservando la primera ocurrencia
 * en el orden recibido (el llamador decide ese orden — normalmente
 * prioridad de fuente, luego posición dentro de cada fuente). No fusiona
 * `provider`: la ocurrencia que gana conserva su propia provenance, nunca
 * se combina con la de un duplicado descartado (evita "fusionar resultados
 * sin source", el error explícito a evitar del Task Packet).
 */
export const dedupeResults = (results: readonly DedupableResult[]): DedupableResult[] => {
  const seen = new Set<string>();
  const deduped: DedupableResult[] = [];

  for (const result of results) {
    const key = canonicalizeUrl(result.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
};
