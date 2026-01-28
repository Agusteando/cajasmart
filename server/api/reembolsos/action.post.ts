import { getReembolso, patchReembolso } from '~/server/utils/reembolsos.store'

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  const action = String(body?.action || '').trim().toUpperCase()
  const reason = String(body?.reason || '').trim()
  const paymentRef = String(body?.paymentRef || '').trim()

  if (!id) bad('Falta id.')
  if (!action) bad('Falta action.')

  const r = getReembolso(id)
  if (!r) bad('No encontrado.', 404)

  if (action === 'APPROVE') {
    const next = patchReembolso(id, { estado: 'aprobado' })
    return { ok: true, data: next }
  }

  if (action === 'RETURN') {
    if (!reason) bad('Faltan observaciones.')
    const notas = `${(r.notas || '').trim() ? `${r.notas}\n\n` : ''}OBSERVACIONES FISCAL: ${reason}`
    const next = patchReembolso(id, { estado: 'rechazado', notas })
    return { ok: true, data: next }
  }

  if (action === 'PROCESS') {
    const notas = paymentRef
      ? `${(r.notas || '').trim() ? `${r.notas}\n\n` : ''}PAGO TESORERÍA: ${paymentRef}`
      : r.notas
    const next = patchReembolso(id, { estado: 'pagado', notas })
    return { ok: true, data: next }
  }

  bad('Acción no soportada.')
})