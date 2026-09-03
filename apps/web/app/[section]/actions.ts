'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { CoreClientError, RhiaCoreClient } from '../../src/core-client.ts';
import { rhiaSessionCookieHeader } from '../auth-cookie.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const coreClient = () => {
  const origin = process.env['RHIA_CORE_API_URL'];
  if (!origin) throw new CoreClientError(503, 'Core no está configurado.');
  return new RhiaCoreClient(origin);
};

const resultFor = (error: unknown): string => {
  if (error instanceof CoreClientError) {
    if (error.status === 401) return 'session-required';
    if (error.status === 403) return 'not-authorized';
    if (error.status === 404) return 'not-found';
    if (error.status === 409) return 'state-conflict';
  }
  return 'operation-failed';
};

export async function jobCommandAction(formData: FormData): Promise<void> {
  const jobId = formData.get('jobId');
  const command = formData.get('command');
  const reason = formData.get('reason');
  let result = 'operation-complete';
  try {
    if (typeof jobId !== 'string' || !UUID.test(jobId) || (command !== 'retry' && command !== 'cancel')
      || (typeof reason === 'string' && reason.length > 1000)) throw new CoreClientError(400, 'Solicitud inválida.');
    await coreClient().commandJob(await rhiaSessionCookieHeader(), jobId, command, typeof reason === 'string' ? reason.trim() : undefined);
  } catch (error) {
    result = resultFor(error);
  }
  redirect(`/jobs?result=${result}`);
}

export async function approvalDecisionAction(formData: FormData): Promise<void> {
  const approvalId = formData.get('approvalId');
  const decision = formData.get('decision');
  const reason = formData.get('reason');
  let result = 'operation-complete';
  try {
    if (typeof approvalId !== 'string' || !UUID.test(approvalId)
      || (decision !== 'APPROVED' && decision !== 'REJECTED')
      || typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 1000) {
      throw new CoreClientError(400, 'Solicitud inválida.');
    }
    await coreClient().decideApproval(await rhiaSessionCookieHeader(), approvalId, decision, reason);
  } catch (error) {
    result = resultFor(error);
  }
  redirect(`/approvals?result=${result}`);
}
