// PH07-T002, accion 1 ("Derivar personas objetivo por use case") y los dos
// "Errores que debe evitar" del packet:
//   - "Lista rigida global de cargos": no existe UNA lista de titulos que se
//     use siempre. `AREA_TITLE_KEYWORDS` tiene una lista distinta POR AREA, y
//     que areas se activan (y con que prioridad) depende del texto del caso
//     de uso -- nunca se devuelven todas las areas con la misma prioridad.
//   - "Asumir que todo buyer es RRHH": RRHH no tiene ningun trato especial en
//     el scoring; si el texto no menciona nada relacionado a RRHH, esa area
//     puede terminar con prioridad 0 (ver test "cross-role").
//
// Heuristica v1 deliberadamente simple (conteo de coincidencias de keyword
// sobre texto normalizado), documentada igual que
// evidence-pipeline/classifySourceReliability y
// entity-resolver/nameSimilarity: explicita como heuristica, no un modelo de
// lenguaje (eso es AI Gateway/model-router, PH05, fuera de este paquete
// puro).

import { RoleArchetypeSchema, type RoleArchetype, type RoleArea, type UseCaseContext } from './schema.js';

/** Pliega diacriticos y pasa a minusculas para comparar texto en espanol/ingles sin depender de acentos exactos. */
export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Palabras clave de CONTEXTO (que aparecen en la descripcion del caso de uso)
// que sugieren que un area es relevante. Distintas de `AREA_TITLE_KEYWORDS`
// (los cargos que se buscarian DENTRO de esa area) -- separar ambas listas
// evita que agregar un sinonimo de contexto cambie sin querer los cargos
// buscados, y viceversa.
const AREA_CONTEXT_KEYWORDS: Readonly<Record<RoleArea, readonly string[]>> = {
  RRHH: [
    'recursos humanos', 'rrhh', 'talento', 'nomina', 'payroll', 'contratacion', 'reclutamiento',
    'capacitacion', 'bienestar laboral', 'clima laboral', 'onboarding', 'human resources', 'hr',
  ],
  GERENCIA: [
    'direccion general', 'junta directiva', 'estrategia', 'gobierno corporativo', 'ceo', 'gerencia general',
    'expansion', 'inversion', 'consejo directivo', 'executive', 'leadership',
  ],
  OPERACIONES: [
    'logistica', 'manufactura', 'produccion', 'cadena de suministro', 'planta', 'almacen', 'inventario',
    'operaciones', 'supply chain', 'manufacturing', 'warehouse',
  ],
  FINANZAS: [
    'contabilidad', 'tesoreria', 'presupuesto', 'finanzas', 'facturacion', 'cuentas por pagar',
    'cuentas por cobrar', 'auditoria financiera', 'accounting', 'finance',
  ],
  TI: [
    'sistemas', 'infraestructura tecnologica', 'ciberseguridad', 'transformacion digital', 'software',
    'nube', 'cloud', 'datos', 'information technology', 'it department',
  ],
  LEGAL: [
    'cumplimiento', 'compliance', 'contratos legales', 'asesoria legal', 'regulatorio', 'normativa',
    'legal counsel',
  ],
  // OTRA no tiene keywords de contexto propias -- nunca "gana" por
  // coincidencia directa, solo aparece como piso minimo (ver deriveTargetRoles).
  OTRA: [],
};

// Cargos tipicos POR AREA -- lo que realmente se usaria para construir
// queries de busqueda (candidate-search.ts). Cada area tiene su propia lista
// corta; agregar un area nueva no obliga a tocar el motor de scoring.
const AREA_TITLE_KEYWORDS: Readonly<Record<RoleArea, readonly string[]>> = {
  RRHH: ['director de recursos humanos', 'gerente de talento humano', 'jefe de nomina', 'hr manager', 'people operations'],
  GERENCIA: ['gerente general', 'director ejecutivo', 'ceo', 'director de operaciones corporativas', 'managing director'],
  OPERACIONES: ['gerente de operaciones', 'jefe de planta', 'director de logistica', 'operations manager', 'supply chain manager'],
  FINANZAS: ['director financiero', 'gerente de finanzas', 'cfo', 'controller financiero', 'jefe de tesoreria'],
  TI: ['director de tecnologia', 'cto', 'gerente de sistemas', 'it manager', 'jefe de infraestructura'],
  LEGAL: ['director legal', 'gerente de cumplimiento', 'general counsel', 'compliance manager'],
  OTRA: ['gerente de area', 'responsable de proyecto', 'coordinador general'],
};

const ROLE_AREAS: readonly RoleArea[] = ['RRHH', 'GERENCIA', 'OPERACIONES', 'FINANZAS', 'TI', 'LEGAL', 'OTRA'];

// Piso minimo para OTRA: nunca 0 (siempre existe la posibilidad de que el
// comprador real este en un area no listada), pero deliberadamente bajo para
// que nunca supere a un area con coincidencia real de contexto.
const OTRA_FLOOR_PRIORITY = 0.05;

/**
 * Cuenta, para cada area, cuantas de sus `AREA_CONTEXT_KEYWORDS` aparecen en
 * el texto combinado de `description` + `signals`. Normaliza el conteo a
 * [0,1] dividiendo por el numero de coincidencias mas alto entre todas las
 * areas (nunca por el tamano de la lista de cada area, que variaria el techo
 * de cada una sin motivo real).
 */
export const deriveTargetRoles = (useCase: UseCaseContext): RoleArchetype[] => {
  const haystack = foldText([useCase.description, ...(useCase.signals ?? [])].join(' '));

  const rawScores = ROLE_AREAS.map((area) => {
    const contextKeywords = AREA_CONTEXT_KEYWORDS[area];
    const matchedContextTerms = contextKeywords.filter((keyword) => haystack.includes(foldText(keyword)));
    return { area, matchedContextTerms, rawCount: matchedContextTerms.length };
  });

  const maxRawCount = Math.max(...rawScores.map((entry) => entry.rawCount), 0);

  const archetypes = rawScores.map(({ area, matchedContextTerms, rawCount }): RoleArchetype => {
    const normalized = maxRawCount > 0 ? rawCount / maxRawCount : 0;
    const priority = area === 'OTRA' ? Math.max(OTRA_FLOOR_PRIORITY, normalized) : normalized;
    return RoleArchetypeSchema.parse({
      area,
      priority,
      titleKeywords: AREA_TITLE_KEYWORDS[area],
      matchedContextTerms,
    });
  });

  // Nunca se colapsa a una sola area "ganadora": se devuelven las 7,
  // ordenadas por prioridad descendente, para que el llamador decida cuantas
  // usar (candidate-search.ts) y para que quede trazable por que un area
  // quedo abajo (matchedContextTerms vacio).
  return archetypes.sort((a, b) => b.priority - a.priority);
};

/**
 * Clasifica un `titleGuess` ya extraido (person-identity.ts) en una de las
 * areas de `roles` (salida de `deriveTargetRoles` para el MISMO caso de
 * uso) por solape de palabras contra `AREA_TITLE_KEYWORDS` -- nunca contra
 * una lista global fija (mismo principio que el resto de este archivo).
 * `titleGuess === null` (identidad no resuelta, ver person-identity.ts) da
 * `OTRA` explicitamente -- no se adivina un area para un cargo que no se
 * pudo leer. Si el titulo no matchea ninguna keyword de ninguna area, cae
 * al area de mayor prioridad para este caso de uso (`roles` ya viene
 * ordenado descendente por `deriveTargetRoles`) -- sigue dependiendo del
 * contexto, nunca defaultea a RRHH salvo que RRHH sea realmente el area mas
 * relevante para ese caso de uso.
 */
export const matchRoleAreaForTitle = (titleGuess: string | null, roles: readonly RoleArchetype[]): RoleArea => {
  if (!titleGuess) return 'OTRA';
  const titleTokens = new Set(foldText(titleGuess).split(/\s+/).filter(Boolean));

  let bestArea: RoleArea | null = null;
  let bestOverlap = 0;
  for (const role of roles) {
    for (const keyword of role.titleKeywords) {
      const keywordTokens = foldText(keyword).split(/\s+/).filter(Boolean);
      const overlap = keywordTokens.filter((token) => titleTokens.has(token)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestArea = role.area;
      }
    }
  }

  return bestArea ?? roles[0]?.area ?? 'OTRA';
};
