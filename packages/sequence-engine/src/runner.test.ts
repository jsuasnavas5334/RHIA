import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChannelSendRequest, ChannelSendResult } from '@rhia/channel-gateway';
import type { OutreachPolicy, SequenceContext, TouchLedgerEntry } from '@rhia/outreach-policy';
import { advanceSequence, toChannelId } from './runner.js';

const policy: OutreachPolicy = {
  version: '1.0',
  maxProactiveTouches: 3,
  cadenceBusinessDays: [0, 3, 7],
  contactWindow: { startHour: 8, endHour: 20 },
  channels: [{ channel: 'EMAIL', enabled: true, minimumHoursBetweenTouches: 48 }],
};

const baseContext = (overrides: Partial<SequenceContext> = {}): SequenceContext => ({
  organizationId: 'org-1',
  sequenceId: 'seq-1',
  subjectKey: 'contact-hash-1',
  timezone: 'America/Guayaquil',
  startedAt: '2026-08-24T14:00:00Z',
  ledger: [],
  stopSignals: [],
  suppressedSubjectKeys: [],
  ...overrides,
});

const makeFakeSend = () => {
  const calls: ChannelSendRequest[] = [];
  const send = async (request: ChannelSendRequest): Promise<ChannelSendResult> => {
    calls.push(request);
    return {
      status: 'SUCCEEDED',
      requestId: request.idempotencyKey,
      channel: request.channel,
      provider: request.provider,
      providerMessageId: `msg-${calls.length}`,
      deliveryStatus: 'SENT',
      deduplicated: false,
      latencyMs: 1,
    };
  };
  return { send, calls };
};

const buildMessage = () => ({ to: 'prospecto@example.com', subject: 'Asunto', body: 'Cuerpo', metadata: {} });

test('toChannelId mapea cada OutreachChannel a su ChannelId equivalente (exhaustivo, EMAIL/LINKEDIN/WHATSAPP)', () => {
  assert.equal(toChannelId('EMAIL'), 'email');
  assert.equal(toChannelId('LINKEDIN'), 'linkedin');
  assert.equal(toChannelId('WHATSAPP'), 'whatsapp');
});

test('3-touch boundary: advanceSequence nunca llama a send una 4ta vez; la 4ta llamada es COMPLETE', async () => {
  const { send, calls } = makeFakeSend();
  let ledger: TouchLedgerEntry[] = [];
  let now = new Date('2026-08-24T14:00:00Z');

  // Un caller real espera hasta `plannedAt` antes de reintentar (DEFERRED no
  // es un error, es "todavia no toca"). Simulamos exactamente eso: si sale
  // DEFERRED, avanzamos el reloj simulado hasta ese instante y reintentamos
  // el MISMO toque -- nunca contamos un DEFERRED como un envio.
  for (let ordinal = 0; ordinal < 3; ordinal += 1) {
    let outcome = await advanceSequence({ context: baseContext({ ledger }), policy, resolveProvider: () => 'n8n-webhook', buildMessage, send, now });
    if (outcome.outcome === 'DEFERRED') {
      now = new Date(outcome.touch.plannedAt);
      outcome = await advanceSequence({ context: baseContext({ ledger }), policy, resolveProvider: () => 'n8n-webhook', buildMessage, send, now });
    }
    assert.equal(outcome.outcome, 'SENT', `toque ${ordinal + 1} debia enviarse, resultado: ${JSON.stringify(outcome)}`);
    if (outcome.outcome !== 'SENT') continue;
    ledger = [...ledger, outcome.touch];
    now = new Date(outcome.touch.plannedAt);
  }
  assert.equal(calls.length, 3, 'exactamente 3 envios reales tras 3 avances');

  const fourth = await advanceSequence({ context: baseContext({ ledger }), policy, resolveProvider: () => 'n8n-webhook', buildMessage, send, now });
  assert.deepEqual(fourth, { outcome: 'COMPLETE', reason: 'MAX_TOUCHES_REACHED' });
  assert.equal(calls.length, 3, 'la 4ta llamada NO debe invocar send -- nunca supera max_touches (criterio de aceptacion)');
});

test('mid-sequence reply: advanceSequence se detiene STOPPED y no vuelve a llamar send tras una respuesta', async () => {
  const { send, calls } = makeFakeSend();
  const firstLedger: TouchLedgerEntry[] = [];
  const now = new Date('2026-08-24T14:00:00Z');

  const first = await advanceSequence({ context: baseContext({ ledger: firstLedger }), policy, resolveProvider: () => 'n8n-webhook', buildMessage, send, now });
  assert.equal(first.outcome, 'SENT');
  assert.equal(calls.length, 1);

  // Llega una respuesta del prospecto antes del segundo toque -- el ledger real
  // ahora incluye una entrada REPLIED (esto lo escribiria el caller real, no este paquete).
  const ledgerAfterReply: TouchLedgerEntry[] =
    first.outcome === 'SENT' ? [{ ...first.touch, status: 'REPLIED' }] : [];

  const second = await advanceSequence({
    context: baseContext({ ledger: ledgerAfterReply }),
    policy,
    resolveProvider: () => 'n8n-webhook',
    buildMessage,
    send,
    now: new Date(now.getTime() + 4 * 24 * 3_600_000),
  });
  assert.deepEqual(second, { outcome: 'STOPPED', reason: 'REPLY' });
  assert.equal(calls.length, 1, 'no debe enviarse ningun toque adicional despues de una respuesta');
});

test('opt-out: advanceSequence se detiene STOPPED y no llama send', async () => {
  const { send, calls } = makeFakeSend();
  const ledger: TouchLedgerEntry[] = [
    { idempotencyKey: 'seq-1:touch:1', channel: 'EMAIL', plannedAt: '2026-08-24T14:00:00Z', status: 'OPTED_OUT' },
  ];
  const outcome = await advanceSequence({
    context: baseContext({ ledger }),
    policy,
    resolveProvider: () => 'n8n-webhook',
    buildMessage,
    send,
    now: new Date('2026-08-25T00:00:00Z'),
  });
  assert.deepEqual(outcome, { outcome: 'STOPPED', reason: 'OPT_OUT' });
  assert.equal(calls.length, 0);
});

test('DEFERRED: advanceSequence no envia si el toque planificado todavia no llega (now < plannedAt) y no llama send', async () => {
  const { send, calls } = makeFakeSend();
  const outcome = await advanceSequence({
    context: baseContext(),
    policy,
    resolveProvider: () => 'n8n-webhook',
    buildMessage,
    send,
    now: new Date('2026-08-20T00:00:00Z'), // antes de startedAt
  });
  assert.equal(outcome.outcome, 'DEFERRED');
  assert.equal(calls.length, 0);
});

test('request enviado al Channel Gateway usa la idempotencyKey que calculo OutreachPolicy, nunca una nueva por intento', async () => {
  const { send, calls } = makeFakeSend();
  await advanceSequence({ context: baseContext(), policy, resolveProvider: () => 'n8n-webhook', buildMessage, send, now: new Date('2026-08-24T14:00:00Z') });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.idempotencyKey, 'seq-1:touch:1');
  assert.equal(calls[0]!.channel, 'email');
  assert.equal(calls[0]!.organizationId, 'org-1');
});
