# Core API v1

## Propósito

Core API es la frontera versionada entre RHIA App, workers y n8n. La lógica de dominio vive en servicios y no en componentes de interfaz ni adaptadores de persistencia.

## Ruta implementada

| Método | Ruta | Acción RBAC | Resultado |
| --- | --- | --- | --- |
| `GET` | `/api/v1/companies` | `READ_OPERATIONS` | Lista company groups del tenant activo. |
| `POST` | `/api/v1/companies` | `WRITE_OPERATIONS` | Crea un company group de forma idempotente y emite audit. |
| `GET` | `/api/v1/contacts` | `READ_OPERATIONS` | Lista contactos del tenant activo. |
| `POST` | `/api/v1/contacts` | `WRITE_OPERATIONS` | Crea un contacto `UNVERIFIED` de forma idempotente y emite audit. |
| `GET` | `/api/v1/opportunities` | `READ_OPERATIONS` | Lista oportunidades del tenant activo. |
| `POST` | `/api/v1/opportunities` | `WRITE_OPERATIONS` | Crea una oportunidad `DISCOVERED/OPEN` de forma idempotente y emite audit. |
| `GET` | `/api/v1/jobs` | `READ_OPERATIONS` | Lista jobs del tenant activo. |
| `POST` | `/api/v1/jobs` | `START_JOB` | Valida el input por `jobType`, crea un job `PENDING` y emite audit. |
| `GET` | `/api/v1/approvals` | `READ_APPROVALS` | Lista approvals; solo identidades humanas autorizadas. |
| `POST` | `/api/v1/approvals` | `REQUEST_APPROVAL` | Crea una solicitud `PENDING`; services requieren `approvals.request`. |
| `POST` | `/api/v1/approvals/:id/decisions` | `DECIDE_APPROVAL` | Registra decisión humana idempotente sin ejecutar la acción aprobada. |

Todas las respuestas declaran `version: "1.0"`. Los errores usan el catálogo `RhiaError`, conservan `correlationId` y no incluyen detalles sensibles.

## Límites de confianza

- `Principal.organizationId` determina el tenant; el payload nunca puede elegirlo.
- RBAC/capability policy se evalúa antes de leer o escribir.
- Una idempotency key pertenece a `organizationId + operation`; reutilizarla con otro payload produce conflicto.
- Un retry válido devuelve el recurso original sin duplicar persistencia ni audit.
- Cada write exitoso emite un evento con hash del resultado y correlation ID.
- Solicitar, leer y decidir approvals son permisos distintos; services nunca deciden.
- Una decisión aprobada solo cambia el approval y no ejecuta precios, descuentos ni compromisos.

## Puertos

- `CompanyGroupRepository`: persistencia tenant-aware.
- `IdempotencyStore`: ledger de operaciones sensibles.
- `AuditSink`: persistencia append-only de auditoría.
- `CoreUnitOfWork`: frontera transaccional obligatoria para cada write.
- `newId` y `now`: tiempo e IDs inyectables para pruebas deterministas.

Los adaptadores en memoria existen únicamente para integración aislada. `PostgresSession` asocia todos los repositorios al mismo cliente mediante contexto asíncrono; recurso, audit e idempotency record se confirman juntos o se revierten juntos. Las unidades anidadas se unen a la transacción existente.

La migration `0005_core_api_persistence` agrega el ledger `core_idempotency` y completa `approval` con organización, job, requester humano, razón, resumen, target y correlation ID. Sus triggers comprueban que approval, action y job pertenecen al mismo tenant. La migration no habilita servicios ni aplica cambios a la base activa.

## Transporte HTTP

- Usa `createCoreHttpServer` sobre el dispatcher y no contiene lógica de negocio.
- Recibe un `PrincipalAuthenticator` inyectado; nunca construye identidad desde headers controlados por el cliente.
- Acepta únicamente `GET` y `POST`; los writes requieren `application/json`.
- Limita el body a 1 MiB por defecto y devuelve errores RHIA para JSON inválido o payload excesivo.
- Propaga o genera `x-correlation-id` y responde siempre con `cache-control: no-store`.
- PH04-T002 conectará sesiones reales al puerto de autenticación.

## Persistencia PostgreSQL

- `createPostgresCoreDependencies` conecta companies, contacts, opportunities, jobs, approvals, auditoría y ledger.
- Las consultas siempre filtran por `organizationId`; la decisión de approval bloquea la fila con `FOR UPDATE`.
- Crear approval registra su execution/action de control dentro de la misma transacción, sin ejecutar la acción comercial.
- El gate restaura un backup cifrado en un contenedor temporal e inyecta un fallo de auditoría para demostrar rollback total.

Ningún endpoint de esta fase envía outreach ni ejecuta acciones comerciales reales.
