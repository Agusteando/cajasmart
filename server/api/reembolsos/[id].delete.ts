import { deleteReembolso } from '~/server/utils/reembolsos.store'

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message })
}

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) bad('Falta id.')

  const ok = deleteReembolso(id)
  if (!ok) bad('No encontrado.', 404)

  return { ok: true }
})