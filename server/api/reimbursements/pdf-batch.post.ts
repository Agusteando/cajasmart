import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useDb } from '~/server/utils/db';
import { requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

// Helper to draw text with truncation
function drawCell(page: any, x: number, y: number, width: number, height: number, text: string, font: any, fontSize: number = 9) {
  // Border
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  if (text) {
    const safeText = String(text).replace(/\n/g, ' ').trim();
    // Rough calc: average char width approx fontSize * 0.5. 
    // We leave some padding (approx 8px).
    const maxChars = Math.floor((width - 8) / (fontSize * 0.5));
    
    let finalText = safeText;
    if (safeText.length > maxChars) {
       finalText = safeText.substring(0, maxChars - 3) + '...';
    }

    page.drawText(finalText, {
      x: x + 4,
      y: y - height + 6,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  const placeholders = ids.map(() => '?').join(',');
  const [reimbursements]: any = await db.execute(
    `SELECT r.*, 
            p.nombre as plantel_nombre, 
            rs.nombre as razon_social,
            u.nombre as solicitante_nombre
     FROM reimbursements r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN planteles p ON r.plantel_id = p.id
     LEFT JOIN razones_sociales rs ON p.razon_social_id = rs.id
     WHERE r.id IN (${placeholders})
     ORDER BY r.id ASC`,
    ids
  );

  const [items]: any = await db.execute(
    `SELECT * FROM reimbursement_items WHERE reimbursement_id IN (${placeholders})`,
    ids
  );

  const itemsMap: Record<number, any[]> = {};
  for (const item of items) {
    if (!itemsMap[item.reimbursement_id]) itemsMap[item.reimbursement_id] = [];
    itemsMap[item.reimbursement_id].push(item);
  }

  let logoBuffer: Buffer | null = null;
  const logoPath = path.resolve(process.cwd(), 'public/logo.webp');
  if (existsSync(logoPath)) {
    try { logoBuffer = await sharp(logoPath).png().toBuffer(); } catch {}
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let embeddedLogo: any = null;
  if (logoBuffer) {
    try { embeddedLogo = await pdfDoc.embedPng(logoBuffer); } catch {}
  }

  const cfg = useRuntimeConfig();
  const uploadDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  const batchId = `BATCH-${Date.now()}-${user.id}`;

  for (const r of reimbursements) {
    const rItems = itemsMap[r.id] || [];
    const total = Number(r.total_amount);
    const razonSocial = r.razon_social || 'INSTITUTO EDUCATIVO PARA EL DESARROLLO INTEGRAL DEL SABER SC';
    const isDeducible = !!r.is_deducible;

    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let y = height - 60;

    if (embeddedLogo) {
      const logoDims = embeddedLogo.scale(0.5); 
      page.drawImage(embeddedLogo, {
        x: 40,
        y: y - 10,
        width: 60,
        height: (60 / logoDims.width) * logoDims.height,
      });
    } else {
      page.drawText('[IEDIS]', { x: 50, y, size: 14, font: fontBold });
    }

    const centerX = width / 2;
    const rsSize = 10;
    const rsWidth = fontBold.widthOfTextAtSize(razonSocial, rsSize);
    page.drawText(razonSocial, { x: centerX - (rsWidth / 2), y: y + 10, size: rsSize, font: fontBold });

    const title = 'REEMBOLSO DE CAJA';
    const titleWidth = fontBold.widthOfTextAtSize(title, 12);
    page.drawText(title, { x: centerX - (titleWidth / 2), y: y - 15, size: 12, font: fontBold, color: rgb(0, 0, 0) });
    
    if (!isDeducible) {
      const warn = 'NO DEDUCIBLE';
      const warnWidth = fontBold.widthOfTextAtSize(warn, 14);
      page.drawText(warn, { x: centerX - (warnWidth / 2), y: y - 35, size: 14, font: fontBold, color: rgb(1, 0, 0) });
    }

    y -= 50;

    // Header Info
    const cleanPlantel = (r.plantel_nombre || 'N/A').replace(/\n/g, ' ').substring(0, 50);
    const cleanAdmin = (r.solicitante_nombre || '').replace(/\n/g, ' ').substring(0, 50);
    
    page.drawText(`PLANTEL: ${cleanPlantel}`, { x: 50, y, size: 10, font });
    y -= 18;
    page.drawText(`NOMBRE DEL ADMINISTRADOR: ${cleanAdmin}`, { x: 50, y, size: 10, font });
    y -= 18;
    page.drawText(`FECHA: ${new Date(r.reimbursement_date).toLocaleDateString('es-MX')}`, { x: 50, y, size: 10, font });
    
    page.drawRectangle({ x: 420, y: y - 5, width: 120, height: 25, borderColor: rgb(0,0,0), borderWidth: 1 });
    page.drawText(`FOLIO: R-${String(r.id).padStart(5, '0')}`, { x: 430, y: y + 3, size: 12, font: fontBold, color: rgb(0.8, 0, 0) });
    y -= 30;

    // Table Header
    const cols = [
      { name: 'FECHA', w: 60 },
      { name: 'FACTURA', w: 70 },
      { name: 'PROVEEDOR', w: 120 },
      { name: 'CONCEPTO', w: 100 },
      { name: 'DESCRIPCION', w: 120 },
      { name: 'MONTO', w: 60 }
    ];

    let x = 40;
    for (const col of cols) {
      drawCell(page, x, y, col.w, 20, col.name, fontBold, 8);
      x += col.w;
    }
    y -= 20;

    for (const item of rItems) {
      if (y < 100) { 
        // Simple page break support if needed, but for receipts usually fits one page. 
        // Truncating list for now to avoid complexity in this snippet.
      }
      x = 40;
      drawCell(page, x, y, 60, 20, item.invoice_date || '-', font, 8); x += 60;
      drawCell(page, x, y, 70, 20, item.invoice_number || '-', font, 8); x += 70;
      drawCell(page, x, y, 120, 20, item.provider || '-', font, 8); x += 120;
      drawCell(page, x, y, 100, 20, item.concept || '-', font, 8); x += 100;
      drawCell(page, x, y, 120, 20, item.description || '-', font, 8); x += 120;
      drawCell(page, x, y, 60, 20, `$${Number(item.amount).toFixed(2)}`, font, 8);
      y -= 20;
    }

    drawCell(page, 40, y, 470, 20, 'TOTAL', fontBold);
    drawCell(page, 510, y, 60, 20, `$${total.toFixed(2)}`, fontBold);
    y -= 60;

    const sigY = y;
    page.drawLine({ start: { x: 60, y: sigY }, end: { x: 240, y: sigY }, thickness: 1 });
    page.drawText('ENTREGA ADMINISTRADOR', { x: 90, y: sigY - 12, size: 8, font });

    page.drawLine({ start: { x: 340, y: sigY }, end: { x: 520, y: sigY }, thickness: 1 });
    page.drawText('RECIBE: TESORERÍA / BANCOS', { x: 370, y: sigY - 12, size: 8, font });

    page.drawText(`Sistema CajaSmart | Batch: ${batchId} | Printed: ${new Date().toISOString()}`, {
      x: 40,
      y: 10,
      size: 6,
      font,
      color: rgb(0.6, 0.6, 0.6)
    });

    const uniqueFiles = [...new Set(rItems.map((i: any) => i.file_url).filter(Boolean))];
    for (const fileUrl of uniqueFiles) {
      try {
        const filePath = path.join(uploadDir, String(fileUrl));
        try { await fs.access(filePath); } catch { continue; }

        const fileBuffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.pdf') {
          try {
            const attachmentDoc = await PDFDocument.load(fileBuffer);
            const copiedPages = await pdfDoc.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
            copiedPages.forEach((cp) => pdfDoc.addPage(cp));
          } catch {}
        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const imgPage = pdfDoc.addPage();
          let image;
          if (ext === '.png') image = await pdfDoc.embedPng(fileBuffer);
          else if (ext === '.jpg' || ext === '.jpeg') image = await pdfDoc.embedJpg(fileBuffer);
          else if (ext === '.webp') {
             const pngBuf = await sharp(fileBuffer).png().toBuffer();
             image = await pdfDoc.embedPng(pngBuf);
          }

          if (image) {
             const { width, height } = imgPage.getSize();
             const imgDims = image.scaleToFit(width - 40, height - 40);
             imgPage.drawImage(image, {
               x: 20,
               y: height - imgDims.height - 20,
               width: imgDims.width,
               height: imgDims.height,
             });
          }
        }
      } catch {}
    }
  }

  // MARK AS PRINTED (ARCHIVED)
  await db.execute(
    `UPDATE reimbursements SET archived_at = NOW(), archived_by = ? WHERE id IN (${placeholders})`,
    [user.id, ...ids]
  );

  const pdfBytes = await pdfDoc.save();

  await createAuditLog({
    entityType: 'batch_print',
    entityId: 0,
    action: 'PRINT',
    actorUserId: user.id,
    comment: `Printed & Archived ${ids.length} items. Ref: ${batchId}`
  });

  setHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="CajaSmart_Batch_${new Date().toISOString().slice(0,10)}.pdf"`,
    'Content-Length': pdfBytes.length,
  });

  return pdfBytes;
});