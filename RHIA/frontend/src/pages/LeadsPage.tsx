import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge, Loader } from '../components/common/Badge'
import { Checkbox } from '../components/common/Checkbox'
import { Modal } from '../components/common/Modal'
import { useLeads } from '../api/hooks/useLeads'
import { useLeadsStore } from '../store/leadsStore'
import { useToastContext } from '../context/ToastContext'
import { exportLeadsToCSV } from '../utils/csv'

const LeadsPage: React.FC = () => {
  const navigate = useNavigate()
  const { leads, total, loading, error, fetchLeads, updateLead, deleteLead } = useLeads()
  const { filters, setFilters, currentPage, setCurrentPage, perPage } = useLeadsStore()
  const toast = useToastContext()
  const [searchTerm, setSearchTerm] = useState(filters.search || '')
  const [statusFilter, setStatusFilter] = useState(filters.status || '')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => {
    fetchLeads({
      page: currentPage,
      per_page: perPage,
      status: statusFilter || undefined,
      search: searchTerm || undefined,
      industry: filters.industry,
    })
  }, [currentPage, statusFilter, searchTerm])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const handleDeleteLead = async (leadId: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este lead?')) {
      const result = await deleteLead(leadId)
      if (result?.success) {
        toast.success('Lead eliminado exitosamente')
      } else {
        toast.error(result?.error || 'Error al eliminar el lead')
      }
    }
  }

  const handleSelectLead = (leadId: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)))
    }
  }

  const handleExportLeads = () => {
    try {
      const leadsToExport = selectedIds.size > 0
        ? leads.filter((l) => selectedIds.has(l.id))
        : leads

      if (leadsToExport.length === 0) {
        toast.warning('No hay leads para exportar')
        return
      }

      exportLeadsToCSV(leadsToExport, `leads-${new Date().toISOString().split('T')[0]}.csv`)
      toast.success(`${leadsToExport.length} leads exportados exitosamente`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un lead')
      return
    }

    let updated = 0
    let failed = 0
    for (const leadId of selectedIds) {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) continue
      const result = await updateLead(leadId, { ...lead, estado: newStatus })
      if (result?.success) {
        updated++
      } else {
        failed++
      }
    }

    setSelectedIds(new Set())
    if (updated > 0) toast.success(`${updated} leads actualizados a ${newStatus}`)
    if (failed > 0) toast.error(`${failed} leads no se pudieron actualizar`)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un lead para eliminar')
      return
    }

    if (!window.confirm(`¿Eliminar ${selectedIds.size} leads?`)) {
      return
    }

    let deleted = 0
    let failed = 0
    for (const leadId of selectedIds) {
      // deleteLead no lanza: devuelve { success: false } si falla
      const result = await deleteLead(leadId)
      if (result?.success) {
        deleted++
      } else {
        failed++
      }
    }

    setSelectedIds(new Set())
    if (deleted > 0) toast.success(`${deleted} leads eliminados`)
    if (failed > 0) toast.error(`${failed} leads no se pudieron eliminar`)
  }

  const handleImportFile = async () => {
    if (!importFile) {
      toast.warning('Selecciona un archivo CSV')
      return
    }

    try {
      const text = await importFile.text()
      const lines = text.split('\n')

      if (lines.length < 2) {
        toast.error('Archivo CSV vacío')
        return
      }

      // Count valid rows (skip header)
      const validRows = lines.slice(1).filter((line) => line.trim().length > 0)
      toast.success(`${validRows.length} leads importados (función en desarrollo)`)
      setIsImportOpen(false)
      setImportFile(null)
    } catch (err: any) {
      toast.error('Error al procesar archivo: ' + err.message)
    }
  }

  const totalPages = Math.ceil((total || 0) / perPage)

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" message="Cargando leads..." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gestiona todos tus leads y su evolución en el embudo de ventas
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
          >
            ↓ Importar
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportLeads}
          >
            ↑ Exportar {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/leads/new')}
          >
            + Nuevo Lead
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-900 dark:text-blue-200">
              {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <select
                onChange={(e) => e.target.value && handleBulkStatusChange(e.target.value)}
                className="px-3 py-1 text-sm border rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">Cambiar estado a...</option>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="respondio">Respondió</option>
                <option value="ganado">Ganado</option>
                <option value="perdido">Perdido</option>
              </select>
              <Button
                size="sm"
                variant="danger"
                onClick={handleBulkDelete}
              >
                Eliminar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Buscar"
              placeholder="Empresa, contacto, email..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="respondio">Respondió</option>
                <option value="ganado">Ganado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resultados
              </label>
              <div className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-md text-gray-900 dark:text-white">
                {leads.length} de {total}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 mb-6">
          <p className="text-red-700 dark:text-red-400">Error: {error}</p>
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800">
              <th className="px-4 py-3">
                <Checkbox
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Industria
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                    selectedIds.has(lead.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onChange={() => handleSelectLead(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {lead.empresa_nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div>{lead.contacto_nombre}</div>
                    <div className="text-xs text-gray-500">{lead.contacto_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {lead.industria}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge status={lead.estado} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteLead(lead.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  {loading ? 'Cargando...' : 'No hay leads con esos filtros'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Importar Leads desde CSV"
        onConfirm={handleImportFile}
        confirmText="Importar"
        confirmVariant="success"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecciona un archivo CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Formato esperado:</p>
            <p>ID,Empresa,Contacto,Email,Teléfono,Industria,Tamaño,Estado,Vacante,Pain Points,Solución,Confianza,Fecha</p>
          </div>
        </div>
      </Modal>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              ← Anterior
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadsPage
