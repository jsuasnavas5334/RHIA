# Contratos Core ↔ n8n ↔ Worker

## Alcance y autoridad

`@rhia/contracts` es la fuente ejecutable de los envelopes v1. TypeScript/Zod define el contrato runtime y el build genera JSON Schema draft 2020-12 en `packages/contracts/generated/json-schema/`. Los ejemplos usan UUID y dominios sintéticos; no contienen credenciales ni datos personales reales.

## Catálogo v1

| Contrato | Productor → consumidor | Propósito |
|---|---|---|
| `JobRequest` | Core → n8n/Worker | Solicitar uno de cinco trabajos comerciales con input discriminado y cerrado. |
| `JobResult` | n8n/Worker → Core | Finalizar un job con output tipado o error explícito. |
| `ExecutionEvent` | n8n/Worker → Core | Reportar lifecycle ordenado mediante `sequence`. |
| `ToolCall` | Core/Worker → adapter | Invocar búsqueda o workflow sin headers ni credenciales en el payload. |
| `ToolResult` | adapter → Core/Worker | Devolver output contractual o error normalizado. |
| `SearchRequest` | Core/Worker → Search | Ejecutar consulta normalizada con mercado y fuentes explícitas. |
| `SearchResponse` | Search → Core/Worker | Separar resultados de la salud técnica de cada proveedor. |
| `ApprovalRequest` | Core → humano/UI | Detener acciones comerciales que requieren decisión humana. |
| `ApprovalDecision` | humano/UI → Core | Registrar decisión por referencia, sin incluir identidad o secretos en claro. |
| `CallbackEnvelope` | Core/n8n/Worker → receptor | Entregar resultados, eventos o decisiones de forma idempotente. |

## Reglas transversales

- Todos los contratos llevan `version: "1.0"` y rechazan propiedades desconocidas.
- `jobId`, `correlationId`, `toolCallId`, `callbackId` y demás identificadores son UUID.
- Un receptor deduplica callbacks por `callbackId`; `correlationId` debe coincidir con el payload anidado.
- `SUCCEEDED` exige output y prohíbe error; `FAILED` exige error y prohíbe output; `PARTIAL` puede informar ambos.
- `output.kind` coincide obligatoriamente con `jobType`.
- Fechas son ISO 8601 con zona; contadores y secuencias no pueden ser negativos.
- Los envelopes no admiten headers, cookies, passwords, tokens, API keys ni objetos de credenciales.
- Los detalles de error son escalares y redactados bajo `safeDetails`; nunca payloads completos.

## Estados y callbacks

Lifecycle esperado:

```text
ACCEPTED → STARTED → PROGRESS* → COMPLETED
                         └────→ RETRY_SCHEDULED → STARTED
                         └────→ FAILED
```

`sequence` es creciente dentro de una ejecución. El receptor debe ignorar eventos duplicados y no retroceder estado por un número de secuencia menor. `emittedAt` indica cuándo se creó el callback, no confirma entrega; reintentos conservan `callbackId`.

## Taxonomía de errores

Formato obligatorio: `RHIA_<DOMINIO>_<CONDICIÓN>`.

| Categoría | Retryable típico | Ejemplo |
|---|---:|---|
| `VALIDATION` | no | `RHIA_CONTRACT_INVALID_PAYLOAD` |
| `DEPENDENCY` | sí, según health | `RHIA_SEARCH_PROVIDER_UNAVAILABLE` |
| `RATE_LIMIT` | sí, con backoff | `RHIA_SEARCH_RATE_LIMITED` |
| `TIMEOUT` | sí, acotado | `RHIA_WORKFLOW_TIMEOUT` |
| `CONFLICT` | no automático | `RHIA_ENTITY_AMBIGUOUS` |
| `POLICY` | no; requiere decisión | `RHIA_APPROVAL_REQUIRED` |
| `INTERNAL` | solo si se declara seguro | `RHIA_CORE_UNEXPECTED_FAILURE` |

`retryable` es un booleano contractual; nunca se deduce del mensaje. Un cero de resultados con proveedores saludables es un resultado válido. Rate-limit, CAPTCHA, timeout o provider down se expresan en `SearchResponse.providers` y no deben confundirse con inexistencia de la entidad.

## Relación con los workflows observados

| Campo n8n observado | Contrato v1 |
|---|---|
| `empresa_mencionada`, `pais_consulta`, `ciudad_consulta`, `consultas_resolucion_entidad` | `JobRequest[RESOLVE_ENTITY].input` |
| `empresa`, `pais`, `urls_para_verificar` | `JobRequest[RESEARCH_COMPANY].input` |
| `candidatos_verificar`, `consulta_persona_contacto` | `JobRequest[DISCOVER_HR].input` |
| `persona_contacto`, `cargo_declarado`, `consulta_verificacion` | `JobRequest[VERIFY_PERSON].input` |
| `consulta_contacto_directo` | `JobRequest[FIND_CONTACTABILITY].input` |

La migración de workflows adaptará nombres legacy en sus bordes; Core no adopta nombres libres ni payloads históricos como contratos internos.

## Versionado

- Cualquier cambio de forma crea una nueva versión de schema; no se cambia `1.0` silenciosamente.
- El productor debe poder emitir una sola versión declarada por callback.
- Una transición breaking requiere dual-read, fixtures de ambas versiones, ventana de migración y ADR.
- Un schema antiguo permanece disponible mientras exista un workflow que lo consuma.

## Verificación

```powershell
wsl.exe -d Ubuntu -- bash -lc 'cd "/mnt/c/Users/jesfu/Desktop/Software RHIA" && docker run --rm --network none -v "$PWD:/workspace" -w /workspace node:24.19.0-bookworm-slim npm test'
```

Los tests validan todos los ejemplos y rechazan versión ausente/futura, propiedades desconocidas, campos con nombre de secreto, invariantes de resultado, correlaciones inconsistentes y códigos libres.
