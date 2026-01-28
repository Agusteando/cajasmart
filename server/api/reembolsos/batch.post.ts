import { getReembolso, patchReembolso } from '~/server/utils/reembolsos.store'

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const action = String(body?.action || '').trim().toLowerCase()
  const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)) : []
  const paymentRef = String(body?.paymentRef || '').trim()

  if (!action) bad('Falta action.')
  if (!ids.length) bad('Faltan ids.')

  const items = ids
    .map((id: string) => getReembolso(id))
    .filter(Boolean)

  if (!items.length) bad('No se encontraron reembolsos.', 404)

  if (action === 'print') {
    const totalAmount = items.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0)
    return {
      ok: true,
      data: {
        generatedAtISO: new Date().toISOString(),
        totalItems: items.length,
        totalAmount,
        items,
      },
    }
  }

  if (action === 'process') {
    for (const r of items as any[]) {
      const notas = paymentRef
        ? `${(r.notas || '').trim() ? `${r.notas}\n\n` : ''}PAGO TESORERÍA: ${paymentRef}`
        : r.notas
      patchReembolso(r.id, { estado: 'pagado', notas })
    }
    return { ok: true }
  }

  bad('Acción no soportada.')
})