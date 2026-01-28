export type ReembolsoEstado = 'borrador' | 'en_revision' | 'aprobado' | 'rechazado' | 'pagado'

export type ReembolsoConcepto = {
  id: string
  invoice_date: string // YYYY-MM-DD
  invoice_number?: string
  provider?: string
  concept: string
  description?: string
  amount: number
}

export type Reembolso = {
  id: string
  folio: string

  // Encabezado (para impresión)
  plantel?: string

  // Quien solicita (admin)
  solicitante: string

  // Compat opcional (si ya lo usabas)
  area?: string

  // Fecha del reembolso (encabezado)
  fechaISO: string

  estado: ReembolsoEstado
  conceptos: ReembolsoConcepto[]
  total: number

  notas?: string

  // Evidencia (1 archivo por reembolso)
  file_url?: string

  createdAtISO: string
  updatedAtISO: string
}