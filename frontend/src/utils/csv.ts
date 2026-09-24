import { Lead } from '../types'

export const exportLeadsToCSV = (leads: Lead[], filename = 'leads.csv') => {
  if (leads.length === 0) {
    throw new Error('No hay leads para exportar')
  }

  // Headers
  const headers = [
    'ID',
    'Empresa',
    'Contacto',
    'Email',
    'Teléfono',
    'Industria',
    'Tamaño',
    'Estado',
    'Vacante',
    'Pain Points',
    'Solución',
    'Confianza %',
    'Fecha Creación',
  ]

  // Data rows
  const rows = leads.map((lead) => [
    lead.id,
    lead.empresa_nombre,
    lead.contacto_nombre,
    lead.contacto_email,
    lead.contacto_telefono || '',
    lead.industria,
    lead.tamano_empleados,
    lead.estado,
    lead.vacante_titulo || '',
    lead.pain_points || '',
    lead.solucion_ofrecida || '',
    lead.confianza_analisis || 0,
    new Date(lead.fecha_creacion).toLocaleDateString('es-ES'),
  ])

  // Create CSV content
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportToCSV = (data: Record<string, any>[], filename = 'export.csv') => {
  if (data.length === 0) {
    throw new Error('No hay datos para exportar')
  }

  // Get headers from first object
  const headers = Object.keys(data[0])

  // Create CSV content
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...data.map((row) =>
      headers.map((header) => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const parseCSV = (csvText: string): Record<string, string>[] => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('Archivo CSV vacío o inválido')
  }

  // Parse headers (removing quotes)
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())

  // Parse data rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    rows.push(row)
  }

  return rows
}
