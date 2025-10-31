const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeConfigured = STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.toLowerCase().includes('dummy');

function getStripe() {
  if (!stripeConfigured) return null;
  try {
    return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  } catch (err) {
    console.warn('Failed to instantiate Stripe client', err);
    return null;
  }
}

function requireAdmin(user) {
  if (!user) return false;
  const roles = user.app_metadata?.roles || [];
  return roles.includes('admin');
}

function computeTotals(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  let subtotal = 0;
  safeItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const unit = Number(item.unit_amount || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) return;
    subtotal += qty * unit;
  });
  return { subtotal, tax: 0, total: subtotal }; // tax placeholder for future
}

function generateInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime().toString().slice(-5)}`;
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    if (!requireAdmin(user)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { clientId, items = [], currency = 'usd', due_at = null, notes = '', sendNow = false } = body;

    if (!clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required' }) };
    }
    if (!Array.isArray(items) || !items.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'At least one line item is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    }

    const totals = computeTotals(items);
    const number = generateInvoiceNumber();

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        number,
        currency,
        status: sendNow ? 'open' : 'draft',
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        issued_at: sendNow ? new Date().toISOString() : null,
        due_at,
        notes,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Invoice insert error:', insertError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create invoice' }) };
    }

    const itemPayload = items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description || 'Line item',
      quantity: Number(item.quantity || 1),
      unit_amount: Number(item.unit_amount || 0),
    }));

    const { error: insertItemsError } = await supabase
      .from('invoice_items')
      .insert(itemPayload);

    if (insertItemsError) {
      console.error('Invoice items insert error:', insertItemsError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create invoice items' }) };
    }

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

          for (const item of itemPayload) {
            await stripe.invoiceItems.create({
              customer: customer.id,
              description: item.description,
              quantity: item.quantity,
              unit_amount: Math.round(item.unit_amount * 100),
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

          const stripeInvoice = await stripe.invoices.create(invoiceParams);
          const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
          await stripe.invoices.sendInvoice(stripeInvoice.id);

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
          console.error('Stripe send invoice failed:', err.message);
          stripeNote = 'Stripe error: ' + err.message;
        }
      } else {
        hostedUrl = '#';
        pdfUrl = null;
        stripeNote = 'Stripe not configured; invoice marked open locally.';
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
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error creating invoice' }) };
  }
};

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, serviceKey);
}

function generateInvoiceNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomUUID().split('-')[0].toUpperCase();
  return `INV-${datePart}-${randomPart}`;
}

function parseItems(items = []) {
  return items
    .filter((item) => item && item.description)
    .map((item) => ({
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unit_amount: Number(item.unit_amount) || 0,
    }));
}

function calculateTotals(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount,
    0
  );
  return {
    subtotal,
    tax: 0,
    total: subtotal,
  };
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const user = context.clientContext && context.clientContext.user;
    const isAdmin = user?.app_metadata?.roles?.includes('admin');
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const {
      clientId,
      clientEmail,
      currency = 'usd',
      dueDate = null,
      notes = '',
      items = [],
    } = body;

    if (!clientId || !clientEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'clientId and clientEmail are required' }),
      };
    }

    const supabase = getSupabase();

    // Ensure client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Client not found' }),
      };
    }

    const parsedItems = parseItems(items);
    const totals = calculateTotals(parsedItems);
    const invoiceNumber = generateInvoiceNumber();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        number: invoiceNumber,
        currency,
        status: 'draft',
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        notes,
        meta: body.meta || {},
      })
      .select('*')
      .single();

    if (invoiceError) throw invoiceError;

    if (parsedItems.length) {
      const rows = parsedItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unit_amount,
      }));
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(rows);
      if (itemsError) throw itemsError;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        invoice,
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

