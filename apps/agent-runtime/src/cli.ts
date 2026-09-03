#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { AgentRuntime } from './runner.js';
import type { RuntimePlan } from './runner.js';
import { PostgresAgentRuntimeStore } from './store.js';
import { runAgentWorker } from './worker.js';

type PlanModule = Readonly<{ default?: unknown; plans?: unknown }>;

export async function main(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const databaseUrl = required(environment, 'RHIA_DATABASE_URL');
  const organizationId = required(environment, 'RHIA_ORGANIZATION_ID');
  const workerId = environment['RHIA_WORKER_ID']?.trim() || `worker-${process.pid}`;
  const planModulePath = required(environment, 'RHIA_AGENT_PLAN_MODULE');
  const leaseMs = optionalInteger(environment, 'RHIA_AGENT_LEASE_MS', 30_000);
  const idlePollMs = optionalInteger(environment, 'RHIA_AGENT_IDLE_POLL_MS', 1_000);
  const plans = await loadPlans(planModulePath);
  const pool = new Pool({ connectionString: databaseUrl, options: '-c search_path=rhia,public' });
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    const runtime = new AgentRuntime(new PostgresAgentRuntimeStore(pool), plans, { leaseMs });
    const summary = await runAgentWorker(runtime, { organizationId, workerId, idlePollMs }, controller.signal);
    process.stdout.write(`${JSON.stringify({ event: 'worker_stopped', workerId, ...summary })}\n`);
  } finally {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
    await pool.end();
  }
}

const required = (environment: NodeJS.ProcessEnv, key: string): string => {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`Falta variable requerida ${key}.`);
  return value;
};

const optionalInteger = (environment: NodeJS.ProcessEnv, key: string, fallback: number): number => {
  const raw = environment[key];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${key} debe ser entero.`);
  return value;
};

const loadPlans = async (modulePath: string): Promise<readonly RuntimePlan[]> => {
  const imported = await import(pathToFileURL(resolve(modulePath)).href) as PlanModule;
  const value = imported.plans ?? imported.default;
  if (!Array.isArray(value) || value.length === 0) throw new Error('El módulo debe exportar plans no vacío.');
  return value as readonly RuntimePlan[];
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Error no identificado.';
    process.stderr.write(`${JSON.stringify({ event: 'worker_failed', message })}\n`);
    process.exitCode = 1;
  });
}
