# Registro de GATE-01 — Baseline

```text
GATE: GATE-01
STATUS: DONE
COMMIT: No creado; publicación bajo control humano.
```

## Condiciones verificadas

| Condición | Evidencia | Resultado |
|---|---|---|
| Inventario de infraestructura | `docs/baseline/infrastructure.md`; `PH01-T001` | PASS |
| Auditoría y backup PostgreSQL | `docs/baseline/database.md`; bundle externo íntegro; `PH01-T002` | PASS |
| Exports n8n | 10 JSON sanitizados y manifest; `PH01-T003` | PASS |
| Baseline funcional | 4 casos repetidos dos veces; `PH01-T004` | PASS |

## Quality checks

- Las cuatro tareas PH01 están `DONE`.
- El bundle cifrado contiene cinco artefactos válidos y cubre 133 tablas.
- El repositorio no contiene archivos `*.dump` ni `*.dump.gpg`.
- Los 10 exports n8n permanecen sanitizados y fuera de ejecución activa.
- El baseline comercial no usa red, credenciales ni bases activas.

## Riesgos transferidos

- Segunda copia física, RPO/RTO y retención automática: `PH10-T004`.
- Parser de dominios y acción ante degradación: deuda funcional para fases de Search/QA.
- Imágenes `latest` y configuración externa: arquitectura/deployment posteriores.

## Decisión

`GATE-01` aprobado. Se permiten las tareas de PH02; las migraciones destructivas continúan prohibidas por las guardas generales.
