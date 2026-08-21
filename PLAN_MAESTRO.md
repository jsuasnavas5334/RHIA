# PLAN MAESTRO — RHIA: Plataforma de Agentes Digitales Empresariales

## 0. Estado del documento

- **Versión:** 1.0
- **Fecha:** 2026-08-19
- **Estado:** `ESPECIFICACIÓN SUFICIENTE PARA PLANIFICAR`
- **Nivel de confianza:** Alto en alcance de producto y arquitectura objetivo; medio-alto en inventario técnico actual porque no se pudo auditar un repositorio GitHub ni el filesystem local desde esta sesión.
- **Fuente de verdad:** Este archivo.
- **Regla de uso:** Toda implementación, refactor, integración, migración o cambio de alcance debe comprobarse contra este documento y actualizar el Decision Log y la Matriz de Trazabilidad cuando corresponda.
- **Principio de ejecución:** Planificar primero, implementar después; no improvisar decisiones de producto dentro de una tarea técnica.
- **Restricción de arquitectura regional:** Ninguna regla, tabla, búsqueda, scoring, automatización o integración debe quedar hardcodeada para un solo país o ciudad.

## 1. Resumen ejecutivo

RHIA será una **plataforma extensible de agentes digitales empresariales** capaz de investigar, razonar, ejecutar tareas en sistemas externos, mantener memoria operacional y operar con autonomía controlada. El primer agente funcional será el **Agente Comercial**, responsable de descubrir empresas, resolver correctamente su identidad, validar evidencia, encontrar contactos, priorizar oportunidades, ejecutar outreach multicanal, mantener conversaciones dentro de políticas aprobadas y conseguir reuniones comerciales efectivas.

La plataforma no se construirá como una colección desordenada de workflows. Se adoptará una arquitectura de **modular monolith + workers**, usando PostgreSQL como fuente de verdad, una aplicación propia para usuarios internos, n8n como motor de orquestación/integración donde aporte valor, un runtime de agentes con políticas y approvals, un gateway de modelos de IA independiente del proveedor, y herramientas de ejecución por API, navegador determinista y Computer Use.

La prioridad de operación será:
1. Facilidad e intuición para usuarios no técnicos.
2. Confiabilidad y trazabilidad.
3. Costo por resultado.
4. Calidad de decisión.
5. Extensibilidad a futuros agentes.
6. Escalabilidad suficiente para al menos 100 empresas/día en la primera etapa.

**KPI comercial principal:** reuniones calificadas realizadas.  
**KPI comercial secundario:** reuniones calificadas agendadas.  
La plataforma medirá además la conversión completa desde empresa descubierta hasta reunión, costo por reunión, tasa de respuesta, calidad de contactos, cobertura de evidencia y performance de cada modelo de IA por tipo de tarea.

## 2. Qué estamos construyendo

RHIA tendrá cinco capas funcionales:

1. **RHIA App:** interfaz propia en español, orientada a usuarios no técnicos, para gestionar agentes, empresas, contactos, oportunidades, conversaciones, reuniones, aprobaciones, errores y métricas.
2. **RHIA Core:** reglas de negocio, permisos, estados, contratos, auditoría, idempotencia, políticas de autonomía, approval gates y persistencia.
3. **Agent Runtime:** motor que recibe objetivos, descompone trabajo, llama herramientas/modelos, mantiene estado y reanuda ejecuciones.
4. **Execution Layer:** n8n, APIs, Playwright/browser automation y Computer Use según el tipo de tarea.
5. **Intelligence Layer:** gateway multi-modelo con OpenAI, Anthropic, DeepSeek, Qwen, Ollama y proveedores futuros, seleccionado por benchmark, costo, calidad, latencia, privacidad y disponibilidad.

El primer agente comercial debe cubrir el flujo completo:

`descubrir empresa → resolver identidad → resolver grupo/entidad/localidad → recopilar evidencia → encontrar contactos → validar contactos → score comercial → decidir canal/cadencia → contactar → conversar → manejar objeciones dentro de política → agendar reunión → registrar resultado → aprender`

La arquitectura también debe permitir crear nuevos agentes sin reescribir el núcleo: marketing, cobranza, administración, RRHH, atención al cliente, investigación, legal, compras, operaciones y otros.

## 3. Qué NO estamos construyendo

No se elimina funcionalidad del alcance general, pero sí se establecen límites para evitar sobrearquitectura:

- No se construirán microservicios independientes mientras el volumen y la operación no lo justifiquen.
- No se permitirá que n8n sea la fuente de verdad del negocio.
- No se permitirá que un modelo de IA sea propietario del estado del proceso.
- No se hardcodearán países, ciudades, industrias, cargos, canales o proveedores.
- No se permitirá a agentes modificar precios aprobados, descuentos, condiciones comerciales o asumir compromisos vinculantes sin aprobación humana.
- No se permitirá outreach ilimitado ni cadencias agresivas.
- No se asumirán resultados de búsqueda vacíos como evidencia de inexistencia cuando exista degradación técnica.
- No se construirá un segundo agente funcional completo antes de que el Agente Comercial cumpla su gate de producto, aunque la arquitectura sí quedará preparada.
- No se hará una reescritura total de n8n/PostgreSQL actuales sin una auditoría que demuestre que es necesaria.

## 4. Usuarios y casos de uso

### Usuarios humanos iniciales

- **Administrador:** configura organización, políticas, proveedores, agentes, usuarios, price books y approvals.
- **Gerente/Manager:** revisa pipeline, métricas, reuniones, conversaciones y aprobaciones sensibles.
- **Operador comercial:** consulta empresas, oportunidades, reuniones, historial y puede intervenir manualmente cuando sea necesario.
- **Viewer/Auditor:** lectura de datos, métricas y trazabilidad sin capacidad operativa.

### Usuarios de sistema

- **Agent Service:** ejecuta tareas con permisos limitados por capability.
- **n8n Service:** orquesta integraciones y workflows autorizados.
- **Worker Service:** ejecuta jobs, retries, Playwright y tareas de fondo.

### Casos de uso principales

1. Investigar una empresa suministrada por un usuario.
2. Descubrir automáticamente empresas por mercado, ciudad, industria, señales y criterios.
3. Resolver empresa global, entidad legal/local, país y ciudad sin falsos positivos.
4. Consolidar un único expediente regional con múltiples países, ciudades, entidades y sucursales.
5. Encontrar contactos relevantes de forma dinámica según solución, industria, tamaño, país y estructura organizacional.
6. Calificar oportunidad y siguiente mejor acción.
7. Contactar automáticamente por email, WhatsApp, LinkedIn, formularios web, chat web, redes sociales y, cuando sea aprobado, voz.
8. Mantener conversaciones automáticas dentro de políticas comerciales.
9. Comunicar precios oficiales aprobados, pero escalar cualquier solicitud de descuento, modificación o condición especial.
10. Agendar reuniones y registrar asistencia/calificación.
11. Mostrar trazabilidad completa de por qué RHIA hizo cada acción.
12. Permitir extensiones futuras para nuevos agentes empresariales.

## 5. Requisitos

### MUST

- Plataforma extensible de agentes.
- Agente Comercial end-to-end.
- App propia usable por equipo interno.
- CRM propio.
- PostgreSQL como fuente de verdad.
- n8n conservado como orquestador donde sea conveniente.
- Arquitectura multipaís y multiciudad.
- Ecuador prioridad comercial #1 y Perú #2 mediante scoring, nunca exclusión.
- Todos los mercados de Latinoamérica habilitados.
- Descubrimiento automático y análisis de empresas suministradas.
- Expediente regional jerárquico de empresa.
- Evidencia trazable con fuente, fecha, confiabilidad y estado.
- Diferenciar `evidence`, `fact`, `inference` y `decision`.
- Contact targeting dinámico; no limitado a RRHH porque las soluciones pueden aplicarse a todos los puestos y áreas.
- Outreach multicanal.
- Máximo de 3 toques automatizados proactivos por secuencia/oportunidad salvo política explícita distinta.
- Detener outreach ante respuesta, reunión, opt-out, rebote permanente o señal de riesgo.
- Precios oficiales comunicables automáticamente.
- Cambios de precio, descuentos y compromisos comerciales requieren aprobación humana.
- Reuniones agendadas y realizadas medidas separadamente.
- Model Router multi-proveedor.
- Evaluación de OpenAI, Anthropic, DeepSeek, Qwen y Ollama.
- Idempotencia, retries, backoff y reanudación.
- Auditoría de acciones.
- Seguridad de secretos y PII.
- Dashboard de errores, jobs, costos y salud.
- Capacidad objetivo inicial: 100 empresas/día.
- Diseño local-first con migración a servidor/cloud sin rediseño.
- Testing automatizado de flujos críticos.
- Backups y rollback.
- Observabilidad.
- Documentación operativa para personas no técnicas.

### SHOULD

- Aprendizaje por performance histórico de cargos, canales, mensajes y modelos.
- Feature flags.
- A/B testing de mensajes dentro de límites aprobados.
- Benchmark continuo de modelos.
- Cache semántico/reutilización de evidencia.
- Dedupe cross-market y cross-source.
- Browser automation determinista con Playwright.
- Computer Use para interfaces no deterministas o sin API.
- Biblioteca de skills/capabilities reutilizables.
- Exportación/importación CSV/XLSX.
- Webhooks para integraciones futuras.
- Soporte i18n desde la estructura aunque UI inicial sea español.
- Vista de costos por oportunidad, campaña, modelo y reunión.

### COULD

- Voz IA para llamadas salientes.
- Marketplace interno de skills.
- Agentes especializados adicionales activables por organización.
- Multi-tenant externo/SaaS.
- Aplicación móvil nativa.
- Entrenamiento/fine-tuning propio si el benchmark lo justifica.
- Vector DB dedicado si PostgreSQL/pgvector deja de ser suficiente.

## 6. Estado actual del producto

| Área | Estado | Observación |
|---|---|---|
| WSL2/Ubuntu | `LISTO` | Entorno local funcional. |
| Docker Compose | `LISTO/PARCIAL` | PostgreSQL y n8n operativos; falta baseline reproducible y hardening. |
| PostgreSQL `rhia_core` | `LISTO/PARCIAL` | Existe y contiene al menos `execution_registry`; schema completo aún no auditado. |
| n8n | `LISTO/PARCIAL` | Orquestación activa; debe documentarse/exportarse. |
| Heartbeat | `LISTO` | Se validó ejecución periódica. |
| SearXNG | `PARCIAL` | Funciona, pero presenta rate limit/CAPTCHA y dependencia fuerte de Google CSE. |
| Generación de consultas | `PARCIAL` | Ya se generan múltiples consultas por entidad/país/ciudad. |
| Separación de consultas | `PARCIAL` | Operativa. |
| Buscar evidencia entidad | `PARCIAL` | HTTP Request a SearXNG; batching 1 item / 3000 ms configurado en prueba. |
| Diagnosticar salud búsqueda | `PARCIAL` | Lógica en desarrollo; detecta degradación y resultados, pero hubo bug de dominio y falta distinguir retry/backoff de reformulación. |
| Evaluación de evidencia | `FALTA/PARCIAL` | Próxima capa lógica. |
| Resolución jerárquica de entidad | `FALTA/PARCIAL` | Requisito definido, implementación final pendiente. |
| CRM propio | `FALTA` | Debe construirse. |
| App propia | `FALTA` | Debe construirse. |
| Outreach | `FALTA` | Debe construirse con políticas. |
| Meeting automation | `FALTA` | Debe construirse. |
| AI Gateway | `FALTA` | Debe construirse. |
| Computer Use/Playwright | `FALTA` | Debe integrarse como herramienta. |
| Observabilidad formal | `FALTA` | Logs existen parcialmente; faltan métricas/tracing/alertas. |
| CI/CD | `DESCONOCIDO` | No se pudo acceder a repositorio GitHub. |
| Tests automatizados | `DESCONOCIDO/FALTA` | No hay evidencia suficiente. |
| Repo fuente | `DESCONOCIDO` | GitHub conectado no expuso repositorios en esta sesión. |

## 7. Arquitectura actual

Arquitectura reconstruida:

```text
Windows / HP Victus
└── WSL2 Ubuntu
    └── Docker
        ├── rhia-postgres
        │   └── rhia_core
        │       └── execution_registry
        ├── rhia-n8n
        │   └── workflows RHIA
        └── SearXNG
            └── motores externos
```

Problemas actuales identificados:

- Lógica de producto todavía embebida en nodos/workflows.
- Falta contrato formal entre n8n, DB y futuros agentes.
- Search health puede confundirse con calidad de evidencia.
- Rate limiting/CAPTCHA reduce cobertura.
- Falta repositorio/versionado accesible.
- Falta UI propia.
- Falta policy engine para acciones autónomas.
- Falta AI gateway y medición de performance/costo.
- Falta observabilidad unificada.

## 8. Arquitectura objetivo

### Principio

**Modular monolith + workers; no microservicios prematuros.**

### Stack objetivo propuesto

- **Frontend + BFF:** Next.js + TypeScript.
- **Core domain:** módulos TypeScript compartidos con validación de schemas.
- **DB:** PostgreSQL.
- **ORM/migraciones:** Prisma o Drizzle; seleccionar uno en PH02 mediante criterio de simplicidad y migraciones reproducibles. Preferencia inicial: Prisma por ergonomía y adopción.
- **Jobs:** PostgreSQL-backed queue para evitar introducir Redis en v1; preferencia inicial `pg-boss` o equivalente mantenido.
- **Orquestación:** n8n para workflows, integraciones y secuencias visuales.
- **Browser automation:** Playwright.
- **Computer Use:** adapter de proveedor, invocado solo cuando browser determinista/API no sea suficiente.
- **AI Gateway:** adapters OpenAI-compatible/Anthropic-compatible y adapters específicos cuando aporte valor.
- **Local models:** Ollama.
- **Search:** SearXNG + adapters de fuentes especializadas.
- **Storage:** filesystem/S3-compatible según entorno; metadatos en Postgres.
- **Deploy local:** Docker Compose.
- **Deploy remoto:** mismos contenedores en VPS/cloud con cambio mínimo.
- **Observabilidad:** logs estructurados + métricas + health checks; stack ligero inicialmente.
- **Auth:** autenticación propia delegada a librería madura; roles y sessions en RHIA Core.

### Diagrama lógico

```text
┌─────────────────────────────────────────────┐
│                 RHIA APP                    │
│ Dashboard / CRM / Agents / Jobs / Approvals │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                 RHIA CORE                   │
│ Domain / Policies / Auth / Audit / API      │
└─────────────┬───────────────┬───────────────┘
              │               │
              ▼               ▼
       PostgreSQL         Job Runtime
     Source of Truth     + Agent Runtime
              │               │
              │      ┌────────┼─────────┐
              │      ▼        ▼         ▼
              │   AI GW     Tools      n8n
              │      │        │         │
              │  providers    │         │
              │               ├─ APIs   │
              │               ├─ Playwright
              │               └─ Computer Use
              │
              └── Evidence / CRM / Audit / Cost
```

### Regla de selección de herramienta

1. API estable y autorizada.
2. Automatización determinista con Playwright.
3. Computer Use cuando la interfaz requiera interpretación visual o cambie con frecuencia.
4. Humano cuando exista ambigüedad crítica, riesgo legal/comercial o política de aprobación.

## 9. Modelo de datos

### Núcleo de organización

**organization**
- id
- name
- default_locale
- default_timezone
- active
- created_at

**user**
- id
- organization_id
- email
- display_name
- status
- auth_provider
- created_at
- last_login_at

**role / permission / user_role**
- RBAC con permisos explícitos.

### Agentes

**agent_definition**
- id
- key
- name
- version
- purpose
- status
- default_policy_id

**agent_instance**
- id
- organization_id
- agent_definition_id
- configuration
- status

**capability**
- id
- key
- risk_level
- requires_approval_default

**agent_capability**
- agent_definition_id
- capability_id
- policy overrides

### Jobs y ejecución

**job**
- id
- organization_id
- agent_instance_id
- job_type
- input
- status
- priority
- idempotency_key
- retry_count
- next_attempt_at
- created_at
- completed_at

**execution**
- id
- job_id
- attempt
- executor_type
- started_at
- ended_at
- outcome
- error_code
- trace_id

**action**
- id
- execution_id
- capability
- resource_type
- resource_id
- request_payload
- response_summary
- risk_level
- status

**approval**
- id
- action_id
- requested_by_agent
- approval_type
- status
- approver_user_id
- reason
- expires_at

### Empresas

**company_group**
- id
- canonical_name
- website_root
- global_identity_status

**company_entity**
- id
- company_group_id
- legal_name
- trade_name
- country_code
- legal_identifier
- entity_type
- status

**company_location**
- id
- company_entity_id
- country_code
- administrative_area
- city
- address
- latitude
- longitude
- timezone
- is_headquarters

**company_alias**
- company_group/entity reference
- alias
- source

### Evidencia y conocimiento

**source**
- id
- source_type
- domain
- url
- fetched_at
- provider
- source_reliability

**evidence**
- id
- subject_type
- subject_id
- source_id
- claim_type
- excerpt_hash
- observed_value
- confidence
- freshness
- status

**fact**
- id
- subject_type
- subject_id
- predicate
- value
- confidence
- valid_from
- valid_to
- supporting_evidence_ids

**inference**
- id
- subject_type
- subject_id
- inference_type
- value
- confidence
- model_run_id
- supporting_fact_ids

**decision**
- id
- decision_type
- input_snapshot
- output
- rationale_summary
- policy_version
- model_run_id

### Contactos y CRM

**contact**
- id
- company_group_id
- company_entity_id
- full_name
- title
- department
- seniority
- country_code
- city
- linkedin_url
- status

**contact_point**
- id
- contact_id
- type
- value_encrypted
- validation_status
- source
- last_validated_at

**opportunity**
- id
- company_group_id
- primary_entity_id
- market_country
- market_city
- stage
- score
- score_version
- owner
- next_action_at
- status

**opportunity_signal**
- opportunity_id
- signal_type
- signal_value
- evidence_id
- weight

### Productos y precios

**product**
- id
- sku
- name
- description
- active

**price_book**
- id
- country_code
- currency
- valid_from
- valid_to
- status

**price_book_item**
- price_book_id
- product_id
- unit_price
- minimum_quantity
- policy_metadata

La IA puede comunicar estos precios cuando estén `ACTIVE`; no puede editar valores.

### Outreach

**outreach_sequence**
- id
- opportunity_id
- policy_id
- status
- max_touches
- timezone
- quiet_hours
- started_at
- stopped_at

**outreach_touch**
- id
- sequence_id
- contact_id
- channel
- planned_at
- sent_at
- status
- message_version
- provider_message_id

**conversation**
- id
- opportunity_id
- contact_id
- channel
- status
- sentiment
- intent
- last_message_at

**message**
- id
- conversation_id
- direction
- content_redacted
- provider_message_id
- sent_at
- detected_intent

### Reuniones

**meeting**
- id
- opportunity_id
- contact_id
- scheduled_at
- timezone
- status
- qualification_status
- attended
- outcome
- calendar_event_id

Estados mínimos:
- `BOOKED`
- `CONFIRMED`
- `ATTENDED`
- `NO_SHOW`
- `CANCELLED`
- `RESCHEDULED`

Calificación:
- `UNQUALIFIED`
- `POTENTIAL`
- `QUALIFIED`

**Definición operativa de reunión efectiva:** `ATTENDED + QUALIFIED`.  
También se reportará `BOOKED + QUALIFIED` como KPI de agenda.

### IA y costos

**model_provider**
- provider
- status
- capabilities

**model_profile**
- task_class
- provider
- model
- quality_score
- latency_score
- cost_score
- privacy_class
- enabled

**model_run**
- id
- provider
- model
- task_class
- input_tokens
- output_tokens
- estimated_cost
- latency_ms
- success
- quality_result

**model_benchmark**
- task_class
- dataset_version
- provider/model
- accuracy
- cost_per_case
- latency_p50
- latency_p95
- updated_at

### Auditoría y observabilidad

**audit_event**
- actor
- actor_type
- action
- resource
- before_hash
- after_hash
- timestamp
- trace_id

**system_health_event**
- component
- status
- detail
- timestamp

### Índices críticos

- canonical/normalized company name + country/city.
- legal identifier por país.
- contact email/phone hash.
- opportunity status + next_action_at.
- job status + next_attempt_at.
- evidence subject + claim_type + freshness.
- model_run task_class + provider/model.
- audit trace_id.

## 10. Roles y permisos

### ADMIN
- Gestionar organización, usuarios, agentes, providers y policies.
- Configurar price books.
- Aprobar acciones sensibles.
- Ver secrets metadata, nunca secretos en texto plano.

### MANAGER
- Gestionar oportunidades y campañas.
- Aprobar descuentos/cambios de precio y compromisos comerciales si la organización lo autoriza.
- Revisar conversaciones y reuniones.
- Intervenir en agentes.

### OPERATOR
- Operar CRM.
- Iniciar investigaciones/campañas.
- Revisar resultados.
- Reprogramar o detener secuencias.
- No modificar price books.

### VIEWER
- Solo lectura de información no sensible según ámbito.

### AGENT_SERVICE
- Permisos por capability.
- Puede investigar, leer, guardar, modificar registros operativos, ingresar a plataformas, descargar documentos, contactar y agendar reuniones.
- No puede modificar precios aprobados.
- No puede aceptar descuentos, condiciones contractuales o compromisos vinculantes.
- No puede elevar sus propios permisos.

### Approval Policy

Siempre requieren aprobación humana:
- modificar precio oficial;
- ofrecer descuento;
- cambiar términos de pago;
- asumir SLA/garantía;
- comprometer fecha/alcance no preaprobado;
- aceptar contrato;
- realizar acción irreversible de alto impacto;
- cambiar permisos/secretos;
- desplegar producción con breaking change;
- acciones legales sensibles.

## 11. Integraciones externas

### Categorías

**Búsqueda y datos**
- SearXNG.
- Motores/fuentes especializadas futuras.
- Fuentes públicas empresariales/regulatorias por país mediante adapters.
- LinkedIn u otras fuentes solo mediante métodos permitidos por sus condiciones y políticas.

**Comunicación**
- Email provider configurable.
- WhatsApp Business API/provider autorizado.
- LinkedIn mediante integración permitida/automation controlada.
- Formularios web.
- Chat web.
- Redes sociales.
- Voz, posteriormente.

**Calendario**
- Google Calendar / Microsoft 365 mediante adapter.

**IA**
- OpenAI.
- Anthropic.
- DeepSeek.
- Qwen.
- Ollama.
- Providers futuros compatibles.

**Browser**
- Playwright.
- Computer Use provider.

### Contrato de integración

Toda integración debe implementar:
- `healthCheck()`
- `capabilities()`
- `execute()`
- `normalizeError()`
- `retryPolicy()`
- `rateLimitState()`
- `auditMetadata()`

Ningún workflow debe depender de un proveedor sin fallback o manejo explícito de indisponibilidad.

## 12. Flujos críticos

### F1 — Descubrimiento automático

1. Usuario/agent define mercado, ciudad, criterios e ICP.
2. RHIA genera estrategias de búsqueda.
3. Search adapters obtienen candidatos.
4. Se deduplican candidatos.
5. Se crea/actualiza company group/entity/location.
6. Evidencia se almacena.
7. Se calcula confianza de identidad.
8. Si confianza insuficiente, se ejecuta reintento, fuente alternativa o escalación.

### F2 — Investigación de empresa suministrada

1. Recibe nombre/URL/país/ciudad parcial o completo.
2. Resuelve ambigüedad.
3. Consulta fuentes.
4. Separa fallos técnicos de ausencia de evidencia.
5. Consolida expediente regional.

### F3 — Contact discovery

1. Deriva funciones compradoras/influenciadoras según solución, empresa y contexto.
2. Busca personas.
3. Valida cargo, vigencia y contacto.
4. Deduplica.
5. Prioriza contacto principal/secundario.

### F4 — Outreach

Política inicial:
- máximo 3 toques proactivos automatizados por oportunidad/secuencia;
- mezcla de canales configurable;
- usar zona horaria local;
- respetar quiet hours;
- detener ante respuesta, opt-out, rebote permanente, reunión o riesgo;
- no duplicar mensajes por retry;
- no contactar simultáneamente múltiples personas de la misma empresa de forma agresiva.

**Suposición operativa inicial de cadencia:** día 0, +3 días hábiles, +7 días hábiles desde el primer toque. Configurable por país/canal/campaña.

### F5 — Conversación

1. Clasificar intención.
2. Recuperar contexto, productos y price book aplicable.
3. Responder dentro de políticas.
4. Si solicita precio oficial, comunicarlo.
5. Si solicita descuento/condición especial/compromiso, crear approval.
6. Si existe intención de reunión, consultar calendario y agendar.

### F6 — Reunión

1. Identificar disponibilidad.
2. Ofrecer opciones.
3. Crear evento.
4. Confirmar.
5. Recordatorio.
6. Registrar asistencia.
7. Calificar reunión.
8. Actualizar oportunidad.

### F7 — Retry de búsqueda

- `NO_RESULTS + engines healthy` → reformular consulta/fuente.
- `NO_RESULTS + rate limit/CAPTCHA/provider down` → backoff/retry/fallback.
- `PARTIAL_RESULTS` → evaluar evidencia disponible y completar con fuentes alternativas.
- No convertir degradación técnica en hecho de negocio.

## 13. Decisiones arquitectónicas

| ID | Decisión | Razón | Alternativas descartadas | Impacto |
|---|---|---|---|---|
| ADR-001 | PostgreSQL es source of truth | Persistencia, consultas, auditoría, recuperación | Estado en n8n | Evita dependencia de workflow |
| ADR-002 | Modular monolith + workers | Menor complejidad para 100 empresas/día | Microservicios | Menor dolor operacional |
| ADR-003 | n8n se conserva como orchestration layer | Ya operativo y visual | Reescritura inmediata | Preserva inversión |
| ADR-004 | App propia para usuarios | Usuario no técnico | Operar desde n8n | Mejora adopción |
| ADR-005 | Arquitectura provider-agnostic de IA | Costos/calidad cambian | Casarse con un proveedor | Permite routing dinámico |
| ADR-006 | API > Playwright > Computer Use | Confiabilidad y costo | Computer Use para todo | Reduce fragilidad |
| ADR-007 | Company Group + Entity + Location | Multinacionales y ciudades | Una fila por “empresa” | Evita duplicados regionales |
| ADR-008 | País y ciudad dinámicos | Cobertura regional | Hardcode | Escalabilidad LATAM |
| ADR-009 | Scoring, no exclusión de mercados | Todos los mercados habilitados | Whitelist de países | Mantiene cobertura |
| ADR-010 | AI no modifica precios | Control comercial | Autonomía total | Approval obligatorio |
| ADR-011 | AI no asume compromisos vinculantes | Riesgo legal/comercial | Autonomía total | Approval obligatorio |
| ADR-012 | Máximo 3 toques proactivos | Evitar saturación | Outreach ilimitado | Política global configurable |
| ADR-013 | Evidencia ≠ hecho ≠ inferencia ≠ decisión | Evitar alucinación operativa | Un único “dato” | Trazabilidad |
| ADR-014 | Queue sobre Postgres inicialmente | Simplicidad | Redis inmediato | Menos infraestructura |
| ADR-015 | No segundo agente completo antes del gate comercial | Evitar scope drift | Paralelizar agentes completos | Plataforma sí extensible |

## 14. Suposiciones

### SUPOSICIÓN PROPUESTA

- UI inicial en español; esquema preparado para i18n.
- Autenticación inicial con email/contraseña segura y opción posterior de SSO.
- Cadencia base: 0/3/7 días hábiles.
- Quiet hours por defecto: 20:00–08:00 hora local; configurable por país/canal.
- Un retry nunca genera un segundo envío si el provider ya aceptó el primer mensaje.
- El sistema prioriza modelos locales/económicos solo si superan el umbral de calidad para la tarea.
- El provider de IA se elige por task class, no por preferencia fija.
- Un modelo premium puede actuar como verificador cuando confianza < umbral.
- Los contactos profesionales son PII y deben tratarse como tal.
- El hosting final puede ser VPS/cloud, pero la primera versión debe correr localmente en Docker.
- El CRM propio es el registro primario de oportunidad, aunque pueda sincronizarse con otros CRMs en el futuro.

## 15. Contradicciones resueltas

1. **n8n vs aplicación propia**  
   Resuelto: n8n queda como infraestructura interna; la App propia es la interfaz de usuario.

2. **Local 24/7 vs cloud**  
   Resuelto: v1 local-first; arquitectura containerizada y migrable sin rediseño.

3. **OpenAI/Claude vs modelos chinos/locales**  
   Resuelto: no hay proveedor único; se implementa model router y benchmark.

4. **Autonomía amplia vs control comercial**  
   Resuelto: autonomía para operación; approval para precios modificados y compromisos vinculantes.

5. **Ventas de RRHH vs cargos objetivo**  
   Resuelto: los contactos se seleccionan dinámicamente según solución/uso; no se limita a departamentos de RRHH.

6. **Todos los canales vs no saturar**  
   Resuelto: canales amplios, pero una política global limita la cadencia y detiene la secuencia al existir interacción.

7. **Empresa única vs filiales/localidades**  
   Resuelto: jerarquía Company Group → Company Entity → Company Location.

## 16. Preguntas abiertas

### Bloqueantes

Ninguna para iniciar la ejecución del plan.

### No bloqueantes

- Proveedor exacto de email y WhatsApp.
- Método exacto de autenticación final (credenciales, Google Workspace, Microsoft).
- VPS/cloud futuro.
- Segundo agente funcional después del Agente Comercial.
- Cadencia final por país/canal después de medir respuesta.
- Umbrales exactos de score y confianza después de construir dataset de validación.
- Proveedor de voz, si se activa.
- ORM definitivo entre Prisma/Drizzle: resolver en PH02 por prueba corta de ergonomía/migración.

Estas decisiones usan defaults provisionales y no bloquean arquitectura.

## 17. Riesgos

| Riesgo | Probabilidad | Impacto | Señal temprana | Mitigación |
|---|---:|---:|---|---|
| Rate limit/CAPTCHA en búsqueda | Alta | Alta | 429, CAPTCHA, 0 resultados masivos | Backoff, batching, múltiples fuentes, health-aware retry |
| Falsos positivos de entidad | Media | Alta | Evidencia no coincide país/ciudad | Scoring de identidad + fuentes independientes |
| Outreach duplicado por retry | Media | Alta | Dos provider IDs para mismo touch | Idempotency key + send ledger |
| Saturación del prospecto | Media | Alta | Quejas/opt-outs | Max 3 toques + quiet hours + stop rules |
| IA inventa compromiso | Media | Alta | Respuesta fuera de policy | Policy engine + constrained generation + approval |
| Exposición de PII/secrets | Baja/Media | Crítica | logs con tokens/contactos | Encryption, redaction, least privilege |
| Dependencia de un modelo | Media | Media | provider outage degrada todo | Multi-provider router/fallback |
| Costos IA crecen | Media | Media | costo/reunión sube | budgets, model routing, caching, benchmarks |
| Deriva de workflows n8n | Alta | Media | cambios no versionados | export/versionado + tests |
| Usuario no técnico bloqueado | Media | Alta | requiere editar nodes | App propia + runbooks + defaults |
| Local PC se apaga | Media | Alta | jobs no ejecutados | autostart, health check, backup, migración VPS |
| DB corruption/pérdida | Baja | Crítica | backup inválido | backups verificados + restore drills |
| Datos empresariales obsoletos | Alta | Media | cargo/empresa cambió | freshness + revalidation |
| Scraping viola TOS | Media | Alta | bloqueo/carta/ban | priorizar APIs y fuentes permitidas |
| Computer Use frágil | Alta | Media | UI cambia | preferir API/Playwright + checkpoints |
| Scope crece a muchos agentes | Alta | Alta | tareas de otros agentes antes del gate | gate comercial obligatorio |
| Multi-país hardcoded accidental | Media | Alta | `if country == Ecuador` dispersos | linters/tests de configuración regional |

## 18. Estrategia de testing

### Unit tests
- normalización de empresa, país y ciudad;
- scoring;
- policy engine;
- approval decisions;
- cadence calculations;
- dedupe;
- price-book permissions;
- model routing.

### Integration tests
- DB + job queue;
- n8n callbacks;
- provider adapters;
- SearXNG;
- email/WhatsApp sandbox;
- calendar;
- Playwright.

### API tests
- auth;
- CRUD CRM;
- approvals;
- agent commands;
- audit.

### E2E
- empresa → evidencia → contacto → outreach → respuesta → reunión;
- búsqueda degradada → retry/fallback;
- descuento solicitado → approval;
- opt-out → stop inmediato.

### Security tests
- permisos por rol;
- secreto no expuesto;
- PII redaction;
- SSRF;
- SQL injection;
- XSS;
- CSRF cuando aplique;
- session expiry;
- brute force/rate limiting.

### Regression dataset

Construir casos que incluyan:
- nombres genéricos como “Empresa X”;
- ciudades ambiguas como San José;
- multinacional con mismo nombre en varios países;
- empresa inexistente;
- empresa con múltiples marcas;
- contacto que cambió de empresa;
- fuentes contradictorias;
- motores degradados;
- resultado vacío con provider healthy;
- resultado vacío con provider blocked.

### Performance
- 100 empresas/día.
- bursts de investigación.
- 1000+ jobs pendientes.
- múltiples conversations concurrentes.

### Manual QA
- experiencia no técnica;
- approvals;
- mensajes;
- dashboards;
- errores comprensibles.

## 19. Seguridad

- Autenticación robusta y sesiones seguras.
- RBAC + capability-based permissions.
- Least privilege para agentes.
- Secrets nunca en repositorio.
- Encryption at rest para contact points sensibles cuando sea razonable.
- TLS en remoto.
- Input validation por schema.
- Sanitización/encoding de output.
- SSRF protection en fetchers.
- Domain allow/deny policies para browser tools.
- Rate limiting en APIs internas y externas.
- Audit log append-only lógico.
- Redacción de secretos/PII en logs.
- Rotación de credenciales.
- Backups cifrados.
- Data retention configurable.
- Opt-out/suppression list central.
- Anti-brute-force.
- Dependabot/equivalente para dependencias.
- Image/file upload validation si se habilitan.
- Computer Use ejecutado en perfil/sandbox separado.
- Navegador con credenciales segregadas por herramienta.
- Acciones de alto riesgo no se ejecutan sin approval token válido.

## 20. DevOps, entornos y deployment

### Entornos

- `local-dev`
- `local-prod`
- `staging`
- `production`

### Local v1

Docker Compose:
- `rhia-web`
- `rhia-worker`
- `rhia-postgres`
- `rhia-n8n`
- `rhia-searxng`
- `rhia-ollama` opcional
- reverse proxy opcional según necesidad

### Requisitos

- compose versionado;
- `.env.example`;
- secretos fuera del repo;
- migrations automáticas controladas;
- health checks;
- restart policies;
- volúmenes persistentes;
- backup scripts;
- restore script;
- runbook de arranque/parada;
- seed mínimo.

### Cloud migration

Mantener interfaces y contenedores. Migración:
1. backup DB;
2. provisioning;
3. restore staging;
4. smoke test;
5. DNS/TLS;
6. ventana de corte;
7. sync final;
8. rollback disponible.

## 21. Observabilidad

### Métricas técnicas

- job success/failure rate;
- queue depth;
- retry count;
- latency por task;
- provider error rate;
- search health;
- browser failure rate;
- DB health;
- CPU/RAM/disk;
- backup age.

### Métricas IA

- costo por task class;
- costo por empresa;
- costo por oportunidad;
- costo por reunión;
- latency por provider/model;
- benchmark quality;
- fallback rate;
- hallucination/policy violation rate.

### Métricas comerciales

- empresas procesadas;
- empresas calificadas;
- contactos válidos;
- outreach enviados;
- delivery rate;
- response rate;
- positive response rate;
- meetings booked;
- meetings attended;
- qualified meetings booked;
- qualified meetings attended;
- conversión por país/ciudad/canal/mensaje/cargo/industria;
- tiempo medio hasta reunión.

### Alertas

- backup > 24h;
- search health degradada;
- provider outage;
- queue stalled;
- costo diario > budget;
- múltiples policy violations;
- delivery/bounce anómalo;
- opt-out spike.

## 22. Estrategia de migración

### Conservar

- PostgreSQL actual.
- `rhia_core`.
- `execution_registry`, migrándolo/extendiendo si procede.
- n8n.
- workflows que pasen auditoría.
- SearXNG.
- Docker/WSL como entorno inicial.

### Modificar

- workflows deben leer/escribir contratos del Core en lugar de almacenar lógica crítica aislada.
- búsqueda debe usar health-aware retry.
- ejecución debe registrar idempotency y audit.

### Reemplazar

Solo componentes que:
- no puedan versionarse;
- mezclen estado con UI;
- dupliquen reglas de negocio;
- no sean recuperables;
- impidan testing.

### Datos

- migraciones forward-only con backups.
- no borrar tablas existentes sin snapshot.
- tablas legacy se marcan deprecated antes de eliminarse.

### Rollback

- backup DB previo;
- rollback de app container;
- workflows versionados;
- feature flags para nuevas rutas.

## 23. Mapa de dependencias

```text
PH01 Baseline
  ↓
PH02 Arquitectura/Repo
  ↓
PH03 Datos/Permisos
  ↓
PH04 App/Core
  ↓
PH05 Runtime/IA
  ↓
PH06 Search/Evidence
  ↓
PH07 Comercial/CRM
  ↓
PH08 Outreach/Meetings
  ↓
PH09 Tools/Computer Use
  ↓
PH10 Security/Testing
  ↓
PH11 Observability/Deployment
  ↓
PH12 QA/Lanzamiento/Hardening
```

Paralelización controlada:
- UI skeleton puede avanzar con schemas mock una vez PH03 está congelado.
- AI adapters pueden desarrollarse en paralelo con search adapters después de PH05 contract freeze.
- observabilidad base puede iniciarse desde PH04 y completarse en PH11.

## 24. Fases

### PH01 — Auditoría y baseline

#### Context Packet

**Objetivo:** convertir el estado actual en un baseline reproducible sin modificar comportamiento.  
**Decisiones relevantes:** preservar Postgres, n8n, SearXNG y Docker; no reescribir por intuición.  
**Restricciones:** no perder workflows ni datos.  
**Riesgos:** repo no accesible; drift local.  
**No cambiar:** lógica funcional hasta capturar evidencia del estado actual.

##### PH01-T001 — Inventariar infraestructura actual

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Crear inventario verificable de contenedores, versiones, puertos, volúmenes, variables declaradas, redes y dependencias.

**Por qué existe**  
Sin baseline no existe rollback ni migración segura.

**Dependencias**  
N/A

**Puede ejecutarse en paralelo con**  
PH01-T002

**Contexto necesario**  
Entorno WSL/Docker actual y este Plan Maestro.

**Archivos o áreas afectadas**  
Docker, WSL, compose, configs.

**Acciones**
1. Listar contenedores y versiones.
2. Capturar compose efectivo.
3. Mapear volúmenes y redes.
4. Registrar health actual.
5. Identificar secretos sin copiarlos al documento.

**Entregable**  
Documento `docs/baseline/infrastructure.md`.

**Criterios de aceptación**
- [ ] Inventario reproduce todos los componentes conocidos.
- [ ] No contiene secretos.
- [ ] Puertos/volúmenes están documentados.

**Pruebas requeridas**
- Reinicio controlado en entorno de prueba.
- Health checks básicos.

**Errores que debe evitar**
- Modificar versiones mientras se audita.
- Copiar passwords/tokens.

**Validación final**  
Un agente distinto puede reconstruir el mapa del entorno usando el documento.

**Handoff**  
Entregar lista de componentes y riesgos a PH02.

##### PH01-T002 — Auditar PostgreSQL y datos existentes

**Rol recomendado**  
`DATABASE`

**Objetivo**  
Documentar schema, tablas, índices, constraints, tamaño y datos críticos sin alterarlos.

**Por qué existe**  
El plan debe preservar inversión existente y evitar migraciones destructivas.

**Dependencias**  
N/A

**Puede ejecutarse en paralelo con**  
PH01-T001

**Contexto necesario**  
`rhia_core` y especialmente `execution_registry`.

**Archivos o áreas afectadas**  
PostgreSQL schema.

**Acciones**
1. Exportar schema-only.
2. Inventariar tablas y relaciones.
3. Revisar índices.
4. Clasificar tablas en conservar/modificar/deprecar.
5. Tomar backup verificado.

**Entregable**  
`docs/baseline/database.md` + backup comprobado.

**Criterios de aceptación**
- [ ] Schema exportado.
- [ ] Backup restaurable en entorno de prueba.
- [ ] Cada tabla clasificada.

**Pruebas requeridas**
- Restore test.
- Checks de conteo por tabla.

**Errores que debe evitar**
- Hacer ALTER/DROP durante auditoría.
- Usar backup no verificado.

**Validación final**  
Restauración de prueba produce mismos conteos críticos.

**Handoff**  
Entregar gaps de modelo a PH03.

##### PH01-T003 — Auditar workflows n8n

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Exportar y clasificar todos los workflows, nodos críticos, credenciales referenciadas y dependencias.

**Por qué existe**  
Los workflows actuales son activos reutilizables y deben quedar versionados.

**Dependencias**  
PH01-T001

**Puede ejecutarse en paralelo con**  
PH01-T002

**Contexto necesario**  
Workflows actuales, incluyendo búsqueda de evidencia y diagnóstico.

**Archivos o áreas afectadas**  
n8n workflows.

**Acciones**
1. Exportar workflows JSON.
2. Nombrar/versionar.
3. Mapear inputs/outputs.
4. Identificar lógica de negocio embebida.
5. Clasificar LISTO/PARCIAL/REFACTORIZAR/ELIMINAR/DECISIÓN.

**Entregable**  
`docs/baseline/n8n.md` + exports versionables.

**Criterios de aceptación**
- [ ] Todos los workflows tienen estado.
- [ ] No se exponen credenciales.
- [ ] Inputs/outputs críticos descritos.

**Pruebas requeridas**
- Import test en instancia n8n vacía.
- Smoke test de workflows seguros.

**Errores que debe evitar**
- Editar nodos durante auditoría.
- Perder IDs o conexiones.

**Validación final**  
Exports importan correctamente sin credenciales.

**Handoff**  
Entregar lista de contratos que Core debe absorber.

##### PH01-T004 — Crear baseline funcional del Agente Comercial

**Rol recomendado**  
`QA`

**Objetivo**  
Definir un set de pruebas manuales reproducibles del flujo actual.

**Por qué existe**  
Necesitamos saber si una mejora rompe lo que ya funciona.

**Dependencias**  
PH01-T002, PH01-T003

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Casos actuales y bugs conocidos.

**Archivos o áreas afectadas**  
QA baseline.

**Acciones**
1. Crear casos empresa clara, ambigua, inexistente y motores degradados.
2. Registrar outputs esperados.
3. Incluir “Empresa X” y San José multigeografía.
4. Registrar tiempos/costos cuando estén disponibles.

**Entregable**  
`tests/baseline/commercial_cases.md`.

**Criterios de aceptación**
- [ ] Casos reproducibles.
- [ ] Expected results explícitos.
- [ ] Incluye fallos técnicos.

**Pruebas requeridas**
- Ejecutar baseline actual.
- Guardar evidencia.

**Errores que debe evitar**
- Usar solo happy path.
- Confundir no-result con no-existe.

**Validación final**  
Dos ejecuciones del mismo caso producen clasificación equivalente.

**Handoff**  
Dataset pasa a PH06 y PH10.

### PH02 — Decisiones técnicas y repositorio

#### Context Packet

**Objetivo:** establecer estructura de código, contratos y convenciones.  
**Restricción principal:** minimizar fricción operacional para un usuario no programador.  
**Estrategia:** un solo lenguaje principal (TypeScript) y pocos servicios.  
**No cambiar:** el dominio regional ni políticas comerciales.

##### PH02-T001 — Adoptar o crear repositorio fuente

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Establecer un repositorio versionado único para app, worker, schemas, migrations, docs y exports n8n.

**Por qué existe**  
Actualmente no existe un repo accesible desde esta sesión; sin repo no hay control de cambios.

**Dependencias**  
PH01-T001, PH01-T003

**Puede ejecutarse en paralelo con**  
PH02-T002

**Contexto necesario**  
Inventario de archivos actuales.

**Archivos o áreas afectadas**  
Repositorio.

**Acciones**
1. Buscar primero repositorio local existente.
2. Si existe, adoptarlo sin sobrescribir.
3. Si no existe, crear monorepo.
4. Agregar .gitignore y política de secrets.
5. Importar exports n8n y docs baseline.

**Entregable**  
Repositorio reproducible.

**Criterios de aceptación**
- [ ] No contiene secretos.
- [ ] README de arranque existe.
- [ ] Estructura documentada.

**Pruebas requeridas**
- Clone limpio.
- Boot de entorno dev.

**Errores que debe evitar**
- Crear repo nuevo ignorando código local existente.
- Commit de .env.

**Validación final**  
Clone limpio puede levantar servicios base.

**Handoff**  
SHA baseline se registra para todas las fases.

##### PH02-T002 — Fijar stack y convenciones

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Congelar stack v1 y convenciones para evitar decisiones repetidas.

**Por qué existe**  
Los agentes ejecutores necesitan reglas estables.

**Dependencias**  
PH01-T001

**Puede ejecutarse en paralelo con**  
PH02-T001

**Contexto necesario**  
Arquitectura objetivo de este plan.

**Archivos o áreas afectadas**  
ADR, linting, package manager.

**Acciones**
1. Seleccionar Node LTS soportado.
2. Usar TypeScript strict.
3. Elegir package manager.
4. Evaluar Prisma vs Drizzle con mini spike.
5. Fijar naming, error codes y schema validation.

**Entregable**  
`docs/architecture/stack.md` + ADR.

**Criterios de aceptación**
- [ ] Una sola opción elegida por categoría.
- [ ] Razones registradas.
- [ ] No introduce infraestructura innecesaria.

**Pruebas requeridas**
- Build mínimo.
- Migration dry-run.

**Errores que debe evitar**
- Elegir por moda.
- Introducir Redis/microservicios sin necesidad.

**Validación final**  
Reviewer puede explicar por qué cada componente existe.

**Handoff**  
Stack queda congelado para PH03-PH12 salvo ADR.

##### PH02-T003 — Definir contratos Core ↔ n8n ↔ Worker

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Especificar payloads versionados, estados, errores y callbacks.

**Por qué existe**  
Evita lógica implícita entre workflows.

**Dependencias**  
PH01-T003, PH02-T002

**Puede ejecutarse en paralelo con**  
PH02-T004

**Contexto necesario**  
Inputs/outputs de workflows.

**Archivos o áreas afectadas**  
schemas/contracts.

**Acciones**
1. Definir JobRequest/JobResult.
2. Definir ExecutionEvent.
3. Definir ToolCall/ToolResult.
4. Definir SearchResponse normalizada.
5. Definir ApprovalRequest.
6. Definir error taxonomy.

**Entregable**  
Schemas JSON/TypeScript documentados.

**Criterios de aceptación**
- [ ] Todos los contratos tienen version.
- [ ] Errores retryable/non-retryable distinguibles.
- [ ] No incluyen secretos.

**Pruebas requeridas**
- Contract tests.
- Schema validation negativa.

**Errores que debe evitar**
- Payloads libres sin schema.
- Cambios breaking silenciosos.

**Validación final**  
Todos los ejemplos validan contra schema.

**Handoff**  
Handoff a PH04-PH06.

##### PH02-T004 — Definir protocolo de configuración no técnica

**Rol recomendado**  
`PRODUCT`

**Objetivo**  
Conseguir que las decisiones operativas comunes se cambien por UI/config y no editando código.

**Por qué existe**  
Condición explícita del fundador: menor dolor posible para no programadores.

**Dependencias**  
PH02-T002

**Puede ejecutarse en paralelo con**  
PH02-T003

**Contexto necesario**  
Políticas de canales, cadencias, mercados, modelos.

**Archivos o áreas afectadas**  
Config schema + future admin UI.

**Acciones**
1. Clasificar configuración vs código.
2. Diseñar settings versionados.
3. Definir defaults seguros.
4. Definir validaciones y preview.
5. Definir qué cambios requieren restart.

**Entregable**  
`docs/architecture/configuration.md`.

**Criterios de aceptación**
- [ ] Cadencias, prioridades, budgets y providers son configurables.
- [ ] No se editan workflows para cambiar una regla comercial normal.

**Pruebas requeridas**
- Validation tests.
- Invalid config rejected.

**Errores que debe evitar**
- Exponer secretos en UI.
- Permitir config inválida.

**Validación final**  
Un operador puede entender qué se podrá configurar sin conocer n8n.

**Handoff**  
Handoff a PH04 admin UI.

### PH03 — Modelo de datos, permisos y políticas

#### Context Packet

**Objetivo:** convertir el modelo conceptual en schema migrable y políticas ejecutables.  
**Riesgo principal:** crear tablas simplistas que rompan multipaís/multiciudad.  
**No cambiar:** jerarquía Company Group → Entity → Location.

##### PH03-T001 — Implementar schema de dominio v1

**Rol recomendado**  
`DATABASE`

**Objetivo**  
Crear migrations para entidades definidas en sección 9.

**Por qué existe**  
El Core necesita persistencia estable antes de UI y agentes.

**Dependencias**  
PH02-T002, PH01-T002

**Puede ejecutarse en paralelo con**  
PH03-T002, PH03-T003

**Contexto necesario**  
Modelo de datos y schema existente.

**Archivos o áreas afectadas**  
db/schema, migrations.

**Acciones**
1. Mapear legacy a nuevo modelo.
2. Crear migrations aditivas.
3. Crear constraints/índices.
4. Agregar timestamps/audit refs.
5. Preparar seed mínimo.

**Entregable**  
Migrations v1.

**Criterios de aceptación**
- [ ] No pérdida de datos.
- [ ] Índices críticos presentes.
- [ ] País/ciudad no hardcoded.

**Pruebas requeridas**
- Migration up en copia.
- Restore/rollback strategy test.
- Constraint tests.

**Errores que debe evitar**
- DROP prematuro.
- Campos `country` libres sin código normalizado.

**Validación final**  
Migration reproducible desde backup baseline.

**Handoff**  
Handoff a Core.

##### PH03-T002 — Implementar RBAC y capability policies

**Rol recomendado**  
`SECURITY`

**Objetivo**  
Representar permisos humanos y de agentes.

**Por qué existe**  
Autonomía controlada es requisito central.

**Dependencias**  
PH03-T001

**Puede ejecutarse en paralelo con**  
PH03-T003

**Contexto necesario**  
Sección 10.

**Archivos o áreas afectadas**  
permissions/policies.

**Acciones**
1. Crear roles.
2. Crear capabilities.
3. Mapear actions sensibles.
4. Definir approval-required policies.
5. Definir service identities.

**Entregable**  
Policy model + seed.

**Criterios de aceptación**
- [ ] Agent no puede auto-elevar permisos.
- [ ] Cambio de precio siempre bloqueado.
- [ ] Commitment siempre bloqueado.

**Pruebas requeridas**
- Permission matrix tests.
- Negative authorization tests.

**Errores que debe evitar**
- Checks dispersos en UI solamente.
- Admin bypass no auditado.

**Validación final**  
Suite de permisos pasa desde API y worker.

**Handoff**  
Handoff a PH04/PH05.

##### PH03-T003 — Implementar policy de outreach

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Formalizar max 3 toques, quiet hours, stop rules y suppression.

**Por qué existe**  
Evita saturación y duplicados.

**Dependencias**  
PH03-T001, PH03-T002

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Cadencia y canales definidos.

**Archivos o áreas afectadas**  
outreach policy.

**Acciones**
1. Crear policy versionada.
2. Implementar cálculo de next touch.
3. Añadir stop conditions.
4. Crear suppression list.
5. Permitir override aprobado.

**Entregable**  
OutreachPolicy v1.

**Criterios de aceptación**
- [ ] Nunca >3 toques por default.
- [ ] No envía fuera de ventana.
- [ ] Respuesta/opt-out detiene secuencia.

**Pruebas requeridas**
- Timezone tests.
- Retry duplicate test.
- Opt-out test.

**Errores que debe evitar**
- Contar retries como nuevos toques.
- Usar timezone del servidor.

**Validación final**  
Simulación de 100 secuencias no viola reglas.

**Handoff**  
Handoff a PH08.

##### PH03-T004 — Definir taxonomy de estado y errores

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Crear estados únicos para jobs, evidence, opportunities, messages y meetings.

**Por qué existe**  
Los workflows deben razonar sobre estados consistentes.

**Dependencias**  
PH02-T003, PH03-T001

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Flujos críticos.

**Archivos o áreas afectadas**  
domain enums/error catalog.

**Acciones**
1. Definir state machines.
2. Definir transitions permitidas.
3. Definir error codes.
4. Clasificar retryable.
5. Documentar terminal states.

**Entregable**  
`docs/domain/state-machines.md`.

**Criterios de aceptación**
- [ ] No hay estados ambiguos.
- [ ] Transiciones inválidas fallan.
- [ ] Search degradation tiene código propio.

**Pruebas requeridas**
- Transition unit tests.
- Retry classification tests.

**Errores que debe evitar**
- Strings libres.
- Usar `error=true` sin categoría.

**Validación final**  
Diagramas y tests coinciden.

**Handoff**  
Handoff a todas las fases.

### PH04 — RHIA Core y App

#### Context Packet

**Objetivo:** construir la interfaz y API propias sin meter lógica crítica en componentes UI.  
**UX:** español, simple, orientado a operaciones.  
**No cambiar:** n8n sigue interno.

##### PH04-T001 — Construir Core API y service layer

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Exponer operaciones de dominio con validación, permisos y audit.

**Por qué existe**  
Será el punto estable entre App, workers y n8n.

**Dependencias**  
PH03-T001, PH03-T002, PH03-T004

**Puede ejecutarse en paralelo con**  
PH04-T002

**Contexto necesario**  
Contracts y schema.

**Archivos o áreas afectadas**  
app/api, services.

**Acciones**
1. Crear módulos companies, contacts, opportunities, jobs, approvals.
2. Validar schemas.
3. Aplicar RBAC.
4. Emitir audit events.
5. Agregar idempotency en writes sensibles.

**Entregable**  
Core API v1.

**Criterios de aceptación**
- [ ] Endpoints versionados.
- [ ] Errores normalizados.
- [ ] Audit por write.

**Pruebas requeridas**
- API integration tests.
- Auth negative tests.

**Errores que debe evitar**
- SQL directo desde UI.
- Business logic duplicada.

**Validación final**  
Contract suite pasa.

**Handoff**  
Handoff a UI y Runtime.

##### PH04-T002 — Implementar autenticación y sesiones

**Rol recomendado**  
`SECURITY`

**Objetivo**  
Permitir acceso seguro del equipo interno.

**Por qué existe**  
App propia requiere identidad y permisos.

**Dependencias**  
PH03-T002, PH04-T001

**Puede ejecutarse en paralelo con**  
PH04-T003

**Contexto necesario**  
RBAC.

**Archivos o áreas afectadas**  
auth.

**Acciones**
1. Elegir librería madura compatible con stack.
2. Implementar login/logout/session expiry.
3. Bootstrap admin.
4. Rate limit login.
5. Audit login events.

**Entregable**  
Auth v1.

**Criterios de aceptación**
- [ ] Passwords hasheadas con algoritmo fuerte.
- [ ] Session expiry funciona.
- [ ] Roles se cargan desde Core.

**Pruebas requeridas**
- Login brute-force test.
- Session expiry test.
- Privilege escalation test.

**Errores que debe evitar**
- Auth casera incompleta.
- Tokens en localStorage si no es necesario.

**Validación final**  
Security reviewer aprueba threat checklist.

**Handoff**  
Handoff a UI.

##### PH04-T003 — Construir shell y navegación de RHIA App

**Rol recomendado**  
`FRONTEND`

**Objetivo**  
Crear interfaz base usable sin editar n8n.

**Por qué existe**  
Condición principal de adopción.

**Dependencias**  
PH04-T001, PH04-T002

**Puede ejecutarse en paralelo con**  
PH04-T004

**Contexto necesario**  
Casos de uso.

**Archivos o áreas afectadas**  
web UI.

**Acciones**
1. Crear dashboard.
2. Navegación Agents/Companies/Contacts/Opportunities/Meetings/Jobs/Approvals/Settings.
3. Loading/error/empty states.
4. Responsive básico.
5. Permisos visuales.

**Entregable**  
App shell.

**Criterios de aceptación**
- [ ] Usuario puede navegar sin conocimiento técnico.
- [ ] Errores explican siguiente acción.
- [ ] No muestra controles sin permiso.

**Pruebas requeridas**
- Component tests.
- E2E navigation.

**Errores que debe evitar**
- Exponer IDs técnicos innecesarios.
- Depender de n8n UI.

**Validación final**  
Operador no técnico completa navegación guiada.

**Handoff**  
Handoff a CRM UI.

##### PH04-T004 — Construir centro de jobs y approvals

**Rol recomendado**  
`FRONTEND`

**Objetivo**  
Dar visibilidad y control a ejecuciones y acciones sensibles.

**Por qué existe**  
Autonomía sin control visible es inaceptable.

**Dependencias**  
PH04-T001, PH04-T003

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Jobs/actions/approvals.

**Archivos o áreas afectadas**  
web UI + API.

**Acciones**
1. Vista de jobs.
2. Filtros por estado/agente.
3. Retry/cancel seguro.
4. Detalle de trazas resumidas.
5. Inbox de approvals con approve/reject/reason.

**Entregable**  
Operations Center.

**Criterios de aceptación**
- [ ] Manager ve por qué se pide approval.
- [ ] Retry respeta idempotency.
- [ ] Cancel evita nuevos pasos.

**Pruebas requeridas**
- E2E approval.
- Retry duplicate test.

**Errores que debe evitar**
- Aprobar sin contexto.
- Retry desde UI saltándose policies.

**Validación final**  
Demo: solicitud de descuento queda bloqueada hasta aprobación.

**Handoff**  
Handoff a PH05/PH08.

### PH05 — Runtime de agentes y AI Gateway

#### Context Packet

**Objetivo:** construir cerebros intercambiables y un runtime que no pierda estado.  
**Principio:** costo × calidad × latencia × privacidad, medidos por tarea.

##### PH05-T001 — Implementar Agent Runtime

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Ejecutar jobs por pasos con estado persistente, retries y reanudación.

**Por qué existe**  
RHIA debe continuar después de fallos sin depender de memoria del modelo.

**Dependencias**  
PH04-T001, PH03-T004

**Puede ejecutarse en paralelo con**  
PH05-T002

**Contexto necesario**  
Job/execution/action contracts.

**Archivos o áreas afectadas**  
worker/runtime.

**Acciones**
1. Claim de jobs.
2. Step execution.
3. Persistir checkpoints.
4. Retries con backoff.
5. Cancellation.
6. Dead-letter state.

**Entregable**  
Runtime v1.

**Criterios de aceptación**
- [ ] Crash no pierde job.
- [ ] Mismo idempotency key no duplica action.
- [ ] Retries limitados.

**Pruebas requeridas**
- Kill worker mid-job.
- Concurrency test.
- Retry test.

**Errores que debe evitar**
- Estado solo en RAM.
- Retry infinito.

**Validación final**  
Reiniciar worker y continuar job pendiente.

**Handoff**  
Handoff al AI gateway/tools.

##### PH05-T002 — Construir AI Gateway provider-agnostic

**Rol recomendado**  
`AI`

**Objetivo**  
Unificar invocaciones a OpenAI, Anthropic, DeepSeek, Qwen y Ollama.

**Por qué existe**  
Evita vendor lock-in.

**Dependencias**  
PH05-T001

**Puede ejecutarse en paralelo con**  
PH05-T003

**Contexto necesario**  
Providers requeridos.

**Archivos o áreas afectadas**  
ai/providers.

**Acciones**
1. Definir interface.
2. Crear adapters.
3. Normalizar tool calls/JSON.
4. Normalizar usage/cost.
5. Implementar timeouts/fallback.

**Entregable**  
AI Gateway v1.

**Criterios de aceptación**
- [ ] Todos los providers devuelven response normalizada.
- [ ] Errores comparables.
- [ ] Secrets segregados.

**Pruebas requeridas**
- Provider sandbox tests.
- Timeout/fallback tests.

**Errores que debe evitar**
- Business logic dentro de adapter.
- Assume todos soportan mismas features.

**Validación final**  
Una task de prueba corre con al menos 3 providers sin cambiar código de dominio.

**Handoff**  
Handoff a router.

##### PH05-T003 — Implementar Model Router y budgets

**Rol recomendado**  
`AI`

**Objetivo**  
Elegir modelo por task class usando calidad, costo, latencia, disponibilidad y privacidad.

**Por qué existe**  
El objetivo es eficiencia de costos y resultados.

**Dependencias**  
PH05-T002

**Puede ejecutarse en paralelo con**  
PH05-T004

**Contexto necesario**  
Model profiles.

**Archivos o áreas afectadas**  
ai/router.

**Acciones**
1. Definir task classes.
2. Definir quality thresholds.
3. Budget diario/mensual.
4. Fallback chain.
5. Escalation a premium cuando confianza baja.

**Entregable**  
Router v1.

**Criterios de aceptación**
- [ ] No excede budget sin policy.
- [ ] Fallback funciona.
- [ ] Provider no está hardcoded en agentes.

**Pruebas requeridas**
- Budget test.
- Provider outage.
- Low-confidence escalation.

**Errores que debe evitar**
- Elegir solo por precio.
- Usar modelo premium para todo.

**Validación final**  
Reporte muestra por qué se eligió modelo.

**Handoff**  
Handoff a benchmark.

##### PH05-T004 — Crear benchmark RHIA de modelos

**Rol recomendado**  
`AI`

**Objetivo**  
Medir modelos con tareas reales del dominio.

**Por qué existe**  
Las decisiones de IA deben basarse en datos propios.

**Dependencias**  
PH01-T004, PH05-T002, PH05-T003

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Dataset comercial baseline.

**Archivos o áreas afectadas**  
benchmarks.

**Acciones**
1. Crear dataset versionado.
2. Definir métricas por task.
3. Ejecutar modelos candidatos.
4. Registrar calidad/costo/latencia.
5. Actualizar model_profile.

**Entregable**  
Benchmark v1.

**Criterios de aceptación**
- [ ] Dataset no contiene secretos.
- [ ] Resultados reproducibles.
- [ ] Incluye entity resolution, classification, drafting y tool selection.

**Pruebas requeridas**
- Re-run subset.
- Human-reviewed gold labels.

**Errores que debe evitar**
- Benchmark genérico ajeno a RHIA.
- Medir solo exactitud sin costo.

**Validación final**  
Router consume resultados del benchmark.

**Handoff**  
Handoff a PH06-PH08.

### PH06 — Search, evidencia y resolución de identidad

#### Context Packet

**Objetivo:** convertir la búsqueda actual en un subsistema confiable.  
**Regla crítica:** salud técnica y evidencia son dimensiones distintas.

##### PH06-T001 — Estabilizar SearXNG y health diagnostics

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Corregir batching, extracción de dominios, rate-limit detection y health status.

**Por qué existe**  
El flujo actual está degradado y puede producir falsos negativos.

**Dependencias**  
PH01-T003, PH03-T004, PH05-T001

**Puede ejecutarse en paralelo con**  
PH06-T002

**Contexto necesario**  
Workflow actual de búsqueda.

**Archivos o áreas afectadas**  
n8n/search + search adapter.

**Acciones**
1. Verificar batching 1/3000ms.
2. Corregir domain parser.
3. Distinguir 429/CAPTCHA/down.
4. Crear health score por engine.
5. Persistir health events.

**Entregable**  
Search Health v2.

**Criterios de aceptación**
- [ ] 20 URLs producen dominios >0.
- [ ] 429 genera RETRY_BACKOFF.
- [ ] Healthy no-results genera REFORMULATE.

**Pruebas requeridas**
- Reproducir dataset Empresa X.
- Simular 429/CAPTCHA.

**Errores que debe evitar**
- Reformular ante rate limit.
- Asumir SearXNG healthy por HTTP 200.

**Validación final**  
Dashboard muestra degradación y acción correcta.

**Handoff**  
Handoff a search orchestrator.

##### PH06-T002 — Construir Search Orchestrator multi-fuente

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Coordinar SearXNG y futuras fuentes con dedupe, rate limits y fallback.

**Por qué existe**  
Una sola fuente no es suficiente para calidad regional.

**Dependencias**  
PH06-T001, PH02-T003

**Puede ejecutarse en paralelo con**  
PH06-T003

**Contexto necesario**  
SearchResponse contract.

**Archivos o áreas afectadas**  
search service.

**Acciones**
1. Crear adapter interface.
2. Implementar SearXNG adapter.
3. Dedupe URLs/results.
4. Source fallback.
5. Per-source quotas/backoff.

**Entregable**  
Search service v1.

**Criterios de aceptación**
- [ ] Una fuente caída no aborta todo.
- [ ] Results mantienen provenance.
- [ ] No duplica URL canonical.

**Pruebas requeridas**
- Source outage.
- Duplicate URL.
- Timeout.

**Errores que debe evitar**
- Fusionar resultados sin source.
- Retries simultáneos agresivos.

**Validación final**  
Search test matrix pasa.

**Handoff**  
Handoff evidence pipeline.

##### PH06-T003 — Implementar Evidence Pipeline

**Rol recomendado**  
`AI`

**Objetivo**  
Transformar resultados web en evidencia normalizada y trazable.

**Por qué existe**  
Necesitamos separar evidencia de hechos e inferencias.

**Dependencias**  
PH06-T002, PH03-T001

**Puede ejecutarse en paralelo con**  
PH06-T004

**Contexto necesario**  
Evidence schema.

**Archivos o áreas afectadas**  
evidence service.

**Acciones**
1. Canonicalizar URL.
2. Hash excerpt.
3. Clasificar source reliability.
4. Extraer claims.
5. Guardar freshness.
6. Relacionar evidence→fact.

**Entregable**  
Evidence v1.

**Criterios de aceptación**
- [ ] Cada fact importante tiene supporting evidence.
- [ ] Duplicados colapsan.
- [ ] Fecha/fuente preservadas.

**Pruebas requeridas**
- Duplicate evidence.
- Contradictory evidence.
- Stale evidence.

**Errores que debe evitar**
- Guardar texto entero sin necesidad.
- Promover inferencia a fact sin support.

**Validación final**  
Expediente muestra de dónde sale cada dato.

**Handoff**  
Handoff entity resolution.

##### PH06-T004 — Resolver Company Group/Entity/Location

**Rol recomendado**  
`AI`

**Objetivo**  
Determinar identidad jerárquica con confidence y conflictos explícitos.

**Por qué existe**  
Es núcleo de la arquitectura regional.

**Dependencias**  
PH06-T003, PH05-T004

**Puede ejecutarse en paralelo con**  
PH06-T005

**Contexto necesario**  
Company hierarchy.

**Archivos o áreas afectadas**  
entity resolution.

**Acciones**
1. Normalizar nombre.
2. Usar legal identifiers cuando existan.
3. Resolver país/ciudad.
4. Detectar parent/subsidiary/operator.
5. Calcular confidence.
6. Escalar ambigüedad.

**Entregable**  
Entity Resolver v1.

**Criterios de aceptación**
- [ ] No mezcla San José CR/US/Belize.
- [ ] Multinacional conserva grupo común.
- [ ] Confidence bajo no auto-confirma.

**Pruebas requeridas**
- Ambiguous city.
- Same name different company.
- Subsidiary test.

**Errores que debe evitar**
- Resolver por string similarity solamente.
- Forzar un país.

**Validación final**  
Gold dataset supera umbral acordado antes de release.

**Handoff**  
Handoff CRM enrichment.

##### PH06-T005 — Implementar dedupe y cache de investigación

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Evitar re-ejecutar trabajo ya válido.

**Por qué existe**  
Reduce costos y carga externa.

**Dependencias**  
PH06-T003, PH06-T004

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Freshness and execution registry.

**Archivos o áreas afectadas**  
cache/dedupe.

**Acciones**
1. Definir cache keys.
2. TTL por claim/source.
3. Reuse evidence.
4. Invalidation.
5. Record cache hit.

**Entregable**  
Research cache v1.

**Criterios de aceptación**
- [ ] Misma empresa no repite búsquedas frescas.
- [ ] Datos stale se revalidan.
- [ ] Cache hit auditable.

**Pruebas requeridas**
- Repeated job.
- TTL expiry.
- Manual invalidate.

**Errores que debe evitar**
- Cache eterno.
- Cache por nombre sin país/entidad.

**Validación final**  
Dos jobs iguales muestran ahorro medible.

**Handoff**  
Handoff a cost dashboard.

### PH07 — CRM, contactos y scoring comercial

#### Context Packet

**Objetivo:** convertir empresas válidas en oportunidades accionables.  
**Regla:** cargos objetivo dinámicos; soluciones pueden aplicarse a todas las posiciones de una organización.

##### PH07-T001 — Construir CRM propio

**Rol recomendado**  
`FRONTEND`

**Objetivo**  
Implementar companies, contacts, opportunities, activities y timeline.

**Por qué existe**  
El CRM será la interfaz operacional principal.

**Dependencias**  
PH04-T003, PH06-T004

**Puede ejecutarse en paralelo con**  
PH07-T002

**Contexto necesario**  
Modelo CRM.

**Archivos o áreas afectadas**  
CRM API/UI.

**Acciones**
1. Company 360.
2. Opportunity board.
3. Contact view.
4. Timeline unificada.
5. Search/filter por país/ciudad.

**Entregable**  
CRM v1.

**Criterios de aceptación**
- [ ] Expediente regional visible.
- [ ] Historial único.
- [ ] No duplica empresas por ciudad.

**Pruebas requeridas**
- E2E company→opportunity.
- Permission tests.

**Errores que debe evitar**
- Tabla plana de empresas.
- País/city filters hardcoded.

**Validación final**  
Operador gestiona una oportunidad completa sin n8n.

**Handoff**  
Handoff contact discovery.

##### PH07-T002 — Implementar Contact Discovery dinámico

**Rol recomendado**  
`AI`

**Objetivo**  
Encontrar roles compradores/influenciadores según solución y contexto.

**Por qué existe**  
Las soluciones pueden impactar toda la organización; no limitar a RRHH.

**Dependencias**  
PH07-T001, PH06-T003, PH05-T004

**Puede ejecutarse en paralelo con**  
PH07-T003

**Contexto necesario**  
Contacts model and product catalog.

**Archivos o áreas afectadas**  
contact discovery.

**Acciones**
1. Derivar personas objetivo por use case.
2. Buscar candidatos.
3. Resolver identidad personal.
4. Vincular company/entity.
5. Guardar provenance.

**Entregable**  
Contact Discovery v1.

**Criterios de aceptación**
- [ ] Puede priorizar RRHH, gerencia, operaciones u otras áreas según caso.
- [ ] No crea contacto sin company linkage.

**Pruebas requeridas**
- Cross-role tests.
- Stale title test.

**Errores que debe evitar**
- Lista rígida global de cargos.
- Asumir que todo buyer es RRHH.

**Validación final**  
Casos gold producen contactos razonables.

**Handoff**  
Handoff validation.

##### PH07-T003 — Validar puntos de contacto

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Estimar vigencia y calidad de email/WhatsApp/otros puntos.

**Por qué existe**  
Outreach sin validación incrementa bounces y riesgo.

**Dependencias**  
PH07-T002

**Puede ejecutarse en paralelo con**  
PH07-T004

**Contexto necesario**  
contact_point schema.

**Archivos o áreas afectadas**  
validation service.

**Acciones**
1. Normalizar.
2. Dedup hash.
3. Validar formato.
4. Usar validators/provider cuando se configure.
5. Marcar confidence/freshness.

**Entregable**  
Contact Validation v1.

**Criterios de aceptación**
- [ ] No envía a INVALID.
- [ ] Unknown no se presenta como verified.
- [ ] PII protegida.

**Pruebas requeridas**
- Invalid email.
- Duplicate phone.
- Stale validation.

**Errores que debe evitar**
- Guardar secretos en logs.
- Inventar emails sin marcar inferidos.

**Validación final**  
Contact view muestra estado y fuente.

**Handoff**  
Handoff scoring/outreach.

##### PH07-T004 — Implementar Opportunity Scoring

**Rol recomendado**  
`PRODUCT`

**Objetivo**  
Priorizar oportunidades por fit, señal, contactabilidad, timing, país/ciudad y evidencia.

**Por qué existe**  
El sistema debe asignar esfuerzo donde hay mayor probabilidad de reunión.

**Dependencias**  
PH07-T001, PH07-T003

**Puede ejecutarse en paralelo con**  
PH07-T005

**Contexto necesario**  
Prioridad Ecuador #1, Perú #2; sin excluir otros mercados.

**Archivos o áreas afectadas**  
scoring.

**Acciones**
1. Definir componentes.
2. Configurar pesos.
3. Agregar country/city priority.
4. No bloquear mercados.
5. Versionar score.
6. Explicar score.

**Entregable**  
Scoring v1.

**Criterios de aceptación**
- [ ] Ecuador y Perú reciben prioridad relativa configurable.
- [ ] Otros países siguen elegibles.
- [ ] Score explicable.

**Pruebas requeridas**
- Cross-country test.
- No evidence test.
- Score versioning.

**Errores que debe evitar**
- Hardcode if/else por país.
- Score opaco de IA.

**Validación final**  
100 oportunidades pueden ordenarse y explicar top 10.

**Handoff**  
Handoff campaign engine.

##### PH07-T005 — Crear Next Best Action

**Rol recomendado**  
`AI`

**Objetivo**  
Decidir investigación adicional, contacto, espera, revalidación o descarte operativo.

**Por qué existe**  
Scoring sin acción no genera reuniones.

**Dependencias**  
PH07-T004, PH05-T003

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Opportunity state.

**Archivos o áreas afectadas**  
decision engine.

**Acciones**
1. Definir action catalog.
2. Aplicar policy.
3. Usar model solo cuando rule engine no baste.
4. Persist rationale.
5. Programar next_action_at.

**Entregable**  
NBA v1.

**Criterios de aceptación**
- [ ] Cada oportunidad activa tiene next action o reason.
- [ ] Acciones sensibles generan approval.

**Pruebas requeridas**
- Low score.
- Missing contact.
- Reply pending.

**Errores que debe evitar**
- Modelo inventando acciones fuera de catálogo.
- Oportunidad sin siguiente acción.

**Validación final**  
Dashboard no muestra oportunidades huérfanas.

**Handoff**  
Handoff PH08.

### PH08 — Outreach, conversación y reuniones

#### Context Packet

**Objetivo:** transformar oportunidades en reuniones sin saturar ni asumir compromisos no autorizados.  
**KPI:** qualified booked y effective attended.

##### PH08-T001 — Construir Channel Gateway

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Unificar email, WhatsApp, LinkedIn, formularios, chat y redes mediante adapters.

**Por qué existe**  
Los agentes no deben depender de proveedores específicos.

**Dependencias**  
PH03-T003, PH05-T001, PH07-T003

**Puede ejecutarse en paralelo con**  
PH08-T002

**Contexto necesario**  
Channel contract.

**Archivos o áreas afectadas**  
channels.

**Acciones**
1. Definir send/status/inbound contract.
2. Implementar primero proveedores disponibles.
3. Idempotency key.
4. Delivery callbacks.
5. Error normalization.

**Entregable**  
Channel Gateway v1.

**Criterios de aceptación**
- [ ] Provider ack registrado.
- [ ] Retry no duplica.
- [ ] Delivery status normalizado.

**Pruebas requeridas**
- Duplicate retry.
- Provider timeout.
- Webhook duplicate.

**Errores que debe evitar**
- Enviar directamente desde n8n sin ledger.
- Ignorar provider IDs.

**Validación final**  
Sandbox demuestra exactly-once lógico.

**Handoff**  
Handoff sequence engine.

##### PH08-T002 — Implementar Sequence Engine

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Planificar máximo 3 toques respetando horario, canal y stop rules.

**Por qué existe**  
Evita saturación y automatiza seguimiento.

**Dependencias**  
PH08-T001, PH03-T003

**Puede ejecutarse en paralelo con**  
PH08-T003

**Contexto necesario**  
OutreachPolicy.

**Archivos o áreas afectadas**  
sequence engine.

**Acciones**
1. Crear touch plan.
2. Cadencia 0/3/7 default.
3. Channel mix.
4. Stop on reply/meeting/opt-out.
5. Reschedule por feriados/ventanas si se configura.

**Entregable**  
Sequence Engine v1.

**Criterios de aceptación**
- [ ] Nunca supera max_touches.
- [ ] No contacta después de stop.
- [ ] Timezone correcto.

**Pruebas requeridas**
- 3-touch boundary.
- Mid-sequence reply.
- Opt-out.

**Errores que debe evitar**
- Crear secuencia nueva para evadir límite.
- Horario del servidor.

**Validación final**  
Simulación multi-país no viola policy.

**Handoff**  
Handoff content/conversation.

##### PH08-T003 — Implementar generación y revisión de mensajes

**Rol recomendado**  
`AI`

**Objetivo**  
Crear mensajes personalizados basados en evidencia y contexto sin inventar claims.

**Por qué existe**  
Mejora respuesta conservando control.

**Dependencias**  
PH08-T002, PH06-T003, PH05-T004

**Puede ejecutarse en paralelo con**  
PH08-T004

**Contexto necesario**  
Facts/inferences/policies.

**Archivos o áreas afectadas**  
messaging AI.

**Acciones**
1. Construir context pack.
2. Separar facts de inferences.
3. Generar por canal.
4. Policy lint.
5. Versionar templates/prompts.

**Entregable**  
Messaging v1.

**Criterios de aceptación**
- [ ] No afirma dato sin soporte.
- [ ] No ofrece descuento.
- [ ] Tono por canal.

**Pruebas requeridas**
- Hallucinated claim test.
- Price test.
- Opt-out language.

**Errores que debe evitar**
- Copiar exceso de contenido fuente.
- Inventar urgencia falsa.

**Validación final**  
Reviewer humano aprueba gold set.

**Handoff**  
Handoff conversation agent.

##### PH08-T004 — Construir Conversation Agent

**Rol recomendado**  
`AI`

**Objetivo**  
Gestionar respuestas entrantes y continuar diálogo hasta reunión o escalación.

**Por qué existe**  
El usuario pidió seguimiento automático.

**Dependencias**  
PH08-T003, PH04-T004

**Puede ejecutarse en paralelo con**  
PH08-T005

**Contexto necesario**  
Policies comerciales y price book.

**Archivos o áreas afectadas**  
conversation runtime.

**Acciones**
1. Classify intent.
2. Retrieve context.
3. Responder preguntas permitidas.
4. Comunicar precio oficial.
5. Escalar descuento/commitment.
6. Detect meeting intent.

**Entregable**  
Conversation Agent v1.

**Criterios de aceptación**
- [ ] Descuento crea approval.
- [ ] Precio oficial activo puede comunicarse.
- [ ] Commitment no aprobado se bloquea.

**Pruebas requeridas**
- Discount request.
- Contract term request.
- General product question.
- Hostile/opt-out.

**Errores que debe evitar**
- Responder con precio stale.
- Asumir compromiso.

**Validación final**  
Scripted E2E de objeciones pasa.

**Handoff**  
Handoff scheduling.

##### PH08-T005 — Implementar Meeting Scheduler y KPI

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Agendar, confirmar y medir reuniones.

**Por qué existe**  
El criterio de éxito es conseguir reuniones efectivas.

**Dependencias**  
PH08-T004

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Calendar adapter + meeting schema.

**Archivos o áreas afectadas**  
calendar/meetings.

**Acciones**
1. Consultar disponibilidad.
2. Proponer slots.
3. Crear event.
4. Registrar status.
5. Capturar attended/qualification.
6. Dashboard KPI.

**Entregable**  
Meeting module v1.

**Criterios de aceptación**
- [ ] Booked y attended separados.
- [ ] Effective = attended+qualified.
- [ ] Timezone correcto.

**Pruebas requeridas**
- Double booking.
- Reschedule.
- No-show.
- Calendar provider outage.

**Errores que debe evitar**
- Contar booked como attended.
- Perder timezone.

**Validación final**  
Dashboard muestra funnel hasta effective meeting.

**Handoff**  
Handoff release metrics.

### PH09 — Tools, Playwright y Computer Use

#### Context Packet

**Objetivo:** permitir a agentes operar herramientas externas con control, seguridad y evidencia.  
**Orden:** API → Playwright → Computer Use.

##### PH09-T001 — Crear Tool Registry

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Registrar herramientas, capabilities, risk level, credentials y health.

**Por qué existe**  
Permite extensibilidad sin lógica ad-hoc.

**Dependencias**  
PH03-T002, PH05-T001

**Puede ejecutarse en paralelo con**  
PH09-T002

**Contexto necesario**  
Capability model.

**Archivos o áreas afectadas**  
tools registry.

**Acciones**
1. Definir tool manifest.
2. Registrar capabilities.
3. Mapear credentials refs.
4. Health check.
5. Allowed domains/actions.

**Entregable**  
Tool Registry v1.

**Criterios de aceptación**
- [ ] Agent solo ve tools permitidas.
- [ ] Cada tool tiene owner y risk.

**Pruebas requeridas**
- Unauthorized tool.
- Tool down.

**Errores que debe evitar**
- Pasar credenciales en prompt.
- Tools sin policy.

**Validación final**  
Runtime rechaza tool fuera de capability.

**Handoff**  
Handoff API/Browser adapters.

##### PH09-T002 — Implementar Playwright Worker

**Rol recomendado**  
`BACKEND`

**Objetivo**  
Automatizar interfaces deterministas con pasos verificables.

**Por qué existe**  
Más confiable y barato que Computer Use cuando DOM es estable.

**Dependencias**  
PH09-T001

**Puede ejecutarse en paralelo con**  
PH09-T003

**Contexto necesario**  
Browser security policy.

**Archivos o áreas afectadas**  
browser worker.

**Acciones**
1. Perfiles aislados.
2. Selectors robustos.
3. Screenshots en fallo.
4. Timeouts.
5. Checkpoints.
6. Domain allowlist.

**Entregable**  
Playwright Worker v1.

**Criterios de aceptación**
- [ ] Fallos capturan evidencia.
- [ ] Credenciales no se loguean.
- [ ] Retry seguro.

**Pruebas requeridas**
- UI changed.
- Timeout.
- Login expired.

**Errores que debe evitar**
- Selectors frágiles por texto únicamente.
- Compartir sesión sin aislamiento.

**Validación final**  
Scenario test completa una tarea sandbox.

**Handoff**  
Handoff Computer Use fallback.

##### PH09-T003 — Integrar Computer Use Adapter

**Rol recomendado**  
`AI`

**Objetivo**  
Ejecutar tareas visuales no deterministas cuando API/Playwright no bastan.

**Por qué existe**  
Necesario para herramientas repetitivas complejas.

**Dependencias**  
PH09-T001, PH09-T002, PH05-T002

**Puede ejecutarse en paralelo con**  
PH09-T004

**Contexto necesario**  
Approval/risk model.

**Archivos o áreas afectadas**  
computer-use adapter.

**Acciones**
1. Definir provider-neutral interface.
2. Sandbox browser.
3. Capture actions.
4. Step limits.
5. Risk checkpoints.
6. Fallback humano.

**Entregable**  
Computer Use v1.

**Criterios de aceptación**
- [ ] No accede dominios no autorizados.
- [ ] High-risk action requiere approval.
- [ ] Session trace auditable.

**Pruebas requeridas**
- Unexpected modal.
- Wrong page.
- Sensitive action.

**Errores que debe evitar**
- Control ilimitado del escritorio.
- Ocultar acciones.

**Validación final**  
Replay/trace permite entender lo realizado.

**Handoff**  
Handoff skills.

##### PH09-T004 — Crear Skill Library

**Rol recomendado**  
`ARCHITECT`

**Objetivo**  
Empaquetar procedimientos reutilizables por herramienta.

**Por qué existe**  
Permite enseñar procesos una vez y reutilizarlos.

**Dependencias**  
PH09-T002, PH09-T003

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Tool contracts.

**Archivos o áreas afectadas**  
skills.

**Acciones**
1. Definir skill manifest.
2. Inputs/outputs.
3. Preconditions.
4. Validation.
5. Versioning.
6. Rollback/fallback.

**Entregable**  
Skill Library v1.

**Criterios de aceptación**
- [ ] Skill versionado.
- [ ] No mezcla secretos.
- [ ] Validation final obligatoria.

**Pruebas requeridas**
- Skill stale.
- Missing precondition.
- Tool UI changed.

**Errores que debe evitar**
- Procedimientos solo en prompts largos.
- Cambios sin versión.

**Validación final**  
Un agente ejecuta skill sin releer historial.

**Handoff**  
Handoff futuros agentes.

### PH10 — Seguridad, testing y resiliencia

#### Context Packet

**Objetivo:** impedir que el producto llegue a producción por “parece funcionar”.  
**Gate:** seguridad y regresión obligatorias.

##### PH10-T001 — Implementar secrets y redaction

**Rol recomendado**  
`SECURITY`

**Objetivo**  
Eliminar secretos/PII de logs y controlar acceso.

**Por qué existe**  
Agentes operan cuentas reales.

**Dependencias**  
PH04-T002, PH09-T001

**Puede ejecutarse en paralelo con**  
PH10-T002

**Contexto necesario**  
Threat model.

**Archivos o áreas afectadas**  
secrets/logging.

**Acciones**
1. Centralizar secret refs.
2. Redact logs.
3. Encrypt contact points sensibles.
4. Rotation runbook.
5. Secret scanning CI.

**Entregable**  
Secrets v1.

**Criterios de aceptación**
- [ ] No secret en repo/log.
- [ ] PII redacted donde corresponda.
- [ ] Rotation posible.

**Pruebas requeridas**
- Secret scan.
- Log snapshot.

**Errores que debe evitar**
- Guardar cookies/tokens en DB plana.
- Screenshots con credenciales visibles sin redaction.

**Validación final**  
Security review no encuentra secreto expuesto.

**Handoff**  
Handoff hardening.

##### PH10-T002 — Construir suite de regresión comercial

**Rol recomendado**  
`QA`

**Objetivo**  
Automatizar los flujos críticos de PH06-PH08.

**Por qué existe**  
Evita romper reuniones al mejorar componentes.

**Dependencias**  
PH01-T004, PH08-T005

**Puede ejecutarse en paralelo con**  
PH10-T003

**Contexto necesario**  
Gold dataset.

**Archivos o áreas afectadas**  
tests.

**Acciones**
1. Unit/integration/E2E.
2. Mock providers.
3. Sandbox comms.
4. Ambiguous entities.
5. Policy tests.

**Entregable**  
CI test suite.

**Criterios de aceptación**
- [ ] Cubre happy+negative paths.
- [ ] Casos Empresa X/San José incluidos.
- [ ] Outreach duplicate protegido.

**Pruebas requeridas**
- Full suite.
- Nightly/provider subset.

**Errores que debe evitar**
- Tests que llaman producción.
- Assertions débiles.

**Validación final**  
CI bloquea merge ante regresión MUST.

**Handoff**  
Handoff release gate.

##### PH10-T003 — Threat model y abuse tests

**Rol recomendado**  
`SECURITY`

**Objetivo**  
Modelar ataques y mal uso de agentes.

**Por qué existe**  
Autonomía amplía superficie de riesgo.

**Dependencias**  
PH10-T001, PH03-T002, PH09-T003

**Puede ejecutarse en paralelo con**  
PH10-T004

**Contexto necesario**  
Security section.

**Archivos o áreas afectadas**  
security docs/tests.

**Acciones**
1. Threat model STRIDE-like.
2. Prompt injection via web evidence.
3. Tool abuse.
4. SSRF.
5. Privilege escalation.
6. Data exfiltration.

**Entregable**  
`docs/security/threat-model.md`.

**Criterios de aceptación**
- [ ] Prompt injection no cambia policy.
- [ ] Browser restrictions probadas.
- [ ] Approvals no bypass.

**Pruebas requeridas**
- Adversarial evidence.
- Malicious URL.
- Role escalation.

**Errores que debe evitar**
- Confiar en texto web como instrucción.
- Permitir tool calls desde contenido no confiable.

**Validación final**  
Red-team checklist pasa.

**Handoff**  
Handoff gate.

##### PH10-T004 — Backup, restore y disaster recovery

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Demostrar recuperación real.

**Por qué existe**  
Local-first aumenta riesgo de pérdida por hardware.

**Dependencias**  
PH01-T002, PH11-T001

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
DB/storage/workflows.

**Archivos o áreas afectadas**  
backup/restore.

**Acciones**
1. Backup automático.
2. Retención.
3. Export n8n.
4. Restore isolated.
5. RPO/RTO inicial.
6. Runbook.

**Entregable**  
DR v1.

**Criterios de aceptación**
- [ ] Restore probado.
- [ ] Backups cifrados.
- [ ] Age monitor.

**Pruebas requeridas**
- Full restore drill.
- Corrupt backup test.

**Errores que debe evitar**
- Backup sin restore.
- Mismo disco como única copia.

**Validación final**  
Entorno vacío vuelve operativo con backup.

**Handoff**  
Handoff launch checklist.

### PH11 — Observabilidad y deployment

#### Context Packet

**Objetivo:** operar RHIA sin tener que depurar manualmente en n8n.  
**Condición:** dashboard técnico comprensible.

##### PH11-T001 — Implementar logs, metrics y health

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Unificar telemetría de app, worker, n8n, search, providers y DB.

**Por qué existe**  
Sin observabilidad no existe operación autónoma confiable.

**Dependencias**  
PH04-T001, PH05-T001, PH06-T001

**Puede ejecutarse en paralelo con**  
PH11-T002

**Contexto necesario**  
Metrics section.

**Archivos o áreas afectadas**  
observability.

**Acciones**
1. Structured logs.
2. Trace IDs.
3. Health endpoints.
4. Metrics collector.
5. Retention.

**Entregable**  
Observability v1.

**Criterios de aceptación**
- [ ] Trace cruza job→model→tool.
- [ ] Health por componente.
- [ ] Logs redacted.

**Pruebas requeridas**
- Trace test.
- Provider outage.

**Errores que debe evitar**
- Logs sin correlation ID.
- Datos sensibles.

**Validación final**  
Incidente se diagnostica desde dashboard.

**Handoff**  
Handoff alerts.

##### PH11-T002 — Construir alertas y budgets

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Notificar solo condiciones accionables.

**Por qué existe**  
Evita operación reactiva manual.

**Dependencias**  
PH11-T001, PH05-T003

**Puede ejecutarse en paralelo con**  
PH11-T003

**Contexto necesario**  
Alert thresholds.

**Archivos o áreas afectadas**  
alerts.

**Acciones**
1. Search degraded.
2. Queue stalled.
3. Backup stale.
4. Cost budget.
5. Bounce spike.
6. Policy violation.

**Entregable**  
Alerting v1.

**Criterios de aceptación**
- [ ] Alert incluye causa y acción.
- [ ] No alert storm.
- [ ] Budget hard/soft limits.

**Pruebas requeridas**
- Simulated incidents.

**Errores que debe evitar**
- Alertas por cada error individual.
- Sin dedupe.

**Validación final**  
Runbook enlazado desde alerta.

**Handoff**  
Handoff operations.

##### PH11-T003 — Crear deployment local-prod reproducible

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Arrancar RHIA con pocos pasos y auto-restart.

**Por qué existe**  
Usuario no técnico necesita operación simple.

**Dependencias**  
PH02-T001, PH11-T001

**Puede ejecutarse en paralelo con**  
PH11-T004

**Contexto necesario**  
Docker compose.

**Archivos o áreas afectadas**  
deployment.

**Acciones**
1. Compose final.
2. Health dependencies.
3. Restart policies.
4. Startup scripts.
5. Desktop shortcut/runbook opcional.
6. Update procedure.

**Entregable**  
Local-prod v1.

**Criterios de aceptación**
- [ ] Arranque tras reboot.
- [ ] No intervención en n8n necesaria.
- [ ] Version visible.

**Pruebas requeridas**
- Cold boot.
- Unexpected restart.

**Errores que debe evitar**
- Comandos manuales largos.
- Latest tags sin pin.

**Validación final**  
Reinicio de PC recupera servicios.

**Handoff**  
Handoff migration.

##### PH11-T004 — Preparar migración VPS/cloud

**Rol recomendado**  
`DEVOPS`

**Objetivo**  
Validar que v1 puede moverse sin rediseño.

**Por qué existe**  
Requisito explícito local ahora, servidor después.

**Dependencias**  
PH11-T003, PH10-T004

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Container architecture.

**Archivos o áreas afectadas**  
deployment docs.

**Acciones**
1. Provision staging remoto.
2. Restore copy.
3. TLS.
4. Secrets.
5. Smoke tests.
6. Cost estimate.

**Entregable**  
Cloud-ready runbook.

**Criterios de aceptación**
- [ ] Mismos contracts.
- [ ] No dependencia WSL específica.
- [ ] Rollback documentado.

**Pruebas requeridas**
- Remote staging smoke test cuando se autorice gasto.

**Errores que debe evitar**
- Migrar producción sin staging.
- Cambiar arquitectura durante traslado.

**Validación final**  
Staging remoto replica flujo crítico.

**Handoff**  
Handoff production decision.

### PH12 — QA de producto, lanzamiento y hardening

#### Context Packet

**Objetivo:** demostrar que RHIA consigue reuniones efectivas de forma controlada.  
**Escalación humana:** producción, secretos, gasto importante y cambios legales.

##### PH12-T001 — Pilot controlado con empresas reales

**Rol recomendado**  
`PRODUCT`

**Objetivo**  
Operar un lote pequeño con supervisión para medir el funnel.

**Por qué existe**  
Validar producto antes de escalar a 100 empresas/día.

**Dependencias**  
PH08-T005, PH10-T002, PH11-T003

**Puede ejecutarse en paralelo con**  
PH12-T002

**Contexto necesario**  
Agente comercial completo.

**Archivos o áreas afectadas**  
pilot.

**Acciones**
1. Seleccionar muestra.
2. Ejecutar research.
3. Outreach controlado.
4. Revisar mensajes/respuestas.
5. Registrar reuniones.

**Entregable**  
Pilot report.

**Criterios de aceptación**
- [ ] Sin policy violations.
- [ ] Datos trazables.
- [ ] KPI medidos.

**Pruebas requeridas**
- Manual QA de cada incidente.

**Errores que debe evitar**
- Escalar volumen antes de corregir errores.
- Cambiar score sin versionar.

**Validación final**  
Review de resultados con métricas reales.

**Handoff**  
Handoff tuning.

##### PH12-T002 — Tuning basado en conversiones

**Rol recomendado**  
`PRODUCT`

**Objetivo**  
Ajustar scoring, targeting, canales, cadencia y modelos usando datos reales.

**Por qué existe**  
El objetivo no es procesar empresas, es conseguir reuniones.

**Dependencias**  
PH12-T001

**Puede ejecutarse en paralelo con**  
PH12-T003

**Contexto necesario**  
Pilot metrics.

**Archivos o áreas afectadas**  
configs/models.

**Acciones**
1. Analizar funnel.
2. Cost per meeting.
3. Response by role/channel.
4. Model quality.
5. Actualizar config versionada.

**Entregable**  
Config v1.1.

**Criterios de aceptación**
- [ ] Cambios tienen evidencia.
- [ ] No rompe suppression/policies.
- [ ] Score versionado.

**Pruebas requeridas**
- A/B controlado cuando aplique.

**Errores que debe evitar**
- Optimizar solo open rate.
- Cambiar muchas variables a la vez.

**Validación final**  
Mejora o justifica estabilidad.

**Handoff**  
Handoff scale test.

##### PH12-T003 — Scale test a 100 empresas/día

**Rol recomendado**  
`QA`

**Objetivo**  
Validar capacidad objetivo.

**Por qué existe**  
Es el volumen especificado por el fundador.

**Dependencias**  
PH12-T002, PH11-T001

**Puede ejecutarse en paralelo con**  
PH12-T004

**Contexto necesario**  
Production-like environment.

**Archivos o áreas afectadas**  
load/performance.

**Acciones**
1. Simular/operar 100 empresas.
2. Medir queue/DB/providers.
3. Validar budgets.
4. Verificar no duplicates.
5. Observar search health.

**Entregable**  
Capacity report.

**Criterios de aceptación**
- [ ] 100 empresas/día sin pérdida.
- [ ] Latencias aceptables.
- [ ] Backpressure funciona.

**Pruebas requeridas**
- Load test.
- Failure injection.

**Errores que debe evitar**
- Forzar concurrencia ignorando limits.
- Medir solo throughput.

**Validación final**  
Reporte muestra headroom y bottlenecks.

**Handoff**  
Handoff release gate.

##### PH12-T004 — Release y post-launch hardening

**Rol recomendado**  
`ORCHESTRATOR`

**Objetivo**  
Declarar v1 solo después de gates y estabilizar operación.

**Por qué existe**  
Cierre formal del proyecto v1.

**Dependencias**  
PH12-T003, GATE-07

**Puede ejecutarse en paralelo con**  
N/A

**Contexto necesario**  
Todo el plan.

**Archivos o áreas afectadas**  
release.

**Acciones**
1. Tag release.
2. Freeze migrations.
3. Backup.
4. Smoke test.
5. Enable monitoring.
6. Runbook/support.
7. 30-day hardening log.

**Entregable**  
RHIA v1 release.

**Criterios de aceptación**
- [ ] MUST completos.
- [ ] No blockers.
- [ ] Rollback disponible.
- [ ] KPI visible.

**Pruebas requeridas**
- Release smoke.
- Restore confidence.
- Security checklist.

**Errores que debe evitar**
- Release por fecha ignorando gates.
- Cambios no documentados.

**Validación final**  
Definition of Done global satisfecha.

**Handoff**  
Handoff a roadmap del segundo agente.

## 25. Quality Gates

### GATE-01 — Baseline
Requiere PH01 completa.
- Inventario, DB backup, exports n8n y baseline funcional disponibles.
- Si falla: no se permite migración/refactor.

### GATE-02 — Arquitectura
Requiere PH02-PH03.
- Stack congelado.
- Contratos versionados.
- Schema migrable.
- RBAC/policies definidos.
- Si falla: no se construye Agent Runtime.

### GATE-03 — Plataforma
Requiere PH04-PH05.
- App, auth, Core, runtime, AI gateway y router funcionales.
- Si falla: no se conecta outreach real.

### GATE-04 — Inteligencia comercial
Requiere PH06-PH07.
- Entity resolution supera gold dataset.
- Search health distingue degradación.
- CRM, contactos y scoring funcionan.
- Si falla: no se inicia prospección automatizada.

### GATE-05 — Outreach
Requiere PH08.
- Exactly-once lógico.
- Max 3 touches.
- Opt-out.
- Approval de descuentos/commitments.
- Meeting tracking.
- Si falla: no se habilitan canales reales.

### GATE-06 — Tools y seguridad
Requiere PH09-PH10.
- Tool permissions.
- Computer Use sandbox.
- Threat model.
- Backup restore.
- Si falla: no producción.

### GATE-07 — Release
Requiere PH11 + pilot PH12-T001/T002/T003.
- Observabilidad.
- 100 empresas/día.
- No blockers.
- KPI y costos visibles.
- Si falla: se mantiene pilot/staging.

### GATE-08 — Post-launch
30 días.
- Incidentes críticos resueltos.
- Backup restore vigente.
- Funnel estable.
- Decidir segundo agente.

## 26. Run Order

1. En paralelo: `PH01-T001`, `PH01-T002`
2. `PH01-T003`
3. `PH01-T004`
4. `GATE-01`
5. En paralelo: `PH02-T001`, `PH02-T002`
6. `PH02-T003`, `PH02-T004`
7. En paralelo: `PH03-T001`, `PH03-T004`
8. `PH03-T002`, `PH03-T003`
9. `GATE-02`
10. `PH04-T001`
11. `PH04-T002`
12. En paralelo: `PH04-T003`, `PH05-T001`
13. `PH04-T004`
14. `PH05-T002`
15. `PH05-T003`
16. `PH05-T004`
17. `GATE-03`
18. `PH06-T001`
19. `PH06-T002`
20. `PH06-T003`
21. En paralelo: `PH06-T004`, `PH06-T005`
22. `PH07-T001`
23. `PH07-T002`
24. `PH07-T003`
25. `PH07-T004`
26. `PH07-T005`
27. `GATE-04`
28. `PH08-T001`
29. `PH08-T002`
30. `PH08-T003`
31. `PH08-T004`
32. `PH08-T005`
33. `GATE-05`
34. `PH09-T001`
35. `PH09-T002`
36. `PH09-T003`
37. `PH09-T004`
38. En paralelo: `PH10-T001`, `PH10-T002`, `PH11-T001`
39. `PH10-T003`
40. `PH10-T004`
41. `GATE-06`
42. `PH11-T002`
43. `PH11-T003`
44. `PH11-T004`
45. `PH12-T001`
46. `PH12-T002`
47. `PH12-T003`
48. `GATE-07`
49. `PH12-T004`
50. `GATE-08`

## 27. Paralelización

### Safe parallel
- Infrastructure audit + DB audit.
- UI skeleton + Agent Runtime después de contratos.
- Provider adapters independientes.
- Search source adapters independientes.
- Security tests + observability base.
- Documentation puede actualizarse dentro de cada tarea.

### No paralelizar
- Dos migrations sobre mismas tablas.
- Dos cambios simultáneos en mismo workflow n8n.
- Update/delete del mismo archivo.
- Dos cambios de policy sin version bump.
- Dos campañas reales sobre misma oportunidad sin lock.

### Locks lógicos
- `company_entity:{id}`
- `opportunity:{id}`
- `outreach_sequence:{id}`
- `meeting:{id}`
- `credential:{id}`

## 28. Protocolo de handoff

Cada agente debe entregar:

- estado: `DONE | BLOCKED | PARTIAL | FAILED`;
- task ID;
- commit SHA/branch;
- archivos modificados;
- migrations;
- tests ejecutados;
- resultados;
- screenshots cuando aporten valor;
- endpoints o jobs probados;
- decisiones nuevas;
- riesgos pendientes;
- datos/mocks generados;
- siguiente tarea desbloqueada.

Formato mínimo:

```text
TASK: PHxx-Txxx
STATUS: DONE
COMMIT:
TESTS:
EVIDENCE:
RISKS:
DECISIONS:
NEXT:
```

No se acepta “implementado” sin evidencia.

## 29. Protocolo de cambios

1. Detectar desviación.
2. Guardar evidencia.
3. Clasificar impacto:
   - local/reversible;
   - arquitectura;
   - seguridad/legal;
   - producto;
   - costo;
   - producción.
4. Proponer cambio.
5. Actualizar dependencias.
6. Actualizar tareas.
7. Registrar ADR/Decision Log.
8. Continuar solo si no altera requisito crítico.
9. Escalar al humano si:
   - cambio irreversible;
   - precio/gasto relevante;
   - producción;
   - secreto/permisos;
   - compromiso legal/comercial;
   - cambio de producto;
   - riesgo de seguridad alto.

Cambios rutinarios compatibles con el plan no necesitan aprobación humana.

## 30. Matriz de trazabilidad

| Requisito | Decisión | Feature | Tareas | Prueba | Estado inicial |
|---|---|---|---|---|---|
| Plataforma extensible | ADR-002/005 | Agent Runtime/Tool Registry | PH05, PH09 | runtime/tool tests | FALTA |
| App propia | ADR-004 | RHIA App | PH04 | E2E UI | FALTA |
| CRM propio | ADR-007 | CRM | PH07-T001 | E2E opportunity | FALTA |
| Multipaís/multiciudad | ADR-007/008 | Company hierarchy | PH03, PH06 | ambiguous city tests | PARCIAL |
| Ecuador #1/Perú #2 sin exclusión | ADR-009 | Scoring | PH07-T004 | cross-country score | FALTA |
| Descubrimiento + empresa suministrada | — | Search flows | PH06 | F1/F2 E2E | PARCIAL |
| Evidencia trazable | ADR-013 | Evidence pipeline | PH06-T003 | provenance tests | FALTA |
| No falsos negativos por rate limit | — | Search Health | PH06-T001 | 429/CAPTCHA | PARCIAL |
| AI multi-provider | ADR-005 | AI Gateway | PH05 | provider tests | FALTA |
| DeepSeek/Qwen/Ollama evaluables | ADR-005 | Benchmark/Router | PH05-T002/4 | benchmark | FALTA |
| Cost efficiency | — | Router/Budgets | PH05-T003 | budget tests | FALTA |
| Contact targeting dinámico | — | Contact Discovery | PH07-T002 | role tests | FALTA |
| Todos los canales | — | Channel Gateway | PH08-T001 | adapter tests | FALTA |
| Máx. 3 contactos | ADR-012 | Sequence Engine | PH03-T003, PH08-T002 | boundary tests | FALTA |
| Conversación automática | — | Conversation Agent | PH08-T004 | scripted E2E | FALTA |
| Precio oficial automático | ADR-010 | Price Book | PH03/PH08 | price tests | FALTA |
| No cambiar precio | ADR-010 | Approval | PH03-T002, PH08-T004 | discount test | FALTA |
| No compromisos | ADR-011 | Approval | PH03-T002, PH08-T004 | commitment test | FALTA |
| Reuniones booked + attended | — | Meeting module | PH08-T005 | calendar E2E | FALTA |
| 100 empresas/día | — | Capacity | PH12-T003 | load test | FALTA |
| Local ahora/cloud después | ADR-002 | Deployment | PH11 | cold boot/cloud staging | PARCIAL |
| API > Playwright > Computer Use | ADR-006 | Tool layer | PH09 | fallback tests | FALTA |
| No reejecutar trabajo | — | Cache/idempotency | PH06-T005, PH05 | repeat tests | PARCIAL |
| Auditoría | — | Audit events | PH04/PH11 | trace tests | PARCIAL |
| Backups | — | DR | PH10-T004 | restore drill | PARCIAL |
| Seguridad PII/secrets | — | Security | PH10 | security suite | FALTA |

## 31. Definition of Done

RHIA v1 está terminado solo si:

- Todos los requisitos MUST están completados o explícitamente aceptados como excepción.
- Agente Comercial completa el flujo de empresa a reunión.
- Company Group/Entity/Location funciona en casos ambiguos.
- Search health distingue fallo técnico de ausencia de evidencia.
- CRM propio es utilizable sin n8n.
- Contact discovery y validation funcionan.
- Outreach respeta máximo 3 toques, quiet hours, opt-out y exactly-once lógico.
- Conversation Agent no cambia precios ni asume compromisos.
- Meeting booking/attended/qualified se registran.
- AI Gateway soporta múltiples providers.
- Model Router usa benchmark/budgets.
- Agent Runtime reanuda jobs.
- Tool permissions funcionan.
- Computer Use está sandboxed.
- Tests críticos pasan.
- Seguridad no tiene blockers.
- Backup y restore están verificados.
- Observabilidad y alertas están activas.
- Deployment es reproducible.
- Rollback existe.
- Capacidad de 100 empresas/día está validada.
- No existen blockers conocidos.
- KPI de reuniones calificadas agendadas/realizadas es visible.
- Documentación permite operar sin conocimiento de programación.

## 32. Checklist de lanzamiento

- [ ] GATE-01 a GATE-07 aprobados.
- [ ] Backup reciente y restore probado.
- [ ] Migrations revisadas.
- [ ] Secrets correctos.
- [ ] No secrets en repo/logs.
- [ ] Price books activos y revisados.
- [ ] Approval policies activas.
- [ ] Suppression/opt-out funcional.
- [ ] Channel sandboxes probados.
- [ ] Calendar probado.
- [ ] Search health estable o fallback disponible.
- [ ] Model budgets configurados.
- [ ] Dashboards y alertas activas.
- [ ] Runbooks de incidentes disponibles.
- [ ] Usuario admin y manager verificados.
- [ ] Smoke test empresa→reunión.
- [ ] Rollback documentado.
- [ ] Capacidad 100 empresas/día validada.

## 33. Checklist post-lanzamiento

Diario:
- [ ] Search health.
- [ ] Queue failures.
- [ ] Bounce/opt-out.
- [ ] Costo IA.
- [ ] Reuniones.

Semanal:
- [ ] Funnel por país/ciudad.
- [ ] Performance por cargo/canal.
- [ ] Benchmark drift.
- [ ] Stale evidence.
- [ ] Retry/dead-letter.
- [ ] Storage/disk.

Mensual:
- [ ] Restore drill parcial.
- [ ] Secret rotation review.
- [ ] Dependency/security scan.
- [ ] Score recalibration.
- [ ] Cadence review.
- [ ] Provider cost/quality review.
- [ ] Decidir hardening o siguiente agente.

A los 30 días:
- [ ] GATE-08.
- [ ] Roadmap del segundo agente.
- [ ] Evaluar migración a VPS/cloud según uptime/carga.

## 34. Apéndice: decisiones descartadas

### Reescritura total inmediata
Descartada porque existe infraestructura funcional en n8n/PostgreSQL y no hay evidencia suficiente de que deba eliminarse.

### Microservicios desde v1
Descartados por complejidad operacional innecesaria para 100 empresas/día.

### Un único proveedor de IA
Descartado por costo, disponibilidad, capacidad y riesgo de lock-in.

### Computer Use para todo
Descartado por costo y fragilidad frente a APIs y Playwright.

### Hardcode Ecuador
Descartado. Ecuador es prioridad comercial, no límite arquitectónico.

### CRM externo como fuente primaria
Descartado para v1. RHIA Core tendrá CRM propio; integraciones futuras serán adapters.

### Outreach ilimitado
Descartado por riesgo comercial y reputacional.

### IA con autoridad de descuentos/compromisos
Descartada por control comercial, legal y reputacional.

### Empresa como fila plana
Descartada porque no modela grupos, entidades, filiales, ciudades ni mercados de forma correcta.

# Auditoría final del Plan

- Cada requisito MUST está conectado a fases/tareas.
- Cada tarea incluye dependencias, criterios de aceptación, pruebas, errores a evitar, validación y handoff.
- Todas las integraciones contemplan errores, retries y observabilidad.
- Recursos sensibles tienen permisos.
- Migraciones requieren backup/restore.
- Cada fase crítica tiene gate.
- El orden de ejecución no contiene dependencias circulares identificadas.
- Las contradicciones principales están resueltas.
- Las decisiones críticas no se dejan implícitas dentro de tareas.
- Las preguntas restantes son no bloqueantes.
- Un agente ejecutor puede iniciar por `PH01-T001` sin reconstruir el historial del proyecto.
- Ninguna tarea requiere una futura sesión programada de ChatGPT.
- La implementación debe detenerse y escalar solamente en las condiciones definidas en el Protocolo de Cambios.

**Estado:** `ESPECIFICACIÓN SUFICIENTE PARA PLANIFICAR`  
**Siguiente tarea ejecutable:** `PH01-T001 — Inventariar infraestructura actual`
