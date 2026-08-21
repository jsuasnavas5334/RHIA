import type { RhiaSettings } from '@rhia/config';

export const outreachPolicyVersion = '1.0' as const;
export const outreachChannels = ['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const;
export type OutreachChannel = (typeof outreachChannels)[number];
export type StopSignal = 'REPLY' | 'MEETING_BOOKED' | 'OPT_OUT' | 'PERMANENT_BOUNCE' | 'RISK';

export type OutreachPolicy = Readonly<{
  version: typeof outreachPolicyVersion;
  maxProactiveTouches: number;
  cadenceBusinessDays: readonly number[];
  contactWindow: Readonly<{ startHour: number; endHour: number }>;
  channels: readonly Readonly<{ channel: OutreachChannel; enabled: boolean; minimumHoursBetweenTouches: number }>[];
}>;

export const createOutreachPolicy = (settings: RhiaSettings): OutreachPolicy => ({
  version: outreachPolicyVersion,
  maxProactiveTouches: settings.cadence.maxProactiveTouches,
  cadenceBusinessDays: [0, 3, 7],
  contactWindow: { startHour: 8, endHour: 20 },
  channels: settings.cadence.channels,
});

export type TouchLedgerEntry = Readonly<{
  idempotencyKey: string;
  channel: OutreachChannel;
  plannedAt: string;
  status: 'PLANNED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'CANCELLED' | 'OPTED_OUT';
}>;

export type OutreachOverride = Readonly<{
  action: 'OUTREACH_POLICY_OVERRIDE';
  organizationId: string;
  sequenceId: string;
  approvedByHumanId: string;
  approvedMaxTouches: number;
  expiresAt: string;
}>;

export type SequenceContext = Readonly<{
  organizationId: string;
  sequenceId: string;
  subjectKey: string;
  timezone: string;
  startedAt: string;
  ledger: readonly TouchLedgerEntry[];
  stopSignals: readonly StopSignal[];
  suppressedSubjectKeys: readonly string[];
  requestedIdempotencyKey?: string;
  override?: OutreachOverride;
}>;

export type PlanResult =
  | Readonly<{ outcome: 'SCHEDULED'; touch: TouchLedgerEntry }>
  | Readonly<{ outcome: 'DUPLICATE'; touch: TouchLedgerEntry }>
  | Readonly<{ outcome: 'STOPPED'; reason: StopSignal | 'SUPPRESSED' }>
  | Readonly<{ outcome: 'COMPLETE'; reason: 'MAX_TOUCHES_REACHED' | 'NO_CHANNEL_ENABLED' }>;

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const localParts = (date: Date, timezone: string) => {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
    });
    formatterCache.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { weekday: parts['weekday'] ?? '', hour: Number(parts['hour']), minute: Number(parts['minute']) };
};

export const isWithinContactWindow = (instant: string | Date, timezone: string, policy: OutreachPolicy): boolean => {
  const date = instant instanceof Date ? instant : new Date(instant);
  const local = localParts(date, timezone);
  return !['Sat', 'Sun'].includes(local.weekday) && local.hour >= policy.contactWindow.startHour && local.hour < policy.contactWindow.endHour;
};

const addBusinessDays = (instant: Date, businessDays: number, timezone: string): Date => {
  const result = new Date(instant);
  let added = 0;
  while (added < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    const { weekday } = localParts(result, timezone);
    if (!['Sat', 'Sun'].includes(weekday)) added += 1;
  }
  return result;
};

const nextContactWindow = (instant: Date, timezone: string, policy: OutreachPolicy): Date => {
  const result = new Date(instant);
  for (let steps = 0; steps < 5 * 24 * 4; steps += 1) {
    if (isWithinContactWindow(result, timezone, policy)) return result;
    result.setUTCMinutes(result.getUTCMinutes() + 15);
  }
  throw new Error(`No se encontró ventana hábil para ${timezone}.`);
};

const stopReason = (context: SequenceContext): StopSignal | 'SUPPRESSED' | undefined => {
  if (context.suppressedSubjectKeys.includes(context.subjectKey)) return 'SUPPRESSED';
  if (context.ledger.some((touch) => touch.status === 'OPTED_OUT')) return 'OPT_OUT';
  if (context.ledger.some((touch) => touch.status === 'REPLIED')) return 'REPLY';
  const priority: readonly StopSignal[] = ['OPT_OUT', 'REPLY', 'MEETING_BOOKED', 'PERMANENT_BOUNCE', 'RISK'];
  return priority.find((signal) => context.stopSignals.includes(signal));
};

const approvedMaximum = (context: SequenceContext, policy: OutreachPolicy, now: Date): number => {
  const override = context.override;
  if (
    !override ||
    override.organizationId !== context.organizationId ||
    override.sequenceId !== context.sequenceId ||
    override.action !== 'OUTREACH_POLICY_OVERRIDE' ||
    override.approvedMaxTouches <= policy.maxProactiveTouches ||
    override.approvedMaxTouches > 5 ||
    new Date(override.expiresAt).getTime() <= now.getTime()
  ) return policy.maxProactiveTouches;
  return override.approvedMaxTouches;
};

export const planNextTouch = (context: SequenceContext, policy: OutreachPolicy, now = new Date()): PlanResult => {
  const stopped = stopReason(context);
  if (stopped) return { outcome: 'STOPPED', reason: stopped };

  if (context.requestedIdempotencyKey) {
    const existing = context.ledger.find((touch) => touch.idempotencyKey === context.requestedIdempotencyKey);
    if (existing) return { outcome: 'DUPLICATE', touch: existing };
  }

  const uniqueTouches = [...new Map(context.ledger.map((touch) => [touch.idempotencyKey, touch])).values()];
  const maximum = approvedMaximum(context, policy, now);
  if (uniqueTouches.length >= maximum) return { outcome: 'COMPLETE', reason: 'MAX_TOUCHES_REACHED' };

  const enabledChannels = policy.channels.filter((channel) => channel.enabled);
  if (enabledChannels.length === 0) return { outcome: 'COMPLETE', reason: 'NO_CHANNEL_ENABLED' };
  const ordinal = uniqueTouches.length;
  const selectedChannel = enabledChannels[ordinal % enabledChannels.length];
  if (!selectedChannel) return { outcome: 'COMPLETE', reason: 'NO_CHANNEL_ENABLED' };

  const cadenceOffset = policy.cadenceBusinessDays[Math.min(ordinal, policy.cadenceBusinessDays.length - 1)] ?? 0;
  let candidate = addBusinessDays(new Date(context.startedAt), cadenceOffset, context.timezone);
  const lastTouch = uniqueTouches.at(-1);
  if (lastTouch) {
    const spacing = new Date(new Date(lastTouch.plannedAt).getTime() + selectedChannel.minimumHoursBetweenTouches * 3_600_000);
    if (spacing > candidate) candidate = spacing;
  }
  if (candidate < now) candidate = new Date(now);
  const plannedAt = nextContactWindow(candidate, context.timezone, policy).toISOString();
  const idempotencyKey = context.requestedIdempotencyKey ?? `${context.sequenceId}:touch:${ordinal + 1}`;
  return { outcome: 'SCHEDULED', touch: { idempotencyKey, channel: selectedChannel.channel, plannedAt, status: 'PLANNED' } };
};
