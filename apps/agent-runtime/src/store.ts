import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const TERMINAL = new Set(['SUCCEEDED', 'PARTIAL']);

type Row = Record<string, unknown>;
const text = (row: Row, key: string): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new AgentRuntimeStoreError('INVALID_DATABASE_STATE', `Falta ${key} en PostgreSQL.`);
  return value;
};
const integer = (row: Row, key: string): number => {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new AgentRuntimeStoreError('INVALID_DATABASE_STATE', `Falta ${key} en PostgreSQL.`);
  return value;
};
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);

export class AgentRuntimeStoreError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'LEASE_LOST' | 'INVALID_DATABASE_STATE', message: string) {
    super(message);
    this.name = 'AgentRuntimeStoreError';
  }
}

export type ClaimedJob = Readonly<{
  id: string;
  organizationId: string;
  executionId: string;
  attempt: number;
  jobType: string;
  input: Readonly<Record<string, unknown>>;
  retryCount: number;
  leaseToken: string;
  leaseOwner: string;
  leaseExpiresAt: string;
}>;

export type StepCheckpoint = Readonly<{
  id: string;
  jobId: string;
  executionId: string;
  stepKey: string;
  status: 'STARTED' | 'SUCCEEDED' | 'FAILED';
  inputHash: string;
  actionId?: string | undefined;
  outputSummary?: Readonly<Record<string, unknown>> | undefined;
}>;

export const checkpointInputHash = (input: unknown): string => createHash('sha256').update(JSON.stringify(input)).digest('hex');

export class PostgresAgentRuntimeStore {
  constructor(
    private readonly pool: Pool,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID,
  ) {}

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* conserva el error original */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async claim(organizationId: string, workerId: string, leaseMs = 30_000): Promise<ClaimedJob | undefined> {
    if (!UUID.test(organizationId) || !KEY.test(workerId) || !Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) {
      throw new AgentRuntimeStoreError('INVALID_INPUT', 'Claim requiere tenant, worker y lease válidos.');
    }
    const now = this.now();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    return this.transaction(async (client) => {
      await client.query(`WITH exhausted AS (
          SELECT id FROM rhia.job
          WHERE organization_id=$1 AND status='RUNNING' AND lease_expires_at <= $2 AND retry_count >= 3
          FOR UPDATE SKIP LOCKED
        ), closed_executions AS (
          UPDATE rhia.execution execution SET ended_at=$2, outcome='FAILED', error_code='RHIA_JOB_RETRY_EXHAUSTED'
          FROM exhausted WHERE execution.job_id=exhausted.id AND execution.ended_at IS NULL
        ) UPDATE rhia.job job SET status='DEAD_LETTER', completed_at=$2, updated_at=$2,
          lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL
        FROM exhausted WHERE job.id=exhausted.id`, [organizationId, now]);

      const candidate = await client.query<Row>(`SELECT * FROM rhia.job
        WHERE organization_id=$1 AND (
          status IN ('PENDING','QUEUED')
          OR (status='RETRY_SCHEDULED' AND (next_attempt_at IS NULL OR next_attempt_at <= $2))
          OR (status='RUNNING' AND lease_expires_at <= $2 AND retry_count < 3)
        )
        ORDER BY priority DESC, created_at, id
        FOR UPDATE SKIP LOCKED LIMIT 1`, [organizationId, now]);
      const row = candidate.rows[0];
      if (!row) return undefined;
      const jobId = text(row, 'id');
      const recovering = row['status'] === 'RUNNING';
      if (recovering) {
        await client.query(`UPDATE rhia.execution SET ended_at=$2, outcome='FAILED', error_code='RHIA_WORKFLOW_TIMEOUT'
          WHERE job_id=$1 AND ended_at IS NULL`, [jobId, now]);
      }
      const attemptResult = await client.query<{ attempt: number }>(
        'SELECT COALESCE(MAX(attempt), 0)::int + 1 AS attempt FROM rhia.execution WHERE job_id=$1', [jobId],
      );
      const attempt = attemptResult.rows[0]?.attempt;
      if (!attempt) throw new AgentRuntimeStoreError('INVALID_DATABASE_STATE', 'No se pudo calcular el intento.');
      const executionId = this.newId();
      const leaseToken = this.newId();
      await client.query(`INSERT INTO rhia.execution (id, job_id, attempt, executor_type, started_at, trace_id)
        VALUES ($1,$2,$3,'WORKER_SERVICE',$4,$5)`, [executionId, jobId, attempt, now, leaseToken]);
      const claimed = await client.query<Row>(`UPDATE rhia.job SET status='RUNNING',
          retry_count=retry_count + $3, lease_token=$4, lease_owner=$5, lease_expires_at=$6,
          current_step=NULL, next_attempt_at=NULL, updated_at=$2, completed_at=NULL
        WHERE id=$1 RETURNING *`, [jobId, now, recovering ? 1 : 0, leaseToken, workerId, leaseExpiresAt]);
      const claimedRow = claimed.rows[0];
      if (!claimedRow) throw new AgentRuntimeStoreError('INVALID_DATABASE_STATE', 'El job desapareció durante el claim.');
      const input = claimedRow['input'];
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentRuntimeStoreError('INVALID_DATABASE_STATE', 'El input del job no es un objeto.');
      return {
        id: jobId, organizationId, executionId, attempt, jobType: text(claimedRow, 'job_type'),
        input: input as Record<string, unknown>, retryCount: integer(claimedRow, 'retry_count'),
        leaseToken, leaseOwner: workerId, leaseExpiresAt: leaseExpiresAt.toISOString(),
      };
    });
  }

  async renewLease(claim: ClaimedJob, leaseMs = 30_000): Promise<ClaimedJob> {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) {
      throw new AgentRuntimeStoreError('INVALID_INPUT', 'Heartbeat requiere un lease válido.');
    }
    const now = this.now();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const result = await this.pool.query(`UPDATE rhia.job SET lease_expires_at=$5, updated_at=$4
      WHERE id=$1 AND organization_id=$2 AND lease_token=$3 AND status='RUNNING' AND lease_expires_at > $4`,
    [claim.id, claim.organizationId, claim.leaseToken, now, leaseExpiresAt]);
    if (result.rowCount !== 1) throw new AgentRuntimeStoreError('LEASE_LOST', 'El lease expiró o cambió de owner.');
    return { ...claim, leaseExpiresAt: leaseExpiresAt.toISOString() };
  }

  async beginStep(claim: ClaimedJob, stepKey: string, inputHash: string): Promise<StepCheckpoint> {
    if (!KEY.test(stepKey) || !/^[0-9a-f]{64}$/.test(inputHash)) {
      throw new AgentRuntimeStoreError('INVALID_INPUT', 'Step key o input hash inválido.');
    }
    return this.transaction(async (client) => {
      await this.assertLease(client, claim);
      const existing = await client.query<Row>(
        'SELECT * FROM rhia.job_step_checkpoint WHERE organization_id=$1 AND job_id=$2 AND step_key=$3 FOR UPDATE',
        [claim.organizationId, claim.id, stepKey],
      );
      const prior = existing.rows[0];
      if (prior && text(prior, 'input_hash') !== inputHash) {
        throw new AgentRuntimeStoreError('INVALID_INPUT', 'El step key ya pertenece a otro input.');
      }
      if (prior?.['status'] === 'SUCCEEDED') return this.mapCheckpoint(prior);
      const checkpointId = prior ? text(prior, 'id') : this.newId();
      const now = this.now();
      const saved = prior
        ? await client.query<Row>(`UPDATE rhia.job_step_checkpoint SET execution_id=$2, status='STARTED', attempt=$3,
            lease_token=$4, output_summary=NULL, error_code=NULL, started_at=$5, completed_at=NULL, updated_at=$5
          WHERE id=$1 RETURNING *`, [checkpointId, claim.executionId, claim.attempt, claim.leaseToken, now])
        : await client.query<Row>(`INSERT INTO rhia.job_step_checkpoint
            (id, organization_id, job_id, execution_id, step_key, status, attempt, lease_token, input_hash, started_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,'STARTED',$6,$7,$8,$9,$9) RETURNING *`,
        [checkpointId, claim.organizationId, claim.id, claim.executionId, stepKey, claim.attempt, claim.leaseToken, inputHash, now]);
      await client.query('UPDATE rhia.job SET current_step=$3, updated_at=$4 WHERE id=$1 AND lease_token=$2',
        [claim.id, claim.leaseToken, stepKey, now]);
      return this.mapCheckpoint(saved.rows[0]!);
    });
  }

  async reserveAction(claim: ClaimedJob, checkpointId: string, action: Readonly<{
    capabilityKey: string;
    resourceType: string;
    requestPayload: Readonly<Record<string, unknown>>;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>): Promise<string> {
    if (!UUID.test(checkpointId) || !KEY.test(action.capabilityKey) || !KEY.test(action.resourceType)) {
      throw new AgentRuntimeStoreError('INVALID_INPUT', 'Reserva de action inválida.');
    }
    return this.transaction(async (client) => {
      await this.assertLease(client, claim);
      const checkpoint = await client.query<Row>(`SELECT * FROM rhia.job_step_checkpoint
        WHERE id=$1 AND job_id=$2 AND lease_token=$3 AND status='STARTED' FOR UPDATE`,
      [checkpointId, claim.id, claim.leaseToken]);
      const row = checkpoint.rows[0];
      if (!row) throw new AgentRuntimeStoreError('LEASE_LOST', 'El checkpoint ya no pertenece al lease activo.');
      const existingActionId = row['action_id'];
      if (typeof existingActionId === 'string') {
        await client.query(`UPDATE rhia.action SET status='PENDING', updated_at=$2 WHERE id=$1`, [existingActionId, this.now()]);
        return existingActionId;
      }
      const actionId = this.newId();
      const now = this.now();
      await client.query(`INSERT INTO rhia.action
          (id, execution_id, capability_key, resource_type, request_payload, risk_level, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,'PENDING',$7,$7)`,
      [actionId, claim.executionId, action.capabilityKey, action.resourceType,
        JSON.stringify({ ...action.requestPayload, idempotencyKey: checkpointId }), action.riskLevel, now]);
      await client.query('UPDATE rhia.job_step_checkpoint SET action_id=$2, updated_at=$3 WHERE id=$1',
        [checkpointId, actionId, now]);
      return actionId;
    });
  }

  async completeStep(claim: ClaimedJob, checkpointId: string, outputSummary: Readonly<Record<string, unknown>>): Promise<void> {
    if (!UUID.test(checkpointId)) throw new AgentRuntimeStoreError('INVALID_INPUT', 'Checkpoint inválido.');
    await this.transaction(async (client) => {
      await this.assertLease(client, claim);
      const result = await client.query(`UPDATE rhia.job_step_checkpoint SET status='SUCCEEDED', output_summary=$4::jsonb,
          completed_at=$5, updated_at=$5, error_code=NULL
        WHERE id=$1 AND job_id=$2 AND lease_token=$3 AND status='STARTED'`,
      [checkpointId, claim.id, claim.leaseToken, JSON.stringify(outputSummary), this.now()]);
      if (result.rowCount !== 1) throw new AgentRuntimeStoreError('LEASE_LOST', 'El checkpoint ya no pertenece al lease activo.');
      await client.query(`UPDATE rhia.action SET status='SUCCEEDED', response_summary=$2::jsonb, updated_at=$3
        WHERE id=(SELECT action_id FROM rhia.job_step_checkpoint WHERE id=$1)`,
      [checkpointId, JSON.stringify(outputSummary), this.now()]);
    });
  }

  async finish(claim: ClaimedJob, status: 'SUCCEEDED' | 'PARTIAL'): Promise<void> {
    if (!TERMINAL.has(status)) throw new AgentRuntimeStoreError('INVALID_INPUT', 'Estado final inválido.');
    const now = this.now();
    await this.transaction(async (client) => {
      const result = await client.query(`UPDATE rhia.job SET status=$3, completed_at=$4, updated_at=$4,
          lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL, current_step=NULL
        WHERE id=$1 AND organization_id=$2 AND lease_token=$5 AND status='RUNNING'`,
      [claim.id, claim.organizationId, status, now, claim.leaseToken]);
      if (result.rowCount !== 1) throw new AgentRuntimeStoreError('LEASE_LOST', 'El job ya no pertenece al lease activo.');
      await client.query(`UPDATE rhia.execution SET ended_at=$2, outcome=$3
        WHERE id=$1 AND ended_at IS NULL`, [claim.executionId, now, status]);
    });
  }

  async fail(claim: ClaimedJob, errorCode: string, backoffMs: number): Promise<'RETRY_SCHEDULED' | 'DEAD_LETTER'> {
    if (!/^RHIA_[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(errorCode) || !Number.isSafeInteger(backoffMs) || backoffMs < 0 || backoffMs > 86_400_000) {
      throw new AgentRuntimeStoreError('INVALID_INPUT', 'Error o backoff inválido.');
    }
    const now = this.now();
    const exhausted = claim.retryCount >= 3;
    const status = exhausted ? 'DEAD_LETTER' : 'RETRY_SCHEDULED';
    const nextAttemptAt = exhausted ? null : new Date(now.getTime() + backoffMs);
    return this.transaction(async (client) => {
      const result = await client.query(`UPDATE rhia.job SET status=$4, retry_count=retry_count + $5,
          next_attempt_at=$6, completed_at=$7, updated_at=$3,
          lease_token=NULL, lease_owner=NULL, lease_expires_at=NULL, current_step=NULL
        WHERE id=$1 AND organization_id=$2 AND lease_token=$8 AND status='RUNNING'`,
      [claim.id, claim.organizationId, now, status, exhausted ? 0 : 1, nextAttemptAt, exhausted ? now : null, claim.leaseToken]);
      if (result.rowCount !== 1) throw new AgentRuntimeStoreError('LEASE_LOST', 'El job ya no pertenece al lease activo.');
      await client.query(`WITH failed AS (
          UPDATE rhia.job_step_checkpoint SET status='FAILED', error_code=$3, completed_at=$2, updated_at=$2
          WHERE job_id=$1 AND lease_token=$4 AND status='STARTED' RETURNING action_id
        ) UPDATE rhia.action SET status='FAILED', updated_at=$2
        WHERE id IN (SELECT action_id FROM failed WHERE action_id IS NOT NULL)`,
      [claim.id, now, errorCode, claim.leaseToken]);
      await client.query(`UPDATE rhia.execution SET ended_at=$2, outcome='FAILED', error_code=$3
        WHERE id=$1 AND ended_at IS NULL`, [claim.executionId, now, errorCode]);
      return status;
    });
  }

  private async assertLease(client: PoolClient, claim: ClaimedJob): Promise<void> {
    const result = await client.query(`SELECT 1 FROM rhia.job
      WHERE id=$1 AND organization_id=$2 AND lease_token=$3 AND status='RUNNING' AND lease_expires_at > $4
      FOR UPDATE`, [claim.id, claim.organizationId, claim.leaseToken, this.now()]);
    if (result.rowCount !== 1) throw new AgentRuntimeStoreError('LEASE_LOST', 'El lease expiró o cambió de owner.');
  }

  private mapCheckpoint(row: Row): StepCheckpoint {
    const output = row['output_summary'];
    return {
      id: text(row, 'id'), jobId: text(row, 'job_id'), executionId: text(row, 'execution_id'),
      stepKey: text(row, 'step_key'), status: text(row, 'status') as StepCheckpoint['status'],
      inputHash: text(row, 'input_hash'),
      ...(typeof row['action_id'] === 'string' ? { actionId: row['action_id'] } : {}),
      ...(output && typeof output === 'object' && !Array.isArray(output) ? { outputSummary: output as Record<string, unknown> } : {}),
    };
  }
}
