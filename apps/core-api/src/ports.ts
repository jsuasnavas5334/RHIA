import type { Principal } from '@rhia/policy';
import type { SearchHealthEventRecord } from '@rhia/search-health';
import type { ApprovalRecord, CompanyGroup, Contact, ContactPoint, JobRecord, Opportunity } from './contracts.js';

/** PH07-T001 (wiring Entity Resolver): registro interno de `company_entity`
 * -- una "entidad legal" de una company_group en un país (una multinacional
 * puede tener varias). Solo se crea cuando `CreateCompanyGroupSchema.location`
 * viene en el payload (ver contracts.ts); companies creadas sin señales de
 * ubicación no tienen ninguna fila aquí -- eso es intencional, no un bug: solo
 * pueden compararse contra el Entity Resolver las companies que ya aportaron
 * identidad real, y esto no rompe el flujo existente sin señales. */
export type CompanyEntityRecord = Readonly<{
  id: string;
  organizationId: string;
  companyGroupId: string;
  legalName: string;
  tradeName: string | null;
  countryCode: string;
  legalIdentifier: string | null;
  entityType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}>;

/** PH07-T001: registro interno de `company_location` -- la ubicación (país/
 * ciudad) de un `CompanyEntityRecord`. `isHeadquarters=true` para la primera
 * (y por ahora única) ubicación registrada al crear una company con señales
 * de identidad -- suficiente para el criterio "No duplica empresas por
 * ciudad"; agregar más ubicaciones por entidad queda fuera de alcance de
 * este ciclo (ver docs/progress/PH07-T001.md). */
export type CompanyLocationRecord = Readonly<{
  id: string;
  organizationId: string;
  companyEntityId: string;
  countryCode: string;
  administrativeArea: string | null;
  city: string;
  address: string | null;
  isHeadquarters: boolean;
  createdAt: string;
  updatedAt: string;
}>;

/** PH07-T003 (Contact Validation v1): registro interno de `contact_point`
 * (tabla YA EXISTENTE de PH03-T001, `packages/db/src/schema.ts` -- confirmado
 * con grep antes de tocar el esquema que ningun codigo la usaba todavia,
 * mismo patron que `company_entity`/`company_location` antes de PH07-T001).
 * `valueEncrypted` es el valor real (email/telefono) cifrado con AES-256-GCM
 * (ver contact-point-crypto.ts) -- NUNCA se expone en texto plano fuera de
 * `contact-point-service.ts` (criterio de aceptacion "PII protegida"). */
export type ContactPointRecord = Readonly<{
  id: string;
  organizationId: string;
  contactId: string;
  pointType: 'EMAIL' | 'PHONE' | 'WHATSAPP';
  valueEncrypted: Buffer;
  valueHash: string;
  validationStatus: 'UNVERIFIED' | 'INVALID' | 'VERIFIED';
  sourceId: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type AuditEvent = Readonly<{
  id: string;
  organizationId: string;
  actorId: string;
  actorType: Principal['kind'];
  action: 'COMPANY_GROUP_CREATED' | 'CONTACT_CREATED' | 'CONTACT_POINT_CREATED' | 'OPPORTUNITY_CREATED' | 'JOB_CREATED' | 'JOB_RETRY_SCHEDULED' | 'JOB_CANCELLED' | 'APPROVAL_REQUESTED' | 'APPROVAL_DECIDED';
  resourceType: 'COMPANY_GROUP' | 'CONTACT' | 'CONTACT_POINT' | 'OPPORTUNITY' | 'JOB' | 'APPROVAL';
  resourceId: string;
  afterHash: string;
  occurredAt: string;
  correlationId: string;
}>;

export interface CompanyGroupRepository {
  create(company: CompanyGroup): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly CompanyGroup[]>;
  findById(organizationId: string, companyGroupId: string): Promise<CompanyGroup | undefined>;
}

/** PH07-T001 (wiring Entity Resolver): puertos nuevos para `company_entity`/
 * `company_location` -- tablas ya existentes de PH03-T001 que hasta este
 * ciclo ningún código de `apps/core-api` leía ni escribía (confirmado con
 * grep antes de tocar esquema -- no se crea ninguna tabla nueva). */
export interface CompanyEntityRepository {
  create(entity: CompanyEntityRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly CompanyEntityRecord[]>;
}

export interface CompanyLocationRepository {
  create(location: CompanyLocationRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly CompanyLocationRecord[]>;
}

export interface ContactRepository {
  create(contact: Contact): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly Contact[]>;
}

/** PH07-T003: `findByHash` es la base del "Dedup hash" (accion 2 del
 * packet) -- un mismo valor normalizado para el mismo contacto y tipo de
 * punto nunca produce dos filas, sin importar si vino con una
 * idempotencyKey distinta (p. ej. dos hits de Contact Discovery
 * encontrando el mismo telefono) -- mismo principio que el dedupe por
 * `websiteRoot` de `CompanyGroupService.create`. */
export interface ContactPointRepository {
  create(point: ContactPointRecord): Promise<void>;
  listByContact(organizationId: string, contactId: string): Promise<readonly ContactPointRecord[]>;
  findByHash(organizationId: string, contactId: string, pointType: ContactPointRecord['pointType'], valueHash: string): Promise<ContactPointRecord | undefined>;
}

/** PH07-T003: fuente de la clave de cifrado AES-256-GCM para
 * `contact_point.value_encrypted`. Nunca hay una clave por defecto
 * hardcodeada en el repo (regla fija del proyecto: "secretos nuevos solo
 * con autorizacion explicita y siempre fuera del repositorio") -- ver
 * `EnvEncryptionKeyProvider` en contact-point-crypto.ts, que lee de una
 * variable de entorno y falla ruidosamente si falta o tiene el formato
 * incorrecto, en vez de generar una clave silenciosa. */
export interface EncryptionKeyProvider {
  getKey(): Buffer;
}

export interface OpportunityRepository {
  create(opportunity: Opportunity): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly Opportunity[]>;
}

export interface JobRepository {
  create(job: JobRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly JobRecord[]>;
  findById(organizationId: string, jobId: string): Promise<JobRecord | undefined>;
  update(job: JobRecord): Promise<void>;
}

export interface ApprovalRepository {
  create(approval: ApprovalRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly ApprovalRecord[]>;
  findById(organizationId: string, approvalId: string): Promise<ApprovalRecord | undefined>;
  update(approval: ApprovalRecord): Promise<void>;
}

export type IdempotentResource =
  | Readonly<{ resourceType: 'COMPANY_GROUP'; value: CompanyGroup }>
  | Readonly<{ resourceType: 'CONTACT'; value: Contact }>
  | Readonly<{ resourceType: 'CONTACT_POINT'; value: ContactPointRecord }>
  | Readonly<{ resourceType: 'OPPORTUNITY'; value: Opportunity }>
  | Readonly<{ resourceType: 'JOB'; value: JobRecord }>
  | Readonly<{ resourceType: 'APPROVAL'; value: ApprovalRecord }>;

export type IdempotencyRecord = Readonly<{
  fingerprint: string;
  resource: IdempotentResource;
}>;

export interface IdempotencyStore {
  get(organizationId: string, operation: string, key: string): Promise<IdempotencyRecord | undefined>;
  put(organizationId: string, operation: string, key: string, record: IdempotencyRecord): Promise<void>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
  /** Historial de auditoría de la organización, para construir timelines
   * unificados (PH07-T001: Company 360). Sin filtro de recurso en el puerto
   * -- el filtrado por recurso(s) vive en el servicio, igual que el resto
   * de listados por organización de este módulo. */
  listByOrganization(organizationId: string): Promise<readonly AuditEvent[]>;
}

export interface CoreUnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

/** Lectura de eventos de salud de motores de búsqueda desde `rhia.system_health_event`
 * (PH06-T001, acción pendiente 4: alimentar `computeEngineHealthScores` con historial real). */
export interface SearchHealthRepository {
  /** Eventos con `component` prefijo `search_engine:` desde `since` hasta ahora. */
  listRecentSearchEngineEvents(since: Date): Promise<readonly SearchHealthEventRecord[]>;
}

export type CoreDependencies = Readonly<{
  companies: CompanyGroupRepository;
  companyEntities: CompanyEntityRepository;
  companyLocations: CompanyLocationRepository;
  contacts: ContactRepository;
  contactPoints: ContactPointRepository;
  opportunities: OpportunityRepository;
  jobs: JobRepository;
  approvals: ApprovalRepository;
  idempotency: IdempotencyStore;
  audit: AuditSink;
  unitOfWork: CoreUnitOfWork;
  searchHealth: SearchHealthRepository;
  encryptionKeys: EncryptionKeyProvider;
  newId: () => string;
  now: () => Date;
}>;
