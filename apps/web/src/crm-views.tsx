import { displayTime } from './operations-center.tsx';

export type CoreCompany = Readonly<{
  id: string;
  canonicalName: string;
  websiteRoot: string | null;
  globalIdentityStatus: 'UNRESOLVED' | 'RESOLVED' | 'AMBIGUOUS';
}>;

export type CoreContact = Readonly<{
  id: string;
  companyGroupId: string;
  fullName: string;
  title: string | null;
  countryCode: string | null;
  city: string | null;
  status: 'UNVERIFIED' | 'VERIFIED' | 'CONFLICTING';
}>;

export type CoreOpportunity = Readonly<{
  id: string;
  companyGroupId: string;
  marketCountry: string;
  marketCity: string | null;
  stage: 'DISCOVERED';
  score: number;
  status: 'OPEN';
}>;

export type TimelineEntry = Readonly<{
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
}>;

export type CompanyDetailData = Readonly<{
  company: CoreCompany;
  contacts: readonly CoreContact[];
  opportunities: readonly CoreOpportunity[];
  timeline: readonly TimelineEntry[];
}>;

export type LocationFilters = Readonly<{ country?: string | undefined; city?: string | undefined }>;

export const filterContacts = (contacts: readonly CoreContact[], filters: LocationFilters): readonly CoreContact[] =>
  contacts.filter((contact) =>
    (!filters.country || filters.country === 'ALL' || contact.countryCode === filters.country)
    && (!filters.city || filters.city === 'ALL' || contact.city === filters.city));

export const filterOpportunities = (opportunities: readonly CoreOpportunity[], filters: LocationFilters): readonly CoreOpportunity[] =>
  opportunities.filter((opportunity) =>
    (!filters.country || filters.country === 'ALL' || opportunity.marketCountry === filters.country)
    && (!filters.city || filters.city === 'ALL' || opportunity.marketCity === filters.city));

const companyStatusLabel: Readonly<Record<CoreCompany['globalIdentityStatus'], string>> = {
  UNRESOLVED: 'Sin resolver', RESOLVED: 'Resuelta', AMBIGUOUS: 'Ambigua',
};
const contactStatusLabel: Readonly<Record<CoreContact['status'], string>> = {
  UNVERIFIED: 'Sin verificar', VERIFIED: 'Verificado', CONFLICTING: 'En conflicto',
};
const timelineActionLabel: Readonly<Record<string, string>> = {
  COMPANY_GROUP_CREATED: 'Company creada', CONTACT_CREATED: 'Contact creado', OPPORTUNITY_CREATED: 'Opportunity creada',
  JOB_CREATED: 'Job iniciado', JOB_RETRY_SCHEDULED: 'Job reintentado', JOB_CANCELLED: 'Job cancelado',
  APPROVAL_REQUESTED: 'Approval solicitada', APPROVAL_DECIDED: 'Approval decidida',
};

export const CompanyDirectory = ({ companies }: Readonly<{ companies: readonly CoreCompany[] }>) => (
  <div className="operations-list" aria-live="polite">
    {companies.length === 0
      ? <div className="operations-empty"><strong>No hay companies todavía.</strong><span>Aparecerán aquí cuando el pipeline las registre.</span></div>
      : companies.map((company) => (
        <article className="operation-card" key={company.id}>
          <header>
            <div>
              <span className={`status-chip status-${company.globalIdentityStatus.toLowerCase()}`}>{companyStatusLabel[company.globalIdentityStatus]}</span>
              <h3>{company.canonicalName}</h3>
            </div>
          </header>
          {company.websiteRoot ? <dl className="operation-facts"><div><dt>Sitio</dt><dd>{company.websiteRoot}</dd></div></dl> : null}
          <a href={`/companies/${company.id}`}>Ver expediente regional →</a>
        </article>
      ))}
  </div>
);

export const ContactDirectory = ({
  contacts, filters = {},
}: Readonly<{ contacts: readonly CoreContact[]; filters?: LocationFilters }>) => {
  const filtered = filterContacts(contacts, filters);
  const countries = [...new Set(contacts.map((contact) => contact.countryCode).filter((value): value is string => Boolean(value)))].sort();
  return (
    <>
      <form className="filter-bar" method="get">
        <label>País
          <select defaultValue={filters.country ?? 'ALL'} name="country">
            <option value="ALL">Todos</option>
            {countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>
        <button type="submit">Aplicar filtros</button>
      </form>
      <div className="operations-list" aria-live="polite">
        {filtered.length === 0
          ? <div className="operations-empty"><strong>No hay contacts con estos filtros.</strong><span>Prueba otro país o ciudad.</span></div>
          : filtered.map((contact) => (
            <article className="operation-card" key={contact.id}>
              <header>
                <div>
                  <span className={`status-chip status-${contact.status.toLowerCase()}`}>{contactStatusLabel[contact.status]}</span>
                  <h3>{contact.fullName}</h3>
                </div>
              </header>
              <dl className="operation-facts">
                {contact.title ? <div><dt>Rol</dt><dd>{contact.title}</dd></div> : null}
                {(contact.countryCode || contact.city) ? <div><dt>Ubicación</dt><dd>{[contact.city, contact.countryCode].filter(Boolean).join(', ')}</dd></div> : null}
              </dl>
            </article>
          ))}
      </div>
    </>
  );
};

export const OpportunityBoard = ({
  opportunities, filters = {},
}: Readonly<{ opportunities: readonly CoreOpportunity[]; filters?: LocationFilters }>) => {
  const filtered = filterOpportunities(opportunities, filters);
  const countries = [...new Set(opportunities.map((opportunity) => opportunity.marketCountry))].sort();
  const stages: readonly CoreOpportunity['stage'][] = ['DISCOVERED'];
  return (
    <>
      <form className="filter-bar" method="get">
        <label>País
          <select defaultValue={filters.country ?? 'ALL'} name="country">
            <option value="ALL">Todos</option>
            {countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>
        <button type="submit">Aplicar filtros</button>
      </form>
      <div aria-label="Tablero de oportunidades por etapa" className="opportunity-board">
        {stages.map((stage) => {
          const inStage = filtered.filter((opportunity) => opportunity.stage === stage);
          return (
            <div className="opportunity-column" key={stage}>
              <h3>{stage} <span>{inStage.length}</span></h3>
              {inStage.length === 0
                ? <div className="operations-empty"><strong>Sin oportunidades en esta etapa.</strong></div>
                : inStage.map((opportunity) => (
                  <article className="operation-card" key={opportunity.id}>
                    <header><h4>{[opportunity.marketCity, opportunity.marketCountry].filter(Boolean).join(', ')}</h4></header>
                    <dl className="operation-facts"><div><dt>Score</dt><dd>{opportunity.score}</dd></div></dl>
                  </article>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
};

export const TimelineFeed = ({ timeline }: Readonly<{ timeline: readonly TimelineEntry[] }>) => (
  <ol aria-live="polite" className="timeline-list">
    {timeline.length === 0
      ? <li className="operations-empty"><strong>Sin actividad todavía.</strong></li>
      : timeline.map((event) => (
        <li key={event.id}>
          <time dateTime={event.occurredAt}>{displayTime(event.occurredAt)}</time>
          <span>{timelineActionLabel[event.action] ?? event.action}</span>
        </li>
      ))}
  </ol>
);

export const CompanyDetailView = ({ detail }: Readonly<{ detail: CompanyDetailData }>) => (
  <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">Company 360</span>
        <h1>{detail.company.canonicalName}</h1>
        {detail.company.websiteRoot ? <p>{detail.company.websiteRoot}</p> : null}
      </div>
      <span className={`status-chip status-${detail.company.globalIdentityStatus.toLowerCase()}`}>
        {companyStatusLabel[detail.company.globalIdentityStatus]}
      </span>
    </div>
    <section className="panel section-panel">
      <h2>Contacts ({detail.contacts.length})</h2>
      <ContactDirectory contacts={detail.contacts} />
    </section>
    <section className="panel section-panel">
      <h2>Opportunities ({detail.opportunities.length})</h2>
      <OpportunityBoard opportunities={detail.opportunities} />
    </section>
    <section className="panel section-panel">
      <h2>Timeline unificada</h2>
      <TimelineFeed timeline={detail.timeline} />
    </section>
  </>
);
