import { meetingQualificationStates, stateMachines } from '@rhia/domain';

// Meeting Scheduler (PH08-T005) -- contratos locales de `Meeting`.
//
// "Archivos o areas afectadas" del packet: "calendar/meetings". La tabla
// real `meeting` YA EXISTE en packages/db/src/schema.ts (PH03-T001/PH04,
// lineas 525-540: id, organization_id, opportunity_id, contact_id,
// scheduled_at, timezone, status, qualification_status, attended, outcome,
// calendar_event_id, created_at, updated_at) -- este ciclo NO agrega
// ninguna columna ni tabla nueva (guardrail del proyecto). `Meeting` aqui
// es un tipo plano LOCAL (sin zod), mismo patron y misma razon que
// `Inference`/`PriceBook` en `messaging`/`conversation-agent` (sin red
// disponible para instalar zod 4.4.3 real en este ciclo).
//
// CORRECCION real de este mismo ciclo (encontrada al leer @rhia/domain
// completo antes de empezar PH09-T001, no en la sesion original que
// escribio este archivo): `@rhia/domain` YA EXPORTA DOS contratos reales
// que este archivo debia reusar y no reuso a tiempo:
//   1. `meetingQualificationStates` (`'UNQUALIFIED' | 'POTENTIAL' |
//      'QUALIFIED'`) -- el enum local que este archivo definia antes tenia
//      un `'DISQUALIFIED'` inventado y omitia `'POTENTIAL'` real.
//   2. `stateMachines.meeting` (`states.ts`, real maquina de estados con
//      transiciones: `BOOKED -> {CONFIRMED, ATTENDED, NO_SHOW, CANCELLED,
//      RESCHEDULED}`, `CONFIRMED -> {ATTENDED, NO_SHOW, CANCELLED,
//      RESCHEDULED}`, y `ATTENDED`/`NO_SHOW`/`CANCELLED`/`RESCHEDULED` son
//      terminales) -- el enum local que este archivo definia antes usaba
//      `'COMPLETED'` (inventado, no existe en el contrato real) en vez de
//      `'ATTENDED'` (el valor real), y omitia `'CONFIRMED'` por completo.
// Se corrigen ambos reusando los exports reales de `@rhia/domain` -- mismo
// guardrail del proyecto ("reusar antes de crecer") aplicado a un contrato
// de dominio compartido, no a una tabla de Postgres. `MeetingStatus` ahora
// es literalmente `stateMachines.meeting.states[number]`, y `scheduler.ts`/
// `attendance.ts` usan `canTransition('meeting', from, to)` (tambien real,
// de `@rhia/domain`) para GUARDAR cada cambio de estado -- nunca se asigna
// un `status` nuevo sin confirmar primero que la maquina real lo permite.
export type MeetingStatus = (typeof stateMachines.meeting.states)[number];
export type QualificationStatus = (typeof meetingQualificationStates)[number];

export type Meeting = Readonly<{
  id: string;
  organizationId: string;
  opportunityId: string;
  contactId: string;
  scheduledAt: string;
  timezone: string;
  status: MeetingStatus;
  qualificationStatus: QualificationStatus;
  attended: boolean;
  outcome: string | null;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}>;
