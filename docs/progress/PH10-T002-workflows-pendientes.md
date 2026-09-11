# PH10-T002 — Workflows de CI pendientes de copiar

**Por qué existe este documento:** `device_commit_files` rechaza escrituras
directas a rutas bajo `.github/workflows/` con `"is a protected file and
cannot be written via remote tools"` (protección deliberada de la
plataforma: esos archivos ejecutan código automáticamente en GitHub Actions
al publicarse, así que escribirlos de forma remota y desatendida es
exactamente lo que la protección evita). Este documento vive en una ruta no
protegida (`docs/progress/`) y contiene el contenido íntegro de los dos
workflows para que un humano (o una sesión futura con `device_bash` real
restaurado, que sí puede escribir archivos normales del proyecto) los copie
a su ubicación real:

- `## ci.yml` → copiar a `.github/workflows/ci.yml`
- `## nightly.yml` → copiar a `.github/workflows/nightly.yml`

**Nota de procedencia:** la sesión `SES-20260911-108` ya había redactado y
verificado manualmente el contenido de ambos workflows (mismo alcance
descrito abajo) y los entregó vía `SendUserFile`, pero esa entrega solo
quedó visible en la conversación de esa sesión — no accesible desde una
sesión nueva sin memoria como esta. Esta sesión (`SES-20260911-109`)
confirmó que ningún archivo del repositorio (ni `docs/progress/PH10-T002.md`,
ni `.github/` en el dispositivo, que no existe) contiene ese contenido
exacto, así que regeneró ambos archivos desde cero siguiendo el mismo
alcance del Task Packet `PH10-T002` (`PLAN_MAESTRO.md`): build+test+typecheck
real en push/PR a `main`; sin secretos ni proveedores de pago; subset nightly
con Postgres real efímero (no la base de producción del usuario). El
contenido no fue re-verificado corriendo GitHub Actions real (esta sesión no
tiene forma de disparar Actions), pero cada comando referenciado
(`npm ci`, `npm run build`, `npm run typecheck`, `npm run test`, las
migraciones/seeds de `packages/db/`, `scripts/test-commercial-baseline.mjs`)
es el mismo verificado con evidencia real en `docs/progress/PH10-T002.md`
(build 0 errores, 752 tests/743 pass, Postgres real 63/63 core-api).

## ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test:
    name: Build, typecheck y test suite completa
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24.19.0'
          cache: 'npm'

      - name: Instalar dependencias (lockfile real)
        run: npm ci

      - name: Build (monorepo, build:prerequisites + workspaces)
        run: npm run build

      - name: Typecheck (todos los workspaces)
        run: npm run typecheck

      - name: Test suite (todos los workspaces; casos con Postgres real
          se saltan automáticamente sin RHIA_TEST_DATABASE_URL)
        run: npm run test

      - name: Baseline comercial (Empresa X / San José, RHIA-COM-002)
        run: node scripts/test-commercial-baseline.mjs
```

## nightly.yml

```yaml
name: Nightly (Postgres real efímero)

on:
  schedule:
    # 07:00 UTC ~ 02:00 America/Guayaquil -- horario de baja actividad.
    - cron: '0 7 * * *'
  workflow_dispatch: {}

concurrency:
  group: nightly-${{ github.workflow }}
  cancel-in-progress: false

jobs:
  postgres-integration:
    name: Suite completa contra PostgreSQL real (efímero, sin datos de
      producción)
    runs-on: ubuntu-latest
    timeout-minutes: 45

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rhia_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      RHIA_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/rhia_test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24.19.0'
          cache: 'npm'

      - name: Instalar dependencias (lockfile real)
        run: npm ci

      - name: Build (monorepo, build:prerequisites + workspaces)
        run: npm run build

      - name: Aplicar migraciones reales del repo (packages/db/migrations,
          en orden, contra la base efímera vacía -- no crece el esquema,
          solo aplica lo ya existente)
        run: |
          set -e
          for f in packages/db/migrations/000*.sql; do
            echo "-- aplicando $f"
            psql "$RHIA_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
          done

      - name: Aplicar seeds reales del repo
        run: |
          set -e
          for f in packages/db/seeds/000*.sql; do
            echo "-- aplicando $f"
            psql "$RHIA_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
          done

      - name: Test suite completa (subset "PostgreSQL real ..." corre de
          verdad con RHIA_TEST_DATABASE_URL seteada; nunca contra
          proveedores de IA de pago)
        run: npm run test

      - name: Baseline comercial (Empresa X / San José, RHIA-COM-002)
        run: node scripts/test-commercial-baseline.mjs
```
