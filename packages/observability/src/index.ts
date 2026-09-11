export {
  createTraceContext,
  startSpan,
  endSpan,
  buildTracePath,
  tracePathIncludesSequence,
} from './trace.js';
export type { TraceContext, Span, SpanKind, CreateTraceContextResult, StartSpanResult, EndSpanResult } from './trace.js';

export { createLogEntry, createLogger, logLevels } from './logging.js';
export type { StructuredLogEntry, CreateLogEntryInput, CreateLogEntryResult, LogLevel, Logger } from './logging.js';

export {
  buildComponentId,
  parseComponentId,
  buildHealthEvent,
  computeComponentHealthScores,
  buildHealthSnapshot,
  DEFAULT_HEALTH_SCORE_OPTIONS,
} from './health.js';
export type {
  ComponentKind,
  ComponentHealthStatus,
  HealthEventInput,
  HealthEventRecord,
  HealthClassification,
  ComponentHealthScore,
  HealthScoreOptions,
  HealthSnapshot,
} from './health.js';

export { MetricsCollector } from './metrics.js';
export type { MetricKind, MetricSample, MetricSummary, RecordMetricResult } from './metrics.js';

export { computeRetentionCutoff, partitionByRetention } from './retention.js';
export type { RetentionPolicy, RetainedTimestamped, RetentionPartition } from './retention.js';

export { observabilityErrorCodes, createObservabilityError } from './errors.js';
export type { ObservabilityErrorCode, ObservabilityError } from './errors.js';
