import React, { useEffect, useState } from 'react'
import { Card, StatCard } from '../components/common/Card'
import { Loader } from '../components/common/Badge'
import api from '../api/client'

interface ConversionReport {
  total_leads: number
  leads_contactados: number
  leads_respondieron: number
  leads_ganados: number
  leads_perdidos: number
  tasa_conversion: number
}

interface IndustryReport {
  industria: string
  cantidad_leads: number
  tasa_conversion: number
}

// Porcentaje seguro: evita NaN/Infinity cuando el denominador es 0
// (p. ej. una cuenta nueva sin leads).
const pct = (num: number, den: number): number =>
  den > 0 ? (num / den) * 100 : 0

const ReportsPage: React.FC = () => {
  const [conversionReport, setConversionReport] = useState<ConversionReport | null>(null)
  const [industryReport, setIndustryReport] = useState<IndustryReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [conversionRes, industryRes] = await Promise.all([
        api.get<ConversionReport>('/crm/reports/conversion'),
        api.get<{ data: IndustryReport[] }>('/crm/reports/by-industry'),
      ])

      setConversionReport(conversionRes.data)
      setIndustryReport(industryRes.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" message="Cargando reportes..." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Reportes y Análisis
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Análisis detallado del desempeño de tu embudo de ventas
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </Card>
      )}

      {conversionReport && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              label="Leads Totales"
              value={conversionReport.total_leads}
              icon="📊"
            />
            <StatCard
              label="Contactados"
              value={conversionReport.leads_contactados}
              icon="📞"
            />
            <StatCard
              label="Respondieron"
              value={conversionReport.leads_respondieron}
              icon="💬"
            />
            <StatCard
              label="Ganados"
              value={conversionReport.leads_ganados}
              trend="up"
              trendValue={`${pct(conversionReport.leads_ganados, conversionReport.total_leads).toFixed(1)}%`}
              icon="🎯"
            />
            <StatCard
              label="Perdidos"
              value={conversionReport.leads_perdidos}
              icon="❌"
            />
          </div>

          {/* Embudo de Conversión */}
          <Card title="Embudo de Conversión" subtitle="Flujo de leads a través de las etapas" className="mb-8">
            <div className="space-y-6">
              {[
                {
                  stage: 'Leads Nuevos',
                  value: conversionReport.total_leads,
                  color: 'bg-blue-600',
                },
                {
                  stage: 'Contactados',
                  value: conversionReport.leads_contactados,
                  color: 'bg-yellow-600',
                },
                {
                  stage: 'Respondieron',
                  value: conversionReport.leads_respondieron,
                  color: 'bg-purple-600',
                },
                {
                  stage: 'Ganados',
                  value: conversionReport.leads_ganados,
                  color: 'bg-green-600',
                },
              ].map((item) => (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.stage}
                    </span>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                      {item.value} (
                      {pct(item.value, conversionReport.total_leads).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${item.color}`}
                      style={{
                        width: `${Math.min(pct(item.value, conversionReport.total_leads), 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Métricas Clave */}
          <Card title="Métricas Clave" className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tasa de Contacto
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {conversionReport.total_leads > 0
                    ? (
                        (conversionReport.leads_contactados /
                          conversionReport.total_leads) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tasa de Respuesta
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {conversionReport.leads_contactados > 0
                    ? (
                        (conversionReport.leads_respondieron /
                          conversionReport.leads_contactados) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tasa de Cierre
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {conversionReport.total_leads > 0
                    ? (
                        (conversionReport.leads_ganados /
                          conversionReport.total_leads) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Por Industria */}
      {industryReport.length > 0 && (
        <Card title="Desempeño por Industria">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Industria
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Cantidad Leads
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Tasa Conversión
                  </th>
                </tr>
              </thead>
              <tbody>
                {industryReport.map((item) => (
                  <tr
                    key={item.industria}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {item.industria}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                      {item.cantidad_leads}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                      {(item.tasa_conversion ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default ReportsPage
