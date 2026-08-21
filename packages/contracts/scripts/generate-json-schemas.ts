import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ContractSchemas } from '../src/index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = resolve(packageRoot, 'generated/json-schema');
await mkdir(outputDirectory, { recursive: true });

for (const [name, schema] of Object.entries(ContractSchemas)) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  const document = {
    $id: `https://schemas.rhia.invalid/v1/${name}.schema.json`,
    title: `RHIA ${name} v1`,
    ...jsonSchema,
  };
  await writeFile(resolve(outputDirectory, `${name}.schema.json`), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

await writeFile(
  resolve(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ version: '1.0', schemas: Object.keys(ContractSchemas) }, null, 2)}\n`,
  'utf8',
);
