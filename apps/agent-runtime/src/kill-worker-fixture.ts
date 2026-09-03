import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresAgentRuntimeStore, checkpointInputHash } from './store.js';

const databaseUrl = process.env['RHIA_TEST_DATABASE_URL'];
const organizationId = process.env['RHIA_KILL_TEST_ORGANIZATION_ID'];
if (!databaseUrl || !organizationId) throw new Error('Fixture de kill sin configuración.');
const pool = new Pool({ connectionString: databaseUrl, options: '-c search_path=rhia,public' });
const store = new PostgresAgentRuntimeStore(pool);
const claimed = await store.claim(organizationId, `kill-fixture-${process.pid}`, 1_000);
if (!claimed) throw new Error('Fixture no pudo reclamar el job.');
const checkpoint = await store.beginStep(claimed, 'process-kill-step', checkpointInputHash({ stable: true }));
const actionId = await store.reserveAction(claimed, checkpoint.id, {
  capabilityKey: 'records.read', resourceType: 'COMPANY', requestPayload: { fixture: randomUUID() }, riskLevel: 'LOW',
});
process.stdout.write(`${JSON.stringify({ event: 'ready_to_kill', checkpointId: checkpoint.id, actionId })}\n`);
setInterval(() => undefined, 60_000);
