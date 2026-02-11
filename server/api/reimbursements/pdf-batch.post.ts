import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { useDb } from '~/server/utils/db';
import { requireRole } from '~/server/utils/auth';
import { createAuditLog } from '~/server/utils/audit';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

// Helper: Wrap text into lines that fit within maxWidth
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return [''];
  
  const words = text.replace(/\n/g, ' ').split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(currentLine + ' ' + word, fontSize);
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
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

  // Load Logo
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

  // --- Layout Constants ---
  const fontSize = 9;
  const lineHeight = 12;
  const padding = 4;
  const pageMargin = 40;
  
  // Column definitions
  const cols = [
    { name: 'FECHA', w: 60, key: 'invoice_date' },
    { name: 'FACTURA', w: 70, key: 'invoice_number' },
    { name: 'PROVEEDOR', w: 110, key: 'provider' },
    { name: 'CONCEPTO', w: 100, key: 'concept' },
    { name: 'DESCRIPCIÓN', w: 130, key: 'description' },
    { name: 'MONTO', w: 60, key: 'amount', align: 'right' }
  ];

  for (const r of reimbursements) {
    const rItems = itemsMap[r.id] || [];
    const total = Number(r.total_amount);
    const razonSocial = r.razon_social || 'INSTITUTO EDUCATIVO PARA EL DESARROLLO INTEGRAL DEL SABER SC';
    const isDeducible = !!r.is_deducible;

    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();
    let y = height - pageMargin;

    // --- Header Helper ---
    const drawHeader = () => {
        if (embeddedLogo) {
            const logoDims = embeddedLogo.scale(0.5); 
            page.drawImage(embeddedLogo, { x: pageMargin, y: y - 30, width: 60, height: (60 / logoDims.width) * logoDims.height });
        } else {
            page.drawText('[IEDIS]', { x: pageMargin, y: y - 10, size: 14, font: fontBold });
        }

        const centerX = width / 2;
        
        // Razón Social
        const rsWidth = fontBold.widthOfTextAtSize(razonSocial, 10);
        page.drawText(razonSocial, { x: centerX - (rsWidth / 2), y: y - 10, size: 10, font: fontBold });

        // Title
        const title = 'REEMBOLSO DE CAJA';
        const titleWidth = fontBold.widthOfTextAtSize(title, 12);
        page.drawText(title, { x: centerX - (titleWidth / 2), y: y - 30, size: 12, font: fontBold });
        
        // Type Label
        const typeLabel = isDeducible ? 'DEDUCIBLE' : 'NO DEDUCIBLE';
        const typeColor = isDeducible ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
        const typeWidth = fontBold.widthOfTextAtSize(typeLabel, 10);
        page.drawText(typeLabel, { x: width - pageMargin - typeWidth, y: y - 10, size: 10, font: fontBold, color: typeColor });
        
        // Folio
        const folioText = `FOLIO: R-${String(r.id).padStart(5, '0')}`;
        const folioWidth = fontBold.widthOfTextAtSize(folioText, 12);
        page.drawText(folioText, { x: width - pageMargin - folioWidth, y: y - 30, size: 12, font: fontBold, color: rgb(0.8, 0, 0) });

        y -= 50;

        // Info Block
        const infoX = pageMargin;
        const infoSize = 9;
        page.drawText(`FECHA DE SOLICITUD: ${new Date(r.reimbursement_date).toLocaleDateString('es-MX')}`, { x: infoX, y, size: infoSize, font });
        y -= 14;
        page.drawText(`PLANTEL: ${r.plantel_nombre || 'N/A'}`, { x: infoX, y, size: infoSize, font });
        y -= 14;
        page.drawText(`SOLICITANTE: ${r.solicitante_nombre || 'N/A'}`, { x: infoX, y, size: infoSize, font });
        y -= 14;
        page.drawText(`ESTATUS: ${r.status === 'ON_HOLD' ? 'RETENIDO' : r.status}`, { x: infoX, y, size: infoSize, font });
        
        // Payment Method if processed
        if (r.payment_method) {
            const payText = `MÉTODO: ${r.payment_method} ${r.payment_ref ? `(Ref: ${r.payment_ref})` : ''}`;
            page.drawText(payText, { x: 300, y: y + 14, size: infoSize, font });
        }

        y -= 20;

        // Table Headers
        let x = pageMargin;
        for (const col of cols) {
            page.drawRectangle({ x, y: y - 15, width: col.w, height: 18, color: rgb(0.9, 0.9, 0.9), borderColor: rgb(0,0,0), borderWidth: 0.5 });
            page.drawText(col.name, { x: x + 4, y: y - 10, size: 8, font: fontBold });
            x += col.w;
        }
        y -= 15;
    };

    drawHeader();

    // --- Draw Items with Dynamic Height ---
    for (const item of rItems) {
        // Prepare Data
        const textData: Record<string, string[]> = {
            invoice_date: [item.invoice_date || '-'],
            invoice_number: [item.invoice_number || '-'],
            provider: wrapText(item.provider || '-', cols[2].w - (padding * 2), font, fontSize),
            concept: wrapText(item.concept || '-', cols[3].w - (padding * 2), font, fontSize),
            description: wrapText(item.description || '-', cols[4].w - (padding * 2), font, fontSize),
            amount: [`$${Number(item.amount).toFixed(2)}`]
        };

        // Calculate Row Height
        const maxLines = Math.max(
            textData.provider.length, 
            textData.concept.length, 
            textData.description.length,
            1
        );
        const rowHeight = (maxLines * lineHeight) + (padding * 2);

        // Check Pagination
        if (y - rowHeight < 60) {
            page = pdfDoc.addPage();
            y = height - pageMargin;
            drawHeader(); // Redraw header on new page
        }

        // Draw Row
        let x = pageMargin;
        for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const lines = textData[col.key];

            // Border
            page.drawRectangle({
                x, 
                y: y - rowHeight,
                width: col.w,
                height: rowHeight,
                borderColor: rgb(0,0,0),
                borderWidth: 0.5
            });

            // Text
            for (let l = 0; l < lines.length; l++) {
                const lineY = y - padding - (lineHeight * (l + 1)) + 3; // +3 baseline adjust
                const txt = lines[l];
                
                let textX = x + padding;
                if (col.align === 'right') {
                    const w = font.widthOfTextAtSize(txt, fontSize);
                    textX = x + col.w - padding - w;
                }

                page.drawText(txt, {
                    x: textX,
                    y: lineY,
                    size: fontSize,
                    font,
                    color: rgb(0,0,0)
                });
            }
            x += col.w;
        }
        y -= rowHeight;
    }

    // --- Totals ---
    if (y < 60) {
         page = pdfDoc.addPage();
         y = height - pageMargin;
    }

    const totalLabelW = cols.slice(0, 5).reduce((a, b) => a + b.w, 0);
    page.drawRectangle({ x: pageMargin, y: y - 20, width: totalLabelW, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    page.drawText('TOTAL', { x: pageMargin + totalLabelW - 40, y: y - 14, size: 10, font: fontBold });

    page.drawRectangle({ x: pageMargin + totalLabelW, y: y - 20, width: cols[5].w, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    
    const totalTxt = `$${total.toFixed(2)}`;
    const totalTxtW = fontBold.widthOfTextAtSize(totalTxt, 10);
    page.drawText(totalTxt, { 
        x: pageMargin + totalLabelW + cols[5].w - padding - totalTxtW, 
        y: y - 14, 
        size: 10, 
        font: fontBold 
    });
    
    y -= 50;

    // --- Signatures ---
    const sigY = y;
    page.drawLine({ start: { x: 60, y: sigY }, end: { x: 240, y: sigY }, thickness: 1 });
    page.drawText('ENTREGA ADMINISTRADOR', { x: 90, y: sigY - 12, size: 8, font });

    page.drawLine({ start: { x: 340, y: sigY }, end: { x: 520, y: sigY }, thickness: 1 });
    page.drawText('RECIBE: TESORERÍA / BANCOS', { x: 370, y: sigY - 12, size: 8, font });

    page.drawText(`Sistema CajaSmart | Batch: ${batchId} | Printed: ${new Date().toISOString()}`, {
      x: pageMargin,
      y: 10,
      size: 6,
      font,
      color: rgb(0.6, 0.6, 0.6)
    });

    // --- Merge Attachments ---
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

  // Mark as printed (archived)
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
    comment: `Printed/Reprinted ${ids.length} items. Ref: ${batchId}`
  });

  setHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="CajaSmart_Batch_${new Date().toISOString().slice(0,10)}.pdf"`,
    'Content-Length': pdfBytes.length,
  });

  return pdfBytes;
});