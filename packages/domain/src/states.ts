export const stateMachines = {
  job: {
    initial: 'PENDING',
    states: ['PENDING', 'QUEUED', 'RUNNING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'DEAD_LETTER'],
    terminal: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'DEAD_LETTER'],
    transitions: {
      PENDING: ['QUEUED', 'CANCELLED'],
      QUEUED: ['RUNNING', 'CANCELLED'],
      RUNNING: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED'],
      RETRY_SCHEDULED: ['QUEUED', 'DEAD_LETTER', 'CANCELLED'],
      SUCCEEDED: [],
      PARTIAL: [],
      FAILED: [],
      CANCELLED: [],
      DEAD_LETTER: [],
    },
  },
  evidence: {
    initial: 'COLLECTED',
    states: ['COLLECTED', 'VALIDATED', 'ACTIVE', 'STALE', 'CONTRADICTED', 'REJECTED', 'SUPERSEDED'],
    terminal: ['REJECTED', 'SUPERSEDED'],
    transitions: {
      COLLECTED: ['VALIDATED', 'REJECTED'],
      VALIDATED: ['ACTIVE', 'CONTRADICTED', 'REJECTED'],
      ACTIVE: ['STALE', 'CONTRADICTED', 'SUPERSEDED'],
      STALE: ['VALIDATED', 'SUPERSEDED'],
      CONTRADICTED: ['VALIDATED', 'REJECTED', 'SUPERSEDED'],
      REJECTED: [],
      SUPERSEDED: [],
    },
  },
  opportunity: {
    initial: 'DISCOVERED',
    states: ['DISCOVERED', 'QUALIFYING', 'QUALIFIED', 'NURTURE', 'OUTREACH_ACTIVE', 'ENGAGED', 'MEETING_BOOKED', 'WON', 'LOST', 'DISQUALIFIED'],
    terminal: ['WON', 'LOST', 'DISQUALIFIED'],
    transitions: {
      DISCOVERED: ['QUALIFYING', 'DISQUALIFIED'],
      QUALIFYING: ['QUALIFIED', 'NURTURE', 'DISQUALIFIED'],
      QUALIFIED: ['OUTREACH_ACTIVE', 'NURTURE', 'DISQUALIFIED'],
      NURTURE: ['QUALIFYING', 'OUTREACH_ACTIVE', 'LOST'],
      OUTREACH_ACTIVE: ['ENGAGED', 'MEETING_BOOKED', 'NURTURE', 'LOST'],
      ENGAGED: ['MEETING_BOOKED', 'NURTURE', 'LOST'],
      MEETING_BOOKED: ['WON', 'NURTURE', 'LOST'],
      WON: [],
      LOST: [],
      DISQUALIFIED: [],
    },
  },
  message: {
    initial: 'DRAFT',
    states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PLANNED', 'SENDING', 'SENT', 'DELIVERED', 'REPLIED', 'BOUNCED', 'FAILED', 'CANCELLED', 'OPTED_OUT'],
    terminal: ['REPLIED', 'BOUNCED', 'FAILED', 'CANCELLED', 'OPTED_OUT'],
    transitions: {
      DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
      PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
      APPROVED: ['PLANNED', 'CANCELLED'],
      PLANNED: ['SENDING', 'CANCELLED', 'OPTED_OUT'],
      SENDING: ['SENT', 'FAILED', 'OPTED_OUT'],
      SENT: ['DELIVERED', 'REPLIED', 'BOUNCED', 'FAILED', 'OPTED_OUT'],
      DELIVERED: ['REPLIED', 'OPTED_OUT'],
      REPLIED: [],
      BOUNCED: [],
      FAILED: [],
      CANCELLED: [],
      OPTED_OUT: [],
    },
  },
  meeting: {
    initial: 'BOOKED',
    states: ['BOOKED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED'],
    terminal: ['ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED'],
    transitions: {
      BOOKED: ['CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED'],
      CONFIRMED: ['ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED'],
      ATTENDED: [],
      NO_SHOW: [],
      CANCELLED: [],
      RESCHEDULED: [],
    },
  },
} as const;

export type StateMachineName = keyof typeof stateMachines;

export class InvalidStateTransitionError extends Error {
  readonly code = 'RHIA_STATE_INVALID_TRANSITION';
  constructor(readonly machine: StateMachineName, readonly from: string, readonly to: string) {
    super(`Transición inválida en ${machine}: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export const canTransition = (machineName: StateMachineName, from: string, to: string): boolean => {
  const machine = stateMachines[machineName];
  const allowed = (machine.transitions as Readonly<Record<string, readonly string[]>>)[from];
  return Boolean(allowed?.includes(to));
};

export const assertTransition = (machineName: StateMachineName, from: string, to: string): void => {
  if (!canTransition(machineName, from, to)) throw new InvalidStateTransitionError(machineName, from, to);
};

export const isTerminalState = (machineName: StateMachineName, state: string): boolean =>
  (stateMachines[machineName].terminal as readonly string[]).includes(state);
