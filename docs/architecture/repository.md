# Repositorio fuente de RHIA

## Decisión

RHIA adopta el repositorio local existente y su remoto `jsuasnavas5334/RHIA`; no se crea ni sobrescribe otro repositorio. La rama de integración es `main` y toda publicación continúa bajo control humano mediante `SUBIRALGIT.BAT`.

## Estructura v1

| Ruta | Responsabilidad |
|---|---|
| `apps/` | App/BFF y workers ejecutables cuando se creen en PH04. |
| `packages/` | Dominio, contratos, persistencia y utilidades compartidas. |
| `docs/architecture/` | Stack, ADR, contratos y decisiones técnicas. |
| `docs/baseline/` | Fotografías verificables de infraestructura, datos y n8n. |
| `docs/progress/` | Evidencia persistente por Task ID y Quality Gate. |
| `docs/baseline/n8n/workflows/` | Exports sanitizados y versionables de n8n. |
| `scripts/` | Verificadores, backup, restore y operación local. |
| `tests/` | Fixtures sintéticos, baseline, integración y E2E. |
| `spikes/` | Pruebas técnicas acotadas; no se importan desde producción. |
| `data/` | Estado y bitácora visibles en RHIA Control Center. |

Los directorios `apps/` y `packages/` se materializan al crear sus primeros componentes; npm workspaces ya reserva ambas rutas.

## Política de secretos

- Nunca versionar `.env`, claves privadas, passphrases, cookies, credenciales ni dumps.
- Los ejemplos usan `.env.example` sin valores reales.
- Los backups y secretos operativos permanecen fuera del repositorio.
- `.gitignore`, `scripts/verify-repository-baseline.ps1` y `SUBIRALGIT.BAT` aplican controles de nombre y firmas de secretos antes de publicar.
- Si una credencial se versiona accidentalmente, se considera comprometida: se revoca/rota y se registra el incidente; borrarla en un commit posterior no es suficiente.
- Los exports n8n se publican únicamente después de sanitización y prueba de importación inactiva.

## Reproducibilidad

1. `scripts/verify-repository-baseline.ps1` valida estructura, remoto, rama, ignores y firmas de secretos sin mostrar valores.
2. `scripts/test-repository-snapshot.ps1` construye una copia temporal solo con archivos publicables, instala desde lockfile, ejecuta typecheck/build y prueba `/health` y `/api/status`.
3. Después del primer commit humano, la misma validación debe ejecutarse sobre un clone limpio y registrar el SHA baseline.

## Estado de adopción

- Repositorio local: disponible.
- Remoto: `https://github.com/jsuasnavas5334/RHIA.git`.
- Rama: `main`.
- Primer commit/SHA: pendiente de publicación humana.
- Clone limpio real: pendiente hasta que exista ese primer commit.

La falta de SHA no bloquea contratos/configuración que dependen de `PH02-T002`, pero mantiene `PH02-T001` en estado parcial.
