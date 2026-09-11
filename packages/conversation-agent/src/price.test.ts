import { test } from 'node:test';
import assert from 'node:assert/strict';
import { communicateOfficialPrice, isPriceBookCurrentlyActive } from './price.js';
import type { PriceBook } from './schema.js';

const now = new Date('2026-09-10T12:00:00Z');

const basePriceBook: PriceBook = {
  id: 'pb-1',
  organizationId: 'org-1',
  countryCode: 'EC',
  currency: 'USD',
  validFrom: '2026-01-01T00:00:00Z',
  validTo: null,
  status: 'ACTIVE',
  items: [{ priceBookId: 'pb-1', productId: 'prod-1', sku: 'RHIA-CORE', productName: 'RHIA Core', unitPrice: 199, minimumQuantity: 1 }],
};

test('precio oficial ACTIVE y vigente SI se comunica -- criterio "Precio oficial activo puede comunicarse"', () => {
  const result = communicateOfficialPrice(basePriceBook, 'RHIA-CORE', now);
  assert.equal(result.communicated, true);
  if (result.communicated) {
    assert.equal(result.priceText, 'USD 199.00');
    assert.equal(result.item.sku, 'RHIA-CORE');
  }
});

test('price book en DRAFT nunca se comunica -- evita "Responder con precio stale"', () => {
  const draft: PriceBook = { ...basePriceBook, status: 'DRAFT' };
  const result = communicateOfficialPrice(draft, 'RHIA-CORE', now);
  assert.equal(result.communicated, false);
  assert.equal(!result.communicated && result.reason, 'NO_ACTIVE_PRICE_BOOK');
});

test('price book ya vencido (validTo pasado) nunca se comunica', () => {
  const expired: PriceBook = { ...basePriceBook, validTo: '2026-06-01T00:00:00Z' };
  const result = communicateOfficialPrice(expired, 'RHIA-CORE', now);
  assert.equal(result.communicated, false);
  assert.equal(!result.communicated && result.reason, 'PRICE_BOOK_EXPIRED');
});

test('price book todavia no vigente (validFrom futuro) nunca se comunica', () => {
  const future: PriceBook = { ...basePriceBook, validFrom: '2027-01-01T00:00:00Z' };
  const result = communicateOfficialPrice(future, 'RHIA-CORE', now);
  assert.equal(result.communicated, false);
  assert.equal(!result.communicated && result.reason, 'PRICE_BOOK_NOT_YET_VALID');
});

test('sin price book disponible nunca se inventa un precio', () => {
  const result = communicateOfficialPrice(undefined, 'RHIA-CORE', now);
  assert.equal(result.communicated, false);
  assert.equal(!result.communicated && result.reason, 'NO_ACTIVE_PRICE_BOOK');
});

test('producto sin item en el price book activo nunca se inventa un precio', () => {
  const result = communicateOfficialPrice(basePriceBook, 'SKU-DESCONOCIDO', now);
  assert.equal(result.communicated, false);
  assert.equal(!result.communicated && result.reason, 'PRODUCT_NOT_FOUND');
});

test('isPriceBookCurrentlyActive coincide con la misma decision que communicateOfficialPrice', () => {
  assert.equal(isPriceBookCurrentlyActive(basePriceBook, now), true);
  assert.equal(isPriceBookCurrentlyActive({ ...basePriceBook, status: 'ARCHIVED' }, now), false);
});
