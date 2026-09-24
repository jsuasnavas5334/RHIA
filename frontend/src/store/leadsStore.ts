import { create } from 'zustand'
import { Lead, LeadStatus } from '../types'

interface LeadsFilter {
  status?: LeadStatus
  industry?: string
  search?: string
}

interface LeadsState {
  leads: Lead[]
  filters: LeadsFilter
  currentPage: number
  perPage: number
  total: number

  setLeads: (leads: Lead[]) => void
  setFilters: (filters: LeadsFilter) => void
  setCurrentPage: (page: number) => void
  setTotal: (total: number) => void
  addLead: (lead: Lead) => void
  updateLead: (lead: Lead) => void
  removeLead: (leadId: number) => void
  clearFilters: () => void
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  filters: {},
  currentPage: 1,
  perPage: 20,
  total: 0,

  setLeads: (leads) => set({ leads }),

  setFilters: (filters) =>
    set({
      filters,
      currentPage: 1, // Reset to first page when filters change
    }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setTotal: (total) => set({ total }),

  addLead: (lead) =>
    set((state) => ({
      leads: [lead, ...state.leads],
      total: state.total + 1,
    })),

  updateLead: (lead) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === lead.id ? lead : l)),
    })),

  removeLead: (leadId) =>
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== leadId),
      total: state.total - 1,
    })),

  clearFilters: () =>
    set({
      filters: {},
      currentPage: 1,
    }),
}))
