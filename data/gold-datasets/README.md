# Gold dataset — Entity resolution de empresas (GATE-04)

Este archivo es el insumo que falta para desbloquear `GATE-04` (ver `docs/progress/GATE-04.md`). Sin esto, `@rhia/entity-resolver` (PH06-T004) no se puede validar contra casos reales, y el gate se queda `BLOCKED` indefinidamente.

## Qué es

`entity-resolution-companies.csv` es una lista de **pares de empresas reales**, cada par etiquetado a mano como "misma empresa" o "empresa distinta". Con eso, una sesión futura corre `resolveCompanyEntity()` contra cada par y mide qué tan bien acierta (precisión/recall) frente al umbral que se acuerde.

## Cuántos pares hacen falta

**30 a 50 pares** es un primer umbral razonable. Cuantos más casos reales y variados, mejor mide el resolver.

## Cómo llenarlo

Abre `entity-resolution-companies.csv` en Excel/Sheets. Cada fila es un par (empresa A vs. empresa B). Las columnas:

| Columna | Qué va ahí |
|---|---|
| `pair_id` | Un identificador corto tuyo, ej. `PAR-01`, `PAR-02`... |
| `company_a_name` / `company_b_name` | El nombre tal como aparece en la fuente (legal, comercial, o alias) |
| `company_a_name_kind` / `company_b_name_kind` | `LEGAL` (razón social), `TRADE` (nombre comercial), o `ALIAS` (otro nombre conocido) |
| `company_a_legal_id` / `company_b_legal_id` | RUC/NIT/identificador legal si lo conoces (opcional — déjalo vacío si no lo tienes) |
| `company_a_legal_id_country` / `company_b_legal_id_country` | País del identificador legal, código de 2 letras (EC, PE, CO, US...) — opcional |
| `company_a_city` / `company_b_city` | Ciudad |
| `company_a_country` / `company_b_country` | País, código de 2 letras |
| `same_entity` | `yes` si son la MISMA empresa (aunque el nombre difiera), `no` si son empresas DISTINTAS (aunque el nombre coincida) |
| `case_type` | Describe brevemente el tipo de caso (ver ejemplos abajo) — ayuda a que el dataset cubra variedad, no solo casos fáciles |
| `source` | De dónde sacaste el dato (tu conocimiento del mercado, un registro público, un cliente conocido, etc.) — no hace falta un link, basta con que sea información real que tú puedas respaldar |
| `notes` | Cualquier aclaración útil |

## Tipos de caso que conviene cubrir (no hace falta que sean todos, pero mientras más variedad, mejor)

- **Mismo nombre, distinta empresa** — dos empresas reales sin relación que comparten nombre o son muy parecidas.
- **Nombre legal vs. nombre comercial de la misma empresa** — ej. "Distribuidora XYZ S.A." vs. "XYZ".
- **Ciudad ambigua entre países** — ej. San José (Costa Rica / EE.UU.), Santiago (Chile / otros), Cambridge, Georgetown, Springfield — casos donde el resolver debe reconocer la ambigüedad y NO adivinar el país.
- **Multinacional con matriz/filial cruzando países** — misma empresa/grupo con operación en Ecuador y en Perú (mercado objetivo de RHIA), donde hay una relación de ownership real y conocida (no solo nombres parecidos).
- **Casos "fáciles"** también sirven — nombres claramente distintos de empresas claramente distintas, o el mismo nombre exacto de la misma empresa en la misma ciudad — dan una base de control.

## Las 4 filas `EJEMPLO-XX` del CSV

Son solo ilustrativas (tomadas del propio Task Packet de PH06-T004, sin datos reales). **Bórralas o reemplázalas** por pares reales antes de considerarlo listo — un gold dataset con datos inventados no sirve como evidencia real (regla fija del proyecto: nunca evidencia simulada).

## Qué pasa después de llenarlo

1. Guarda el CSV lleno en `data/gold-datasets/entity-resolution-companies.csv` dentro del repo (mismo nombre, para que la próxima sesión lo encuentre).
2. Dile a Claude/a la próxima sesión que el dataset ya está — no hace falta que definas tú el umbral de aceptación exacto (precisión/recall mínimos), pero si tienes una preferencia (ej. "al menos 90% de aciertos") coméntala, si no, se propondrá uno razonable para que lo confirmes.
3. Esa sesión futura convierte cada fila a la entrada real que espera `@rhia/entity-resolver`, corre `resolveCompanyEntity()` contra cada par, mide el resultado, y con eso GATE-04 puede evaluarse de verdad (pasar o seguir bloqueado, pero ya con evidencia real en vez de "no existe el dataset").

## Mientras tanto

El trigger horario "RHIA - avance autónomo cada hora" va a seguir re-verificando este mismo bloqueo cada hora hasta que el archivo exista en `data/gold-datasets/`. Si prefieres pausarlo mientras completas esto, solo dilo.
