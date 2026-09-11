// PH07-T004, accion 3 ("Agregar country/city priority") y el error a evitar
// "Hardcode if/else por pais": la prioridad vive en una TABLA de datos
// (`Record<countryCode, weight>`), nunca en una cadena de `if
// (countryCode === 'EC') ... else if (countryCode === 'PE') ...`. Agregar,
// quitar o repriorizar un pais es editar una entrada del objeto, nunca
// tocar el motor de scoring (scoring.ts) ni esta funcion.
//
// Contexto necesario del packet: "Prioridad Ecuador #1, Peru #2; sin
// excluir otros mercados". `DEFAULT_COUNTRY_PRIORITY` (el fallback para
// cualquier pais fuera de la tabla) es > 0 a proposito -- un pais no
// listado sigue siendo elegible (criterio de aceptacion "Otros paises
// siguen elegibles"), solo con menor prioridad relativa que EC/PE.

export type CountryPriorityTable = Readonly<Record<string, number>>;

/** Prioridad relativa configurable (criterio de aceptacion: "Ecuador y Peru
 * reciben prioridad relativa configurable") -- este objeto es el valor por
 * DEFECTO, no una constante que `countryPriority` use de forma implicita:
 * cualquier llamador puede pasar su propia tabla (ver `countryPriority`
 * abajo) para repriorizar sin tocar este archivo. */
export const DEFAULT_COUNTRY_PRIORITY_TABLE: CountryPriorityTable = {
  EC: 1,
  PE: 0.85,
};

/** Piso para cualquier pais NO listado en la tabla -- nunca 0 (nunca se
 * excluye a un mercado por no estar en la lista corta), documentado como
 * heuristica v1 explicita (mismo patron que `OTRA_FLOOR_PRIORITY` en
 * @rhia/contact-discovery). */
export const DEFAULT_COUNTRY_PRIORITY = 0.5;

export const countryPriority = (
  countryCode: string,
  table: CountryPriorityTable = DEFAULT_COUNTRY_PRIORITY_TABLE,
  defaultPriority: number = DEFAULT_COUNTRY_PRIORITY,
): number => table[countryCode.toUpperCase()] ?? defaultPriority;

/** Prioridad por ciudad DENTRO de un pais (opcional -- accion 3 tambien
 * menciona "city priority", no solo country). Tabla anidada por pais,
 * mismo principio de datos-no-codigo. Sin tabla de ciudad o sin match, cae
 * a la prioridad del PAIS (nunca a un default distinto/menor solo por no
 * tener dato de ciudad -- la ausencia de senal de ciudad no debe penalizar
 * un mercado prioritario). */
export type CityPriorityTable = Readonly<Record<string, Readonly<Record<string, number>>>>;

export const geoPriority = (
  countryCode: string,
  city: string | null | undefined,
  countryTable: CountryPriorityTable = DEFAULT_COUNTRY_PRIORITY_TABLE,
  cityTable: CityPriorityTable = {},
  defaultCountryPriority: number = DEFAULT_COUNTRY_PRIORITY,
): number => {
  const normalizedCountry = countryCode.toUpperCase();
  const countryScore = countryPriority(normalizedCountry, countryTable, defaultCountryPriority);
  if (!city) return countryScore;
  const cityScore = cityTable[normalizedCountry]?.[city.toLowerCase()];
  return cityScore ?? countryScore;
};
