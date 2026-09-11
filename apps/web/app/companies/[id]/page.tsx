import { notFound } from 'next/navigation';
import { PageStatePanel } from '../../../src/app-shell.tsx';
import { CompanyDetailView } from '../../../src/crm-views.tsx';
import { loadRhiaCoreSession } from '../../core-session.ts';
import { CoreClientError } from '../../../src/core-client.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CompanyDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const configuredOrigin = process.env['RHIA_CORE_API_URL'];
  if (!configuredOrigin) {
    return <><div className="page-heading"><div><span className="eyebrow">Company 360</span><h1>Expediente no disponible</h1></div></div>
      <section className="panel section-panel"><PageStatePanel state="ERROR" /></section></>;
  }

  try {
    const session = await loadRhiaCoreSession();
    const detail = await session.client.getCompany(session.cookieHeader, id);
    return <CompanyDetailView detail={detail} />;
  } catch (error) {
    if (error instanceof CoreClientError && error.status === 400) notFound();
    return <><div className="page-heading"><div><span className="eyebrow">Company 360</span><h1>Expediente no disponible</h1></div></div>
      <section className="panel section-panel"><PageStatePanel state="ERROR" /></section></>;
  }
}
