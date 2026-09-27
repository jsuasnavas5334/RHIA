import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge, Loader } from '../components/common/Badge'
import { useLead } from '../api/hooks/useLeads'
import { LeadStatus } from '../types'

const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const leadId = id ? parseInt(id) : 0
  const { lead, loading, error, getLead, updateLead } = useLead(leadId)
  // Estado al que se está cambiando (null = ninguna petición de estado en curso)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [newNote, setNewNote] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  useEffect(() => {
    if (leadId) {
      getLead()
    }
  }, [leadId, getLead])

  // Ambas acciones envían el lead completo (PUT): si corrieran a la vez, la
  // segunda sobrescribiría el cambio de la primera con datos viejos.
  const isBusy = pendingStatus !== null || isAddingNote

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || isBusy || lead.estado === newStatus) return
    setPendingStatus(newStatus)
    try {
      await updateLead({ ...lead, estado: newStatus })
    } catch {
      // useLead ya guarda el mensaje en `error`; se muestra en el banner
    } finally {
      setPendingStatus(null)
    }
  }

  const handleAddNote = async () => {
    if (!lead || isBusy || !newNote.trim()) return
    setIsAddingNote(true)
    try {
      const updatedNotes = (lead.notas || '') + (lead.notas ? '\n' : '') + newNote
      await updateLead({
        ...lead,
        notas: updatedNotes,
      })
      setNewNote('')
    } catch {
      // se conserva la nota escrita para reintentar; el error va al banner
    } finally {
      setIsAddingNote(false)
    }
  }

  // useLead comparte `loading`/`error` entre getLead y updateLead: solo se
  // reemplaza la página completa cuando todavía no hay lead cargado.
  if (loading && !lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Lead no encontrado</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{lead.contacto_nombre}</h1>
        <Button onClick={() => navigate('/leads')} variant="outline">
          Volver
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          Error: {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-semibold text-gray-600">Empresa</label>
            <p className="text-lg">{lead.empresa_nombre}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Industria</label>
            <p className="text-lg">{lead.industria}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Email</label>
            <p className="text-lg">{lead.contacto_email}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Teléfono</label>
            <p className="text-lg">{lead.contacto_telefono || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Estado</label>
            <Badge status={lead.estado} className="mt-2" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Fuente</label>
            <p className="text-lg">{lead.fuente || 'N/A'}</p>
          </div>
        </div>
      </Card>

      {/* Status Change */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Cambiar Estado</h3>
        <div className="flex gap-2 flex-wrap">
          {(['nuevo', 'contactado', 'respondio', 'ganado', 'perdido'] as const).map((status) => (
            <Button
              key={status}
              onClick={() => handleStatusChange(status)}
              variant={lead.estado === status ? 'primary' : 'outline'}
              aria-pressed={lead.estado === status}
              loading={pendingStatus === status}
              disabled={isBusy}
              size="sm"
            >
              {status}
            </Button>
          ))}
        </div>
      </Card>

      {/* Notes Section */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Notas</h3>
        <div className="mb-4 p-3 bg-gray-50 rounded-lg min-h-[100px]">
          <p className="text-sm whitespace-pre-wrap">{lead.notas || 'Sin notas'}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Agregar nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddNote()
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleAddNote} loading={isAddingNote} disabled={isBusy}>
            Agregar
          </Button>
        </div>
      </Card>

      {/* Additional Info */}
      {lead.vacante_titulo && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Vacante</h3>
          <p className="font-semibold">{lead.vacante_titulo}</p>
          <p className="text-sm text-gray-600 mt-2">{lead.vacante_descripcion}</p>
          {lead.vacante_url && (
            <a href={lead.vacante_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-2 text-sm">
              Ver vacante
            </a>
          )}
        </Card>
      )}

      {/* Email Stats */}
      {lead.email_generado && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Estadísticas de Email</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600">Enviado el</label>
              <p>{lead.fecha_email_enviado ? new Date(lead.fecha_email_enviado).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Abierto</label>
              <p>{lead.email_abierto ? 'Sí' : 'No'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Clicks</label>
              <p>{lead.email_clicks || 0}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default LeadDetailPage
