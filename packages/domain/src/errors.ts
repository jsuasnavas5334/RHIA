export const errorCategories = ['VALIDATION', 'DEPENDENCY', 'RATE_LIMIT', 'TIMEOUT', 'CONFLICT', 'POLICY', 'INTERNAL'] as const;
export type ErrorCategory = (typeof errorCategories)[number];

export const errorCodes = [
  'RHIA_STATE_INVALID_TRANSITION',
  'RHIA_CONTRACT_INVALID_PAYLOAD',
  'RHIA_SEARCH_PROVIDER_DEGRADED',
  'RHIA_SEARCH_PROVIDER_UNAVAILABLE',
  'RHIA_SEARCH_RATE_LIMITED',
  'RHIA_SEARCH_CAPTCHA_BLOCKED',
  'RHIA_SEARCH_TIMEOUT',
  'RHIA_WORKFLOW_TIMEOUT',
  'RHIA_ENTITY_AMBIGUOUS',
  'RHIA_APPROVAL_REQUIRED',
  'RHIA_POLICY_DENIED',
  'RHIA_JOB_RETRY_EXHAUSTED',
  'RHIA_OUTREACH_OPTED_OUT',
  'RHIA_OUTREACH_PERMANENT_BOUNCE',
  'RHIA_MODEL_RATE_LIMITED',
  'RHIA_MODEL_PROVIDER_UNAVAILABLE',
  'RHIA_TOOL_FORBIDDEN',
  'RHIA_CORE_UNEXPECTED_FAILURE',
] as const;

export type ErrorCode = (typeof errorCodes)[number];
export type ErrorDefinition = Readonly<{
  category: ErrorCategory;
  retryable: boolean;
  terminal: boolean;
  description: string;
}>;

export const errorCatalog: Readonly<Record<ErrorCode, ErrorDefinition>> = {
  RHIA_STATE_INVALID_TRANSITION: { category: 'CONFLICT', retryable: false, terminal: false, description: 'La transición no pertenece a la máquina declarada.' },
  RHIA_CONTRACT_INVALID_PAYLOAD: { category: 'VALIDATION', retryable: false, terminal: true, description: 'El payload no cumple el contrato versionado.' },
  RHIA_SEARCH_PROVIDER_DEGRADED: { category: 'DEPENDENCY', retryable: true, terminal: false, description: 'La búsqueda respondió con salud técnica degradada.' },
  RHIA_SEARCH_PROVIDER_UNAVAILABLE: { category: 'DEPENDENCY', retryable: true, terminal: false, description: 'El proveedor de búsqueda no está disponible.' },
  RHIA_SEARCH_RATE_LIMITED: { category: 'RATE_LIMIT', retryable: true, terminal: false, description: 'El proveedor limitó temporalmente las solicitudes.' },
  RHIA_SEARCH_CAPTCHA_BLOCKED: { category: 'DEPENDENCY', retryable: true, terminal: false, description: 'La fuente bloqueó la automatización mediante CAPTCHA.' },
  RHIA_SEARCH_TIMEOUT: { category: 'TIMEOUT', retryable: true, terminal: false, description: 'La búsqueda excedió su tiempo permitido.' },
  RHIA_WORKFLOW_TIMEOUT: { category: 'TIMEOUT', retryable: true, terminal: false, description: 'El workflow excedió su tiempo permitido.' },
  RHIA_ENTITY_AMBIGUOUS: { category: 'CONFLICT', retryable: false, terminal: false, description: 'La evidencia no permite resolver una identidad única.' },
  RHIA_APPROVAL_REQUIRED: { category: 'POLICY', retryable: false, terminal: false, description: 'La acción requiere decisión humana.' },
  RHIA_POLICY_DENIED: { category: 'POLICY', retryable: false, terminal: true, description: 'La política prohíbe la acción solicitada.' },
  RHIA_JOB_RETRY_EXHAUSTED: { category: 'INTERNAL', retryable: false, terminal: true, description: 'El job agotó sus intentos permitidos.' },
  RHIA_OUTREACH_OPTED_OUT: { category: 'POLICY', retryable: false, terminal: true, description: 'El contacto solicitó detener comunicaciones.' },
  RHIA_OUTREACH_PERMANENT_BOUNCE: { category: 'DEPENDENCY', retryable: false, terminal: true, description: 'El destino rechazó permanentemente el mensaje.' },
  RHIA_MODEL_RATE_LIMITED: { category: 'RATE_LIMIT', retryable: true, terminal: false, description: 'El proveedor de modelo aplicó rate limit.' },
  RHIA_MODEL_PROVIDER_UNAVAILABLE: { category: 'DEPENDENCY', retryable: true, terminal: false, description: 'El proveedor de modelo no está disponible.' },
  RHIA_TOOL_FORBIDDEN: { category: 'POLICY', retryable: false, terminal: true, description: 'La capability o política no autoriza la herramienta.' },
  RHIA_CORE_UNEXPECTED_FAILURE: { category: 'INTERNAL', retryable: false, terminal: true, description: 'Core produjo un fallo no clasificado y seguro para logs.' },
};

export const getErrorDefinition = (code: ErrorCode): ErrorDefinition => errorCatalog[code];
