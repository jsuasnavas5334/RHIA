// PH07-T002, accion 2 ("Buscar candidatos"). Este paquete NO ejecuta
// busqueda real (mismo patron que evidence-pipeline/entity-resolver: un
// paquete puro no hace dispatch de red) -- construye las QUERIES de texto
// que un llamador real ejecutaria, ya sea via `@rhia/search-orchestrator`
// (`orchestrateSearch`, PH06-T002) o enviando un job `DISCOVER_HR` (ya
// declarado en `@rhia/contracts`, `DiscoverHrJobSchema.input.contactQuery`
// -- ver packages/contracts/src/index.ts lineas ~77-86; ese job type existe
// desde antes de este ciclo pero no tiene ningun procesamiento server-side
// especial en apps/core-api/src/control-services.ts, se persiste como
// cualquier otro job -- confirmado con grep antes de disenar esta funcion).
// `buildContactQuery` produce exactamente el texto que llenaria ese campo,
// para que una integracion futura no tenga que reinventar el formato de
// query.

import type { RoleArchetype } from './schema.js';

export type CompanySearchContext = Readonly<{
  canonicalName: string;
  countryCode?: string;
  city?: string;
}>;

export type ContactSearchQuery = Readonly<{
  area: RoleArchetype['area'];
  priority: number;
  /** Compatible con `DiscoverHrJobSchema.input.contactQuery` de @rhia/contracts. */
  contactQuery: string;
}>;

const MAX_TITLE_KEYWORDS_PER_QUERY = 3;

export const buildContactQuery = (company: CompanySearchContext, role: RoleArchetype): string => {
  const location = [company.city, company.countryCode].filter(Boolean).join(', ');
  const titles = role.titleKeywords.slice(0, MAX_TITLE_KEYWORDS_PER_QUERY).join(' OR ');
  const locationSuffix = location.length > 0 ? ` ${location}` : '';
  return `"${company.canonicalName}"${locationSuffix} (${titles})`;
};

/**
 * Genera una query por cada area con prioridad > 0 (las areas sin ninguna
 * coincidencia de contexto -- ver role-derivation.ts -- no generan busqueda
 * alguna, evita gastar cupo de busqueda en areas irrelevantes para el caso
 * de uso), ordenadas por prioridad descendente, limitadas a `topN` (default
 * 3 -- mismo espiritu que `SourceQuotaGuard` de search-orchestrator: no
 * disparar busquedas sin limite).
 */
export const buildContactSearchQueries = (
  company: CompanySearchContext,
  roles: readonly RoleArchetype[],
  options: { topN?: number } = {},
): ContactSearchQuery[] => {
  const topN = options.topN ?? 3;
  return roles
    .filter((role) => role.priority > 0)
    .slice(0, topN)
    .map((role) => ({ area: role.area, priority: role.priority, contactQuery: buildContactQuery(company, role) }));
};
