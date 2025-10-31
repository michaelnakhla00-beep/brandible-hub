const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || STRIPE_SECRET_KEY.toLowerCase().includes('dummy')) {
    console.warn('Stripe webhook received but Stripe is not fully configured. Skipping processing.');
    return { statusCode: 200, body: JSON.stringify({ success: true, skipped: true }) };
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  let eventBody;
  try {
    eventBody = stripe.webhooks.constructEvent(event.body, event.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing for webhook');
    return { statusCode: 500, body: 'Supabase configuration missing' };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const eventType = eventBody.type;
    const data = eventBody.data?.object || {};

    if (eventType === 'invoice.payment_succeeded') {
      const stripeInvoiceId = data.id;
      const hostedUrl = data.hosted_invoice_url;
      const pdfUrl = data.invoice_pdf;
      const paidAt = data.status_transitions?.paid_at;
      const amountPaid = data.amount_paid ? data.amount_paid / 100 : null;

      if (stripeInvoiceId) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id, currency')
          .eq('stripe_invoice_id', stripeInvoiceId)
          .single();

        if (invoice) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              hosted_url: hostedUrl || null,
              pdf_url: pdfUrl || null,
              paid_at: paidAt ? new Date(paidAt * 1000).toISOString() : new Date().toISOString(),
            })
            .eq('id', invoice.id);

          if (amountPaid) {
            await supabase
              .from('payments')
              .insert({
                invoice_id: invoice.id,
                provider: 'stripe',
                amount: amountPaid,
                currency: invoice.currency || 'usd',
                status: 'succeeded',
                provider_ref: stripeInvoiceId,
              });
          }
        }
      }
    }

    if (eventType === 'invoice.voided' || eventType === 'invoice.marked_uncollectible') {
      const stripeInvoiceId = data.id;
      const newStatus = eventType === 'invoice.voided' ? 'void' : 'uncollectible';
      if (stripeInvoiceId) {
        await supabase
          .from('invoices')
          .update({ status: newStatus })
          .eq('stripe_invoice_id', stripeInvoiceId);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
    return { statusCode: 500, body: 'Webhook handler failed' };
  }
};

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, serviceKey);
}

function hasStripe() {
  return stripeSecret && !stripeSecret.toLowerCase().includes('dummy') && webhookSecret;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!hasStripe()) {
    // Stripe not configured yet; acknowledge to avoid retries
    return { statusCode: 200, body: JSON.stringify({ ignored: true }) };
  }

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecret);
    const signature = event.headers['stripe-signature'];

    let payload;
    try {
      payload = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed', err);
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    const supabase = getSupabase();
    const invoice = payload.data.object;

    if (!invoice || invoice.object !== 'invoice') {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, client_id, number')
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingInvoice) {
      console.warn('Invoice not found for Stripe ID', invoice.id);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    let statusUpdate = {};
    const nowIso = new Date().toISOString();

    switch (payload.type) {
      case 'invoice.finalized':
        statusUpdate = {
          status: 'open',
          hosted_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf,
          issued_at: invoice.status_transitions?.finalized_at
            ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
            : nowIso,
          due_at: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        };
        break;
      case 'invoice.sent':
        statusUpdate = {
          hosted_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf,
        };
        break;
      case 'invoice.payment_succeeded':
        statusUpdate = {
          status: 'paid',
          paid_at: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
            : nowIso,
        };
        break;
      case 'invoice.payment_failed':
        statusUpdate = {
          status: 'open',
        };
        break;
      case 'invoice.voided':
        statusUpdate = { status: 'void' };
        break;
      case 'invoice.marked_uncollectible':
        statusUpdate = { status: 'uncollectible' };
        break;
      default:
        break;
    }

    if (Object.keys(statusUpdate).length) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update(statusUpdate)
        .eq('id', existingInvoice.id);
      if (updateError) throw updateError;
    }

    if (payload.type === 'invoice.payment_succeeded') {
      const amountPaid = (invoice.amount_paid || 0) / 100;
      await supabase.from('payments').insert({
        invoice_id: existingInvoice.id,
        provider: 'stripe',
        amount: amountPaid,
        currency: invoice.currency || 'usd',
        status: 'succeeded',
        provider_ref: invoice.charge || invoice.id,
        received_at: nowIso,
        meta: {
          stripe_event_id: payload.id,
        },
      });
    }

    try {
      await supabase.from('client_activity').insert({
        client_email: invoice.customer_email,
        activity: `Stripe ${payload.type.replace('invoice.', '')} for invoice ${existingInvoice.number || ''}`,
        type: 'invoice',
        timestamp: nowIso,
      });
    } catch (activityError) {
      console.warn('Webhook activity log failed', activityError);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Webhook error' }) };
  }
};

