// PH07-T004 -- funciones puras que calculan el `rawScore` [0,1] de cada
// componente (accion 1). Cada una es deliberadamente simple y documentada
// como heuristica v1 (mismo patron que el resto del repo: classifySourceReliability,
// nameSimilarity, deriveTargetRoles...) -- ninguna pretende ser un modelo
// aprendido.

/** FIT: proporcion de criterios de encaje (ICP) que la oportunidad cumple.
 * Sin criterios declarados, no hay forma de afirmar fit real -- se
 * documenta como neutro (0.5), nunca como "encaje perfecto" (1) sin
 * evidencia de por que. */
export const fitScore = (matchedCriteria: number, totalCriteria: number): number => {
  if (totalCriteria <= 0) return 0.5;
  return Math.min(1, Math.max(0, matchedCriteria / totalCriteria));
};

export type OpportunitySignalInput = Readonly<{
  weight: number; // 0..1, mismo rango que `opportunity_signal.weight` normalizado por el llamador.
  hasEvidence: boolean; // `opportunity_signal.evidence_id` es NOT NULL en el esquema real -- toda señal real tiene evidencia.
}>;

/** SIGNAL: promedio ponderado de las señales de intención/interés
 * aportadas. Una señal SIN evidencia (que en el esquema real es imposible
 * de persistir, `opportunity_signal.evidence_id` es NOT NULL) nunca se
 * cuenta -- protege contra inflar el score con señales que no podrían
 * existir de verdad en `opportunity_signal`. Sin ninguna señal, 0 (nunca se
 * inventa una señal implícita). */
export const signalScore = (signals: readonly OpportunitySignalInput[]): number => {
  const withEvidence = signals.filter((signal) => signal.hasEvidence);
  if (withEvidence.length === 0) return 0;
  const total = withEvidence.reduce((sum, signal) => sum + Math.min(1, Math.max(0, signal.weight)), 0);
  return Math.min(1, total / withEvidence.length);
};

/** CONTACTABILITY: proporcion de puntos de contacto "sendables" (ver
 * `isSendableContactPoint`/PH07-T003 -- no se importa ese paquete
 * directamente para no acoplar `packages/*` con `apps/core-api`; el
 * llamador real ya sabe cuantos de sus contact points son sendable, aqui
 * solo se calcula la proporcion). Sin ningun contact point, 0 -- una
 * oportunidad sin forma de contactar a nadie no puede tener contactabilidad
 * alta, sin importar cuan buena sea en otros componentes. */
export const contactabilityScore = (sendablePoints: number, totalPoints: number): number => {
  if (totalPoints <= 0) return 0;
  return Math.min(1, Math.max(0, sendablePoints / totalPoints));
};

/** TIMING: una oportunidad con una `nextActionAt` cercana en el futuro
 * puntua alto (hay algo que hacer pronto); sin `nextActionAt`, o ya vencida
 * hace mucho, puntua bajo -- nunca alto por ausencia de dato (ausencia de
 * timing no es "buen timing"). Decae linealmente sobre una ventana de 30
 * dias (heuristica v1 explicita). */
export const DEFAULT_TIMING_WINDOW_DAYS = 30;

export const timingScore = (
  nextActionAt: string | null,
  now: Date,
  windowDays: number = DEFAULT_TIMING_WINDOW_DAYS,
): number => {
  if (!nextActionAt) return 0;
  const diffMs = new Date(nextActionAt).getTime() - now.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays < 0) return 0; // vencida -- ya no es "pronto", es tarde.
  if (diffDays === 0) return 1;
  return Math.min(1, Math.max(0, 1 - diffDays / windowDays));
};

/** EVIDENCE: mas evidencia real respaldando la oportunidad sube el score,
 * con retornos decrecientes (no lineal indefinido) -- 0 evidencia da 0
 * exacto (Pruebas requeridas del packet: "No evidence test"), nunca un
 * numero positivo "por si acaso". Satura cerca de 1 alrededor de
 * `saturationCount` piezas de evidencia. */
export const DEFAULT_EVIDENCE_SATURATION_COUNT = 5;

export const evidenceScore = (evidenceCount: number, saturationCount: number = DEFAULT_EVIDENCE_SATURATION_COUNT): number => {
  if (evidenceCount <= 0) return 0;
  return Math.min(1, evidenceCount / saturationCount);
};
