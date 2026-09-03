import { containsTokenScorer, type TaskCase } from "./types.js";

// Reutiliza el baseline comercial ya auditado y con revision humana real en
// PH01-T004 (`tests/baseline/commercial_cases.json`, `commercial_cases.md`).
// Los prompts resumen el mismo escenario en texto plano; el gold label es el
// `marketAction` (o `searchAction` para el caso 4, que no tiene mercado) ya
// documentado y aprobado en ese baseline -- no se inventan gold labels nuevos
// para esta categoria.
const GOLD_PROVENANCE =
  "Heredado de PH01-T004 (tests/baseline/commercial_cases.json), con revision humana real documentada en docs/progress/PH01-T004.md.";

export const entityResolutionCases: readonly TaskCase[] = [
  {
    id: "BENCH-ER-001",
    taskClassId: "entity_resolution",
    name: "RHIA-COM-001: entidad clara con dos fuentes independientes",
    prompt:
      "Empresa 'Acme RHIA Demo' en San Jose, Costa Rica. Dos fuentes independientes confirman sitio oficial y entidad legal registrada, ambas apuntando al mismo mercado. Clasifica la accion de mercado (una sola palabra clave en mayusculas).",
    gold: "RESOLVER_ENTIDAD_COMERCIAL",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("RESOLVER_ENTIDAD_COMERCIAL"),
    referenceAnswer:
      "Accion: RESOLVER_ENTIDAD_COMERCIAL. Dos fuentes independientes confirman el mismo mercado con evidencia fuerte.",
  },
  {
    id: "BENCH-ER-002",
    taskClassId: "entity_resolution",
    name: "RHIA-COM-002: Empresa X con San Jose multigeografia",
    prompt:
      "Empresa 'Empresa X' aparece con 'San Jose' en tres mercados candidatos (Costa Rica, Estados Unidos, Belice), cada uno con una unica fuente debil. Ningun mercado tiene evidencia fuerte propia. La prioridad comercial de un pais NUNCA decide la identidad. Clasifica la accion de mercado (una sola palabra clave en mayusculas).",
    gold: "AMPLIAR_O_VALIDAR_EVIDENCIA",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("AMPLIAR_O_VALIDAR_EVIDENCIA"),
    referenceAnswer:
      "Accion: AMPLIAR_O_VALIDAR_EVIDENCIA. Tres mercados con evidencia debil y ambigua; la prioridad comercial no decide la identidad, ningun mercado se selecciona automaticamente.",
  },
  {
    id: "BENCH-ER-003",
    taskClassId: "entity_resolution",
    name: "RHIA-COM-003: entidad no encontrada con buscador saludable",
    prompt:
      "Se buscan seis variantes de consulta para 'Entidad Fantasma RHIA 9F2' en Ecuador; todas devuelven cero resultados y los motores de busqueda estan saludables (sin rate-limit ni CAPTCHA). SIN_RESULTADOS con motores saludables NUNCA autoriza afirmar que la empresa no existe. Clasifica la accion de mercado (una sola palabra clave en mayusculas).",
    gold: "AMPLIAR_O_VALIDAR_EVIDENCIA",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("AMPLIAR_O_VALIDAR_EVIDENCIA"),
    referenceAnswer:
      "Accion: AMPLIAR_O_VALIDAR_EVIDENCIA. Cero resultados con motores saludables se reformula; SIN_RESULTADOS nunca autoriza afirmar que la empresa no existe.",
  },
  {
    id: "BENCH-ER-004",
    taskClassId: "entity_resolution",
    name: "RHIA-COM-004: Empresa X con motores degradados",
    prompt:
      "Para 'Empresa X' se ejecutaron 18 consultas; solo 1 produjo resultados (20 URLs) y varios motores reportan rate-limit/CAPTCHA. La salud de busqueda es DEGRADADA con cobertura BAJA. Una busqueda con rate-limit se clasifica separado de la validez semantica. Clasifica la accion de busqueda (una sola palabra clave en mayusculas).",
    gold: "EVALUAR_Y_REINTENTAR_CONSULTAS",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("EVALUAR_Y_REINTENTAR_CONSULTAS"),
    referenceAnswer:
      "Accion: EVALUAR_Y_REINTENTAR_CONSULTAS. Salud DEGRADADA con rate-limit/CAPTCHA se distingue de invalidez semantica; se reintenta, no se descarta la entidad.",
  },
];
