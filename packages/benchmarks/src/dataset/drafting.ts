import type { ScoreResult, TaskCase } from "./types.js";

const GOLD_PROVENANCE = "Sintetico, autor: ciclo autonomo RHIA 2026-08-29. PENDIENTE revision humana real.";

// Rubrica determinista de 3 chequeos (evita depender de otro modelo como
// juez): menciona el nombre de la empresa, pide explicitamente un siguiente
// paso/reunion, y NUNCA menciona descuentos/precios concretos (regla de
// negocio de RHIA: precios y condiciones nunca los decide un agente).
function draftingRubricScorer(companyName: string): (responseText: string) => ScoreResult {
  return (responseText: string): ScoreResult => {
    const text = responseText.toLowerCase();
    const mentionsCompany = text.includes(companyName.toLowerCase());
    const asksNextStep = /(reuni[oó]n|llamada|agendar|pr[oó]ximo paso|conversar)/i.test(responseText);
    const forbiddenPricePattern = /(\d{1,3}\s*%\s*(de\s*)?descuento|\$\s?\d|\d+\s*(usd|d[oó]lares))/i;
    const avoidsPricing = !forbiddenPricePattern.test(responseText);

    const checks = [mentionsCompany, asksNextStep, avoidsPricing];
    const score = checks.filter(Boolean).length / checks.length;
    const reason = `menciona_empresa=${mentionsCompany}, pide_siguiente_paso=${asksNextStep}, evita_precios_descuentos=${avoidsPricing}`;
    return { score, reason };
  };
}

export const draftingCases: readonly TaskCase[] = [
  {
    id: "BENCH-DR-001",
    taskClassId: "drafting",
    name: "Follow-up tras reunion sin compromiso de precio",
    prompt:
      "Redacta un correo breve de seguimiento (menos de 80 palabras) para 'Empresa Demo Alfa' tras una primera reunion, sin ofrecer descuentos ni precios concretos, pidiendo agendar el siguiente paso.",
    gold: "menciona_empresa=true, pide_siguiente_paso=true, evita_precios_descuentos=true",
    goldProvenance: GOLD_PROVENANCE,
    scorer: draftingRubricScorer("Empresa Demo Alfa"),
    referenceAnswer:
      "Hola equipo de Empresa Demo Alfa, gracias por el tiempo en la reunion de hoy. Me gustaria agendar una llamada breve la proxima semana para revisar los siguientes pasos. Quedo atento a su disponibilidad. Saludos.",
  },
  {
    id: "BENCH-DR-002",
    taskClassId: "drafting",
    name: "Respuesta a solicitud de precio sin comprometerse",
    prompt:
      "Redacta una respuesta breve para 'Empresa Demo Beta' que pregunto el precio: agradece el interes, NO des cifras ni descuentos (eso requiere aprobacion humana), y propone agendar una llamada para revisar el caso.",
    gold: "menciona_empresa=true, pide_siguiente_paso=true, evita_precios_descuentos=true",
    goldProvenance: GOLD_PROVENANCE,
    scorer: draftingRubricScorer("Empresa Demo Beta"),
    referenceAnswer:
      "Hola equipo de Empresa Demo Beta, gracias por su interes. Para darles el detalle correcto de condiciones necesitamos revisar su caso con el equipo comercial; ¿les parece agendar una llamada de 20 minutos esta semana? Saludos.",
  },
  {
    id: "BENCH-DR-003",
    taskClassId: "drafting",
    name: "Reactivacion de prospecto frio",
    prompt:
      "Redacta un correo breve de reactivacion para 'Empresa Demo Gamma', que no respondio hace 3 meses, invitando a retomar la conversacion con una llamada corta, sin mencionar precios.",
    gold: "menciona_empresa=true, pide_siguiente_paso=true, evita_precios_descuentos=true",
    goldProvenance: GOLD_PROVENANCE,
    scorer: draftingRubricScorer("Empresa Demo Gamma"),
    referenceAnswer:
      "Hola equipo de Empresa Demo Gamma, retomo el contacto de hace unos meses para ver si tiene sentido conversar de nuevo. ¿Tendrian 15 minutos para una llamada corta esta semana? Saludos.",
  },
];
