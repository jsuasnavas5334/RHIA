import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { CoreApi } from './api.js';
import { CompanyGroupService } from './company-service.js';
import { ApprovalService, JobService } from './control-services.js';
import { createPostgresCoreDependencies } from './postgres-adapters.js';
import { ContactService, OpportunityService } from './record-services.js';
import { SearchHealthService } from './search-health-service.js';

export type CoreRuntimeUtilities = Readonly<{
  newId: () => string;
  now: () => Date;
}>;

export const createPostgresCoreRuntime = (
  pool: Pool,
  utilities: CoreRuntimeUtilities = { newId: randomUUID, now: () => new Date() },
) => {
  const dependencies = createPostgresCoreDependencies(pool, utilities);
  const companies = new CompanyGroupService(dependencies);
  const contacts = new ContactService(dependencies);
  const opportunities = new OpportunityService(dependencies);
  const jobs = new JobService(dependencies);
  const approvals = new ApprovalService(dependencies);
  const searchHealth = new SearchHealthService(dependencies);
  const api = new CoreApi(companies, contacts, opportunities, jobs, approvals, searchHealth);
  return { api, companies, contacts, opportunities, jobs, approvals, searchHealth } as const;
};
