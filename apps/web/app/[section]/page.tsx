import { notFound } from 'next/navigation';
import type { HumanRole } from '@rhia/policy';
import { PageStatePanel } from '../../src/app-shell.tsx';
import { OperationsCenter, type OperationsApproval, type OperationsJob } from '../../src/operations-center.tsx';
import { loadRhiaCoreSession } from '../core-session.ts';
import { approvalDecisionAction, jobCommandAction } from './actions.ts';

const sections = {
  agents: ['Agents', 'Supervisa agentes, capacidades y ejecución.'],
  companies: ['Companies', 'Organizaciones y cuentas del pipeline.'],
  contacts: ['Contacts', 'Personas, roles y señales comerciales.'],
  opportunities: ['Opportunities', 'Negocios activos y próximos pasos.'],
  meetings: ['Meetings', 'Agenda, preparación y resultados.'],
  jobs: ['Jobs', 'Ejecuciones asíncronas y su trazabilidad.'],
  approvals: ['Approvals', 'Decisiones humanas pendientes y resueltas.'],
  settings: ['Settings', 'Configuración segura del workspace.'],
} as const;

type SectionKey = keyof typeof sections;

const previewJobs: readonly OperationsJob[] = [
  { id: 'preview-job-failed', jobType: 'RESOLVE_ENTITY', status: 'FAILED', agentLabel: 'Agente Comercial', updatedAt: '2026-08-21T20:42:00.000Z', retryCount: 1, traceSummary: 'La fuente principal no respondió. No se enviaron mensajes ni se modificaron registros.' },
  { id: 'preview-job-running', jobType: 'DISCOVER_HR', status: 'RUNNING', agentLabel: 'Agente Contactos', updatedAt: '2026-08-21T20:47:00.000Z', retryCount: 0, traceSummary: 'Validando tres candidatos con evidencia pública y control de identidad.' },
  { id: 'preview-job-pending', jobType: 'RESEARCH_COMPANY', status: 'PENDING', agentLabel: 'Agente Research', updatedAt: '2026-08-21T20:50:00.000Z', retryCount: 0, traceSummary: 'En espera de capacidad; todavía no inició ningún paso externo.' },
];

const previewApprovals: readonly OperationsApproval[] = [
  { id: 'preview-approval-discount', action: 'GRANT_DISCOUNT', status: 'PENDING', summary: 'Descuento propuesto del 8% para avanzar la oportunidad', reasonCode: 'RHIA_APPROVAL_DISCOUNT', requestedByLabel: 'Agente Comercial', requestedAt: '2026-08-21T20:51:00.000Z', targetLabel: 'Oportunidad Empresa Andina' },
  { id: 'preview-approval-terms', action: 'CHANGE_COMMERCIAL_TERMS', status: 'PENDING', summary: 'Extender la vigencia de la propuesta a 45 días', reasonCode: 'RHIA_APPROVAL_COMMERCIAL_TERMS', requestedByLabel: 'Agente Comercial', requestedAt: '2026-08-21T20:53:00.000Z', targetLabel: 'Propuesta regional Ecuador' },
];

const resultNotices: Readonly<Record<string, string>> = {
  'operation-complete': 'Operación registrada correctamente. La vista ya refleja el estado más reciente.',
  'session-required': 'Tu sesión no está disponible o expiró. Inicia sesión antes de continuar.',
  'not-authorized': 'Tu sesión no tiene permiso para ejecutar esta operación.',
  'not-found': 'El recurso ya no existe o no pertenece a tu organización.',
  'state-conflict': 'El estado cambió y la operación ya no es válida. La lista fue actualizada.',
  'operation-failed': 'No fue posible completar la operación. Intenta nuevamente o revisa la bitácora.',
};

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export default async function SectionPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  if (section === 'jobs' || section === 'approvals') {
    const query = await searchParams;
    const status = Array.isArray(query['status']) ? query['status'][0] : query['status'];
    const agent = Array.isArray(query['agent']) ? query['agent'][0] : query['agent'];
    const result = Array.isArray(query['result']) ? query['result'][0] : query['result'];
    const configuredOrigin = process.env['RHIA_CORE_API_URL'];
    let jobs: readonly OperationsJob[] = [];
    let approvals: readonly OperationsApproval[] = [];
    let roles: readonly HumanRole[] = [];
    let connected = false;
    let notice = result ? resultNotices[result] : undefined;

    if (configuredOrigin) {
      try {
        const session = await loadRhiaCoreSession();
        const [currentJobs, currentApprovals] = await Promise.all([
          session.client.listJobs(session.cookieHeader), session.client.listApprovals(session.cookieHeader),
        ]);
        ({ roles } = session);
        jobs = currentJobs;
        approvals = currentApprovals;
        connected = true;
      } catch {
        notice = notice ?? 'No se pudo validar la sesión con Core. Las acciones permanecen cerradas.';
      }
    } else if (process.env.NODE_ENV === 'development') {
      roles = ['ADMIN'];
      jobs = previewJobs;
      approvals = previewApprovals;
      notice = notice ?? 'Vista previa local: los datos son demostrativos y ninguna acción será ejecutada.';
    } else {
      notice = notice ?? 'Core no está configurado. La consola permanece cerrada por seguridad.';
    }

    return <OperationsCenter
      approvals={approvals}
      connected={connected}
      filters={{ status, agent }}
      focus={section}
      jobs={jobs}
      roles={roles}
      {...(connected ? { approvalAction: approvalDecisionAction, jobAction: jobCommandAction } : {})}
      {...(notice ? { notice } : {})}
    />;
  }
  const [title, description] = sections[section as SectionKey];
  return <><div className="page-heading"><div><span className="eyebrow">Módulo operativo</span><h1>{title}</h1><p>{description}</p></div></div><section className="panel section-panel"><PageStatePanel state="EMPTY" /></section></>;
}
