import React, { useState } from 'react'
import { Input } from '../common/Input'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { LeadCreateRequest } from '../../types'

interface CreateLeadFormProps {
  onSubmit: (lead: LeadCreateRequest) => Promise<void>
  isLoading?: boolean
  error?: string
}

export const CreateLeadForm: React.FC<CreateLeadFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [formData, setFormData] = useState<LeadCreateRequest>({
    empresa_nombre: '',
    contacto_nombre: '',
    contacto_email: '',
    contacto_telefono: '',
    industria: '',
    tamano_empleados: 0,
    vacante_titulo: '',
    vacante_descripcion: '',
    vacante_url: '',
    pain_points: '',
    solucion_ofrecida: '',
    confianza_analisis: 50,
    fuente: '',
  })

  const [localError, setLocalError] = useState<string>('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement & {
      name: keyof LeadCreateRequest
      value: string | number
    }

    let parsed: string | number = value
    if (type === 'number' || type === 'range') {
      // Campo vacío o inválido → 0 (evita enviar NaN a la API)
      const n = parseFloat(String(value))
      parsed = Number.isNaN(n) ? 0 : n
    }

    setFormData((prev) => ({
      ...prev,
      [name]: parsed,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!formData.empresa_nombre || !formData.contacto_email) {
      setLocalError('Los campos Empresa y Email son obligatorios')
      return
    }

    try {
      await onSubmit(formData)
    } catch (err) {
      setLocalError(error || 'Error al crear el lead')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(localError || error) && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{localError || error}</p>
        </Card>
      )}

      {/* Información de la Empresa */}
      <Card title="Información de la Empresa">
        <div className="space-y-4">
          <Input
            label="Nombre de la Empresa"
            name="empresa_nombre"
            value={formData.empresa_nombre}
            onChange={handleChange}
            placeholder="Nombre de la empresa"
            required
            disabled={isLoading}
          />

          <Input
            label="Industria"
            name="industria"
            value={formData.industria}
            onChange={handleChange}
            placeholder="Ej: Tecnología, Retail, Salud"
            disabled={isLoading}
          />

          <Input
            label="Tamaño (# empleados)"
            name="tamano_empleados"
            type="number"
            value={formData.tamano_empleados}
            onChange={handleChange}
            placeholder="0"
            disabled={isLoading}
          />

          <Input
            label="Fuente"
            name="fuente"
            value={formData.fuente}
            onChange={handleChange}
            placeholder="LinkedIn, Referencia, Búsqueda directa..."
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Información del Contacto */}
      <Card title="Información del Contacto">
        <div className="space-y-4">
          <Input
            label="Nombre del Contacto"
            name="contacto_nombre"
            value={formData.contacto_nombre}
            onChange={handleChange}
            placeholder="Nombre completo"
            required
            disabled={isLoading}
          />

          <Input
            label="Email"
            name="contacto_email"
            type="email"
            value={formData.contacto_email}
            onChange={handleChange}
            placeholder="contacto@empresa.com"
            required
            disabled={isLoading}
          />

          <Input
            label="Teléfono"
            name="contacto_telefono"
            value={formData.contacto_telefono}
            onChange={handleChange}
            placeholder="+1 234 567 8900"
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Información de la Vacante */}
      <Card title="Oportunidad / Vacante">
        <div className="space-y-4">
          <Input
            label="Título de la Vacante"
            name="vacante_titulo"
            value={formData.vacante_titulo}
            onChange={handleChange}
            placeholder="Ej: Gerente de RRHH"
            disabled={isLoading}
          />

          <Input
            label="URL de la Vacante"
            name="vacante_url"
            type="url"
            value={formData.vacante_url}
            onChange={handleChange}
            placeholder="https://..."
            disabled={isLoading}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción de la Vacante
            </label>
            <textarea
              name="vacante_descripcion"
              value={formData.vacante_descripcion}
              onChange={handleChange}
              placeholder="Describa la posición disponible..."
              rows={4}
              className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>
      </Card>

      {/* Análisis */}
      <Card title="Análisis y Propuesta">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pain Points
            </label>
            <textarea
              name="pain_points"
              value={formData.pain_points}
              onChange={handleChange}
              placeholder="Identifica los problemas principales que resuelve Brivé para esta empresa..."
              rows={3}
              className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Solución Ofrecida
            </label>
            <textarea
              name="solucion_ofrecida"
              value={formData.solucion_ofrecida}
              onChange={handleChange}
              placeholder="Describe cómo Brivé soluciona sus problemas..."
              rows={3}
              className="w-full px-4 py-2 border rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confianza en el Análisis: {formData.confianza_analisis}%
            </label>
            <input
              type="range"
              name="confianza_analisis"
              min="0"
              max="100"
              step="10"
              value={formData.confianza_analisis}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Qué tan seguro estás de que este análisis es correcto
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Creando...' : 'Crear Lead'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={isLoading}
          onClick={() => window.history.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
