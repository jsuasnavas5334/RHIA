export type { HolidayCalendar } from './holidays.js';
export { isHoliday, rescheduleAroundHolidays } from './holidays.js';

export type { TouchPlanEntry, TouchPlanResult, BuildTouchPlanOptions } from './touch-plan.js';
export { buildTouchPlan } from './touch-plan.js';

export type {
  ChannelProviderResolver,
  SequenceMessage,
  SequenceMessageBuilder,
  SendCapability,
  AdvanceSequenceInput,
  AdvanceSequenceOutcome,
} from './runner.js';
export { toChannelId, advanceSequence } from './runner.js';

// No se reexporta `createOutreachPolicy` aqui a proposito: construir un
// `OutreachPolicy` a partir de `RhiaSettings` es responsabilidad de
// `@rhia/outreach-policy` (PH03-T003, ya DONE) y de `@rhia/config` -- un
// caller que lo necesite lo importa directamente de ese paquete. Mantener
// este barrel limitado a lo que Sequence Engine usa evita arrastrar el tipo
// `RhiaSettings` (y su dependencia de `zod`) a la superficie publica de este
// paquete sin necesidad real.
export type {
  OutreachChannel,
  OutreachPolicy,
  SequenceContext,
  StopSignal,
  TouchLedgerEntry,
  OutreachOverride,
  PlanResult,
} from '@rhia/outreach-policy';
export { isWithinContactWindow, planNextTouch, outreachChannels, outreachPolicyVersion } from '@rhia/outreach-policy';
