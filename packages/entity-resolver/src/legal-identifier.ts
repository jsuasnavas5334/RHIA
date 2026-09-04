// PH06-T004, acción 2 ("Usar legal identifiers cuando existan"). Un legal
// identifier (RUC, EIN, VAT, company registration number, etc.) es la señal
// más fuerte de identidad porque -a diferencia del nombre- no varía por
// traducción, alias comercial o error tipográfico leve, y es prácticamente
// imposible que dos entidades legales distintas compartan el mismo
// identificador dentro del mismo país. El resolver (entity-resolver.ts) le
// da prioridad sobre similitud de nombre precisamente para evitar el error
// "resolver por string similarity solamente".

/** Normaliza un legal identifier para comparación: sin espacios/guiones/puntos, mayúsculas. */
export const normalizeLegalIdentifier = (raw: string): string => raw.trim().toUpperCase().replace(/[\s.\-/]/g, '');

/**
 * Dos legal identifiers matchean solo si, además de normalizar igual,
 * pertenecen al mismo país — el mismo número puede reutilizarse en
 * esquemas de numeración de países distintos (nunca se asume identidad
 * cross-country solo por el número).
 */
export const legalIdentifiersMatch = (
  a: Readonly<{ identifier: string; countryCode: string }>,
  b: Readonly<{ identifier: string; countryCode: string }>,
): boolean => a.countryCode === b.countryCode && normalizeLegalIdentifier(a.identifier) === normalizeLegalIdentifier(b.identifier);
