import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CompanyDetailView, CompanyDirectory, ContactDirectory, filterContacts, filterOpportunities, OpportunityBoard,
  type CoreCompany, type CoreContact, type CoreOpportunity, type TimelineEntry,
} from './crm-views.tsx';

const contacts: readonly CoreContact[] = [
  { id: 'contact-ec', companyGroupId: 'company-1', fullName: 'Ana Torres', title: 'Gerente RRHH', countryCode: 'EC', city: 'Quito', status: 'VERIFIED' },
  { id: 'contact-co', companyGroupId: 'company-1', fullName: 'Luis Pardo', title: null, countryCode: 'CO', city: 'Bogotá', status: 'UNVERIFIED' },
];
const opportunities: readonly CoreOpportunity[] = [
  { id: 'opportunity-ec', companyGroupId: 'company-1', marketCountry: 'EC', marketCity: 'Quito', stage: 'DISCOVERED', score: 0, status: 'OPEN' },
  { id: 'opportunity-co', companyGroupId: 'company-1', marketCountry: 'CO', marketCity: 'Bogotá', stage: 'DISCOVERED', score: 0, status: 'OPEN' },
];
const companies: readonly CoreCompany[] = [
  { id: 'company-1', canonicalName: 'Empresa Andina', websiteRoot: 'https://andina.example.com', globalIdentityStatus: 'RESOLVED' },
];
const timeline: readonly TimelineEntry[] = [
  { id: 'event-1', action: 'COMPANY_GROUP_CREATED', resourceType: 'COMPANY_GROUP', resourceId: 'company-1', occurredAt: '2026-08-21T20:00:00.000Z' },
  { id: 'event-2', action: 'CONTACT_CREATED', resourceType: 'CONTACT', resourceId: 'contact-ec', occurredAt: '2026-08-21T20:05:00.000Z' },
];

test('filterContacts y filterOpportunities aplican país y ciudad sin mutar la lista original', () => {
  assert.deepEqual(filterContacts(contacts, { country: 'EC' }).map((contact) => contact.id), ['contact-ec']);
  assert.deepEqual(filterContacts(contacts, { country: 'ALL' }).map((contact) => contact.id), ['contact-ec', 'contact-co']);
  assert.deepEqual(filterContacts(contacts, {}).length, 2);
  assert.deepEqual(filterOpportunities(opportunities, { country: 'CO' }).map((opportunity) => opportunity.id), ['opportunity-co']);
  assert.deepEqual(filterOpportunities(opportunities, { city: 'Quito' }).map((opportunity) => opportunity.id), ['opportunity-ec']);
  assert.equal(contacts.length, 2);
});

test('CompanyDirectory enlaza al expediente regional (Company 360) sin exponer estado vacío falso', () => {
  const html = renderToStaticMarkup(<CompanyDirectory companies={companies} />);
  assert.match(html, /Empresa Andina/);
  assert.match(html, /href="\/companies\/company-1"/);
  assert.doesNotMatch(html, /No hay companies todavía/);
  const empty = renderToStaticMarkup(<CompanyDirectory companies={[]} />);
  assert.match(empty, /No hay companies todavía/);
});

test('ContactDirectory filtra por país (search/filter por país/ciudad, PH07-T001)', () => {
  const html = renderToStaticMarkup(<ContactDirectory contacts={contacts} filters={{ country: 'EC' }} />);
  assert.match(html, /Ana Torres/);
  assert.doesNotMatch(html, /Luis Pardo/);
});

test('OpportunityBoard agrupa por etapa y respeta el filtro de ciudad', () => {
  const html = renderToStaticMarkup(<OpportunityBoard filters={{ city: 'Bogotá' }} opportunities={opportunities} />);
  assert.match(html, /DISCOVERED/);
  assert.match(html, /Bogotá, CO/);
  assert.doesNotMatch(html, /Quito, EC/);
});

test('CompanyDetailView arma el timeline unificado (historial único) y no duplica secciones', () => {
  const html = renderToStaticMarkup(<CompanyDetailView detail={{ company: companies[0]!, contacts, opportunities, timeline }} />);
  assert.match(html, /Company 360/);
  assert.match(html, /Company creada/);
  assert.match(html, /Contact creado/);
  assert.match(html, /Contacts \(2\)/);
  assert.match(html, /Opportunities \(2\)/);
});
