import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCompanyLinkage, MissingCompanyLinkageError } from './company-linking.js';

test('assertCompanyLinkage: companyGroupId presente resuelve el vinculo', () => {
  const link = assertCompanyLinkage({ companyGroupId: 'abc-123', companyEntityId: 'entity-1' });
  assert.deepEqual(link, { companyGroupId: 'abc-123', companyEntityId: 'entity-1' });
});

test('assertCompanyLinkage: companyEntityId ausente resuelve a null (no todo company_group tiene company_entity, ver PH07-T001)', () => {
  const link = assertCompanyLinkage({ companyGroupId: 'abc-123' });
  assert.equal(link.companyEntityId, null);
});

test('assertCompanyLinkage: companyGroupId undefined lanza MissingCompanyLinkageError', () => {
  assert.throws(() => assertCompanyLinkage({ companyGroupId: undefined }), MissingCompanyLinkageError);
});

test('assertCompanyLinkage: companyGroupId null lanza MissingCompanyLinkageError', () => {
  assert.throws(() => assertCompanyLinkage({ companyGroupId: null }), MissingCompanyLinkageError);
});

test('assertCompanyLinkage: companyGroupId vacio/solo espacios lanza MissingCompanyLinkageError', () => {
  assert.throws(() => assertCompanyLinkage({ companyGroupId: '   ' }), MissingCompanyLinkageError);
});
