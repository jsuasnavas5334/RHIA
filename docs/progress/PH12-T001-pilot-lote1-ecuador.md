# PH12-T001 — Pilot lote 1: 10 empresas reales (Ecuador)

Generado: SES-20260926-278 (desbloqueo tras respuesta de George en vivo, 2026-09-26 ~03:30 UTC).

## Decisión de George (respuesta en vivo, no simulada)

1. Tamaño de muestra: **10 empresas para comenzar**.
2. Selección: **Claude busca empresas en Ecuador que necesiten los servicios de RHIA** (agente comercial IA para
   conseguir reuniones de venta), priorizando señales recientes (últimas semanas) de que están invirtiendo en
   crecer su función comercial.
3. Canal: **"por todos los medios"** — email, LinkedIn y teléfono cuando el dato esté disponible.
4. Revisión: **Sí** — George revisa y aprueba cada mensaje antes de cualquier envío real.

## Cómo se interpretó "empresas que buscan mis servicios"

RHIA (ver `README.md`) es una plataforma de agentes digitales cuyo primer agente completo es el
**Agente Comercial**, cuyo objetivo es conseguir reuniones comerciales efectivas para el negocio del cliente.
El comprador de RHIA no busca "RHIA" por nombre (es un producto nuevo); busca ayuda para vender más /
conseguir más reuniones comerciales. La señal de compra más verificable y reciente disponible por búsqueda
web abierta es: **empresas ecuatorianas que están activamente contratando o expandiendo su equipo comercial
(ejecutivos de ventas, gerentes comerciales) en las últimas semanas** — eso indica que están invirtiendo
presupuesto en crecer ventas ahora mismo, el perfil de comprador correcto para el agente comercial de RHIA.

No se usó ninguna herramienta de scraping de LinkedIn ni datos privados; toda la evidencia proviene de
búsqueda web abierta (bolsas de empleo públicas y prensa de negocios) y queda citada abajo con URL.

## Lista de 10 empresas (candidatas, pendientes de tu aprobación)

| # | Empresa | Sector | Señal reciente | Ciudad | Evidencia |
|---|---------|--------|-----------------|--------|-----------|
| 1 | Indurama | Línea blanca / electrodomésticos | Vacante comercial abierta (nota de prensa 2026-08-21) | Cuenca | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |
| 2 | Tonicorp | Alimentos / lácteos | Vacante comercial abierta (misma nota) | Varias ciudades | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |
| 3 | Tesalia | Bebidas | Vacante comercial abierta (misma nota) | Varias ciudades | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |
| 4 | Danec | Aceites / consumo masivo | Vacante comercial abierta (misma nota) | Varias ciudades | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |
| 5 | Óptica Los Andes | Retail salud visual | Vacante comercial abierta (misma nota) | Varias ciudades | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |
| 6 | Sicon Cía. Ltda. (Sicon Ecuador) | Construcción — estructura galvanizada | Vacante "Ejecutivo Comercial Sucursal Quito" publicada agosto 2026 | Quito | [Multitrabajos, ago-2026](https://www.multitrabajos.com/empleos/ejecutivo-comercial-de-sucursal-quito-sicon-ecuador-1118398107.html) |
| 7 | Grupo Superior S.A. (Pinturas Superior) | Manufactura / distribución mayorista | Vacante "Ejecutivo de Ventas Mayorista Industria" publicada jun-2026 | Sierra centro/norte | [Multitrabajos, jun-2026](https://www.multitrabajos.com/empleos/ejecutivo-de-ventas-mayorista-industria-grupo-superior-sa-1118315876.html) |
| 8 | Muebles El Bosque S.A. | Manufactura / retail mobiliario | Vacante "Ejecutivo de Ventas Distribución Mayorista — Sierra Centro y Norte" publicada jun-2026 | Sierra centro/norte | [Multitrabajos, jun-2026](https://www.multitrabajos.com/empleos/ejecutivo-de-ventas-distribucion-mayorista--sierra-centro-y-norte-ecuador-muebles-el-bosque-s.a.-1118327322.html) |
| 9 | Hormipisos | Construcción / materiales | Vacante "Ejecutivo Comercial" publicada may-2026 | — | [Multitrabajos, may-2026](https://www.multitrabajos.com/empleos/ejecutivo-comercial-hormipisos-1118299039.html) |
| 10 | Corporación El Rosado | Retail (Mi Comisariato / Ferrisariato) | Vacante comercial abierta (nota Vistazo 21-ago-2026) | Varias ciudades | [Vistazo, 21-ago-2026](https://www.vistazo.com/amp/servicios/bolsa-de-empleo/2026-08-21-ofertas-laborales-ecuador-empresas-30-vacantes-distintas-ciudades-CJ11183625) |

**Backup / reserva (#11, por si alguna de las 10 no responde o George prefiere descartarla):** Banco de
Guayaquil — también con vacante comercial en la misma nota de prensa, pero es una entidad grande y regulada
(ciclo de decisión más largo, más difícil de contactar en frío), por eso queda como reserva y no en el lote
principal.

## Lo que falta antes de poder enviar cualquier mensaje real

- **Contacto verificado por empresa**: la búsqueda web abierta confirma que la empresa existe y tiene una
  señal de compra reciente, pero no da un nombre de persona ni un email/LinkedIn verificado de un decisor
  comercial. El siguiente paso técnico normal (research → contact-discovery → entity-resolver, ya cubierto
  por los tests reales de SES-196) requeriría correr el pipeline real de `apps/core-api` contra estas 10
  empresas para resolver contacto — **no se ejecutó todavía** porque implica tocar la base de datos operativa
  y no hay evidencia en este ciclo de que el entorno (Postgres/n8n) esté levantado y accesible desde esta
  sesión.
- **Mensajes de outreach**: se redactó una plantilla base (ver `PH12-T001-plantillas-outreach.md`) para email
  y LinkedIn, en español, sin inventar nombres de personas ni datos de contacto. Falta personalizarla por
  empresa una vez haya contacto verificado, y **tu aprobación explícita de cada mensaje antes de cualquier
  envío real**, tal como confirmaste.
- **Canal "por todos los medios"**: email y LinkedIn se pueden preparar como borrador para que tú los envíes,
  o para automatizar el envío si me confirmas qué cuenta de email/LinkedIn autorizas usar y con qué límites.
  Teléfono requeriría que tú hagas la llamada o me confirmes una herramienta de voz autorizada; no se asume
  ninguna credencial ni número real sin que tú lo proporciones.

## Próximo paso (para ti)

1. Revisa la lista de 10 (o pide cambios/quita alguna).
2. Dime si quieres que intente resolver contacto real (nombre + email/LinkedIn) para estas empresas con el
   pipeline de research/contact-discovery ya construido, o si tú ya tienes contactos en esas empresas.
3. Aprueba (o edita) la plantilla de mensaje antes de que se prepare el primer envío real.

Ninguna empresa fue contactada. Ningún mensaje fue enviado. No se tocó infraestructura de producción ni el
esquema de PostgreSQL.
