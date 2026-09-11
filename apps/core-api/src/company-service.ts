import { createHash } from 'node:crypto';
import type { ErrorCode } from '@rhia/domain';
import { resolveCompanyEntity, type EntityResolutionInput, type KnownEntity } from '@rhia/entity-resolver';
import { authorize, type Principal } from '@rhia/policy';
import { CreateCompanyGroupSchema, type CompanyDetail, type CompanyGroup, type CreateCompanyGroup, type TimelineEvent } from './contracts.js';
import type { CoreDependencies } from './ports.js';

export class CoreServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: 400 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'CoreServiceError';
  }
}

const fingerprint = (value: object): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** PH07-T001 (criterio "No duplica empresas por ciudad"): un mismo job de
 * discovery corriendo por ciudad puede encontrar la MISMA company dos veces
 * (p. ej. "Acme Corp" vía una búsqueda en Quito y otra vez vía Guayaquil),
 * cada vez con su propia idempotencyKey -- el ledger de idempotencia por sí
 * solo no evita el duplicado. Se decidió DELIBERADAMENTE no comparar por
 * `canonicalName`: un ciclo autónomo anterior (ver docs/progress/PH07-T001.md,
 * sesión SES-20260906-66) ya identificó que un dedupe por nombre exacto
 * fusionaría empresas distintas que comparten el mismo nombre en ciudades
 * distintas -- exactamente el error que @rhia/entity-resolver (PH06-T004)
 * fue diseñado para evitar con señales de ubicación/identificador legal.
 * En cambio, se usa `websiteRoot` (dominio) como señal de dedupe: dos
 * companies con el MISMO dominio son, en la práctica, la misma empresa real
 * sin importar en qué ciudad se haya descubierto cada vez -- a diferencia del
 * nombre, un dominio no se repite por coincidencia entre negocios distintos.
 * Esto es un fix parcial y honesto: solo cubre companies creadas CON
 * `websiteRoot`; el caso "mismo nombre, sin dominio, ciudades distintas"
 * sigue sin resolver y requiere decidir el wiring completo de
 * @rhia/entity-resolver (caller real + señales disponibles) antes de
 * intentar nada más ambicioso -- ver "Qué falta" en docs/progress/PH07-T001.md. */
const normalizeWebsiteRoot = (websiteRoot: string): string =>
  new URL(websiteRoot).hostname.toLowerCase().replace(/^www\./, '');

const requireAuthorization = (principal: Principal, action: 'READ_OPERATIONS' | 'WRITE_OPERATIONS'): void => {
  const decision = authorize(principal, action);
  if (decision.outcome !== 'ALLOW') {
    throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
  }
};

export class CompanyGroupService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly CompanyGroup[]> {
    requireAuthorization(principal, 'READ_OPERATIONS');
    return this.dependencies.companies.listByOrganization(principal.organizationId);
  }

  /** Company 360 (PH07-T001): expediente de una company group con sus contacts,
   * opportunities y un timeline unificado (historial único) construido a partir
   * del audit trail ya existente -- reutiliza rhia.audit_event en vez de crear
   * una tabla de "activities" nueva, mismo principio que PH06-T001/T005 (no
   * crecer el esquema sin necesidad demostrada). El timeline incluye los
   * eventos de la propia company y los de sus contacts/opportunities (así se
   * ve todo el historial de la cuenta en un solo feed), ordenado del más
   * reciente al más antiguo. */
  async getById(principal: Principal, companyGroupId: string): Promise<CompanyDetail> {
    requireAuthorization(principal, 'READ_OPERATIONS');
    const company = await this.dependencies.companies.findById(principal.organizationId, companyGroupId);
    if (!company) {
      throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'Company no existe en el tenant activo.');
    }

    const [allContacts, allOpportunities, allEvents] = await Promise.all([
      this.dependencies.contacts.listByOrganization(principal.organizationId),
      this.dependencies.opportunities.listByOrganization(principal.organizationId),
      this.dependencies.audit.listByOrganization(principal.organizationId),
    ]);

    const contacts = allContacts.filter((contact) => contact.companyGroupId === companyGroupId);
    const opportunities = allOpportunities.filter((opportunity) => opportunity.companyGroupId === companyGroupId);

    const resourceIds = new Set<string>([company.id, ...contacts.map((c) => c.id), ...opportunities.map((o) => o.id)]);
    const timeline: TimelineEvent[] = allEvents
      .filter((event) => resourceIds.has(event.resourceId))
      .map((event) => ({
        id: event.id,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        occurredAt: event.occurredAt,
      }))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));

    return { company, contacts, opportunities, timeline };
  }

  /** PH07-T001 (wiring real de @rhia/entity-resolver, PH06-T004): decisión de
   * alcance tomada en este ciclo, tras tres ciclos previos (SES-20260906-65/
   * 66/67, ver docs/progress/PH07-T001.md) que dejaron correctamente
   * documentado el mismo diagnóstico sin decidir el diseño. El propio
   * PLAN_MAESTRO.md resuelve la pregunta que esos ciclos dejaron abierta
   * ("¿quién es el caller real?"): el Task Packet de PH06-T004 declara su
   * "Handoff" como "Handoff CRM enrichment" -- el resolver está diseñado para
   * alimentar precisamente a este servicio, no a un job de discovery futuro
   * todavía sin construir. Y el propio esquema de `packages/db/src/schema.ts`
   * (PH03-T001) ya tiene `company_entity`/`company_location` con las columnas
   * exactas que `@rhia/entity-resolver` necesita (`country_code`,
   * `legal_identifier`, `city`) -- confirmado sin código que las use en
   * ningún lado (grep previo a este cambio), así que esto usa tablas ya
   * existentes, no crece el esquema.
   *
   * Wiring: `legalIdentifier`/`location` son señales OPCIONALES del payload
   * (contracts.ts). Sin ellas, `create` se comporta exactamente igual que
   * antes (solo dedupe por `websiteRoot`) -- no se rompe ningún caller
   * existente. Con `location` presente, se construye el set de
   * `KnownEntity` ya registrados (a partir de `company_entity`/
   * `company_location` -- companies creadas sin señales no aparecen ahí, así
   * que solo se compara contra companies que YA aportaron identidad real) y
   * se invoca `resolveCompanyEntity`: si resuelve a un grupo existente, se
   * reutiliza (mismo patrón de idempotencyKey-apunta-a-existente que el
   * dedupe por dominio); si no, se crea una company nueva con
   * `globalIdentityStatus` reflejando el resultado (`RESOLVED` o `AMBIGUOUS`
   * cuando el resolver dice `NEEDS_REVIEW` -- nunca se auto-confirma una
   * resolución de baja confianza, mismo criterio de aceptación que PH06-T004)
   * y se persiste su `company_entity`/`company_location` para que futuras
   * llamadas SÍ puedan compararse contra ella.
   *
   * Qué sigue sin cubrir (honesto, no simulado): esto resuelve el caso
   * "mismo nombre real, sin dominio, ciudades distintas" que los ciclos
   * anteriores dejaron como el gap central -- siempre que el caller aporte
   * `location`. Un caller que NO aporte ninguna señal de ubicación (p. ej. un
   * formulario mínimo que solo captura nombre) sigue sin poder dedupearse por
   * identidad -- eso ya no es un hueco de diseño, es una limitación
   * inherente a no tener señal alguna que comparar. Relaciones de ownership
   * (subsidiary/parent) tampoco se envían todavía desde este endpoint -- el
   * contrato no tiene un campo para eso y añadirlo no formaba parte del
   * criterio de aceptación de este packet ("no duplica empresas por
   * ciudad"). Un grupo existente que resuelve como match NO recibe una
   * `company_entity` nueva para la ubicación entrante (se reutiliza el grupo
   * tal cual) -- soporte multi-entidad por grupo (una multinacional con
   * sedes reales en varios países) queda fuera de alcance de este ciclo. */
  async create(
    principal: Principal,
    rawInput: unknown,
    correlationId: string,
  ): Promise<Readonly<{ company: CompanyGroup; replayed: boolean }>> {
    requireAuthorization(principal, 'WRITE_OPERATIONS');
    const parsed = CreateCompanyGroupSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de company no cumple el contrato v1.');
    }

    const input: CreateCompanyGroup = parsed.data;
    const location = input.location ?? null;
    const legalIdentifier = input.legalIdentifier ?? null;
    const normalized = {
      canonicalName: input.canonicalName,
      websiteRoot: input.websiteRoot ?? null,
      legalIdentifier,
      location,
    };
    const inputFingerprint = fingerprint(normalized);
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(
        principal.organizationId,
        'COMPANY_GROUP_CREATE',
        input.idempotencyKey,
      );
      if (stored) {
        if (stored.fingerprint !== inputFingerprint) {
          throw new CoreServiceError(
            'RHIA_CONTRACT_INVALID_PAYLOAD',
            409,
            'La idempotency key ya fue usada con otro payload.',
          );
        }
        if (stored.resource.resourceType !== 'COMPANY_GROUP') {
          throw new CoreServiceError('RHIA_CORE_UNEXPECTED_FAILURE', 409, 'El ledger idempotente contiene otro tipo de recurso.');
        }
        return { company: stored.resource.value, replayed: true };
      }

      if (normalized.websiteRoot) {
        const normalizedDomain = normalizeWebsiteRoot(normalized.websiteRoot);
        const existingByDomain = (await this.dependencies.companies.listByOrganization(principal.organizationId)).find(
          (candidate) => candidate.websiteRoot !== null && normalizeWebsiteRoot(candidate.websiteRoot) === normalizedDomain,
        );
        if (existingByDomain) {
          // Mismo dominio ya registrado en el tenant: no se crea una company
          // duplicada. Se registra la idempotencyKey nueva apuntando a la
          // company existente para que un reintento futuro con esa misma key
          // también resuelva rápido, sin volver a listar/comparar.
          await this.dependencies.idempotency.put(
            principal.organizationId,
            'COMPANY_GROUP_CREATE',
            input.idempotencyKey,
            { fingerprint: inputFingerprint, resource: { resourceType: 'COMPANY_GROUP', value: existingByDomain } },
          );
          return { company: existingByDomain, replayed: true };
        }
      }

      let globalIdentityStatus: CompanyGroup['globalIdentityStatus'] = 'UNRESOLVED';
      if (location) {
        const knownEntities = await this.loadKnownEntities(principal.organizationId);
        const resolutionInput: EntityResolutionInput = {
          organizationId: principal.organizationId,
          names: [{ name: normalized.canonicalName, kind: 'TRADE', confidence: 0.7 }],
          legalIdentifiers: legalIdentifier
            ? [{ identifier: legalIdentifier, countryCode: location.countryCode, confidence: 0.9 }]
            : [],
          locations: [{
            city: location.city,
            countryCode: location.countryCode,
            confidence: 0.8,
            ...(location.administrativeArea ? { administrativeArea: location.administrativeArea } : {}),
          }],
          ownership: [],
          knownEntities,
        };
        const resolution = resolveCompanyEntity(resolutionInput);
        if (!resolution.isNewGroup && resolution.matchedGroupId) {
          const existing = await this.dependencies.companies.findById(principal.organizationId, resolution.matchedGroupId);
          if (existing) {
            // El Entity Resolver encontró un grupo ya conocido (mismo legal
            // identifier, relación de ownership, o nombre+ubicación
            // compatible sin conflicto de país) -- se reutiliza, mismo patrón
            // que el dedupe por dominio de arriba.
            await this.dependencies.idempotency.put(
              principal.organizationId,
              'COMPANY_GROUP_CREATE',
              input.idempotencyKey,
              { fingerprint: inputFingerprint, resource: { resourceType: 'COMPANY_GROUP', value: existing } },
            );
            return { company: existing, replayed: true };
          }
          // matchedGroupId no encontrado en el repositorio (inconsistencia de
          // datos entre company_group y company_entity) -- se continúa como
          // si fuera una company nueva en vez de fallar silenciosamente.
        }
        // Confidence bajo (NEEDS_REVIEW) nunca auto-confirma: se crea la
        // company de todas formas (no se bloquea al operador) pero marcada
        // AMBIGUOUS para revisión humana explícita, nunca RESOLVED.
        globalIdentityStatus = resolution.status === 'NEEDS_REVIEW' ? 'AMBIGUOUS' : 'RESOLVED';
      }

      const occurredAt = this.dependencies.now().toISOString();
      const company: CompanyGroup = {
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        canonicalName: normalized.canonicalName,
        websiteRoot: normalized.websiteRoot,
        globalIdentityStatus,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await this.dependencies.companies.create(company);

      if (location) {
        const entityId = this.dependencies.newId();
        await this.dependencies.companyEntities.create({
          id: entityId,
          organizationId: principal.organizationId,
          companyGroupId: company.id,
          legalName: normalized.canonicalName,
          tradeName: null,
          countryCode: location.countryCode,
          legalIdentifier,
          entityType: 'HEADQUARTERS',
          status: 'ACTIVE',
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
        await this.dependencies.companyLocations.create({
          id: this.dependencies.newId(),
          organizationId: principal.organizationId,
          companyEntityId: entityId,
          countryCode: location.countryCode,
          administrativeArea: location.administrativeArea ?? null,
          city: location.city,
          address: null,
          isHeadquarters: true,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      }

      await this.dependencies.audit.append({
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        actorId: principal.id,
        actorType: principal.kind,
        action: 'COMPANY_GROUP_CREATED',
        resourceType: 'COMPANY_GROUP',
        resourceId: company.id,
        afterHash: fingerprint(company),
        occurredAt,
        correlationId,
      });
      await this.dependencies.idempotency.put(
        principal.organizationId,
        'COMPANY_GROUP_CREATE',
        input.idempotencyKey,
        { fingerprint: inputFingerprint, resource: { resourceType: 'COMPANY_GROUP', value: company } },
      );
      return { company, replayed: false };
    });
  }

  /** Construye los `KnownEntity` de @rhia/entity-resolver a partir de
   * `company_entity`/`company_location` ya persistidos (ver comentario de
   * `create` arriba). Solo companies que YA aportaron `location` alguna vez
   * aparecen aquí -- es una lista que crece con el uso real, no un catálogo
   * completo de todas las companies del tenant. */
  private async loadKnownEntities(organizationId: string): Promise<KnownEntity[]> {
    const [groups, entities, locations] = await Promise.all([
      this.dependencies.companies.listByOrganization(organizationId),
      this.dependencies.companyEntities.listByOrganization(organizationId),
      this.dependencies.companyLocations.listByOrganization(organizationId),
    ]);
    return entities.map((entity): KnownEntity => {
      const group = groups.find((candidate) => candidate.id === entity.companyGroupId);
      const location = locations.find((candidate) => candidate.companyEntityId === entity.id && candidate.isHeadquarters)
        ?? locations.find((candidate) => candidate.companyEntityId === entity.id);
      return {
        companyGroupId: entity.companyGroupId,
        companyEntityId: entity.id,
        canonicalName: group?.canonicalName ?? entity.legalName,
        legalIdentifiers: entity.legalIdentifier ? [entity.legalIdentifier] : [],
        aliases: [],
        countryCode: location?.countryCode ?? entity.countryCode,
        ...(location?.city ? { city: location.city } : {}),
      };
    });
  }
}
