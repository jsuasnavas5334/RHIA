// PH06-T004, acción 3 ("Resolver país/ciudad") y criterio de aceptación
// "No mezcla San José CR/US/Belize" + error a evitar "forzar un país".
//
// Estrategia v1: mantener una lista corta y explícita de nombres de ciudad
// conocidos por ser ambiguos entre países (documentada abajo, no
// exhaustiva — se amplía agregando entradas, sin tocar el motor). Para una
// ciudad NO listada, una sola señal de país ya alcanza para resolver. Para
// una ciudad listada como ambigua, se exige que TODAS las señales de país
// presentes coincidan entre sí (una sola señal confiable de país basta si
// es la única) — si hay señales de país en conflicto, o si no hay ninguna
// señal de país, el resultado es AMBIGUOUS en vez de adivinar. Nunca se
// elige "el país más probable" por defecto (eso sería forzar un país).

import { LocationResolutionSchema, type LocationResolution, type LocationSignal } from './schema.js';

const stripDiacritics = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizeCity = (city: string): string => stripDiacritics(city.trim().toLowerCase());

/**
 * Ciudades cuyo nombre por sí solo NO identifica el país sin ambigüedad.
 * Ejemplos reales y documentados del packet: "San José" es capital de
 * Costa Rica, pero también existe San José, California (US) y San José,
 * Belize (Cayo). "Santiago" es capital de Chile y también una provincia en
 * República Dominicana. "Georgetown" es capital de Guyana y también una
 * ciudad en varios estados de EE. UU. Esta lista es una heurística v1
 * deliberadamente conservadora — mejor tratar una ciudad no listada como
 * "no ambigua por defecto" (riesgo bajo) que mantener una lista exhaustiva
 * inmantenible.
 */
const KNOWN_AMBIGUOUS_CITIES = new Set(
  ['san jose', 'santiago', 'georgetown', 'cambridge', 'springfield', 'guadalupe', 'santa cruz', 'la libertad'].map(normalizeCity),
);

const MIN_COUNTRY_SIGNAL_CONFIDENCE = 0.3;

/**
 * Resuelve país/ciudad a partir de varias señales observadas para el MISMO
 * candidato. No decide identidad de empresa (eso es entity-resolver.ts) —
 * solo produce la mejor ubicación soportable, o declara AMBIGUOUS/NONE de
 * forma explícita si no hay soporte suficiente.
 */
export const resolveLocation = (signals: readonly LocationSignal[]): LocationResolution => {
  if (signals.length === 0) {
    return LocationResolutionSchema.parse({ status: 'NONE', confidence: 0, reason: 'sin señales de ubicación' });
  }

  // Agrupa por ciudad normalizada — señales de ciudades distintas no se
  // combinan entre sí; se elige el grupo con mayor confidence acumulada
  // (suma simple, suficiente para v1: más señales corroborando la misma
  // ciudad debe pesar más que una sola señal aislada de otra ciudad).
  const groups = new Map<string, LocationSignal[]>();
  for (const signal of signals) {
    const key = normalizeCity(signal.city);
    const existing = groups.get(key);
    if (existing) existing.push(signal);
    else groups.set(key, [signal]);
  }

  let bestKey = '';
  let bestScore = -1;
  for (const [key, group] of groups) {
    const score = group.reduce((sum, signal) => sum + signal.confidence, 0);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  const bestGroup = groups.get(bestKey)!;
  const displayCity = bestGroup.reduce((best, signal) => (signal.confidence > best.confidence ? signal : best), bestGroup[0]!).city;

  const countrySignals = bestGroup.filter(
    (signal): signal is LocationSignal & { countryCode: string } =>
      signal.countryCode !== undefined && signal.confidence >= MIN_COUNTRY_SIGNAL_CONFIDENCE,
  );
  const distinctCountries = new Set(countrySignals.map((signal) => signal.countryCode));
  const isKnownAmbiguousCity = KNOWN_AMBIGUOUS_CITIES.has(normalizeCity(displayCity));

  if (distinctCountries.size > 1) {
    // Señales de país en conflicto directo — ambiguo sin importar si la
    // ciudad estaba o no en la lista conocida.
    return LocationResolutionSchema.parse({
      status: 'AMBIGUOUS',
      city: displayCity,
      confidence: 0,
      reason: `señales de país en conflicto para "${displayCity}": ${[...distinctCountries].join(', ')}`,
    });
  }

  if (distinctCountries.size === 1) {
    const [countryCode] = distinctCountries;
    const administrativeArea = bestGroup.find((signal) => signal.administrativeArea)?.administrativeArea;
    const confidence = Math.min(1, countrySignals.reduce((sum, signal) => sum + signal.confidence, 0) / countrySignals.length);
    return LocationResolutionSchema.parse({ status: 'RESOLVED', city: displayCity, countryCode, administrativeArea, confidence });
  }

  // No hay ninguna señal de país utilizable.
  if (isKnownAmbiguousCity) {
    return LocationResolutionSchema.parse({
      status: 'AMBIGUOUS',
      city: displayCity,
      confidence: 0,
      reason: `"${displayCity}" es un nombre de ciudad conocido por ser ambiguo entre países y no hay señal de país confiable — no se fuerza un país por defecto`,
    });
  }

  // Ciudad no listada como ambigua y sin señal de país: se resuelve la
  // ciudad con confianza reducida (no hay país que confirmar), en vez de
  // declarar NONE — sigue siendo información parcial útil, distinta de
  // "sin ubicación en absoluto".
  const confidence = Math.min(0.5, bestGroup.reduce((sum, signal) => sum + signal.confidence, 0) / bestGroup.length);
  return LocationResolutionSchema.parse({
    status: 'RESOLVED',
    city: displayCity,
    confidence,
    reason: 'sin señal de país; ciudad no está en la lista de nombres ambiguos conocidos',
  });
};
