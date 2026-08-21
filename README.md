# RHIA

RHIA es una plataforma extensible de agentes digitales empresariales. Este repositorio contiene el monitor de construcción, baselines verificables, exports sanitizados de n8n y el esqueleto técnico de la versión 1.

## Fuente de verdad

El archivo principal es:

`PLAN_MAESTRO.md`

Antes de modificar el proyecto se consulta el Task Packet aplicable, sus dependencias y el estado real. No es necesario reprocesar el plan completo en cada ciclo.

## Objetivo del proyecto

RHIA es una plataforma extensible de agentes digitales empresariales. El primer agente completo es el **Agente Comercial**, cuyo objetivo principal es conseguir reuniones comerciales efectivas.

## Principios no negociables

- Arquitectura regional, multipaís y multiciudad.
- Ecuador prioridad comercial #1; Perú #2; resto de Latinoamérica habilitado.
- Priorizar por scoring, no por exclusión.
- PostgreSQL como fuente de verdad operacional.
- n8n como orquestador, no como propietario del estado.
- IA multi-proveedor: OpenAI, Anthropic/Claude, DeepSeek, Qwen, Ollama y futuros modelos.
- Orden de herramientas: API → Playwright → Computer Use → humano.
- RHIA puede operar automáticamente salvo:
  - modificar precios;
  - conceder descuentos;
  - cambiar condiciones comerciales;
  - asumir compromisos comerciales vinculantes.
- Máximo inicial: 3 toques proactivos automatizados por oportunidad/secuencia.
- Separar siempre `evidence`, `fact`, `inference` y `decision`.

## Estado técnico conocido

Entorno actual conocido:
- Windows
- WSL2 Ubuntu
- Docker
- PostgreSQL / `rhia_core`
- n8n
- SearXNG
- `execution_registry`
- heartbeat ya probado

El flujo comercial en desarrollo incluye:
- resolver país y ciudad;
- generar consultas;
- separar consultas;
- buscar evidencia de entidad;
- diagnosticar salud de búsqueda;
- evaluar evidencia;
- resolver identidad;
- enriquecer;
- scoring;
- contacto/acción.

## Punto exacto donde quedó el trabajo

El nodo HTTP de búsqueda en n8n fue configurado con:

- `Items per Batch = 1`
- `Batch Interval (ms) = 3000`

El diagnóstico de SearXNG mostró:
- 18 consultas totales;
- 1 con resultados;
- 17 sin resultados;
- rate limits / CAPTCHA en varios motores;
- resultados de Google CSE;
- un bug de extracción de dominios que devolvía `0` dominios aun existiendo URLs válidas.

La regla conceptual importante es:

- `NO_RESULTS + motores saludables` → reformular / fuentes alternativas.
- `NO_RESULTS + rate limit/CAPTCHA/provider down` → retry + backoff + fallback.

No se debe interpretar un cero de resultados como inexistencia de una empresa cuando la búsqueda está técnicamente degradada.

## Arranque para el usuario

1. Hacer doble clic en `STAR.BAT` para abrir RHIA Control Center en `http://localhost:4173/`.
2. Revisar allí la fase actual, la siguiente tarea y los cambios Git locales.
3. Consultar la tarea, las pruebas y los riesgos de cada sesión en la bitácora visible.

Para apagar el servidor local, hacer doble clic en `STOP.BAT`. El monitor no requiere Node.js ni instalación adicional; usa PowerShell incluido en Windows.

El baseline de infraestructura puede comprobarse de forma segura y sin reinicios con:

```powershell
wsl.exe -d Ubuntu -- bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/verify-infrastructure-baseline.sh"
```

El reinicio controlado se prueba sin tocar la infraestructura activa mediante:

```powershell
wsl.exe -d Ubuntu -- bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/test-infrastructure-restart.sh"
```

## Desarrollo reproducible

Stack congelado: Node.js 24.19 LTS, npm workspaces, TypeScript strict, PostgreSQL 18, Drizzle y Zod. Docker Desktop con integración WSL permite ejecutar las pruebas sin instalar Node globalmente.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-repository-baseline.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-repository-snapshot.ps1
```

La segunda prueba construye una copia temporal solo con archivos publicables, ejecuta `npm ci`, typecheck, build y los endpoints del Control Center; luego retira esa copia y su proceso exacto. El procedimiento y la estructura están en `docs/architecture/repository.md`.

## Control de versiones

- `CHANGELOG.md` registra las entregas visibles del proyecto.
- RHIA Control Center consulta el estado real de Git cada 10 segundos cuando se inicia con `STAR.BAT`.
- `SUBIRALGIT.BAT` prepara, valida, confirma y publica los cambios en `origin/main`; nunca usa `force push`.
- La publicación continúa bajo control humano: el monitor no crea commits ni hace push.

El estado actual y la siguiente tarea válida se consultan en RHIA Control Center y `data/project-status.json`; las tareas terminadas conservan su evidencia en `docs/progress/`.

## Seguridad

Este paquete **no incluye contraseñas, tokens, cookies ni secretos**.

Antes de subir archivos locales o `.env`, revisar siempre que no contengan credenciales.
