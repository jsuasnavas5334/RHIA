export { errorCatalog, errorCategories, errorCodes, getErrorDefinition, type ErrorCategory, type ErrorCode, type ErrorDefinition } from './errors.js';
export { assertTransition, canTransition, InvalidStateTransitionError, isTerminalState, stateMachines, type StateMachineName } from './states.js';

export const meetingQualificationStates = ['UNQUALIFIED', 'POTENTIAL', 'QUALIFIED'] as const;
