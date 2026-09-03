import { PageStatePanel } from '../src/app-shell.tsx';

const metrics = [
  { label: 'Prospectos activos', value: '—', detail: 'Sin fuente conectada' },
  { label: 'Oportunidades', value: '—', detail: 'Sin fuente conectada' },
  { label: 'Reuniones', value: '—', detail: 'Sin fuente conectada' },
  { label: 'Aprobaciones', value: '—', detail: 'Sin fuente conectada' },
] as const;

export default function DashboardPage() {
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">Resumen operativo</span><h1>Dashboard</h1><p>Visibilidad central del flujo comercial y sus agentes.</p></div><span className="environment-badge">Entorno local</span></div>
      <section aria-label="Indicadores" className="metric-grid">
        {metrics.map((metric) => <article className="metric-card" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
      </section>
      <div className="dashboard-grid">
        <section className="panel"><header><div><span className="eyebrow">Actividad</span><h2>Pipeline comercial</h2></div><span className="quiet-badge">Próximamente</span></header><PageStatePanel state="EMPTY" /></section>
        <section className="panel"><header><div><span className="eyebrow">Agentes</span><h2>Estado de automatización</h2></div></header><PageStatePanel state="LOADING" /></section>
      </div>
    </>
  );
}
