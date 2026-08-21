# AVANCES CHATGPT HASTA 2026-08-19

## 1. Infraestructura conocida

- HP Victus como equipo principal.
- Windows + WSL2 Ubuntu.
- Docker.
- PostgreSQL.
- n8n.
- Base `rhia_core`.
- Tabla `execution_registry`.
- Heartbeat probado.
- SearXNG para búsqueda web.

## 2. Principios permanentes de RHIA

### Arquitectura regional
Toda programación, arquitectura, reglas, modelos de datos, búsquedas, validaciones y automatizaciones deben ser multipaís.

### Priorización
- Ecuador: prioridad comercial #1.
- Perú: prioridad #2.
- Resto de Latinoamérica: habilitado.
- La prioridad se resuelve por scoring, nunca por exclusión general.

### Ciudad
La ciudad es una dimensión crítica de cada oportunidad y debe almacenarse/validarse dinámicamente.

## 3. Arquitectura conceptual acordada

RHIA será una plataforma general de agentes empresariales.

Primer agente:
**Agente Comercial**

Agentes futuros:
- marketing;
- cobranza;
- administración;
- RRHH;
- atención al cliente;
- investigación;
- legal;
- compras;
- operaciones;
- otros.

Arquitectura conceptual:

```text
RHIA APP
  ↓
RHIA CORE / API
  ↓
PostgreSQL + Agent Runtime
  ↓
n8n / Tools / AI Gateway / Search
```

## 4. Política de autonomía

Automático:
- investigar;
- buscar;
- leer;
- guardar;
- modificar registros operativos;
- entrar a plataformas;
- descargar documentos;
- enviar email;
- enviar WhatsApp;
- otros canales aprobados;
- mantener conversaciones;
- agendar reuniones.

Requiere humano:
- modificar precios;
- conceder descuentos;
- alterar condiciones;
- asumir compromisos comerciales vinculantes.

RHIA sí puede comunicar precios oficiales previamente aprobados.

## 5. Outreach

- Todos los canales deben quedar contemplados.
- Máximo inicial de 3 contactos/toques proactivos por oportunidad/secuencia.
- Deben existir tiempos definidos para no saturar al prospecto.
- Stop automático ante:
  - respuesta;
  - opt-out;
  - reunión;
  - rebote permanente;
  - riesgo;
  - intervención humana.

## 6. CRM

Se decidió crear CRM propio dentro de RHIA.

Modelo regional:
`Company Group → Company Entity → Company Location`

No duplicar empresas innecesariamente por país/ciudad.

## 7. Contactos

No limitar la búsqueda a RRHH.

Las soluciones pueden venderse a puestos y áreas de toda la organización.

El targeting debe aprender dinámicamente qué:
- cargos;
- áreas;
- seniorities;
- industrias;
- tamaños;
- países;
- ciudades

convierten mejor.

## 8. IA

Arquitectura multi-proveedor:
- OpenAI
- Anthropic / Claude
- DeepSeek
- Qwen
- Ollama
- futuros modelos

Criterio de selección:
`calidad + costo + latencia + disponibilidad + privacidad`

Debe existir benchmark RHIA por clase de tarea.

## 9. Herramientas

Orden preferido:
1. API
2. Playwright
3. Computer Use
4. Humano

Computer Use no debe reemplazar automatización determinista cuando no sea necesario.

## 10. Flujo de resolución de entidad en n8n

Flujo aproximado:

```text
contexto/oportunidad
→ resolver país y ciudad
→ generar consultas
→ separar consultas
→ buscar evidencia entidad
→ diagnosticar salud búsqueda
→ evaluar evidencia
→ resolver identidad
→ enriquecer
→ scoring
→ contacto/acción
```

## 11. Caso de prueba geográfica

Input genérico:
- Empresa: `Empresa X`
- Ciudad: `San Jose`
- País: no especificado

Candidatos considerados:
- Costa Rica / San José
- United States / San Jose, California
- Belize / San Jose, Orange Walk
- otros candidatos

Nunca asumir automáticamente el primer país/ciudad.

## 12. Consultas de entidad

Se generaron 6 tipos por contexto:
- `SITIO_OFICIAL`
- `OPERADOR_LOCAL`
- `ENTIDAD_LEGAL`
- `ENTIDAD_EMPLEADORA`
- `GRUPO_EMPRESARIAL`
- `PRESENCIA_LOCAL`

Tres contextos × seis consultas = 18 búsquedas.

## 13. Reglas de resolución

- no asumir marca como empresa;
- no asumir operador como empleador;
- no asumir país ambiguo;
- exigir evidencia de relación;
- preservar fuentes;
- permitir franquicia;
- licencia;
- distribuidor;
- subsidiaria;
- grupo empresarial.

## 14. Salud de búsqueda

Se creó nodo:
`Diagnosticar salud búsqueda`

Debe medir salud técnica independientemente de validez semántica.

Resultado observado:
- 18 consultas;
- 18 respuestas estructuralmente válidas;
- 1 consulta con resultados;
- 17 sin resultados;
- 20 resultados totales;
- cobertura baja;
- motores degradados.

Motores afectados:
- Brave: `too many requests`
- DuckDuckGo: `CAPTCHA`
- Startpage: `CAPTCHA`
- Google CSE: `too many requests` después de la primera consulta

Conclusión:
la principal falla observada era técnica, no necesariamente semántica.

## 15. Batching configurado

En `Buscar evidencia entidad`:

```text
Items per Batch = 1
Batch Interval (ms) = 3000
```

Esto debe validarse con una ejecución fresca.

## 16. Bug de dominios

El diagnóstico devolvió:

```text
resultados_con_url = 20
dominios_unicos = 0
```

Eso es inconsistente.

Se propuso reemplazar el parser de dominio basado en `new URL()` por una extracción regex/string en n8n.

Conceptualmente, URLs como:
- facebook.com
- tiktok.com
- universidadviu.com
- uteg.edu.ec
- rfilc.org
- univalle.edu.co
- uasb.edu.ec
- imprentanacional.go.cr
- erplawyers.com
- linkedin.com
- scribd.com
- researchgate.net

deben producir dominios válidos.

## 17. Regla pendiente del diagnóstico

Actualmente una búsqueda vacía puede terminar en:

`REFORMULAR_CONSULTA`

aunque los motores estén bloqueados.

Debe evolucionar a:

```text
NO_RESULTS + healthy
→ REFORMULAR_CONSULTA

NO_RESULTS + blocked/rate-limit/CAPTCHA
→ REINTENTAR_CON_BACKOFF / FALLBACK
```

## 18. Falso positivo importante

En pruebas previas con Corporación Favorita apareció un falso positivo `favoritabananas.com`.

La lógica debe priorizar:
- identidad exacta;
- dominio oficial;
- evidencia de relación;
- URL/fuente por cada dato.

No inferir relación empresarial solo por similitud nominal.

## 19. Fuente de verdad del futuro desarrollo

`PLAN_MAESTRO.md`

Codex debe:
- auditar primero;
- ejecutar por DAG;
- no inventar arquitectura nueva salvo evidencia;
- preservar componentes útiles;
- producir handoff verificable por task.
