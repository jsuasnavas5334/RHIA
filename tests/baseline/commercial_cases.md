# PH01-T004 — Baseline funcional del Agente Comercial

## Alcance y método

Este baseline ejecuta en modo local `record/replay` los nodos actuales `Evaluar evidencia entidad`, `Consolidar evidencia por mercado` y `Diagnosticar salud búsqueda` del workflow sanitizado `RHIA - Resolución Entidad y País`.

- No usa red, credenciales, bases activas ni datos de prospectos.
- Los dominios sintéticos terminan en `.invalid` y no pueden resolver en Internet.
- Cada caso se ejecuta dos veces y exige una salida equivalente.
- La evidencia degradada procede del fixture ya capturado en `tests/fixtures/searxng/empresa_x_busqueda_degradada.json`.
- Los inputs y expected results legibles por máquina están en `commercial_cases.json`.
- Comando reproducible: `node scripts/test-commercial-baseline.mjs`.

## Casos y resultados esperados

| ID | Escenario | Expected result explícito |
|---|---|---|
| `RHIA-COM-001` | Empresa sintética clara, un mercado y dos fuentes independientes | `MERCADO_CON_EVIDENCIA_FUERTE`; resolver entidad comercial; buscador saludable. |
| `RHIA-COM-002` | `Empresa X`, ciudad `San Jose`, candidatos Costa Rica/Estados Unidos/Belice | Tres mercados requieren más evidencia; ninguno se selecciona automáticamente. |
| `RHIA-COM-003` | Nombre sintético inexistente, seis consultas vacías y motores saludables | `BUSQUEDA_OPERATIVA_SIN_RESULTADOS`; reformular; nunca afirmar inexistencia por una sola búsqueda vacía. |
| `RHIA-COM-004` | `Empresa X`, 18 consultas y motores con rate-limit/CAPTCHA | Salud `DEGRADADA`, cobertura `BAJA`, evaluar y reintentar; preservar dos gaps actuales. |

## Reglas de aceptación observables

1. La identidad se resuelve solo con evidencia fuerte de al menos dos fuentes independientes.
2. La prioridad comercial de un país nunca decide la identidad.
3. `SIN_RESULTADOS` con motores saludables significa reformular, no declarar que la empresa no existe.
4. Una búsqueda con rate-limit o CAPTCHA se clasifica separadamente de la validez semántica.
5. Dos ejecuciones del mismo caso deben producir la misma clasificación.

## Bugs conocidos preservados por el baseline

- `DOMAIN-PARSER-001`: el fixture contiene 20 URLs, pero el runtime observado produjo 0 dominios únicos.
- `DEGRADED-NORESULT-001`: las 17 consultas vacías con motores bloqueados reciben actualmente `REFORMULAR_CONSULTA`; la evolución esperada es backoff/fallback.

Estos defectos se documentan y se prueban como comportamiento actual; no se corrigen durante la auditoría PH01 para evitar mezclar baseline con refactor.

## Tiempo y costo

El runner informa el tiempo conjunto de dos repeticiones por caso. El costo externo es cero porque todo se ejecuta localmente en replay. Los tiempos de proveedores reales todavía no están disponibles y no se simulan.
