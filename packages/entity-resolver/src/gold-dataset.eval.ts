// GATE-04 -- script de evaluacion (no es un archivo *.test.ts: no corre
// dentro de `node --test`, se ejecuta a mano con `node dist/gold-dataset.eval.js`
// para generar el reporte legible). Ver gold-dataset.ts para la
// metodologia completa de los dos escenarios.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadGoldDataset, runGoldDatasetEvaluation } from './gold-dataset.js';

const dataset = loadGoldDataset();
const report = runGoldDatasetEvaluation(dataset);

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`);

const lines: string[] = [];
lines.push(`# Resultado real -- gold dataset ${dataset.name} contra @rhia/entity-resolver`);
lines.push('');
lines.push(`Generado: script real \`gold-dataset.eval.ts\`, sin edicion manual de los numeros.`);
lines.push('');
lines.push('## Escenario A -- solo nombre + pais (safety rail, sin ninguna senal de ownership)');
lines.push('');
lines.push(`Filas totales: ${report.scenarioA.totalRows}`);
lines.push(`Correctamente mantenidas separadas (isNewGroup=true): ${report.scenarioA.correctlySeparate} (${pct(report.scenarioA.correctlySeparate, report.scenarioA.totalRows)})`);
lines.push(`Fusionadas incorrectamente sin evidencia fuerte (bug real si > 0): ${report.scenarioA.incorrectlyMerged.length}`);
if (report.scenarioA.incorrectlyMerged.length > 0) {
  lines.push(`IDs fusionados incorrectamente: ${report.scenarioA.incorrectlyMerged.join(', ')}`);
}
lines.push('');
lines.push('## Escenario B -- señales reales disponibles (ownership solo donde el dataset lo declara)');
lines.push('');
lines.push(`Positivos (SAME_GROUP + DIRECT_LINK, se espera isNewGroup=false): ${report.scenarioB.positives}`);
lines.push(`Negativos (DISTINCT, se espera isNewGroup=true): ${report.scenarioB.negatives}`);
lines.push(`Excluidos de la metrica (GLOBAL_NETWORK, ambiguo por diseno -- ver detalle abajo): ${report.scenarioB.excludedAmbiguous}`);
lines.push('');
lines.push(`True positives: ${report.scenarioB.truePositives} / ${report.scenarioB.positives}`);
lines.push(`False negatives: ${report.scenarioB.falseNegatives} / ${report.scenarioB.positives}`);
lines.push(`True negatives: ${report.scenarioB.trueNegatives} / ${report.scenarioB.negatives}`);
lines.push(`False positives: ${report.scenarioB.falsePositives} / ${report.scenarioB.negatives}`);
lines.push('');
lines.push(`**Precision: ${(report.scenarioB.precision * 100).toFixed(1)}%**`);
lines.push(`**Recall: ${(report.scenarioB.recall * 100).toFixed(1)}%**`);
lines.push('');
lines.push(`De los ${report.scenarioB.positives} positivos, ${report.scenarioB.needsReviewOnPositives} quedaron en status NEEDS_REVIEW (confianza combinada bajo el umbral de auto-confirmacion) en vez de RESOLVED -- en produccion esos casos escalarian a revision humana en vez de auto-confirmarse, aunque isNewGroup ya haya quedado correcto.`);
lines.push('');
lines.push('## Casos GLOBAL_NETWORK (excluidos de la metrica, reportados aparte)');
lines.push('');
lines.push('Redes profesionales globales (Deloitte, PwC, EY, KPMG): cada firma miembro es una entidad legal separada por pais bajo una marca/red compartida, no una relacion de ownership real -- por eso NO se les agrego una señal de ownership sintetica (habria tergiversado la relacion real). Con solo señales de nombre+pais, el resultado es:');
lines.push('');
for (const row of report.scenarioB.ambiguousRows) {
  lines.push(`- #${row.id} ${row.marca}: isNewGroup=${row.isNewGroup}, status=${row.status}`);
}
lines.push('');
lines.push('Esto no es un fallo del resolver -- es una decision de producto sin resolver: si RHIA debe tratar firmas-miembro de una misma red profesional como una sola cuenta CRM o como cuentas separadas depende de como se vende, no de lo que el resolver puede inferir sin una señal de ownership o membership real.');

const reportMd = lines.join('\n') + '\n';
const outPath = fileURLToPath(new URL('../../../docs/gold-datasets/entity-resolution-ec-pe-v1-results.md', import.meta.url));
writeFileSync(outPath, reportMd, 'utf-8');

console.log(reportMd);
console.log(`\nReporte escrito en: ${outPath}`);
