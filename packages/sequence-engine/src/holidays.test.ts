import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutreachPolicy } from '@rhia/outreach-policy';
import { isHoliday, rescheduleAroundHolidays } from './holidays.js';

const policy: OutreachPolicy = {
  version: '1.0',
  maxProactiveTouches: 3,
  cadenceBusinessDays: [0, 3, 7],
  contactWindow: { startHour: 8, endHour: 20 },
  channels: [{ channel: 'EMAIL', enabled: true, minimumHoursBetweenTouches: 48 }],
};

test('isHoliday es false sin calendario configurado (no-op real, "si se configura")', () => {
  assert.equal(isHoliday('2026-12-25T14:00:00Z', 'America/Guayaquil', undefined), false);
  assert.equal(isHoliday('2026-12-25T14:00:00Z', 'America/Guayaquil', []), false);
});

test('isHoliday compara la fecha local del timezone del contacto, no UTC', () => {
  // 2026-12-25T02:30:00Z en America/Guayaquil (UTC-5) todavia es 2026-12-24 local.
  assert.equal(isHoliday('2026-12-25T02:30:00Z', 'America/Guayaquil', ['2026-12-25']), false);
  assert.equal(isHoliday('2026-12-25T02:30:00Z', 'America/Guayaquil', ['2026-12-24']), true);
});

test('rescheduleAroundHolidays no cambia nada sin calendario (no-op real)', () => {
  const plannedAt = '2026-08-24T14:00:00Z'; // lunes, dentro de ventana Guayaquil
  assert.equal(rescheduleAroundHolidays(plannedAt, 'America/Guayaquil', policy, undefined), plannedAt);
});

test('rescheduleAroundHolidays empuja hacia adelante (nunca hacia atras) fuera de un feriado', () => {
  // 2026-08-24 (lunes) 14:00 UTC = 09:00 America/Guayaquil, dentro de ventana [8,20) y no fin de semana.
  const plannedAt = '2026-08-24T14:00:00Z';
  const rescheduled = rescheduleAroundHolidays(plannedAt, 'America/Guayaquil', policy, ['2026-08-24']);
  assert.notEqual(rescheduled, plannedAt);
  assert.ok(new Date(rescheduled).getTime() > new Date(plannedAt).getTime(), 'debe moverse hacia adelante, nunca hacia atras');
  assert.equal(isHoliday(rescheduled, 'America/Guayaquil', ['2026-08-24']), false);
});

test('rescheduleAroundHolidays combina feriado consecutivo + fin de semana y sigue devolviendo ventana habil real', () => {
  // Viernes 2026-08-21 feriado -> debe saltar sabado/domingo y aterrizar en lunes 2026-08-24, dentro de ventana.
  const plannedAt = '2026-08-21T14:00:00Z';
  const rescheduled = rescheduleAroundHolidays(plannedAt, 'America/Guayaquil', policy, ['2026-08-21']);
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(rescheduled));
  assert.equal(local, '2026-08-24');
});
