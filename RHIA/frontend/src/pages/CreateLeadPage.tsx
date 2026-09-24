import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateLeadForm } from '../components/forms/CreateLeadForm'
import { useLeads } from '../api/hooks/useLeads'
import { LeadCreateRequest } from '../types'

export const CreateLeadPage: React.FC = () => {
  const navigate = useNavigate()
  const { createLead } = useLeads()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (leadData: LeadCreateRequest) => {
    setIsLoading(true)
    setError('')

    try {
      await createLead(leadData)
      navigate('/leads')
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        'Error al crear el lead'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Crear Nuevo Lead
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Ingresa la información de la empresa y contacto
        </p>
      </div>

      <CreateLeadForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
    </div>
  )
}
