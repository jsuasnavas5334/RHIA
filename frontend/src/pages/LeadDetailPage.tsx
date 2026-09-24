import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge, Loader } from '../components/common/Badge'
import { useLead } from '../api/hooks/useLeads'
import { Lead, LeadStatus } from '../types'

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const leadId = id ? parseInt(id) : 0
  const { lead, loading, error, getLead, updateLead } = useLead(leadId)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedLead, setEditedLead] = useState<Lead | null>(null)
  const [newNote, setNewNote] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  useEffect(() => {
    getLead()
  }, [leadId])

  useEffect(() => {
    if (lead) {
      setEditedLead(lead)
    }
  }, [lead])

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return
    setIsSaving(true)
    await updateLead({ ...lead, estado: newStatus })
    setIsSaving(false)
  }

  const handleSave = async () => {
    if (!editedLead) return
    setIsSaving(true)
    await updateLead(editedLead)
    setIsEditing(false)
    setIsSaving(false)
  }

  const handleAddNote = async () => {
    if (!lead || !newNote.trim()) return
    setIsAddingNote(true)
    await updateLead({
      ...lead,
      notas: (lead.notas || '') + (lead.notas ? '\n' : '') + newNote,
    })
    setNewNote('')
    setIsAddingNote(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" message="Cargando lead..." />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button variant="secondary" onClick={() => navigate('/leads')}>
          ← Volver a Leads
        </Button>
        <Card className="mt-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">
            {error || 'No se encontró el lead'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="secondary" onClick={() => navigate('/leads')} className="mb-6">
        ← Volver a Leads
      </Button>

      <div className="grid gap-6">
        {/* Información Principal */}
        <Card>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lead.empresa_nombre}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {lead.contacto_nombre} • {lead.contacto_email}
              </p>
            </div>
            <div className="text-right">
              <Badge status={lead.estado} />
              <div className="mt-2 text-xs text-gray-500">
                {new Date(lead.fecha_creacion).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>

          {!isEditing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEditing(true)}
              className="mb-6"
            >
              Editar
            </Button>
          )}

          {isEditing && editedLead ? (
            <div className="space-y-4 mb-6">
              <Input
                label="Empresa"
                value={editedLead.empresa_nombre}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, empresa_nombre: e.target.value })
                }
              />
              <Input
                label="Nombre de Contacto"
                value={editedLead.contacto_nombre}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, contacto_nombre: e.target.value })
                }
              />
              <Input
                label="Email"
                type="email"
                value={editedLead.contacto_email}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, contacto_email: e.target.value })
                }
              />
              <Input
                label="Teléfono"
                value={editedLead.contacto_telefono || ''}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, contacto_telefono: e.target.value })
                }
              />
              <Input
                label="Industria"
                value={editedLead.industria}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, industria: e.target.value })
                }
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isSaving}
                >
                  Guardar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false)
                    setEditedLead(lead)
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Industria</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.industria}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tamaño</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.tamano_empleados} empleados
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.contacto_telefono || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fuente</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.fuente || '-'}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Cambio de Estado */}
        <Card title="Cambiar Estado">
          <div className="flex gap-2 flex-wrap">
            {(['nuevo', 'contactado', 'respondio', 'ganado', 'perdido'] as LeadStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={lead.estado === status ? 'primary' : 'secondary'}
                  onClick={() => handleStatusChange(status)}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              )
            )}
          </div>
        </Card>

        {/* Detalles de Vacante */}
        <Card title="Oportunidad / Vacante" subtitle="Detalles de la posición de interés">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Título</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lead.vacante_titulo || '-'}
              </p>
            </div>
            {lead.vacante_url && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">URL</p>
                <a
                  href={lead.vacante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ver vacante
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Descripción</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {lead.vacante_descripcion || '-'}
              </p>
            </div>
          </div>
        </Card>

        {/* Analysis y Solución */}
        <Card title="Análisis y Propuesta">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pain Points</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {lead.pain_points || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Solución Ofrecida
              </p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {lead.solucion_ofrecida || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Confianza en Análisis
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${lead.confianza_analisis || 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">
                  {lead.confianza_analisis || 0}%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Notas */}
        <Card title="Notas y Observaciones">
          <div className="space-y-4">
            {lead.notas && (
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-md">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {lead.notas}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Input
                label="Agregar Nota"
                placeholder="Escribe una nueva nota..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddNote}
                loading={isAddingNote}
                disabled={!newNote.trim() || isAddingNote}
              >
                Agregar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
