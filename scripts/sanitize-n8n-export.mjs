import fs from 'node:fs';
import path from 'node:path';

const [rawDirectory, outputDirectory] = process.argv.slice(2);
if (!rawDirectory || !outputDirectory) {
  console.error('Uso: node sanitize-n8n-export.mjs <directorio-raw> <directorio-sanitizado>');
  process.exit(2);
}

const sensitiveKey = /(password|passphrase|secret|token|api.?key|authorization|client.?secret|access.?token|refresh.?token)/i;
const sensitiveHeader = /^(authorization|proxy-authorization|x-api-key|api-key|x-auth-token)$/i;
const bearerValue = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i;
const findings = [];

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' &&
    !(Array.isArray(value) && value.length === 0) &&
    !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}

function scan(value, currentPath) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scan(entry, `${currentPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && bearerValue.test(value)) findings.push(currentPath);
    return;
  }

  if (typeof value.name === 'string' && sensitiveHeader.test(value.name) && hasValue(value.value)) {
    findings.push(`${currentPath}.value`);
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${currentPath}.${key}`;
    if (key === 'credentials') continue;
    if (sensitiveKey.test(key) && hasValue(entry)) findings.push(entryPath);
    scan(entry, entryPath);
  }
}

function sanitizeWorkflow(workflow) {
  const credentialTypes = new Set();
  for (const node of workflow.nodes ?? []) {
    for (const credentialType of Object.keys(node.credentials ?? {})) credentialTypes.add(credentialType);
    delete node.credentials;
  }
  delete workflow.pinData;
  delete workflow.staticData;
  delete workflow.shared;
  return { workflow, credentialTypes: [...credentialTypes].sort() };
}

const files = fs.readdirSync(rawDirectory)
  .filter((file) => file.endsWith('.json'))
  .sort();
if (!files.length) throw new Error('El export raw no contiene archivos JSON.');

const sanitized = [];
for (const file of files) {
  const document = JSON.parse(fs.readFileSync(path.join(rawDirectory, file), 'utf8'));
  const workflows = Array.isArray(document) ? document : [document];
  if (workflows.length !== 1) throw new Error(`${file} no contiene exactamente un workflow.`);
  const workflow = workflows[0];
  if (!/^[A-Za-z0-9_-]+$/.test(workflow.id ?? '')) throw new Error(`${file} tiene un ID inválido.`);
  scan(workflow.nodes ?? [], `${workflow.id}.nodes`);
  const result = sanitizeWorkflow(workflow);
  sanitized.push({ file: `${workflow.id}.json`, ...result });
}

if (findings.length) {
  console.error('Export detenido: se detectaron posibles secretos embebidos en:');
  [...new Set(findings)].sort().forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

const uniqueIds = new Set(sanitized.map(({ workflow }) => workflow.id));
if (uniqueIds.size !== sanitized.length) throw new Error('El export contiene IDs de workflow duplicados.');

fs.mkdirSync(outputDirectory, { recursive: false, mode: 0o700 });
const manifest = [];
for (const { file, workflow, credentialTypes } of sanitized) {
  fs.writeFileSync(path.join(outputDirectory, file), `${JSON.stringify(workflow, null, 2)}\n`, { mode: 0o600 });
  manifest.push({
    id: workflow.id,
    name: workflow.name,
    active: Boolean(workflow.active),
    nodeCount: workflow.nodes?.length ?? 0,
    credentialTypes,
    file,
  });
}
fs.writeFileSync(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ version: 1, workflowCount: manifest.length, workflows: manifest }, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(`Export sanitizado: ${manifest.length} workflows; sin referencias concretas de credenciales.`);
