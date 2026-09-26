# PH12-T001 — Resolución de contacto real (lote 1, 10 empresas)

Generado: SES-20260926-279 (continuación de SES-278, misma tarea `PH12-T001`).

## Cómo se hizo esta investigación

No se pudo correr el pipeline real de `research/contact-discovery` de `apps/core-api` contra PostgreSQL: el
`device_bash` de esta sesión es una VM aislada de Windows sin Docker/n8n corriendo (`docker` no está
instalado; verificado con `which docker` → sin resultado). Como alternativa real (no simulada) y dentro de lo
que George ya autorizó ("por todos los medios: email, LinkedIn, teléfono"; "Claude busca las empresas... sin
lista propia de George"), se hizo research manual con `WebSearch`/`WebFetch` sobre fuentes públicas: sitios
oficiales de cada empresa (página de contacto), prensa de negocios, y perfiles/páginas públicas de LinkedIn.

**Regla aplicada:** no se inventó ningún nombre, cargo, email ni teléfono. Se excluyeron a propósito los
resultados de sitios agregadores de datos personales (RocketReach, ZoomInfo, Lusha, Seamless.AI, SignalHire,
FinalScout, GetProspect) como fuente de nombre/email de una persona: son datos de terceros recopilados sin
verificación y no es apropiado usarlos como base de un contacto comercial en frío. Sí se usó, cuando existía,
el canal oficial publicado por la propia empresa (email/teléfono/formulario en su sitio web) y perfiles de
LinkedIn que aparecen indexados públicamente (para el canal LinkedIn, no para extraer datos privados).

Cada fila indica el **canal verificado más confiable disponible hoy** y el nivel de confianza. Ninguno de
estos contactos fue usado para enviar nada; son la base para que George apruebe antes de cualquier envío
real.

## Resultado por empresa

| # | Empresa | Canal oficial verificado | Nombre de persona (si aplica) | Confianza | Fuente |
|---|---------|---------------------------|-------------------------------|-----------|--------|
| 1 | Indurama | Formulario web en [indurama.com/contact-us](https://www.indurama.com/contact-us) + "Línea comercial" (indurama.com/linea-comercial, sin número extraíble) | No resuelto con confianza (una nota de prensa sobre "nuevo gerente comercial de Indurama" corresponde a Indurama Perú, no Ecuador — se descartó por posible confusión de entidad) | Baja (solo canal genérico) | [indurama.com/contact-us](https://www.indurama.com/contact-us) |
| 2 | Tonicorp | Email genérico `servicioalcliente@tonicorp.com`; tel. 1800-866472 / (04) 3701300 | Posible: "Gerardo Vázquez Zerecero, Director Comercial de Lácteos Holding Tonicorp" — **fuente es un agregador de datos (RocketReach), no verificado independientemente; no usar el nombre hasta confirmar en LinkedIn propio de la empresa** | Media (canal genérico confiable; nombre sin confirmar) | [tonicorp.com/contactenos](https://www.tonicorp.com/contactenos/) |
| 3 | Tesalia (The Tesalia Springs Company / Tesalia CBC) | [tesaliacbc.com/contacto](https://tesaliacbc.com/contacto/) (formulario; teléfonos listados son de otros países del grupo CBC, no Ecuador) | "Martín Morales — Gerente de Ventas en Tesalia CBC" (perfil público de LinkedIn, `ec.linkedin.com/in/martin-morales-8807a211b`) | Media (perfil de LinkedIn público, no verificado por segunda fuente) | [LinkedIn](https://ec.linkedin.com/in/martin-morales-8807a211b) |
| 4 | Danec (Grupo Danec) | Email genérico de ventas `ventas@danec.com`, `info@danec.com`; tel. 1800-333999 | No resuelto | Alta (canal de ventas directo y oficial) | [grupodanec.com.ec](https://grupodanec.com.ec/) |
| 5 | Óptica Los Andes | WhatsApp +593 99 407 0643; tel. 1800-ÓPTICA (678422); formulario en [opticalosandes.com.ec/contactanos](https://opticalosandes.com.ec/contactanos/) | No resuelto | Alta (canal oficial multicanal) | [opticalosandes.com.ec/contactanos](https://opticalosandes.com.ec/contactanos/) |
| 6 | Sicon Cía. Ltda. | Email `ventas@siconecuador.ec`; tel. 02-394-6900 ext. 0102 | Posible: "Xavier Alvarado, Gerente General" — nombrado por la propia página de Facebook de Sicon Ecuador (fuente primaria de la empresa, no un agregador), perfil LinkedIn `linkedin.com/in/xavieralvarado/` sin confirmar que sea la misma persona (nombre común) | Media-alta canal / media nombre | [siconecuador.com/contact](https://siconecuador.com/contact/), [Facebook Sicon Ecuador](https://www.facebook.com/siconecuador/videos/xavier-alvarado-nuestro-gerente-general-destac%C3%B3-c%C3%B3mo-%F0%9D%97%A6%F0%9D%97%9C%F0%9D%97%96%F0%9D%97%A2%F0%9D%97%A1-se-ha-posicionado-com/2123289935081908/) |
| 7 | Grupo Superior S.A. (Pinturas Superior) | Página oficial [gruposuperior.com/contactanos](https://www.gruposuperior.com/contactanos/) existe pero no se pudo extraer el contenido (bloqueo técnico de esta sesión al leerla) | No resuelto | Baja — pendiente reintentar la lectura de esa página o visita manual | [gruposuperior.com/contactanos](https://www.gruposuperior.com/contactanos/) |
| 8 | Muebles El Bosque S.A. | No se encontró email/teléfono corporativo oficial verificable (solo directorios de terceros no oficiales); existe página de LinkedIn de la empresa | No resuelto | Baja | [LinkedIn Muebles el Bosque S.A.](https://www.linkedin.com/company/muebles-el-bosque-s.-a.) |
| 9 | Hormipisos Cía. Ltda. | Página oficial "Nuestras oficinas" bloqueada por robots.txt para esta sesión; no se obtuvo email/teléfono oficial verificable | No resuelto | Baja — pendiente visita manual a hormipisos.com | [hormipisos.com/nuestras-oficinas](https://hormipisos.com/nuestras-oficinas/) |
| 10 | Corporación El Rosado | `proveedores@elrosado.com` (canal oficial, pero es específicamente para proveedores/vendedores hacia El Rosado, no para venderles un servicio — usar con cautela o preferir LinkedIn de la empresa) | No resuelto | Media (canal oficial pero de propósito distinto) | [proveedores.elrosado.com/home/contacto](https://proveedores.elrosado.com/home/contacto) |

**Reserva #11 — Banco de Guayaquil:** no investigada en este ciclo (queda fuera del lote principal de 10 por
decisión ya documentada).

## Lectura honesta del resultado

De las 10 empresas, se obtuvo un **canal oficial de contacto verificable** (email/teléfono/formulario propio
de la empresa) para 7 de 10 (Indurama, Tonicorp, Tesalia, Danec, Óptica Los Andes, Sicon, El Rosado —este
último de uso limitado). No se pudo resolver un canal oficial para 3 de 10 (Grupo Superior, Muebles El
Bosque, Hormipisos) por bloqueos técnicos de lectura o falta de información pública suficiente en esta
sesión. Un **nombre de persona con algo de respaldo** solo se obtuvo, con confianza media, para 3 de 10
(Tonicorp, Tesalia, Sicon) — en ningún caso con una segunda fuente independiente que lo confirme al 100%.

Esto confirma lo que ya se anotó en SES-278: el research web abierto (sin el pipeline real de
`contact-discovery` de `apps/core-api` ni una herramienta como LinkedIn Sales Navigator) da **canales
genéricos de empresa confiables**, pero **no nombres de decisores individuales verificados** de forma
consistente. Es una base razonable para un primer contacto por el canal oficial de la empresa (dirigido al
"equipo comercial" en vez de a una persona con nombre inventado), pero no reemplaza al pipeline real para
personalizar con nombre y cargo.

## Recomendación para el primer mensaje (mientras no haya nombre verificado)

Para las empresas sin nombre de persona confirmado, el mensaje debe dirigirse al equipo/área, nunca a un
nombre inventado, por ejemplo: *"Hola, equipo comercial de {{empresa}}..."* en vez de
*"Hola {{nombre_contacto}}..."*. Se preparó un borrador ajustado por empresa en
[`PH12-T001-mensajes-borrador.md`](./PH12-T001-mensajes-borrador.md) — **ningún mensaje fue enviado**.

## Pendiente (para George)

1. Aprobar (o pedir cambios en) la lista de 10 empresas y esta tabla de canales/contactos.
2. Decidir si, para las 3 empresas sin canal resuelto (Grupo Superior, Muebles El Bosque, Hormipisos), quiere
   que se reintente el research, que tú aportes el contacto, o que se descarten del lote 1.
3. Aprobar el contenido de los mensajes borrador antes de cualquier envío real.
4. Decidir qué cuenta de email/LinkedIn autoriza usar para enviar (y con qué límite), o si el envío del lote 1
   lo harás tú directamente con estos borradores.

No se contactó a ninguna empresa. No se envió ningún mensaje. No se tocó infraestructura de producción ni el
esquema de PostgreSQL. No se guardó ninguna credencial.
