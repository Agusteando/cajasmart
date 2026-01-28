import { readMultipartFormData } from 'h3'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createReembolso } from '~/server/utils/reembolsos.store'

function bad(message: string, statusCode = 400) {
  throw createError({ statusCode, statusMessage: message })
}

function isMultipart(event: any) {
  const ct = String(event.node.req.headers['content-type'] || '')
  return ct.includes('multipart/form-data')
}

function toText(data: any) {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof Uint8Array) return Buffer.from(data).toString('utf8')
  return String(data)
}

async function saveUpload(file: { filename?: string; data: any }) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })

  const original = String(file.filename || 'archivo').trim() || 'archivo'
  const safe = original.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`
  await fs.writeFile(path.join(uploadsDir, filename), file.data)
  return filename
}

export default defineEventHandler(async (event) => {
  let body: any = {}

  if (isMultipart(event)) {
    const parts = (await readMultipartFormData(event)) || []
    for (const p of parts) {
      if (!p?.name) continue
      if (p.name === 'file') continue
      body[p.name] = toText((p as any).data)
    }

    const filePart = parts.find((p: any) => p?.name === 'file' && p?.data)
    if (filePart) {
      body.file_url = await saveUpload(filePart as any)
    }

    if (body.conceptos && typeof body.conceptos === 'string') {
      try {
        body.conceptos = JSON.parse(body.conceptos)
      } catch {
        bad('Conceptos inválidos (JSON).')
      }
    }
  } else {
    body = await readBody(event)
  }

  const solicitante = String(body?.solicitante || '').trim()
  const plantel = String(body?.plantel || body?.area || '').trim() || undefined
  const area = String(body?.area || '').trim() || undefined
  const fechaISO = body?.fechaISO ? String(body.fechaISO) : undefined
  const notas = body?.notas ? String(body.notas) : undefined
  const file_url = body?.file_url ? String(body.file_url) : undefined

  const conceptos = Array.isArray(body?.conceptos) ? body.conceptos : []

  if (!solicitante) bad('Falta solicitante.')
  if (!conceptos.length) bad('Agrega al menos un concepto.')

  for (const [i, c] of conceptos.entries()) {
    const concept = String(c?.concept || '').trim()
    const invoice_date = String(c?.invoice_date || '').trim()
    const amount = Number(c?.amount)

    if (!invoice_date) bad(`Concepto #${i + 1}: falta fecha.`)
    if (!concept) bad(`Concepto #${i + 1}: falta concepto.`)
    if (!Number.isFinite(amount) || amount <= 0) bad(`Concepto #${i + 1}: monto inválido.`)
  }

  const created = createReembolso({
    plantel,
    solicitante,
    area,
    fechaISO,
    notas,
    file_url,
    conceptos: conceptos.map((c: any) => ({
      id: c?.id,
      invoice_date: c?.invoice_date,
      invoice_number: c?.invoice_number,
      provider: c?.provider,
      concept: c?.concept,
      description: c?.description,
      amount: c?.amount,
    })),
  })

  return { ok: true, data: created }
})