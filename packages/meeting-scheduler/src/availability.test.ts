import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinBusinessHours, proposeSlots, DEFAULT_BUSINESS_HOURS } from './availability.js';

test('isWithinBusinessHours usa el timezone explicito, nunca la hora del servidor -- criterio "Timezone correcto"', () => {
  // 2026-09-14 14:00 UTC = 09:00 en America/Guayaquil (UTC-5) y = 16:00 en Europe/Madrid (UTC+2 en septiembre).
  const instant = '2026-09-14T14:00:00Z';
  assert.equal(isWithinBusinessHours(instant, 'America/Guayaquil'), true, 'las 09:00 locales en Guayaquil SI caen en horario laboral (9-18)');
  assert.equal(isWithinBusinessHours(instant, 'Europe/Madrid'), true, 'las 16:00 locales en Madrid SI caen en horario laboral (9-18)');
});

test('isWithinBusinessHours excluye fines de semana en el timezone local, no en UTC', () => {
  // 2026-09-19 es sabado. A las 10:00 UTC en Guayaquil (UTC-5) sigue siendo sabado 05:00 -> fuera de horario Y fin de semana.
  assert.equal(isWithinBusinessHours('2026-09-19T15:00:00Z', 'America/Guayaquil'), false);
});

test('proposeSlots descarta slots fuera de horario laboral y slots ya pasados, sin inventar ninguno nuevo', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const slots = [
    { start: '2026-09-14T10:00:00Z', end: '2026-09-14T10:30:00Z' }, // 05:00 Guayaquil -- fuera de horario
    { start: '2026-09-14T15:00:00Z', end: '2026-09-14T15:30:00Z' }, // 10:00 Guayaquil -- dentro de horario, futuro
    { start: '2026-09-14T11:00:00Z', end: '2026-09-14T11:30:00Z' }, // ya paso respecto a `now`
  ];
  const proposed = proposeSlots(slots, 'America/Guayaquil', now, DEFAULT_BUSINESS_HOURS);
  assert.deepEqual(proposed, [slots[1]]);
});

test('proposeSlots respeta el limite maximo de propuestas', () => {
  const now = new Date('2026-09-14T00:00:00Z');
  // Todos los dias son lunes reales en UTC-5 (Guayaquil) a las 10:00 locales -- dentro de horario, para aislar el test del filtro de fin de semana.
  const mondays = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
  const slots = mondays.map((day) => ({ start: `${day}T15:00:00Z`, end: `${day}T15:30:00Z` }));
  const proposed = proposeSlots(slots, 'America/Guayaquil', now, DEFAULT_BUSINESS_HOURS, 3);
  assert.equal(proposed.length, 3);
});
