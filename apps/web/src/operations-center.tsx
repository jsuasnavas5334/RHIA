import type { HumanRole } from '@rhia/policy';
import { rolePermissions } from '@rhia/policy';

export type OperationsJob = Readonly<{
  id: string;
  jobType: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'RETRY_SCHEDULED' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'DEAD_LETTER';
  agentLabel: string;
  updatedAt: string;
  retryCount: number;
  traceSummary: string;
}>;

export type OperationsApproval = Readonly<{
  id: string;
  action: 'CHANGE_PRICE' | 'GRANT_DISCOUNT' | 'CHANGE_COMMERCIAL_TERMS' | 'BINDING_COMMITMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  summary: string;
  reasonCode: string;
  requestedByLabel: string;
  requestedAt: string;
  targetLabel: string;
}>;

export type JobFilters = Readonly<{ status?: string | undefined; agent?: string | undefined }>;

export const filterJobs = (jobs: readonly OperationsJob[], filters: JobFilters): readonly OperationsJob[] => jobs.filter((job) =>
  (!filters.status || filters.status === 'ALL' || job.status === filters.status)
  && (!filters.agent || filters.agent === 'ALL' || job.agentLabel === filters.agent));

const permissionsFor = (roles: readonly HumanRole[]) => new Set(roles.flatMap((role) => rolePermissions[role]));

export const jobControls = (roles: readonly HumanRole[], status: OperationsJob['status']) => {
  const canExecute = permissionsFor(roles).has('jobs.execute');
  return {
    retry: canExecute && (status === 'FAILED' || status === 'PARTIAL'),
    cancel: canExecute && (status === 'PENDING' || status === 'QUEUED' || status === 'RETRY_SCHEDULED'),
  } as const;
};

export const canDecideApproval = (roles: readonly HumanRole[]): boolean => permissionsFor(roles).has('approvals.decide');

const statusLabel: Readonly<Record<OperationsJob['status'], string>> = {
  PENDING: 'Pendiente', QUEUED: 'En cola', RUNNING: 'En ejecución', RETRY_SCHEDULED: 'Reintento programado',
  SUCCEEDED: 'Completado', PARTIAL: 'Parcial', FAILED: 'Falló', CANCELLED: 'Cancelado', DEAD_LETTER: 'Agotado',
};

const actionLabel: Readonly<Record<OperationsApproval['action'], string>> = {
  CHANGE_PRICE: 'Cambio de precio', GRANT_DISCOUNT: 'Descuento',
  CHANGE_COMMERCIAL_TERMS: 'Cambio de condiciones', BINDING_COMMITMENT: 'Compromiso comercial',
};

const displayTime = (value: string) => new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil',
}).format(new Date(value));

type ServerFormAction = (formData: FormData) => void | Promise<void>;

const JobList = ({ jobs, roles, connected, action }: Readonly<{ jobs: readonly OperationsJob[]; roles: readonly HumanRole[]; connected: boolean; action: ServerFormAction | undefined }>) => (
  <div className="operations-list" aria-live="polite">
    {jobs.length === 0 ? <div className="operations-empty"><strong>No hay ejecuciones con estos filtros.</strong><span>Prueba otro estado o agente.</span></div> : jobs.map((job, index) => {
      const controls = jobControls(roles, job.status);
      return (
        <article className="operation-card" key={`${job.updatedAt}-${index}`}>
          <header><div><span className={`status-chip status-${job.status.toLowerCase()}`}>{statusLabel[job.status]}</span><h3>{job.jobType.replaceAll('_', ' ')}</h3></div><time dateTime={job.updatedAt}>{displayTime(job.updatedAt)}</time></header>
          <dl className="operation-facts"><div><dt>Agente</dt><dd>{job.agentLabel}</dd></div><div><dt>Intentos</dt><dd>{job.retryCount + 1}</dd></div></dl>
          <p className="trace-summary">{job.traceSummary}</p>
          {(controls.retry || controls.cancel) ? <form action={connected ? action : undefined} className="operation-actions" aria-label="Acciones disponibles">
            {connected ? <input name="jobId" type="hidden" value={job.id} /> : null}
            {controls.retry ? <button disabled={!connected} name="command" type="submit" value="retry">Reintentar</button> : null}
            {controls.cancel ? <button className="danger-action" disabled={!connected} name="command" type="submit" value="cancel">Cancelar</button> : null}
            <small>{connected ? 'Core validará sesión, tenant y permiso' : 'Conexión segura con Core pendiente · vista previa sin acciones'}</small>
          </form> : null}
        </article>
      );
    })}
  </div>
);

const ApprovalInbox = ({ approvals, roles, connected, action }: Readonly<{ approvals: readonly OperationsApproval[]; roles: readonly HumanRole[]; connected: boolean; action: ServerFormAction | undefined }>) => {
  const canDecide = canDecideApproval(roles);
  return (
    <div className="approval-inbox">
      {approvals.length === 0 ? <div className="operations-empty"><strong>No hay decisiones pendientes.</strong><span>Las nuevas solicitudes aparecerán aquí con su contexto.</span></div> : approvals.map((approval, index) => (
        <article className="approval-card" key={`${approval.requestedAt}-${index}`}>
          <header><div><span className="eyebrow">{actionLabel[approval.action]}</span><h3>{approval.summary}</h3></div><span className="status-chip status-pending">Pendiente</span></header>
          <dl className="approval-context">
            <div><dt>Por qué requiere aprobación</dt><dd>{approval.reasonCode.replace('RHIA_APPROVAL_', '').replaceAll('_', ' ').toLowerCase()}</dd></div>
            <div><dt>Objetivo</dt><dd>{approval.targetLabel}</dd></div>
            <div><dt>Solicitado por</dt><dd>{approval.requestedByLabel} · {displayTime(approval.requestedAt)}</dd></div>
          </dl>
          <form action={connected ? action : undefined} className="decision-form">{connected ? <input name="approvalId" type="hidden" value={approval.id} /> : null}<label htmlFor={`approval-reason-${index}`}>Motivo de la decisión</label><textarea disabled={!canDecide || !connected} id={`approval-reason-${index}`} maxLength={1000} name="reason" placeholder="Explica brevemente la decisión" required rows={3} /><div><button disabled={!canDecide || !connected} name="decision" type="submit" value="APPROVED">Aprobar</button><button className="danger-action" disabled={!canDecide || !connected} name="decision" type="submit" value="REJECTED">Rechazar</button><small>{!canDecide ? 'Tu rol no permite decidir' : connected ? 'Core aplicará separación de funciones' : 'Conexión segura con Core pendiente · vista previa sin acciones'}</small></div></form>
        </article>
      ))}
    </div>
  );
};

export const OperationsCenter = ({
  focus, jobs, approvals, roles, filters = {}, connected = false, jobAction, approvalAction, notice,
}: Readonly<{
  focus: 'jobs' | 'approvals';
  jobs: readonly OperationsJob[];
  approvals: readonly OperationsApproval[];
  roles: readonly HumanRole[];
  filters?: JobFilters;
  connected?: boolean;
  jobAction?: ServerFormAction;
  approvalAction?: ServerFormAction;
  notice?: string | undefined;
}>) => {
  const filteredJobs = filterJobs(jobs, filters);
  const agents = [...new Set(jobs.map((job) => job.agentLabel))];
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">Operations Center</span><h1>{focus === 'jobs' ? 'Jobs' : 'Approvals'}</h1><p>{focus === 'jobs' ? 'Supervisa cada ejecución y actúa sin perder trazabilidad.' : 'Decide acciones sensibles con contexto y separación de funciones.'}</p></div><span className="environment-badge">Control gobernado</span></div>
      {notice ? <p className="operations-notice" role="status">{notice}</p> : null}
      <div className="operations-tabs" aria-label="Vistas de Operations Center"><a aria-current={focus === 'jobs' ? 'page' : undefined} href="/jobs">Ejecuciones</a><a aria-current={focus === 'approvals' ? 'page' : undefined} href="/approvals">Aprobaciones <span>{approvals.length}</span></a></div>
      {focus === 'jobs' ? <>
        <form className="filter-bar" method="get"><label>Estado<select defaultValue={filters.status ?? 'ALL'} name="status"><option value="ALL">Todos</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Agente<select defaultValue={filters.agent ?? 'ALL'} name="agent"><option value="ALL">Todos</option>{agents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}</select></label><button type="submit">Aplicar filtros</button></form>
        <JobList action={jobAction} connected={connected} jobs={filteredJobs} roles={roles} />
      </> : <ApprovalInbox action={approvalAction} approvals={approvals.filter((approval) => approval.status === 'PENDING')} connected={connected} roles={roles} />}
    </>
  );
};
