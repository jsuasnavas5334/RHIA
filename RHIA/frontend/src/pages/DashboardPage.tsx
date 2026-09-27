import React, { useEffect, useState } from 'react'
import { Card, StatCard } from '../components/common/Card'
import { Loader } from '../components/common/Badge'
import { useDashboard } from '../api/hooks/useDashboard'

const DashboardPage: React.FC = () => {
  const { metrics, loading, error, fetchMetrics } = useDashboard()

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" message="Cargando dashboard..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">Error al cargar el dashboard: {error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard de Ventas
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Vista general de tu embudo de ventas y actividades
        </p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Leads Totales"
            value={metrics.total_leads || 0}
            trend={metrics.new_leads_this_month ? 'up' : undefined}
            trendValue={`+${metrics.new_leads_this_month || 0} este mes`}
            icon="📊"
          />

          <StatCard
            label="Tasa de Conversión"
            value={`${metrics.conversion_rate || 0}%`}
            trend={
              metrics.conversion_rate && metrics.conversion_rate > 0 ? 'up' : 'down'
            }
            trendValue={`vs período anterior`}
            icon="📈"
          />

          <StatCard
            label="Leads Ganados"
            value={metrics.won_leads || 0}
            trend="up"
            trendValue={`de ${metrics.total_leads || 0}`}
            icon="🎯"
          />

          <StatCard
            label="Tasa de Respuesta"
            value={`${metrics.response_rate || 0}%`}
            trend="up"
            trendValue="de contactos"
            icon="💬"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Estado de Leads por Etapa" subtitle="Distribución en el embudo">
          <div className="space-y-4">
            {metrics?.leads_by_status && (
              Object.entries(metrics.leads_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {status}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${((count as number) / (metrics.total_leads || 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Leads por Industria" subtitle="Top 5 sectores más activos">
          <div className="space-y-3">
            {metrics?.leads_by_industry &&
              Object.entries(metrics.leads_by_industry)
                .slice(0, 5)
                .map(([industry, count]) => (
                  <div key={industry} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {industry}
                    </span>
                    <span className="text-sm font-semibold text-blue-600">
                      {count}
                    </span>
                  </div>
                ))}
          </div>
        </Card>
      </div>

      <Card title="Actividad Reciente" subtitle="Últimas 7 días" className="mt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Emails enviados
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {metrics?.emails_sent_this_week || 0}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Emails abiertos
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {metrics?.emails_opened_this_week || 0}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Nuevos contactos
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {metrics?.new_contacts_this_week || 0}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default DashboardPage
