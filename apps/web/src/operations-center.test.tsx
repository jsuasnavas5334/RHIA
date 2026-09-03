import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { canDecideApproval, filterJobs, jobControls, OperationsCenter, type OperationsApproval, type OperationsJob } from './operations-center.tsx';

const jobs: readonly OperationsJob[] = [
  { id: 'job-1', jobType: 'RESOLVE_ENTITY', status: 'FAILED', agentLabel: 'Agente Comercial', updatedAt: '2026-08-21T20:00:00.000Z', retryCount: 1, traceSummary: 'Falló al consultar una fuente; no se ejecutó outreach.' },
  { id: 'job-2', jobType: 'DISCOVER_HR', status: 'RUNNING', agentLabel: 'Agente Contactos', updatedAt: '2026-08-21T20:05:00.000Z', retryCount: 0, traceSummary: 'Validando candidatos con evidencia pública.' },
];
const approvals: readonly OperationsApproval[] = [
  { id: 'approval-1', action: 'GRANT_DISCOUNT', status: 'PENDING', summary: 'Descuento propuesto del 8%', reasonCode: 'RHIA_APPROVAL_DISCOUNT', requestedByLabel: 'Agente Comercial', requestedAt: '2026-08-21T20:10:00.000Z', targetLabel: 'Oportunidad Andina' },
];

test('filtros combinan estado y agente sin exponer identificadores', () => {
  assert.deepEqual(filterJobs(jobs, { status: 'FAILED' }).map((job) => job.id), ['job-1']);
  assert.equal(filterJobs(jobs, { agent: 'Agente Contactos' }).length, 1);
  const html = renderToStaticMarkup(<OperationsCenter approvals={approvals} filters={{ status: 'FAILED' }} focus="jobs" jobs={jobs} roles={['MANAGER']} />);
  assert.match(html, /Falló al consultar una fuente/);
  assert.doesNotMatch(html, /job-1/);
  assert.doesNotMatch(html, /Validando candidatos/);
});

test('retry, cancel y decisiones solo aparecen para roles y estados autorizados', () => {
  assert.deepEqual(jobControls(['MANAGER'], 'FAILED'), { retry: true, cancel: false });
  assert.deepEqual(jobControls(['VIEWER'], 'FAILED'), { retry: false, cancel: false });
  assert.deepEqual(jobControls(['OPERATOR'], 'PENDING'), { retry: false, cancel: true });
  assert.equal(canDecideApproval(['MANAGER']), true);
  assert.equal(canDecideApproval(['OPERATOR']), false);
});

test('manager ve el motivo y contexto antes de decidir una approval', () => {
  const html = renderToStaticMarkup(<OperationsCenter approvals={approvals} focus="approvals" jobs={jobs} roles={['MANAGER']} />);
  assert.match(html, /Por qué requiere aprobación/);
  assert.match(html, /discount/);
  assert.match(html, /Oportunidad Andina/);
  assert.match(html, /Motivo de la decisión/);
  assert.match(html, /Conexión segura con Core pendiente/);
});

test('sesión conectada habilita formularios gobernados sin convertir roles en autoridad', () => {
  const action = async (_formData: FormData): Promise<void> => undefined;
  const jobHtml = renderToStaticMarkup(<OperationsCenter approvals={approvals} connected focus="jobs" jobAction={action} jobs={jobs} roles={['MANAGER']} />);
  assert.match(jobHtml, /name="jobId" value="job-1"/);
  assert.match(jobHtml, /Core validará sesión, tenant y permiso/);
  assert.doesNotMatch(jobHtml, /disabled="" type="submit" value="retry"/);

  const approvalHtml = renderToStaticMarkup(<OperationsCenter approvalAction={action} approvals={approvals} connected focus="approvals" jobs={jobs} roles={['MANAGER']} />);
  assert.match(approvalHtml, /name="approvalId" value="approval-1"/);
  assert.match(approvalHtml, /Core aplicará separación de funciones/);
  assert.doesNotMatch(approvalHtml, /disabled="" type="submit" value="APPROVED"/);
});
