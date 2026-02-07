import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useDb } from '~/server/utils/db';
import { requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

// Helper to draw table cell borders/text
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

  // Text (centered vertically, left aligned with padding)
  if (text) {
    const cleanText = String(text).replace(/\n/g, ' ').substring(0, 55); 
    page.drawText(cleanText, {
      x: x + 4,
      y: y - height + 6,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

export default defineEventHandler(async (event) => {
  // CHANGED: Added TESORERIA, removed RH requirement (though kept for legacy safety if role still exists)
  const user = requireRole(event, ['RH', 'TESORERIA', 'SUPER_ADMIN']);
  const body = await readBody(event);
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  // 1. Fetch Data with Razon Social Join
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

  // 2. Prepare Logo
  let logoBuffer: Buffer | null = null;
  const logoPath = path.resolve(process.cwd(), 'public/logo.webp');
  
  if (existsSync(logoPath)) {
    try {
      logoBuffer = await sharp(logoPath).png().toBuffer();
    } catch (e) {
      console.error('Error converting logo:', e);
    }
  }

  // 3. Create Master PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let embeddedLogo: any = null;
  if (logoBuffer) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoBuffer);
    } catch (e) {
      console.error('Error embedding logo:', e);
    }
  }

  const cfg = useRuntimeConfig();
  const uploadDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));
  const batchId = `BATCH-${Date.now()}-${user.id}`;

  for (const r of reimbursements) {
    const rItems = itemsMap[r.id] || [];
    const total = Number(r.total_amount);
    const razonSocial = r.razon_social || 'INSTITUTO EDUCATIVO PARA EL DESARROLLO INTEGRAL DEL SABER SC';
    const isDeducible = !!r.is_deducible;

    // --- A. Draw Summary Sheet ---
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let y = height - 60;

    // Header Layout
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
    
    // NEW: Render NO DEDUCIBLE warning if applicable
    if (!isDeducible) {
      const warn = 'NO DEDUCIBLE';
      const warnWidth = fontBold.widthOfTextAtSize(warn, 14);
      page.drawText(warn, { 
        x: centerX - (warnWidth / 2), 
        y: y - 35, 
        size: 14, 
        font: fontBold, 
        color: rgb(1, 0, 0) // Red
      });
    }

    y -= 50;

    // Header Fields
    page.drawText(`PLANTEL: ${r.plantel_nombre || 'N/A'}`, { x: 50, y, size: 10, font });
    y -= 18;
    page.drawText(`NOMBRE DEL ADMINISTRADOR: ${r.solicitante_nombre}`, { x: 50, y, size: 10, font });
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

    // Table Rows
    for (const item of rItems) {
      if (y < 100) { }
      x = 40;
      drawCell(page, x, y, 60, 20, item.invoice_date || '-', font); x += 60;
      drawCell(page, x, y, 70, 20, item.invoice_number || '-', font); x += 70;
      drawCell(page, x, y, 120, 20, item.provider || '-', font); x += 120;
      drawCell(page, x, y, 100, 20, item.concept || '-', font); x += 100;
      drawCell(page, x, y, 120, 20, item.description || '-', font); x += 120;
      drawCell(page, x, y, 60, 20, `$${Number(item.amount).toFixed(2)}`, font);
      y -= 20;
    }

    // Total Row
    drawCell(page, 40, y, 470, 20, 'TOTAL', fontBold);
    drawCell(page, 510, y, 60, 20, `$${total.toFixed(2)}`, fontBold);
    y -= 60;

    // Signatures
    const sigY = y;
    page.drawLine({ start: { x: 60, y: sigY }, end: { x: 240, y: sigY }, thickness: 1 });
    page.drawText('ENTREGA ADMINISTRADOR', { x: 90, y: sigY - 12, size: 8, font });

    page.drawLine({ start: { x: 340, y: sigY }, end: { x: 520, y: sigY }, thickness: 1 });
    page.drawText('RECIBE: TESORERÍA / BANCOS', { x: 370, y: sigY - 12, size: 8, font });

    // Footer
    page.drawText(`Sistema CajaSmart | Batch: ${batchId} | Printed: ${new Date().toISOString()}`, {
      x: 40,
      y: 10,
      size: 6,
      font,
      color: rgb(0.6, 0.6, 0.6)
    });

    // --- B. Merge Attachment ---
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
          } catch (pdfErr) {
            const errPage = pdfDoc.addPage();
            errPage.drawText(`ERROR: No se pudo adjuntar el PDF original (${fileUrl}).`, { x: 50, y: 700, font, size: 12, color: rgb(1,0,0) });
          }
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
      } catch (err) {
        console.error(`Error attaching file ${fileUrl}`, err);
      }
    }
  }

  // 4. Update Database (Mark as Printed/Archived)
  // We do this before sending response.
  await db.execute(
    `UPDATE reimbursements SET archived_at = NOW(), archived_by = ? WHERE id IN (${placeholders})`,
    [user.id, ...ids]
  );

  // 5. Finalize
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