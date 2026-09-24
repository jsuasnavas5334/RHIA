import { Lead } from '../types'

export const generateCSVContent = (data: Record<string, any>[]): string => {
  if (data.length === 0) {
    return ''
  }

  const headers = Object.keys(data[0])
  const headerRow = headers.join(',')
  
  const dataRows = data.map((row) =>
    headers.map((header) => {
      const value = row[header] ?? ''
      const stringValue = String(value)
      
      // Only quote if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        const escaped = stringValue.replace(/"/g, '""')
        return `"${escaped}"`
      }
      return stringValue
    }).join(',')
  )

  return [headerRow, ...dataRows].join('\n')
}

export const exportToCSV = (data: Record<string, any>[], returnBlob = false): string | Blob => {
  const csvContent = generateCSVContent(data)
  
  if (returnBlob) {
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  }
  
  return csvContent
}

export const downloadCSV = (data: Record<string, any>[], filename = 'export.csv') => {
  const csvContent = generateCSVContent(data)
  
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
    lead.industria || '',
    lead.tamano || '',
    lead.estado,
    lead.vacancias_descripcion || '',
    lead.pain_points || '',
    lead.solucion_ofrecida || '',
    (lead.confianza_analisis || 0).toString(),
    new Date(lead.fecha_creacion).toLocaleDateString(),
  ])

  const csvData = [headers, ...rows.map((row) => row.map((cell) => String(cell || '')))]
  const csvContent = generateCSVContent(csvData)

  downloadCSV(csvData, filename)
}

export const parseCSV = (csvText: string, requiredColumns?: string[]): Record<string, string>[] => {
  if (!csvText || csvText.trim() === '') {
    return []
  }

  const lines = csvText.split('\n')
  if (lines.length === 0) {
    return []
  }

  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine)

  if (requiredColumns && !requiredColumns.every((col) => headers.includes(col))) {
    throw new Error(`Missing required columns: ${requiredColumns.join(', ')}`)
  }

  const data: Record<string, string>[] = []
  let currentLine = ''

  for (let i = 1; i < lines.length; i++) {
    currentLine += (currentLine ? '\n' : '') + lines[i]

    // Check if the line is complete (has matching quotes)
    if (isLineComplete(currentLine)) {
      const values = parseCSVLine(currentLine)
      if (values.length > 0) {
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        data.push(row)
      }
      currentLine = ''
    }
  }

  return data
}

const parseCSVLine = (line: string): string[] => {
  const values: string[] = []
  let currentValue = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"'
        i++
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue)
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  values.push(currentValue)
  return values
}

const isLineComplete = (line: string): boolean => {
  let quoteCount = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && (i === 0 || line[i - 1] !== '"')) {
      quoteCount++
    } else if (line[i] === '"' && line[i - 1] === '"') {
      // Escaped quote, skip
      i++
    }
  }
  return quoteCount % 2 === 0
}
