# Resultado real -- gold dataset entity-resolution-ec-pe-v1 contra @rhia/entity-resolver

Generado: script real `gold-dataset.eval.ts`, sin edicion manual de los numeros.

## Escenario A -- solo nombre + pais (safety rail, sin ninguna senal de ownership)

Filas totales: 100
Correctamente mantenidas separadas (isNewGroup=true): 100 (100.0%)
Fusionadas incorrectamente sin evidencia fuerte (bug real si > 0): 0

## Escenario B -- señales reales disponibles (ownership solo donde el dataset lo declara)

Positivos (SAME_GROUP + DIRECT_LINK, se espera isNewGroup=false): 84
Negativos (DISTINCT, se espera isNewGroup=true): 12
Excluidos de la metrica (GLOBAL_NETWORK, ambiguo por diseno -- ver detalle abajo): 4

True positives: 84 / 84
False negatives: 0 / 84
True negatives: 12 / 12
False positives: 0 / 12

**Precision: 100.0%**
**Recall: 100.0%**

De los 84 positivos, 0 quedaron en status NEEDS_REVIEW (confianza combinada bajo el umbral de auto-confirmacion) en vez de RESOLVED -- en produccion esos casos escalarian a revision humana en vez de auto-confirmarse, aunque isNewGroup ya haya quedado correcto.

## Casos GLOBAL_NETWORK (excluidos de la metrica, reportados aparte)

Redes profesionales globales (Deloitte, PwC, EY, KPMG): cada firma miembro es una entidad legal separada por pais bajo una marca/red compartida, no una relacion de ownership real -- por eso NO se les agrego una señal de ownership sintetica (habria tergiversado la relacion real). Con solo señales de nombre+pais, el resultado es:

- #94 Deloitte: isNewGroup=true, status=RESOLVED
- #95 PwC: isNewGroup=true, status=RESOLVED
- #96 EY: isNewGroup=true, status=RESOLVED
- #97 KPMG: isNewGroup=true, status=RESOLVED

Esto no es un fallo del resolver -- es una decision de producto sin resolver: si RHIA debe tratar firmas-miembro de una misma red profesional como una sola cuenta CRM o como cuentas separadas depende de como se vende, no de lo que el resolver puede inferir sin una señal de ownership o membership real.
