# Configuración no técnica de RHIA

## Objetivo

Un operador podrá cambiar reglas comerciales normales desde la futura Admin UI sin editar TypeScript, SQL ni workflows n8n. `@rhia/config` define el schema runtime, defaults, preview seguro y JSON Schema que PH04 consumirá.

## Qué es configuración

| Grupo | Configurable por operador | Default seguro | Aplicación |
|---|---|---|---|
| Mercados | prioridades adicionales y score regional | Ecuador 100, Perú 90, resto LATAM 50 y habilitado | hot reload |
| Cadencia | máximo de toques (1–3), espera y canal habilitado | 3; todos los canales de envío deshabilitados | hot reload |
| Scoring | cuatro pesos que suman 100 y umbral de oportunidad | 30/35/20/15; umbral 70 | hot reload |
| Budgets | búsquedas, tokens, acciones browser y gasto diario | 20/0/0; USD 0 | hot reload |
| Providers | habilitación, alias, prioridad y referencia segura | solo Ollama local | hot reload |
| Search/tool fallback | SearXNG y habilitación de fallback | SearXNG sí; browser/Computer Use no | hot reload |
| Runtime | concurrencia y timezone | 1 worker; America/Guayaquil | restart de worker |
| Logging | nivel ERROR/WARN/INFO/DEBUG | INFO | hot reload |

Las referencias de credencial son UUID opacos seleccionados desde un almacén seguro. La UI nunca recibe, edita ni previsualiza el secreto.

## Qué permanece en código o infraestructura

- Reglas inmutables: Ecuador prioridad 1, Perú prioridad 2, resto de Latinoamérica habilitado.
- Máximo absoluto de tres toques proactivos.
- Aprobación humana para precios, descuentos, condiciones y compromisos vinculantes.
- Orden de herramientas API → Playwright → Computer Use → humano.
- Estados, contratos, taxonomía de errores, lógica de evidencia y permisos.
- URLs de base de datos, puertos, claves de cifrado, credenciales y topología Docker.

Cambiar database URL, puertos o topología requiere procedimiento DevOps y reinicio completo; no se expone como settings. Cambiar schemas o invariantes requiere código, pruebas y ADR/migration según corresponda.

## Flujo de Admin UI

```text
Editar borrador → validar → previsualizar diff/efecto → confirmar → guardar versión → aplicar
                                             └──── error: no guarda ni aplica
```

La vista previa muestra rutas y valores operativos, redacta `credentialRef` como referencia presente/ausente e indica `HOT_RELOAD` o `WORKER_RESTART`. Una validación fallida devuelve path, código y mensaje, nunca repite el valor enviado.

## Reglas de validación

- Objetos strict: cualquier propiedad desconocida se rechaza.
- `version` debe ser exactamente `1.0`.
- Los pesos de scoring suman 100.
- Países, canales, providers y prioridades de providers son únicos.
- Ecuador mantiene score mayor que Perú; Perú mayor que cualquier prioridad regional.
- Provider remoto activo requiere referencia segura y budget diario positivo.
- Provider local prohíbe credentialRef.
- Channels inician deshabilitados; budget externo, tokens y browser inician en cero.
- Orden de tools y límites de aprobación no son configurables.

## Versionado y auditoría

- Cada settings guardado conserva `version`, autor por referencia, timestamp y diff redactado cuando PH04 implemente persistencia.
- Cambios incompatibles crean schema nuevo y migrador; nunca se reinterpreta silenciosamente v1.0.
- La UI debe soportar validar y previsualizar antes de persistir.
- Rollback restaura una versión previa válida, no un JSON libre.

## Handoff a PH04

La Admin UI consumirá `RhiaSettings.schema.json`, `defaultRhiaSettings` y `previewSettingsChange`. n8n recibirá reglas efectivas desde Core; ningún workflow debe modificarse para cambiar cadencias, prioridades, budgets o providers.
