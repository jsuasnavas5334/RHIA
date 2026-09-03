import { containsTokenScorer, type TaskCase } from "./types.js";

// Dataset sintetico propio de RHIA (clasificacion de intencion de mensajes
// entrantes de prospectos), sin datos de prospectos reales ni secretos.
// Nombres y dominios son ficticios (".invalid" o genericos "Demo").
// Gold labels definidos por este ciclo autonomo -- PENDIENTE de revision
// humana real antes de usarse para enrutar decisiones de produccion (ver
// docs/progress/PH05-T004.md, seccion Riesgos).
const GOLD_PROVENANCE = "Sintetico, autor: ciclo autonomo RHIA 2026-08-29. PENDIENTE revision humana real.";

export const classificationCases: readonly TaskCase[] = [
  {
    id: "BENCH-CL-001",
    taskClassId: "classification",
    name: "Prospecto pide agendar una llamada",
    prompt:
      "Mensaje entrante de 'Empresa Demo Alfa': 'Nos interesa conocer mas, ¿podemos agendar una llamada la proxima semana?'. Clasifica la intencion (una sola palabra clave en mayusculas): INTERESADO_EN_REUNION, SOLICITA_PRECIO, NO_INTERESADO o SPAM_O_IRRELEVANTE.",
    gold: "INTERESADO_EN_REUNION",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("INTERESADO_EN_REUNION"),
    referenceAnswer: "Intencion: INTERESADO_EN_REUNION. El prospecto pide explicitamente agendar una llamada.",
  },
  {
    id: "BENCH-CL-002",
    taskClassId: "classification",
    name: "Prospecto pregunta por precio directamente",
    prompt:
      "Mensaje entrante de 'Empresa Demo Beta': '¿Cuanto cuesta el plan mensual?'. Clasifica la intencion (una sola palabra clave en mayusculas): INTERESADO_EN_REUNION, SOLICITA_PRECIO, NO_INTERESADO o SPAM_O_IRRELEVANTE.",
    gold: "SOLICITA_PRECIO",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("SOLICITA_PRECIO"),
    referenceAnswer: "Intencion: SOLICITA_PRECIO. Pregunta directamente por el costo del plan.",
  },
  {
    id: "BENCH-CL-003",
    taskClassId: "classification",
    name: "Prospecto declina explicitamente",
    prompt:
      "Mensaje entrante de 'Empresa Demo Gamma': 'Gracias, pero no es el momento, por favor no nos contacten mas.'. Clasifica la intencion (una sola palabra clave en mayusculas): INTERESADO_EN_REUNION, SOLICITA_PRECIO, NO_INTERESADO o SPAM_O_IRRELEVANTE.",
    gold: "NO_INTERESADO",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("NO_INTERESADO"),
    referenceAnswer: "Intencion: NO_INTERESADO. Pide explicitamente no ser contactado de nuevo.",
  },
];
