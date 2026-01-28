import { getReembolso } from '~/server/utils/reembolsos.store'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') || ''
  const r = getReembolso(id)
  if (!r) throw createError({ statusCode: 404, statusMessage: 'No existe el reembolso.' })
  return { ok: true, data: r }
})
