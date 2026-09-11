import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApprovalDraft, isValidReasonCode } from './escalation.js';

const context = { subjectId: 'contact-1', inboundExcerpt: 'me pueden hacer un descuento?' };

test('DISCOUNT_REQUEST produce un ApprovalDraft GRANT_DISCOUNT -- criterio "Descuento crea approval"', () => {
  const draft = buildApprovalDraft('DISCOUNT_REQUEST', context);
  assert.ok(draft);
  assert.equal(draft?.action, 'GRANT_DISCOUNT');
  assert.equal(draft && isValidReasonCode(draft.reasonCode), true);
  assert.equal(draft?.requiresHumanApproval, true);
});

test('COMMERCIAL_TERMS_REQUEST produce un ApprovalDraft CHANGE_COMMERCIAL_TERMS', () => {
  const draft = buildApprovalDraft('COMMERCIAL_TERMS_REQUEST', context);
  assert.ok(draft);
  assert.equal(draft?.action, 'CHANGE_COMMERCIAL_TERMS');
  assert.equal(draft && isValidReasonCode(draft.reasonCode), true);
});

test('COMMITMENT_REQUEST produce un ApprovalDraft BINDING_COMMITMENT -- criterio "Commitment no aprobado se bloquea"', () => {
  const draft = buildApprovalDraft('COMMITMENT_REQUEST', context);
  assert.ok(draft);
  assert.equal(draft?.action, 'BINDING_COMMITMENT');
  assert.equal(draft && isValidReasonCode(draft.reasonCode), true);
});

test('ninguna otra intencion produce un ApprovalDraft', () => {
  for (const intent of ['PRICE_INQUIRY', 'PRODUCT_QUESTION', 'UNKNOWN', 'OPT_OUT', 'HOSTILE'] as const) {
    assert.equal(buildApprovalDraft(intent, context), undefined, `${intent} no deberia escalar`);
  }
});

test('el reasonCode siempre cumple el patron real de CreateApprovalSchema (/^RHIA_APPROVAL_[A-Z0-9_]+$/)', () => {
  for (const intent of ['DISCOUNT_REQUEST', 'COMMERCIAL_TERMS_REQUEST', 'COMMITMENT_REQUEST'] as const) {
    const draft = buildApprovalDraft(intent, context);
    assert.ok(draft);
    assert.match(draft!.reasonCode, /^RHIA_APPROVAL_[A-Z0-9_]+$/);
  }
});
