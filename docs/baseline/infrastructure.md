# PH01-T001 — Baseline de infraestructura

## Estado

- Captura: 2026-08-19 12:22 UTC-05:00
- Estado de tarea: `PARTIAL`
- Método: inspección de solo lectura
- Cambios aplicados a infraestructura: ninguno
- Secretos capturados: ninguno

Este documento describe el entorno observado. No sustituye el archivo Compose ni contiene valores de variables, contraseñas, tokens o claves.

## Host

| Componente | Valor observado |
|---|---|
| Equipo | Lenovo 82BJ |
| Sistema operativo | Windows 11 Home, 64 bits |
| Versión / build | 10.0.26200 / 26200 |
| Memoria física | 12.67 GB |
| Último arranque observado | 2026-08-13 04:55 UTC-05:00 |

## WSL2

| Propiedad | Valor observado |
|---|---|
| Distribución predeterminada | Ubuntu |
| Estado | Running |
| Versión WSL | 2 |
| Ubuntu | 26.04 LTS (`resolute`) |
| Kernel | 6.18.33.2-microsoft-standard-WSL2 |
| CPU visibles | 8 |
| Memoria asignada | 6,106,513,408 bytes |
| Swap | 2,147,483,648 bytes |

## Docker

| Propiedad | Valor observado |
|---|---|
| Docker Client / Engine | 29.7.2 / 29.7.2 |
| API | 1.55 |
| Docker Compose | 5.4.0 |
| Storage driver | overlayfs |
| Cgroup | v2 |
| Contenedores | 6 totales / 4 activos |
| Imágenes | 5 |
| Uso de imágenes | 9.5 GB |
| Uso de volúmenes | 2.112 GB |

## Proyecto Compose

| Propiedad | Valor observado |
|---|---|
| Proyecto | `infrastructure` |
| Estado | `running(4)` |
| Archivo | `/home/server-rhia-orquestador/rhia-orquestador/infrastructure/compose.yaml` |
| Tamaño | 1,894 bytes |
| Modificación | 2026-08-16 22:09:22 UTC-05:00 |
| SHA-256 | `d43106b43a8aa61e0fc346b9422e213de2271af7980774585f9692de33a19797` |

Servicios declarados: `postgres`, `n8n`, `searxng`, `ollama`.

Se observaron archivos de respaldo del Compose y `searxng/settings.yml`. No se copiaron sus contenidos porque pueden contener configuración sensible.

## Servicios activos

| Contenedor | Imagen observada | Versión de aplicación | Estado | Health Docker | Puerto host | Restart |
|---|---|---|---|---|---|---|
| `rhia-postgres` | `postgres:18` | PostgreSQL 18.4 | running | healthy | no publicado | unless-stopped |
| `rhia-n8n` | `docker.n8n.io/n8nio/n8n:latest` | n8n 2.34.5 | running | no definido | `127.0.0.1:5678` | unless-stopped |
| `rhia-searxng` | `searxng/searxng:latest` | 2026.8.16-b2da6b90f | running | no definido | no publicado | unless-stopped |
| `rhia-ollama` | `ollama/ollama:latest` | Ollama 0.32.9 | running | no definido | no publicado | unless-stopped |

También existen dos contenedores `hello-world` detenidos, sin restart policy. Se conservan; no se autoriza su eliminación durante el baseline.

### Digests observados

- PostgreSQL: `sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636`
- n8n: `sha256:d91033b4fac2f7b75c5c4007e10824c66147f7d7a3cccb488720e97452ee7dc7`
- SearXNG: `sha256:e45d5894bfaa0bf8773b9f283795ae57f1c15ddb29c8cecb70b3665b0ce9ec60`
- Ollama: `sha256:1685741456770df6e3cceb2a945a5f75e020f658d1701509668d6f4688f1dd3f`

Los digests registran exactamente lo observado; el Compose continúa usando tags y no fue modificado.

## Red

Los cuatro servicios activos comparten la red bridge `rhia_internal` (`172.18.0.0/16` observado). Solo n8n publica un puerto al host y lo limita a loopback.

```text
Windows
└── WSL2 Ubuntu
    └── Docker / proyecto infrastructure
        └── rhia_internal
            ├── rhia-searxng :8080 (solo red interna)
            ├── rhia-n8n :5678 → 127.0.0.1:5678
            ├── rhia-postgres :5432 (solo red interna)
            └── rhia-ollama :11434 (solo red interna)
```

## Volúmenes y montajes

| Servicio | Volumen o bind | Destino |
|---|---|---|
| PostgreSQL | `infrastructure_rhia_postgres_data` | `/var/lib/postgresql` |
| n8n | `infrastructure_rhia_n8n_data` | `/home/node/.n8n` |
| Ollama | `infrastructure_rhia_ollama_data` | `/root/.ollama` |
| SearXNG | `infrastructure_rhia_searxng_cache` | `/var/cache/searxng` |
| SearXNG | volumen anónimo `3ffca9…ccdc63` | `/etc/searxng` |
| SearXNG | bind de `infrastructure/searxng/settings.yml` en modo read-only | `/etc/searxng/settings.yml` |

## Variables declaradas

Solo se registran nombres. Los valores no fueron leídos ni copiados.

- PostgreSQL / composición: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `RHIA_DB_NAME`, `RHIA_DB_USER`, `RHIA_DB_PASSWORD`, `N8N_DB_NAME`, `N8N_DB_USER`, `N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `N8N_PORT`, `N8N_TIMEZONE`, `SEARXNG_SECRET`.
- n8n: `DB_TYPE`, `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_DATABASE`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `GENERIC_TIMEZONE`, `TZ`.
- SearXNG: `SEARXNG_SECRET` y rutas internas de configuración.
- Ollama: `OLLAMA_HOST`, `OLLAMA_CONTEXT_LENGTH`, `OLLAMA_MAX_LOADED_MODELS`, `OLLAMA_NUM_PARALLEL` y configuración de GPU.

Al ejecutar `docker compose config` sin un contexto externo de variables, Compose indicó como no definidas ocho variables de RHIA. Esto no prueba que los contenedores activos carezcan de valores; prueba que el procedimiento reproducible para aportar esas variables todavía no está documentado.

## Health verificado

| Componente | Comprobación | Resultado |
|---|---|---|
| PostgreSQL | `pg_isready` dentro del contenedor | accepting connections |
| n8n | `GET http://127.0.0.1:5678/healthz` | HTTP 200 |
| SearXNG | `GET /healthz` dentro del contenedor | `OK` |
| Ollama | `ollama list` | respondió; modelo `qwen3.5:2b-q4_K_M` disponible |

## Verificación reproducible

El script `scripts/verify-infrastructure-baseline.sh` comprueba el estado esperado sin leer valores de variables de entorno ni modificar contenedores. Valida el hash del Compose, versiones de Docker, cuatro contenedores e imágenes, red, volúmenes persistentes, publicación local de n8n y health básico.

Ejecución desde Windows:

```powershell
wsl.exe -d Ubuntu -- bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/verify-infrastructure-baseline.sh"
```

Revalidación del 2026-08-19 a las 18:23 UTC-05:00: `24/24` controles correctos, sin desviaciones. Esta prueba detecta drift; no sustituye el reinicio controlado requerido después de disponer de backup y restore verificados.

## Reinicio controlado en entorno de prueba

El 2026-08-19 a las 19:07 UTC-05:00 se ejecutó `scripts/test-infrastructure-restart.sh` con el Compose aislado `tests/baseline/infrastructure-smoke.compose.yaml`.

- Se utilizaron las cuatro imágenes observadas: PostgreSQL, n8n, SearXNG y Ollama.
- El proyecto de prueba tuvo red y cuatro volúmenes propios, sin montar volúmenes RHIA activos.
- No publicó puertos al host y no leyó configuración ni secretos de producción.
- Los cuatro servicios iniciaron saludables, se reiniciaron y recuperaron health.
- Al finalizar se retiraron únicamente los contenedores, red y volúmenes del proyecto desechable `rhia-baseline-smoke`.
- Los cuatro servicios RHIA activos conservaron su estado y pasaron nuevamente el verificador de baseline.

La prueba satisface el reinicio controlado requerido por PH01-T001 sin asumir el riesgo de reiniciar la infraestructura activa antes del backup de PH01-T002.

## Riesgos y gaps

1. n8n, SearXNG y Ollama usan `latest`; una recreación futura podría cambiar versiones sin intención.
2. n8n, SearXNG y Ollama no declaran healthcheck de Docker, aunque sus comprobaciones manuales respondieron.
3. El mecanismo externo que aporta variables al Compose no está documentado y `docker compose config` no puede reproducirse desde el directorio por sí solo.
4. El volumen anónimo montado en `/etc/searxng` debe aclararse antes de cualquier recreación.
5. La configuración de smoke reproduce la topología y el ciclo de salud, pero no incorpora settings o datos sensibles del entorno activo.
6. La clasificación de datos, schema e índices pertenece a `PH01-T002`; no se inspeccionaron contenidos de PostgreSQL en esta tarea.

## Validación y siguiente paso

El mapa cubre todos los componentes conocidos, puertos, redes, montajes, versiones y health sin registrar secretos. La reconstrucción y el reinicio se comprobaron en una topología aislada con las mismas cuatro imágenes; `PH01-T001` queda `DONE`.

Siguiente trabajo permitido: continuar `PH01-T002` y comenzar `PH01-T003` en paralelo, sin reiniciar ni alterar los servicios activos.
