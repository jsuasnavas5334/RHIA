import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '../packages/db/src/schema.ts';

const manifest = JSON.parse(await readFile(new URL('../packages/db/generated/schema-manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.version, '0007_auth_audit');
assert.equal(manifest.tableCount, 51);
assert.equal(manifest.tables.length, 51);

const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
for (const expected of manifest.tables) {
  const exported = schema[camel(expected.name)];
  assert.ok(exported, `Falta export Drizzle para ${expected.name}`);
  assert.equal(getTableName(exported), expected.name, `Nombre SQL divergente: ${expected.name}`);
  const columns = getTableColumns(exported);
  assert.deepEqual(Object.keys(columns).sort(), expected.columns.map(camel).sort(), `Columnas divergentes: ${expected.name}`);
}

assert.equal(schema.companyEntity.countryCode.notNull, true);
assert.equal(schema.companyLocation.countryCode.notNull, true);
assert.equal(schema.opportunity.marketCountry.notNull, true);
assert.equal(schema.outreachSequence.maxTouches.notNull, true);
assert.equal(schema.contactPoint.valueEncrypted.notNull, true);
assert.equal(schema.outreachPolicy.configuration.notNull, true);
assert.equal(schema.outreachSuppression.subjectKeyHash.notNull, true);

console.log('Drizzle parity verificada: 51 tablas y todas sus columnas coinciden con las migrations.');
