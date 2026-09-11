export { meetingQualificationStates, stateMachines, canTransition, assertTransition, isTerminalState } from '@rhia/domain';
export type { Meeting, MeetingStatus, QualificationStatus } from './schema.js';

export { createCalendarError, normalizeUnexpectedCalendarError } from './contracts.js';
export type {
  CalendarSlot,
  AvailabilityQuery,
  CalendarErrorCode,
  CalendarError,
  CreateCalendarEventRequest,
  CreateCalendarEventSuccess,
  CreateCalendarEventFailure,
  CreateCalendarEventResult,
  CancelCalendarEventResult,
  CalendarAdapter,
} from './contracts.js';

export { DEFAULT_BUSINESS_HOURS, isWithinBusinessHours, proposeSlots } from './availability.js';
export type { BusinessHours } from './availability.js';

export {
  DEFAULT_MEETING_DURATION_MINUTES,
  findDoubleBookingConflict,
  bookMeeting,
  rescheduleMeeting,
  cancelMeeting,
  markNoShow,
} from './scheduler.js';
export type {
  BookMeetingInput,
  BookMeetingOutcome,
  RescheduleMeetingOutcome,
  CancelMeetingOutcome,
  MarkNoShowOutcome,
  InvalidTransitionOutcome,
} from './scheduler.js';

export { recordAttendance, isEffectiveMeeting } from './attendance.js';
export type { RecordAttendanceOutcome } from './attendance.js';

export { computeMeetingFunnelKpis } from './kpi.js';
export type { MeetingFunnelKpis } from './kpi.js';
