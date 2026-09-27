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
  URL.revokeObjectURL(url)

  return csvContent
}

// Parse a single CSV line respecting quoted fields and escaped quotes ("")
const parseCSVLine = (line: string): string[] => {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

export const parseCSV = (csvText: string): Record<string, string>[] => {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) {
    throw new Error('Archivo CSV vacío o inválido')
  }

  const headers = parseCSVLine(lines[0])

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    rows.push(row)
  }

  return rows
}

// Export alias for tests
export const exportToCSV = exportLeadsToCSV
