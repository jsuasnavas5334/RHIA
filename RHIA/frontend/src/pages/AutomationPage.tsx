import React, { useEffect, useState } from 'react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge, Loader } from '../components/common/Badge'
import api from '../api/client'
import { AutomationRule } from '../types'

const AutomationPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  // Regla con una petición (activar/desactivar/eliminar) en curso:
  // evita peticiones duplicadas por doble clic.
  const [pendingRuleId, setPendingRuleId] = useState<number | null>(null)
  const [newRule, setNewRule] = useState({
    nombre: '',
    descripcion: '',
    condiciones: '{}',
    acciones: '{}',
    frecuencia: 'immediate' as const,
    activo: true,
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ data: AutomationRule[] }>('/automation/rules')
      setRules(response.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar reglas de automatización')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRule = async () => {
    if (!newRule.nombre.trim()) {
      setError('El nombre de la regla es obligatorio')
      return
    }

    setLoading(true)
    try {
      await api.post('/automation/rules', newRule)
      setNewRule({
        nombre: '',
        descripcion: '',
        condiciones: '{}',
        acciones: '{}',
        frecuencia: 'immediate',
        activo: true,
      })
      setIsCreating(false)
      await fetchRules()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear regla')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRule = async (ruleId: number, activo: boolean) => {
    if (pendingRuleId !== null) return
    setPendingRuleId(ruleId)
    try {
      const rule = rules.find((r) => r.id === ruleId)
      if (rule) {
        await api.put(`/automation/rules/${ruleId}`, {
          ...rule,
          activo: !activo,
        })
        await fetchRules()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar regla')
    } finally {
      setPendingRuleId(null)
    }
  }

  const handleDeleteRule = async (ruleId: number) => {
    if (pendingRuleId !== null) return
    if (window.confirm('¿Eliminar esta regla de automatización?')) {
      setPendingRuleId(ruleId)
      try {
        await api.delete(`/automation/rules/${ruleId}`)
        await fetchRules()
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Error al eliminar regla')
      } finally {
        setPendingRuleId(null)
      }
    }
  }

  // Loader a pantalla completa solo en la carga inicial: al crear la
  // primera regla no debe desmontarse el formulario.
  if (loading && rules.length === 0 && !isCreating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" message="Cargando automatizaciones..." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Automatización de Ventas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configura reglas automáticas para gestionar leads y optimizar tu embudo
          </p>
        </div>
        {!isCreating && (
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            + Nueva Regla
          </Button>
        )}
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </Card>
      )}

      {isCreating && (
        <Card title="Crear Nueva Regla de Automatización" className="mb-6">
          <div className="space-y-4">
            <Input
              label="Nombre de la Regla"
              placeholder="Ej: Enviar email a nuevos leads"
              value={newRule.nombre}
              onChange={(e) => setNewRule({ ...newRule, nombre: e.target.value })}
              disabled={loading}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <textarea
                value={newRule.descripcion}
                onChange={(e) => setNewRule({ ...newRule, descripcion: e.target.value })}
                placeholder="Describe qué hace esta regla..."
                rows={3}
                className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frecuencia
                </label>
                <select
                  value={newRule.frecuencia}
                  onChange={(e) =>
                    setNewRule({
                      ...newRule,
                      frecuencia: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  disabled={loading}
                >
                  <option value="immediate">Inmediata</option>
                  <option value="delay_1h">Después de 1 hora</option>
                  <option value="delay_24h">Después de 24 horas</option>
                  <option value="daily_9am">Diaria a las 9 AM</option>
                  <option value="weekly_monday">Semanal (lunes)</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRule.activo}
                    onChange={(e) => setNewRule({ ...newRule, activo: e.target.checked })}
                    className="w-4 h-4"
                    disabled={loading}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Activada
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="primary"
                onClick={handleCreateRule}
                loading={loading}
                disabled={loading}
              >
                Crear Regla
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(false)
                  setError('')
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {rules.length > 0 ? (
          rules.map((rule) => (
            <Card key={rule.id} hoverable className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {rule.nombre}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {rule.descripcion}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge status={rule.activo ? 'activa' : 'inactiva'} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frecuencia</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {rule.frecuencia === 'immediate' && 'Inmediata'}
                    {rule.frecuencia === 'delay_1h' && 'Después de 1h'}
                    {rule.frecuencia === 'delay_24h' && 'Después de 24h'}
                    {rule.frecuencia === 'daily_9am' && 'Diaria 9 AM'}
                    {rule.frecuencia === 'weekly_monday' && 'Semanal'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ejecuciones
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {rule.conteo_ejecuciones ?? rule.total_ejecuciones ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Última ejecución
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {rule.ultima_ejecucion
                      ? new Date(rule.ultima_ejecucion).toLocaleDateString('es-ES')
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={rule.activo ? 'primary' : 'secondary'}
                  onClick={() => handleToggleRule(rule.id, rule.activo)}
                  loading={pendingRuleId === rule.id}
                  disabled={pendingRuleId !== null}
                >
                  {rule.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteRule(rule.id)}
                  disabled={pendingRuleId !== null}
                >
                  Eliminar
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No hay reglas de automatización configuradas
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="mt-4"
              >
                Crear Primera Regla
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default AutomationPage
