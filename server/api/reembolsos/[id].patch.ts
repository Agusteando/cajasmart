import { patchReembolso } from '~/server/utils/reembolsos.store'
import type { ReembolsoEstado } from '~/types/reembolso'

const allowed: ReembolsoEstado[] = ['borrador', 'en_revision', 'aprobado', 'rechazado', 'pagado']

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message })
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event)

  if (body?.estado != null) {
    const estado = String(body.estado) as ReembolsoEstado
    if (!allowed.includes(estado)) bad('Estado inválido.')
  }

  const updated = patchReembolso(id, {
    estado: body?.estado,
    notas: body?.notas,
  })

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'No existe el reembolso.' })
  return { ok: true, data: updated }
})
