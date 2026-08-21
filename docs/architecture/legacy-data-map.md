# Mapeo de datos legacy hacia el dominio v1

La migración `0001_domain_v1.sql` es aditiva: crea el schema `rhia` y no modifica las ocho tablas existentes en `public`. `legacy_object_map` permite registrar cada backfill posterior sin perder trazabilidad ni duplicar filas.

| Fuente legacy | Estado baseline | Destino v1 | Estrategia |
|---|---:|---|---|
| `public.country_context` | 249 filas | settings/market policy y referencia geográfica | Conservar; no copiar como empresas. Validar ISO2 al consumir. |
| `public.city_context` | 57.688 filas | referencia para `company_location` | Conservar catálogo; crear locations solo para entidades observadas. |
| `public.commercial_entities` | 0 filas | `company_group`, `company_entity`, `company_alias` | Backfill idempotente cuando existan filas; registrar IDs en `legacy_object_map`. |
| `public.entity_relationships` | 0 filas | relaciones de identidad/evidencia futuras | Conservar; migrar después de que existan entidades destino. |
| `public.entity_resolution_cache` | 0 filas | cache de PH06 | Conservar hasta definir freshness/cache keys; no es source of truth de empresa. |
| `public.location_resolution_cache` | 0 filas | cache de PH06 | Conservar; no convertir resultados provisionales en locations confirmadas. |
| `public.prospect_contact_candidates` | 2 filas | `contact`, `contact_point`, `evidence` | Diferir hasta disponer de cifrado de contact points y evidencia normalizada; no leer PII en esta fase. |
| `public.execution_registry` | 144 filas en backup | `job`, `execution`, audit/health | Conservar como historial. Nuevas ejecuciones usan v1; backfill solo de referencias y métricas necesarias. |

## Reglas de backfill

- Nunca borrar ni actualizar la fila legacy durante el backfill inicial.
- Cada inserción destino y su `legacy_object_map` ocurren en la misma transacción.
- La clave `(source_table, source_key, target_table)` impide duplicación.
- Los backfills con PII requieren cifrado, hash de búsqueda y aprobación de la tarea de seguridad correspondiente.
- Un cache legacy no se promueve automáticamente a `fact`; primero debe crear `evidence` y pasar las reglas de confidence/freshness.

## Rollback

No existe una migración down destructiva. Ante fallo antes de producción, se descarta únicamente la base temporal y se restaura de nuevo el bundle cifrado. Ante fallo futuro en un entorno persistente, se detienen writers, se conserva el schema nuevo para forensics y se restaura el backup verificado en una instancia paralela antes de cualquier conmutación.
