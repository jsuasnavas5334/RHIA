// Messaging (PH08-T003) -- contratos locales. `Inference` refleja 1:1 la
// tabla real `inference` de packages/db/src/schema.ts (PH03-T001, ya
// cerrada) -- se definio aqui, en un tipo plano (sin zod), en vez de
// promoverla a @rhia/contracts o a @rhia/evidence-pipeline, porque:
//   1. Este packet no crea ningun modelo de datos nuevo -- la tabla
//      `inference` ya existe (id, organization_id, subject_type,
//      subject_id, inference_type, value, confidence, model_run_id,
//      supporting_fact_ids), se reusa tal cual, sin agregar columnas.
//   2. `@rhia/evidence-pipeline` (PH06-T003, ya DONE) declara `Fact` con
//      zod 4.4.3 real; esta sesion NO tiene acceso a red para instalar esa
//      version exacta de zod (solo una v3.25.76 transitiva disponible en
//      el contenedor cloud, incompatible en superficie de tipos con lo que
//      genera zod v4 -- p.ej. `z.core.$strict`). Reabrir/tocar
//      evidence-pipeline para agregar `Inference` ahi habria requerido esa
//      misma dependencia real de zod 4.4.3 y ademas reabrir una tarea
//      cerrada sin evidencia de regresion (prohibido por el protocolo del
//      proyecto). Un tipo plano local, honesto sobre esta limitacion, evita
//      ambos problemas sin bloquear el packet.
//
// `Fact` SI se reusa de verdad (import type, ver index.ts/context-pack.ts)
// -- ese import es solo de tipo y se confirmo empiricamente que compila
// real (tsc real, exit 0) contra el `dist/` ya construido de
// evidence-pipeline en una sesion anterior, aunque el zod disponible aqui
// sea v3 (ver docs/progress/PH08-T003.md, seccion de evidencia, para el
// detalle exacto de esta limitacion de entorno).

export type Inference = Readonly<{
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  inferenceType: string;
  value: unknown;
  confidence: number;
  modelRunId: string;
  supportingFactIds: readonly string[];
}>;
