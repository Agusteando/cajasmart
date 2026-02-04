import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useDb } from '~/server/utils/db';
import { requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import path from 'node:path';
import fs from 'node:fs/promises';

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
    // Basic text wrapping or truncation would go here, simplified for now
    const cleanText = String(text).replace(/\n/g, ' ').substring(0, 50); 
    page.drawText(cleanText, {
      x: x + 4,
      y: y - height + 4,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['RH', 'SUPER_ADMIN']);
  const body = await readBody(event);
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No items selected' });
  }

  const db = await useDb();

  // 1. Fetch Data
  const placeholders = ids.map(() => '?').join(',');
  const [reimbursements]: any = await db.execute(
    `SELECT r.*, 
            p.nombre as plantel_nombre, 
            u.nombre as solicitante_nombre
     FROM reimbursements r
     JOIN users u ON r.user_id = u.id
     JOIN planteles p ON r.plantel_id = p.id
     WHERE r.id IN (${placeholders})`,
    ids
  );

  const [items]: any = await db.execute(
    `SELECT * FROM reimbursement_items WHERE reimbursement_id IN (${placeholders})`,
    ids
  );

  // Group items
  const itemsMap: Record<number, any[]> = {};
  for (const item of items) {
    if (!itemsMap[item.reimbursement_id]) itemsMap[item.reimbursement_id] = [];
    itemsMap[item.reimbursement_id].push(item);
  }

  // 2. Create Master PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const cfg = useRuntimeConfig();
  const uploadDir = path.resolve(process.cwd(), String(cfg.uploadDir || './public/uploads'));

  const batchId = `BATCH-${Date.now()}-${user.id}`;

  for (const r of reimbursements) {
    const rItems = itemsMap[r.id] || [];
    const total = Number(r.total_amount);

    // --- A. Draw Summary Sheet ---
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let y = height - 50;

    // Logo Area (Placeholder Text)
    page.drawText('[LOGO IEDIS]', { x: 50, y, size: 14, font: fontBold });
    page.drawText('INSTITUTO EDUCATIVO PARA EL DESARROLLO INTEGRAL DEL SABER S.C', { x: 160, y, size: 12, font: fontBold });
    y -= 25;
    page.drawText('REEMBOLSO DE CAJA DEDUCIBLE', { x: 200, y, size: 14, font: fontBold, color: rgb(0, 0, 0) });
    y -= 40;

    // Header Fields
    page.drawText(`PLANTEL: ${r.plantel_nombre}`, { x: 50, y, size: 10, font });
    y -= 20;
    page.drawText(`NOMBRE DEL ADMINISTRADOR: ${r.solicitante_nombre}`, { x: 50, y, size: 10, font });
    y -= 20;
    page.drawText(`FECHA: ${new Date(r.reimbursement_date).toLocaleDateString('es-MX')}`, { x: 50, y, size: 10, font });
    page.drawText(`FOLIO: R-${String(r.id).padStart(5, '0')}`, { x: 400, y, size: 10, font: fontBold });
    y -= 30;

    // Table Header
    const cols = [
      { name: 'FECHA', w: 60 },
      { name: 'FACTURA', w: 70 },
      { name: 'PROVEEDOR', w: 120 },
      { name: 'CONCEPTO', w: 100 },
      { name: 'DESCRIPCION', w: 130 },
      { name: 'MONTO', w: 60 }
    ];

    let x = 30;
    for (const col of cols) {
      drawCell(page, x, y, col.w, 20, col.name, fontBold, 8);
      x += col.w;
    }
    y -= 20;

    // Table Rows
    for (const item of rItems) {
      if (y < 100) { // New page if full
        // Simplified: assuming items fit on one page for now or cut off
      }
      x = 30;
      drawCell(page, x, y, 60, 20, item.invoice_date || '', font); x += 60;
      drawCell(page, x, y, 70, 20, item.invoice_number || '', font); x += 70;
      drawCell(page, x, y, 120, 20, item.provider || '', font); x += 120;
      drawCell(page, x, y, 100, 20, item.concept || '', font); x += 100;
      drawCell(page, x, y, 130, 20, item.description || '', font); x += 130;
      drawCell(page, x, y, 60, 20, `$${Number(item.amount).toFixed(2)}`, font);
      y -= 20;
    }

    // Total Row
    drawCell(page, 30, y, 480, 20, 'DESCRIPCION:  TOTAL', fontBold);
    drawCell(page, 510, y, 60, 20, `$${total.toFixed(2)}`, fontBold);
    y -= 50;

    // Signatures
    page.drawLine({ start: { x: 50, y }, end: { x: 250, y }, thickness: 1 });
    page.drawLine({ start: { x: 300, y }, end: { x: 550, y }, thickness: 1 });
    y -= 15;
    page.drawText('ENTREGA ADMINISTRADOR', { x: 80, y, size: 9, font });
    page.drawText('RECIBE: RH / CONTABILIDAD', { x: 350, y, size: 9, font });

    // Footer Batch ID
    page.drawText(`Batch: ${batchId} | Generated by: ${user.nombre}`, {
      x: 30,
      y: 10,
      size: 6,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });

    // --- B. Merge Attachment ---
    // If the reimbursement has a file attached to the first item (legacy logic) or distinct items
    // Current logic uses `file_url` stored in items. Usually they share the same file per reimbursement in this system.
    const fileUrl = rItems[0]?.file_url;
    
    if (fileUrl) {
      try {
        const filePath = path.join(uploadDir, fileUrl);
        const fileBuffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.pdf') {
          const attachmentDoc = await PDFDocument.load(fileBuffer);
          const copiedPages = await pdfDoc.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
          copiedPages.forEach((cp) => pdfDoc.addPage(cp));
        } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          const imgPage = pdfDoc.addPage();
          let image;
          if (ext === '.png') image = await pdfDoc.embedPng(fileBuffer);
          else image = await pdfDoc.embedJpg(fileBuffer);
          
          const { width, height } = imgPage.getSize();
          const imgDims = image.scaleToFit(width - 40, height - 40);
          
          imgPage.drawImage(image, {
            x: 20,
            y: height - imgDims.height - 20,
            width: imgDims.width,
            height: imgDims.height,
          });
        }
      } catch (err) {
        console.error(`Failed to merge attachment for R-${r.id}`, err);
        // Add an error page
        const errPage = pdfDoc.addPage();
        errPage.drawText(`Error al adjuntar archivo para R-${r.id}: Archivo no encontrado o corrupto.`, { x: 50, y: 700, size: 12, font, color: rgb(1, 0, 0) });
      }
    }
  }

  // 3. Finalize
  const pdfBytes = await pdfDoc.save();

  // Audit
  await createAuditLog({
    entityType: 'batch_print',
    entityId: 0,
    action: 'PRINT',
    actorUserId: user.id,
    comment: `Printed ${ids.length} items. Ref: ${batchId}`
  });

  setHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="CajaSmart_Batch_${new Date().toISOString().slice(0,10)}.pdf"`,
    'Content-Length': pdfBytes.length,
  });

  return pdfBytes;
});