const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Override PDFKit font loading to prevent file system access
// PDFKit tries to resolve font files, but in serverless we need to use built-in fonts
const originalFont = PDFDocument.prototype.font;
PDFDocument.prototype.font = function(src, family, size) {
  // If src is already a Buffer or valid font object, use it directly
  if (Buffer.isBuffer(src) || (typeof src === 'object' && src !== null && !src.path)) {
    return originalFont.call(this, src, family, size);
  }
  
  // For standard PDFKit font names, try to load from PDFKit's font data
  const standardFonts = {
    'Helvetica': 'Helvetica',
    'Helvetica-Bold': 'Helvetica-Bold',
    'Courier': 'Courier',
    'Courier-Bold': 'Courier-Bold',
    'Times-Roman': 'Times-Roman',
    'Times-Bold': 'Times-Bold'
  };
  
  if (typeof src === 'string' && standardFonts[src]) {
    try {
      // Try to require PDFKit's font data directly
      const fontName = standardFonts[src];
      let fontData;
      try {
        // Try to load from PDFKit's data directory
        const fontPath = require.resolve('pdfkit/js/data/' + fontName + '.afm');
        fontData = fs.readFileSync(fontPath, 'utf8');
        return originalFont.call(this, fontData, family || src, size);
      } catch (e1) {
        try {
          // Try alternative path
          const fontPath2 = path.join(__dirname, '../../node_modules/pdfkit/js/data', fontName + '.afm');
          if (fs.existsSync(fontPath2)) {
            fontData = fs.readFileSync(fontPath2, 'utf8');
            return originalFont.call(this, fontData, family || src, size);
          }
        } catch (e2) {
          // Fall back to using font name - PDFKit may have embedded data
          console.warn('Font file not found, using font name:', fontName);
        }
      }
      // If we got font data, use it
      if (fontData) {
        return originalFont.call(this, fontData, family || src, size);
      }
    } catch (e) {
      console.warn('Font loading error, falling back to name:', e.message);
    }
    // Final fallback: use font name directly
    return originalFont.call(this, src, family || src, size);
  }
  
  // For any other font, try original behavior
  return originalFont.call(this, src, family, size);
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.INVOICE_STORAGE_BUCKET || 'client_files';

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function isAdmin(user) {
  return Boolean(user && (user.app_metadata?.roles || []).includes('admin'));
}

function sanitizeSegment(value, fallback = 'unknown') {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatCurrency(amount = 0, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(Number(amount) || 0);
  } catch (error) {
    return '$' + Number(amount || 0).toFixed(2);
  }
}

function resolveLogoPath() {
  const candidates = [
    path.join(__dirname, '../../assets/images/Brandible.png'),
    path.join(__dirname, '../../assets/images/brandible.png'),
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) {
      return candidates[i];
    }
  }
  return null;
}

function buildInvoiceFromRecord(record) {
  const meta = record.meta || {};
  const invoiceItems = record.invoice_items || [];
  const items = [];
  for (let i = 0; i < invoiceItems.length; i++) {
    const item = invoiceItems[i];
    items.push({
      description: item.description || 'Line item',
      qty: Number(item.quantity) || 0,
      price: Number(item.unit_amount) || 0,
    });
  }

  const clientsName = record.clients && record.clients.name ? record.clients.name : null;
  const clientsEmail = record.clients && record.clients.email ? record.clients.email : null;
  
  let subtotal = Number(record.subtotal);
  if (!subtotal && items.length > 0) {
    subtotal = 0;
    for (let i = 0; i < items.length; i++) {
      subtotal += items[i].qty * items[i].price;
    }
  }

  return {
    clientId: record.client_id,
    invoiceId: record.id,
    clientName: clientsName || meta.clientName || 'Client',
    clientEmail: clientsEmail || meta.clientEmail || '',
    invoiceNumber: record.number || meta.invoiceNumber || 'INV-0000',
    date: record.issued_at || record.created_at,
    dueDate: record.due_at,
    items: items,
    subtotal: subtotal,
    taxAmount: Number(record.tax) || 0,
    taxRate: Number(meta.taxRate) || 0,
    discountAmount: Number(meta.discountAmount) || 0,
    discountRate: Number(meta.discountRate) || 0,
    notes: record.notes || meta.notes || '',
    total: Number(record.total) || 0,
    currency: record.currency || meta.currency || 'USD',
  };
}

function normalizeBodyPayload(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const normalizedItems = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = item.qty !== undefined && item.qty !== null ? item.qty : (item.quantity !== undefined && item.quantity !== null ? item.quantity : 0);
    const price = item.price !== undefined && item.price !== null ? item.price : (item.unit_amount !== undefined && item.unit_amount !== null ? item.unit_amount : 0);
    normalizedItems.push({
      description: item.description || 'Line item',
      qty: Number(qty),
      price: Number(price),
    });
  }

  let subtotal;
  if (body.subtotal !== undefined) {
    subtotal = Number(body.subtotal);
  } else {
    subtotal = 0;
    for (let i = 0; i < normalizedItems.length; i++) {
      subtotal += normalizedItems[i].qty * normalizedItems[i].price;
    }
  }

  const taxAmount = body.taxAmount !== undefined
    ? Number(body.taxAmount)
    : Number(body.tax || 0);

  const discountAmount = body.discountAmount !== undefined
    ? Number(body.discountAmount)
    : Number(body.discount || 0);

  const total = body.total !== undefined
    ? Number(body.total)
    : subtotal + taxAmount - discountAmount;

  return {
    clientId: body.clientId,
    invoiceId: body.invoiceId,
    clientName: body.clientName || 'Client',
    clientEmail: body.clientEmail || '',
    invoiceNumber: body.invoiceNumber || 'INV-0000',
    date: body.date,
    dueDate: body.dueDate,
    items: normalizedItems,
    subtotal,
    taxAmount,
    taxRate: body.taxRate !== undefined ? Number(body.taxRate) : null,
    discountAmount,
    discountRate: body.discountRate !== undefined ? Number(body.discountRate) : null,
    notes: body.notes || '',
    total,
    currency: (body.currency || 'USD').toUpperCase(),
    store: body.store !== false,
  };
}

function generateInvoicePdf(invoiceData, logoPath) {
  return new Promise(function(resolve, reject) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', function(chunk) { chunks.push(chunk); });
      doc.on('end', function() { resolve(Buffer.concat(chunks)); });

      const primaryColor = '#5B4FFF';
      const textColor = '#1F1F1F';
      const borderColor = '#E6E6E6';
      const tableStripe = '#F7F7F7';

      // Header (compact)
      if (logoPath) {
        doc.image(logoPath, 50, 40, { width: 100 });
      }

      doc
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Brandible Marketing Group', 50, 110);

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Invoice', 50, 130);

      // Right aligned invoice info
      const infoTop = 40;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(textColor)
        .text('Invoice #: ' + invoiceData.invoiceNumber, 320, infoTop, { align: 'right' })
        .moveDown(0.15)
        .text('Date: ' + (invoiceData.date ? new Date(invoiceData.date).toLocaleDateString() : new Date().toLocaleDateString()), { align: 'right' })
        .moveDown(0.15)
        .text('Due: ' + (invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : '—'), { align: 'right' });

      // Bill To (compact)
      doc
        .moveDown(2.5)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Bill To:');

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(invoiceData.clientName || 'Client')
        .text(invoiceData.clientEmail || '');

      // Table Header
      let tableTop = doc.y + 14;
      const tableLeft = 50;
      const tableWidth = 495;
      const rowHeight = 26;

      doc
        .lineWidth(1)
        .strokeColor(borderColor)
        .moveTo(tableLeft, tableTop)
        .lineTo(tableLeft + tableWidth, tableTop)
        .stroke();

      doc
        .rect(tableLeft, tableTop, tableWidth, rowHeight)
        .fill(tableStripe);

      doc
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Description', tableLeft + 10, tableTop + 8)
        .text('Qty', tableLeft + 280, tableTop + 8, { width: 50, align: 'right' })
        .text('Price', tableLeft + 340, tableTop + 8, { width: 70, align: 'right' })
        .text('Line Total', tableLeft + 420, tableTop + 8, { width: 80, align: 'right' });

      let currentY = tableTop + rowHeight;
      const items = invoiceData.items || [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const stripe = index % 2 === 0 ? '#FFFFFF' : tableStripe;
        doc
          .rect(tableLeft, currentY, tableWidth, rowHeight)
          .fill(stripe);

        const itemQty = item.qty !== undefined && item.qty !== null ? item.qty : 0;
        const itemPrice = item.price !== undefined && item.price !== null ? item.price : 0;
        doc
          .fillColor(textColor)
          .font('Helvetica')
          .fontSize(10)
          .text(item.description || 'Line item', tableLeft + 10, currentY + 8, { width: 250 })
          .text(itemQty, tableLeft + 280, currentY + 8, { width: 50, align: 'right' })
          .text(formatCurrency(itemPrice, invoiceData.currency), tableLeft + 340, currentY + 8, { width: 70, align: 'right' })
          .text(formatCurrency(itemQty * itemPrice, invoiceData.currency), tableLeft + 420, currentY + 8, { width: 80, align: 'right' });

        currentY += rowHeight;
      }

      // Table border
      doc
        .lineWidth(1)
        .strokeColor(borderColor)
        .rect(tableLeft, tableTop, tableWidth, Math.max(rowHeight, currentY - tableTop))
        .stroke();

      // Summary (compact)
      let summaryY = currentY + 12;
      doc
        .strokeColor(borderColor)
        .moveTo(tableLeft, summaryY - 8)
        .lineTo(tableLeft + tableWidth, summaryY - 8)
        .stroke();

      const summaryLeft = tableLeft + tableWidth - 220;

      const taxLabel = invoiceData.taxRate != null
        ? 'Tax (' + invoiceData.taxRate.toFixed(2) + '%)'
        : 'Tax';
      const discountLabel = invoiceData.discountRate != null
        ? 'Discount (' + invoiceData.discountRate.toFixed(2) + '%)'
        : 'Discount';

      const summaryRows = [
        { label: 'Subtotal', value: formatCurrency(invoiceData.subtotal, invoiceData.currency) },
        { label: taxLabel, value: formatCurrency(invoiceData.taxAmount, invoiceData.currency) },
        { label: discountLabel, value: formatCurrency(-Math.abs(invoiceData.discountAmount || 0), invoiceData.currency) },
      ];

      for (let i = 0; i < summaryRows.length; i++) {
        const row = summaryRows[i];
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(textColor)
          .text(row.label, summaryLeft, summaryY, { width: 120, align: 'right' })
          .text(row.value, summaryLeft + 130, summaryY, { width: 90, align: 'right' });
        summaryY += 16;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Total', summaryLeft, summaryY + 3, { width: 120, align: 'right' })
        .text(formatCurrency(invoiceData.total, invoiceData.currency), summaryLeft + 130, summaryY + 3, { width: 90, align: 'right' });

      // Notes (compact)
      if (invoiceData.notes) {
        const notesY = summaryY + 25;
        if (notesY < doc.page.height - 100) {
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(textColor)
            .text('Notes', 50, notesY);
          doc
            .font('Helvetica')
            .fontSize(9)
            .text(invoiceData.notes, 50, notesY + 12, { width: 495 });
        }
      }

      // Footer (compact, fit on one page)
      const footerY = Math.min(summaryY + (invoiceData.notes ? 60 : 40), doc.page.height - 80);
      doc
        .strokeColor(borderColor)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(textColor)
        .text('Thank you for partnering with Brandible.', 50, footerY + 8, { align: 'center' });

      const footerBarY = footerY + 22;
      if (footerBarY + 25 < doc.page.height) {
        doc
          .rect(50, footerBarY, 495, 25)
          .fill(primaryColor);

        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('www.brandible.com', 50, footerBarY + 8, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function uploadPdf(buffer, clientId, invoiceIdentifier, store) {
  const supabase = getSupabaseClient();
  const safeClientId = sanitizeSegment(clientId, 'client');
  const safeInvoiceId = sanitizeSegment(invoiceIdentifier, 'invoice_' + Date.now());
  const directory = store ? 'invoices' : 'invoices/previews';
  const fileName = store ? 'invoice' : 'preview';
  const storagePath = directory + '/' + safeClientId + '/' + fileName + '_' + safeInvoiceId + '.pdf';

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return publicData?.publicUrl;
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
    }

    const supabase = getSupabaseClient();
    const body = JSON.parse(event.body || '{}');
    const invoiceId = body.invoiceId || body.id || null;
    const adminRequest = isAdmin(user);

    let invoiceData;
    let storeFinal = false;

    if (invoiceId) {
      const { data: invoiceRecord, error: fetchError } = await supabase
        .from('invoices')
        .select('*, invoice_items(*), clients:client_id(name, email)')
        .eq('id', invoiceId)
        .single();

      if (fetchError) {
        console.error('generate-invoice-pdf fetch error:', fetchError);
        return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
      }

      if (!adminRequest && invoiceRecord && invoiceRecord.clients && invoiceRecord.clients.email && invoiceRecord.clients.email !== user.email) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Access denied' }) };
      }

      invoiceData = buildInvoiceFromRecord(invoiceRecord);
      storeFinal = body.store !== false; // default to true for existing invoices
    } else {
      if (!adminRequest) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Access denied' }) };
      }

      invoiceData = normalizeBodyPayload(body);
      if (!invoiceData.clientId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required for previews' }) };
      }
      storeFinal = invoiceData.store === true; // previews default to false
    }

    const logoPath = resolveLogoPath();
    const pdfBuffer = await generateInvoicePdf(invoiceData, logoPath);

    const clientIdForStorage = invoiceData.clientId || body.clientId;
    const invoiceIdentifier = invoiceData.invoiceId || invoiceData.invoiceNumber || Date.now();
    const url = await uploadPdf(pdfBuffer, clientIdForStorage, invoiceIdentifier, storeFinal);

    if (storeFinal && invoiceData.invoiceId) {
      try {
        const { data: currentInvoice } = await supabase
          .from('invoices')
          .select('meta')
          .eq('id', invoiceData.invoiceId)
          .single();

        const currentMeta = currentInvoice && currentInvoice.meta ? currentInvoice.meta : {};
        const nextMeta = {
          taxRate: currentMeta.taxRate,
          discountRate: currentMeta.discountRate,
          pdfUrl: url,
        };
        if (invoiceData.taxRate !== undefined && invoiceData.taxRate !== null) {
          nextMeta.taxRate = invoiceData.taxRate;
        } else if (currentInvoice && currentInvoice.meta && currentInvoice.meta.taxRate !== undefined) {
          nextMeta.taxRate = currentInvoice.meta.taxRate;
        }
        if (invoiceData.discountRate !== undefined && invoiceData.discountRate !== null) {
          nextMeta.discountRate = invoiceData.discountRate;
        } else if (currentInvoice && currentInvoice.meta && currentInvoice.meta.discountRate !== undefined) {
          nextMeta.discountRate = currentInvoice.meta.discountRate;
        }

        await supabase
          .from('invoices')
          .update({
            pdf_url: url,
            meta: nextMeta,
          })
          .eq('id', invoiceData.invoiceId);
      } catch (metaError) {
        console.warn('generate-invoice-pdf meta update warning:', metaError);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, url }),
    };
  } catch (error) {
    console.error('generate-invoice-pdf error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to generate invoice PDF' }),
    };
  }
};


