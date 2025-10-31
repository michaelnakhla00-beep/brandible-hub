const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const pdfkitPackagePath = require.resolve('pdfkit/package.json');
const pdfkitDir = path.dirname(pdfkitPackagePath);
const standardFontDir = path.join(pdfkitDir, 'js', 'data');
const standardFontMap = {
  Helvetica: 'Helvetica.afm',
  'Helvetica-Bold': 'Helvetica-Bold.afm',
  'Helvetica-Oblique': 'Helvetica-Oblique.afm',
  'Helvetica-BoldOblique': 'Helvetica-BoldOblique.afm',
  'Times-Roman': 'Times-Roman.afm',
  'Times-Bold': 'Times-Bold.afm',
  'Times-Italic': 'Times-Italic.afm',
  'Times-BoldItalic': 'Times-BoldItalic.afm'
};

const originalFontMethod = PDFDocument.prototype.font;
PDFDocument.prototype.font = function patchedFont(name, size, options) {
  if (typeof name === 'string' && standardFontMap[name]) {
    const fontFile = path.join(standardFontDir, standardFontMap[name]);
    if (fs.existsSync(fontFile)) {
      return originalFontMethod.call(this, fontFile, size, options);
    }
  }
  return originalFontMethod.call(this, name, size, options);
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
    return `$${Number(amount || 0).toFixed(2)}`;
  }
}

function resolveLogoPath() {
  const candidates = [
    path.join(__dirname, '../../assets/images/Brandible.png'),
    path.join(__dirname, '../../assets/images/brandible.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function buildInvoiceFromRecord(record) {
  const meta = record.meta || {};
  const items = (record.invoice_items || []).map((item) => ({
    description: item.description || 'Line item',
    qty: Number(item.quantity) || 0,
    price: Number(item.unit_amount) || 0,
  }));

  return {
    clientId: record.client_id,
    invoiceId: record.id,
    clientName: record.clients?.name || meta.clientName || 'Client',
    clientEmail: record.clients?.email || meta.clientEmail || '',
    invoiceNumber: record.number || meta.invoiceNumber || 'INV-0000',
    date: record.issued_at || record.created_at,
    dueDate: record.due_at,
    items,
    subtotal: Number(record.subtotal) || items.reduce((sum, item) => sum + item.qty * item.price, 0),
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
  const normalizedItems = items.map((item) => ({
    description: item.description || 'Line item',
    qty: Number(item.qty ?? item.quantity ?? 0),
    price: Number(item.price ?? item.unit_amount ?? 0),
  }));

  const subtotal = body.subtotal !== undefined
    ? Number(body.subtotal)
    : normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);

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
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const primaryColor = '#5B4FFF';
      const textColor = '#1F1F1F';
      const borderColor = '#E6E6E6';
      const tableStripe = '#F7F7F7';

      // Header
      if (logoPath) {
        doc.image(logoPath, 50, 40, { width: 120 });
      }

      doc
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Brandible Marketing Group', 50, 140);

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Invoice', 50, 165);

      // Right aligned invoice info
      const infoTop = 40;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text(`Invoice #: ${invoiceData.invoiceNumber}`, 320, infoTop, { align: 'right' })
        .moveDown(0.2)
        .text(`Date: ${invoiceData.date ? new Date(invoiceData.date).toLocaleDateString() : new Date().toLocaleDateString()}`, { align: 'right' })
        .moveDown(0.2)
        .text(`Due: ${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : '—'}`, { align: 'right' });

      // Bill To
      doc
        .moveDown(3)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Bill To:');

      doc
        .font('Helvetica')
        .fontSize(11)
        .text(invoiceData.clientName || 'Client')
        .text(invoiceData.clientEmail || '');

      // Table Header
      let tableTop = doc.y + 20;
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

      items.forEach((item, index) => {
        const stripe = index % 2 === 0 ? '#FFFFFF' : tableStripe;
        doc
          .rect(tableLeft, currentY, tableWidth, rowHeight)
          .fill(stripe);

        doc
          .fillColor(textColor)
          .font('Helvetica')
          .fontSize(10)
          .text(item.description || 'Line item', tableLeft + 10, currentY + 8, { width: 250 })
          .text(item.qty ?? 0, tableLeft + 280, currentY + 8, { width: 50, align: 'right' })
          .text(formatCurrency(item.price, invoiceData.currency), tableLeft + 340, currentY + 8, { width: 70, align: 'right' })
          .text(formatCurrency((item.qty || 0) * (item.price || 0), invoiceData.currency), tableLeft + 420, currentY + 8, { width: 80, align: 'right' });

        currentY += rowHeight;
      });

      // Table border
      doc
        .lineWidth(1)
        .strokeColor(borderColor)
        .rect(tableLeft, tableTop, tableWidth, Math.max(rowHeight, currentY - tableTop))
        .stroke();

      // Summary
      let summaryY = currentY + 20;
      doc
        .strokeColor(borderColor)
        .moveTo(tableLeft, summaryY - 10)
        .lineTo(tableLeft + tableWidth, summaryY - 10)
        .stroke();

      const summaryLeft = tableLeft + tableWidth - 220;

      const taxLabel = invoiceData.taxRate != null
        ? `Tax (${invoiceData.taxRate.toFixed(2)}%)`
        : 'Tax';
      const discountLabel = invoiceData.discountRate != null
        ? `Discount (${invoiceData.discountRate.toFixed(2)}%)`
        : 'Discount';

      const summaryRows = [
        { label: 'Subtotal', value: formatCurrency(invoiceData.subtotal, invoiceData.currency) },
        { label: taxLabel, value: formatCurrency(invoiceData.taxAmount, invoiceData.currency) },
        { label: discountLabel, value: formatCurrency(-Math.abs(invoiceData.discountAmount || 0), invoiceData.currency) },
      ];

      summaryRows.forEach((row) => {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(textColor)
          .text(row.label, summaryLeft, summaryY, { width: 120, align: 'right' })
          .text(row.value, summaryLeft + 130, summaryY, { width: 90, align: 'right' });
        summaryY += 18;
      });

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Total', summaryLeft, summaryY + 5, { width: 120, align: 'right' })
        .text(formatCurrency(invoiceData.total, invoiceData.currency), summaryLeft + 130, summaryY + 5, { width: 90, align: 'right' });

      // Notes
      if (invoiceData.notes) {
        doc
          .moveDown(2)
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(textColor)
          .text('Notes')
          .moveDown(0.4)
          .font('Helvetica')
          .fontSize(10)
          .text(invoiceData.notes, { width: 495 });
      }

      // Footer
      const footerY = doc.page.height - 120;
      doc
        .strokeColor(borderColor)
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text('Thank you for partnering with Brandible.', 50, footerY + 15, { align: 'center' });

      doc
        .rect(50, footerY + 50, 495, 30)
        .fill(primaryColor);

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('www.brandible.com', 50, footerY + 58, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function uploadPdf(buffer, clientId, invoiceIdentifier, store) {
  const supabase = getSupabaseClient();
  const safeClientId = sanitizeSegment(clientId, 'client');
  const safeInvoiceId = sanitizeSegment(invoiceIdentifier, `invoice_${Date.now()}`);
  const directory = store ? 'invoices' : 'invoices/previews';
  const storagePath = `${directory}/${safeClientId}/${store ? 'invoice' : 'preview'}_${safeInvoiceId}.pdf`;

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

      if (!adminRequest && invoiceRecord?.clients?.email && invoiceRecord.clients.email !== user.email) {
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

        const nextMeta = {
          ...(currentInvoice?.meta || {}),
          pdfUrl: url,
          taxRate: invoiceData.taxRate ?? currentInvoice?.meta?.taxRate,
          discountRate: invoiceData.discountRate ?? currentInvoice?.meta?.discountRate,
        };

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


