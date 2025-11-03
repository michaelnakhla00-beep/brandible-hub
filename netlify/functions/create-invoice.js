const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeConfigured = STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.toLowerCase().includes('dummy');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function getStripe() {
  if (!stripeConfigured) return null;
  try {
    return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  } catch (err) {
    console.warn('Failed to instantiate Stripe client', err);
    return null;
  }
}

function normalizeItems(items) {
  if (!items || !Array.isArray(items)) items = [];
  return items
    .filter(function(item) { return item && item.description; })
    .map(function(item) {
      return {
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit_amount: Number(item.unit_amount) || 0,
      };
    });
}

function calculateTotals(items, taxRate, discountRate) {
  if (!items || !Array.isArray(items)) items = [];
  if (taxRate === undefined || taxRate === null) taxRate = 0;
  if (discountRate === undefined || discountRate === null) discountRate = 0;
  const subtotal = items.reduce(function(sum, item) { return sum + item.quantity * item.unit_amount; }, 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const discountAmount = subtotal * (Number(discountRate) || 0) / 100;
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal: subtotal, taxAmount: taxAmount, discountAmount: discountAmount, total: total };
}

async function generateInvoiceNumber(supabase, year) {
  if (year === undefined || year === null) year = new Date().getFullYear();
  // Query for the highest invoice number for this year
  const queryResult = await supabase
    .from('invoices')
    .select('number')
    .like('number', 'INV-' + year + '-%')
    .order('number', { ascending: false })
    .limit(1);
  const invoices = queryResult.data;
  const error = queryResult.error;

  if (error) {
    console.warn('Failed to query invoice numbers, using fallback:', error);
    return 'INV-' + year + '-00001';
  }

  // Extract the highest sequence number
  let nextSequence = 1;
  if (invoices && invoices.length > 0 && invoices[0].number) {
    const match = String(invoices[0].number).match(/^INV-(\d{4})-(\d+)$/i);
    if (match && match[2]) {
      const lastSeq = parseInt(match[2], 10);
      nextSequence = lastSeq + 1;
    }
  }

  // Format as 5-digit zero-padded number
  let paddedSeq = String(nextSequence);
  while (paddedSeq.length < 5) {
    paddedSeq = '0' + paddedSeq;
  }
  return 'INV-' + year + '-' + paddedSeq;
}

function buildMeta(params) {
  if (!params) params = {};
  const attachments = params.attachments || [];
  const taxRate = params.taxRate || 0;
  const discountRate = params.discountRate || 0;
  const discountAmount = params.discountAmount || 0;
  return {
    attachments: attachments,
    taxRate: Number(taxRate) || 0,
    discountRate: Number(discountRate) || 0,
    discountAmount: discountAmount,
  };
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    const userRoles = user && user.app_metadata && user.app_metadata.roles || [];
    if (!user || !userRoles.includes('admin')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const clientId = body.clientId;
    const currency = body.currency || 'usd';
    const due_at = body.due_at || null;
    const notes = body.notes || '';
    const sendNow = body.sendNow !== undefined ? body.sendNow : true;
    const providedNumber = body.number;
    const taxRate = body.taxRate || 0;
    const discountRate = body.discountRate || 0;
    const items = body.items || [];
    const attachments = body.attachments || [];

    if (!clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required' }) };
    }

    const supabase = getSupabase();

    const clientResult = await supabase
      .from('clients')
      .select('id, email, name')
      .eq('id', clientId)
      .single();
    const client = clientResult.data;
    const clientError = clientResult.error;
    if (clientError) throw clientError;
    if (!client) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    }

    const normalizedItems = normalizeItems(items);
    if (!normalizedItems.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'At least one line item is required' }) };
    }

    const totals = calculateTotals(normalizedItems, taxRate, discountRate);
    
    // Generate invoice number server-side to prevent duplicates
    // Only use provided number if explicitly provided (for previews/re-testing)
    const invoiceNumber = providedNumber || await generateInvoiceNumber(supabase);

    const meta = buildMeta({ attachments, taxRate, discountRate, discountAmount: totals.discountAmount });

    const invoiceResult = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        number: invoiceNumber,
        currency: currency,
        status: sendNow ? 'open' : 'draft',
        subtotal: totals.subtotal,
        tax: totals.taxAmount,
        total: totals.total,
        issued_at: sendNow ? new Date().toISOString() : null,
        due_at: due_at,
        notes: notes,
        meta: meta,
      })
      .select('*')
      .single();
    const invoice = invoiceResult.data;
    const insertError = invoiceResult.error;

    if (insertError) throw insertError;

    const lineRows = normalizedItems.map(function(item) {
      return {
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unit_amount,
      };
    });

    const itemsResult = await supabase
      .from('invoice_items')
      .insert(lineRows);
    const itemsError = itemsResult.error;
    if (itemsError) throw itemsError;

    let hostedUrl = null;
    let pdfUrl = null;
    let stripeInvoiceId = null;
    let stripeNote = null;

    if (sendNow) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const customer = await stripe.customers.create(
            { email: client.email, name: client.name },
            { idempotencyKey: client.email + '-' + invoice.id }
          );

          for (let i = 0; i < normalizedItems.length; i++) {
            const item = normalizedItems[i];
            await stripe.invoiceItems.create({
              customer: customer.id,
              description: item.description,
              quantity: item.quantity,
              unit_amount: Math.round(item.unit_amount * 100),
              currency: currency,
            });
          }

          if (totals.taxAmount > 0) {
            await stripe.invoiceItems.create({
              customer: customer.id,
              description: 'Tax',
              quantity: 1,
              unit_amount: Math.round(totals.taxAmount * 100),
              currency,
            });
          }

          if (totals.discountAmount > 0) {
            await stripe.invoiceItems.create({
              customer: customer.id,
              description: 'Discount',
              quantity: 1,
              unit_amount: Math.round(-totals.discountAmount * 100),
              currency,
            });
          }

          const invoiceParams = {
            customer: customer.id,
            collection_method: 'send_invoice',
            auto_advance: true,
            footer: notes || undefined,
          };
          if (due_at) {
            const dueDate = new Date(due_at);
            if (!Number.isNaN(dueDate.getTime())) {
              const days = Math.max(0, Math.round((dueDate - new Date()) / (1000 * 60 * 60 * 24)));
              invoiceParams.days_until_due = days || 30;
            }
          }

          const stripeDraft = await stripe.invoices.create(invoiceParams);
          const finalized = await stripe.invoices.finalizeInvoice(stripeDraft.id);
          await stripe.invoices.sendInvoice(stripeDraft.id);

          hostedUrl = finalized.hosted_invoice_url;
          pdfUrl = finalized.invoice_pdf;
          stripeInvoiceId = finalized.id;

          const finalizedAt = finalized.status_transitions && finalized.status_transitions.finalized_at
            ? finalized.status_transitions.finalized_at
            : null;
          
          await supabase
            .from('invoices')
            .update({
              status: 'open',
              stripe_invoice_id: stripeInvoiceId,
              hosted_url: hostedUrl,
              pdf_url: pdfUrl,
              issued_at: finalizedAt
                ? new Date(finalizedAt * 1000).toISOString()
                : new Date().toISOString(),
            })
            .eq('id', invoice.id);
        } catch (err) {
          console.error('Stripe send invoice failed:', err);
          stripeNote = `Stripe error: ${err.message}`;
        }
      } else {
        stripeNote = 'Stripe not configured; invoice saved locally as open.';
      }
    }

    const responseInvoice = Object.assign({}, invoice);
    if (hostedUrl) responseInvoice.hosted_url = hostedUrl;
    if (pdfUrl) responseInvoice.pdf_url = pdfUrl;
    if (stripeInvoiceId) responseInvoice.stripe_invoice_id = stripeInvoiceId;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        invoice: responseInvoice,
        note: stripeNote,
      }),
    };
  } catch (err) {
    console.error('create-invoice error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to create invoice' }),
    };
  }
};
