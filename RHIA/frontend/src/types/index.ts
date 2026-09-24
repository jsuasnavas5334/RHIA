// API Response Types
export interface ApiResponse<T> {
  status: string
  data?: T
  error?: string
  message?: string
}

// Lead Types
export interface Lead {
  id: number
  empresa_nombre: string
  industria: string
  tamano_empleados?: number
  contacto_nombre: string
  contacto_email: string
  contacto_telefono?: string
  vacante_titulo?: string
  vacante_descripcion?: string
  vacante_url?: string
  pain_points?: string
  solucion_ofrecida?: string
  confianza_analisis?: number
  email_generado?: boolean
  fecha_email_enviado?: string
  email_abierto?: boolean
  email_clicks?: number
  estado: LeadStatus
  notas?: string
  fuente?: string
  fecha_creacion: string
  fecha_actualizado?: string
}

export type LeadStatus = 'nuevo' | 'contactado' | 'respondio' | 'ganado' | 'perdido' | string

export interface LeadCreateRequest {
  empresa_nombre: string
  industria: string
  tamano_empleados?: number
  contacto_nombre: string
  contacto_email: string
  contacto_telefono?: string
  vacante_titulo?: string
  vacante_descripcion?: string
  vacante_url?: string
  notas?: string
  fuente?: string
  confianza_analisis?: number
}

// User Types
export interface User {
  id: number
  email: string
  nombre_completo: string
  rol: UserRole
  activo: boolean
  token?: string
}

export type UserRole = 'admin' | 'sales' | 'manager' | 'viewer' | string

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
  expires_in: number
}

// Email Types
export interface Email {
  id: string
  lead_id: number
  recipient: string
  subject: string
  body: string
  sent_at: string
  opened: boolean
  status: string
}

export interface EmailGenerateRequest {
  lead_id: number
  template_name: string
}

export interface EmailGenerateResponse {
  lead_id: number
  subject: string
  body: string
  template_used: string
}

// Dashboard Types
export interface DashboardMetrics {
  total_leads: number
  leads_by_status: Record<string, number>
  leads_by_industry: Record<string, number>
  conversion_rate: number
  recent_activity_7days: number
  avg_response_time_hours: number
  timestamp: string
  // Campos adicionales usados en DashboardPage
  new_leads_this_month?: number
  won_leads?: number
  response_rate?: number
  emails_sent_this_week?: number
  emails_opened_this_week?: number
  new_contacts_this_week?: number
}

// Pagination Types
export interface PaginatedResponse<T> {
  page: number
  per_page: number
  total: number
  total_pages: number
  data: T[]
}

// Automation Types
export interface AutomationRule {
  id: number
  nombre: string
  descripcion?: string
  condicion: string
  accion: string
  frecuencia: string
  activo: boolean
  total_ejecuciones: number
  conteo_ejecuciones?: number
  ultima_ejecucion?: string
  proxima_ejecucion?: string
}

// Contact History Types
export interface ContactHistoryEntry {
  id: number
  lead_id: number
  tipo_interaccion: string
  descripcion: string
  fecha: string
  resultado: string
}

// Form Props
export interface LoginFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export interface CreateLeadFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  initialData?: Partial<Lead>
}

// Hook Return Types
export interface UseAuthReturn {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  token: string | null
  login: (credentials: LoginRequest) => Promise<{ success: boolean; token?: string; error?: any }>
  logout: () => void
}

export interface UseLeadsReturn {
  leads: Lead[]
  loading: boolean
  error: string | null
  fetchLeads: (page?: number) => Promise<void>
  getLeadById: (id: number) => Promise<Lead>
  createLead: (data: LeadCreateRequest) => Promise<Lead>
  updateLead: (id: number, data: Partial<Lead>) => Promise<Lead>
  deleteLead: (id: number) => Promise<void>
}

export interface UseDashboardReturn {
  metrics: DashboardMetrics | null
  loading: boolean
  error: string | null
  fetchMetrics: () => Promise<void>
}

export interface UseToastReturn {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}
