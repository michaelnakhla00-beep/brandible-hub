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

function normalizeItems(items = []) {
  return items
    .filter((item) => item && item.description)
    .map((item) => ({
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unit_amount: Number(item.unit_amount) || 0,
    }));
}

function calculateTotals(items = [], taxRate = 0, discountRate = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_amount, 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const discountAmount = subtotal * (Number(discountRate) || 0) / 100;
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal, taxAmount, discountAmount, total };
}

function fallbackInvoiceNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 90000 + 10000);
  return `INV-${datePart}-${random}`;
}

function buildMeta({ attachments = [], taxRate = 0, discountRate = 0, discountAmount = 0 }) {
  return {
    attachments,
    taxRate: Number(taxRate) || 0,
    discountRate: Number(discountRate) || 0,
    discountAmount,
  };
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    if (!user || !(user.app_metadata?.roles || []).includes('admin')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const {
      clientId,
      currency = 'usd',
      due_at = null,
      notes = '',
      sendNow = true,
      number: providedNumber,
      taxRate = 0,
      discountRate = 0,
      items = [],
      attachments = [],
    } = body;

    if (!clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required' }) };
    }

    const supabase = getSupabase();

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, name')
      .eq('id', clientId)
      .single();
    if (clientError) throw clientError;
    if (!client) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    }

    const normalizedItems = normalizeItems(items);
    if (!normalizedItems.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'At least one line item is required' }) };
    }

    const totals = calculateTotals(normalizedItems, taxRate, discountRate);
    const invoiceNumber = providedNumber || fallbackInvoiceNumber();

    const meta = buildMeta({ attachments, taxRate, discountRate, discountAmount: totals.discountAmount });

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        number: invoiceNumber,
        currency,
        status: sendNow ? 'open' : 'draft',
        subtotal: totals.subtotal,
        tax: totals.taxAmount,
        total: totals.total,
        issued_at: sendNow ? new Date().toISOString() : null,
        due_at,
        notes,
        meta,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    const lineRows = normalizedItems.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_amount: item.unit_amount,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(lineRows);
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
            { idempotencyKey: `${client.email}-${invoice.id}` }
          );

          for (const item of normalizedItems) {
            await stripe.invoiceItems.create({
              customer: customer.id,
              description: item.description,
              quantity: item.quantity,
              unit_amount: Math.round(item.unit_amount * 100),
              currency,
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

          await supabase
            .from('invoices')
            .update({
              status: 'open',
              stripe_invoice_id: stripeInvoiceId,
              hosted_url: hostedUrl,
              pdf_url: pdfUrl,
              issued_at: finalized.status_transitions?.finalized_at
                ? new Date(finalized.status_transitions.finalized_at * 1000).toISOString()
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        invoice: { ...invoice, hosted_url: hostedUrl, pdf_url: pdfUrl, stripe_invoice_id: stripeInvoiceId },
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


