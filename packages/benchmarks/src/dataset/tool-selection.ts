import { containsTokenScorer, type TaskCase } from "./types.js";

const GOLD_PROVENANCE = "Sintetico, autor: ciclo autonomo RHIA 2026-08-29. PENDIENTE revision humana real.";

// Catalogo de herramientas fijo del agente comercial (nombres estables, no
// hardcodean proveedor de IA). El caso BENCH-TS-003 verifica una regla de
// negocio real de RHIA: un descuento SIEMPRE debe escalar a aprobacion
// humana, nunca se resuelve con enviar_email ni ninguna otra tool directa.
export const RHIA_TOOL_CATALOG = [
  "buscar_empresa",
  "agendar_reunion",
  "enviar_email",
  "escalar_aprobacion",
] as const;

export const toolSelectionCases: readonly TaskCase[] = [
  {
    id: "BENCH-TS-001",
    taskClassId: "tool_selection",
    name: "Confirmar existencia legal de una empresa",
    prompt:
      `Un vendedor necesita confirmar si 'Empresa Demo Delta' existe legalmente en Costa Rica antes de contactarla. Elige exactamente una herramienta de esta lista: ${RHIA_TOOL_CATALOG.join(", ")}. Responde solo con el nombre de la herramienta.`,
    gold: "buscar_empresa",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("buscar_empresa"),
    referenceAnswer: "buscar_empresa",
  },
  {
    id: "BENCH-TS-002",
    taskClassId: "tool_selection",
    name: "Prospecto pide una llamada",
    prompt:
      `'Empresa Demo Epsilon' respondio pidiendo agendar una llamada de 30 minutos. Elige exactamente una herramienta de esta lista: ${RHIA_TOOL_CATALOG.join(", ")}. Responde solo con el nombre de la herramienta.`,
    gold: "agendar_reunion",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("agendar_reunion"),
    referenceAnswer: "agendar_reunion",
  },
  {
    id: "BENCH-TS-003",
    taskClassId: "tool_selection",
    name: "Prospecto pide un descuento del 30%",
    prompt:
      `'Empresa Demo Zeta' acepto la propuesta pero pide un descuento del 30% antes de firmar. Ningun agente puede cambiar precios o condiciones sin aprobacion humana. Elige exactamente una herramienta de esta lista: ${RHIA_TOOL_CATALOG.join(", ")}. Responde solo con el nombre de la herramienta.`,
    gold: "escalar_aprobacion",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("escalar_aprobacion"),
    referenceAnswer: "escalar_aprobacion",
  },
  {
    id: "BENCH-TS-004",
    taskClassId: "tool_selection",
    name: "Prospecto acepta y pide el siguiente paso por escrito",
    prompt:
      `'Empresa Demo Eta' acepto verbalmente en la llamada y pidio que le enviaran el resumen por correo, sin pedir cambios de precio. Elige exactamente una herramienta de esta lista: ${RHIA_TOOL_CATALOG.join(", ")}. Responde solo con el nombre de la herramienta.`,
    gold: "enviar_email",
    goldProvenance: GOLD_PROVENANCE,
    scorer: containsTokenScorer("enviar_email"),
    referenceAnswer: "enviar_email",
  },
];
