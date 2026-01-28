import { listReembolsos } from '~/server/utils/reembolsos.store'
import type { Reembolso } from '~/types/reembolso'

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event)?.q ?? '').trim().toLowerCase()
  const estado = String(getQuery(event)?.estado ?? getQuery(event)?.status ?? '').trim()

  let items = listReembolsos()

  if (estado) {
    items = items.filter((r) => r.estado === estado)
  }

  if (q) {
    items = items.filter((r: Reembolso) => {
      const haystack = [
        r.folio,
        r.plantel ?? '',
        r.solicitante ?? '',
        r.notas ?? '',
        ...(r.conceptos || []).flatMap((c) => [
          c.invoice_date,
          c.invoice_number ?? '',
          c.provider ?? '',
          c.concept ?? '',
          c.description ?? '',
          String(c.amount ?? ''),
        ]),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }

  return { items }
})