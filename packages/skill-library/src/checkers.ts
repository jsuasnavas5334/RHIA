// Skill Library (PH09-T004) -- interfaces inyectables para precondiciones y
// validacion final. Nunca implementadas con logica real de negocio dentro
// de este paquete puro (mismo principio que `SecretResolver` en los
// hermanos de PH09): el HOST decide como comprobar cada `id` declarado.

export interface PreconditionChecker {
  check(preconditionId: string, signal: AbortSignal): Promise<boolean>;
}

/** Accion "Validation final obligatoria": el HOST decide como verificar cada `validationId`; el worker solo garantiza que TODAS se corran y que ninguna se omita. */
export interface ValidationChecker {
  check(validationId: string, signal: AbortSignal): Promise<boolean>;
}
