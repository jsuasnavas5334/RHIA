import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { defaultRhiaSettings, RhiaSettingsSchema } from '../src/index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = resolve(packageRoot, 'generated');
await mkdir(outputDirectory, { recursive: true });

const schema = {
  $id: 'https://schemas.rhia.invalid/v1/RhiaSettings.schema.json',
  title: 'RHIA Settings v1',
  ...z.toJSONSchema(RhiaSettingsSchema, { target: 'draft-2020-12' }),
};
await writeFile(resolve(outputDirectory, 'RhiaSettings.schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
await writeFile(resolve(outputDirectory, 'defaults.json'), `${JSON.stringify(defaultRhiaSettings, null, 2)}\n`, 'utf8');
