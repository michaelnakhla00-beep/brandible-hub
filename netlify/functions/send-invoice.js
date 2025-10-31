const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeConfigured = STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.toLowerCase().includes('dummy');

function requireAdmin(user) {
  if (!user) return false;
  const roles = user.app_metadata?.roles || [];
  return roles.includes('admin');
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
    const { invoiceId } = body;
    if (!invoiceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invoiceId is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients:client_id(email, name), invoice_items (*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    let hostedUrl = invoice.hosted_url;
    let pdfUrl = invoice.pdf_url;
    let stripeInvoiceId = invoice.stripe_invoice_id;
    let stripeNote = null;

    const stripe = getStripe();
    if (stripe) {
      try {
        const customer = await stripe.customers.create(
          { email: invoice.clients?.email, name: invoice.clients?.name },
          { idempotencyKey: `${invoice.clients?.email || 'client'}-${invoice.id}` }
        );

        for (const item of invoice.invoice_items || []) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            description: item.description,
            quantity: item.quantity,
            unit_amount: Math.round(item.unit_amount * 100),
            currency: invoice.currency,
          });
        }

        const invoiceParams = {
          customer: customer.id,
          collection_method: 'send_invoice',
          auto_advance: true,
          footer: invoice.notes || undefined,
        };
        if (invoice.due_at) {
          const dueDate = new Date(invoice.due_at);
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
          .eq('id', invoiceId);
      } catch (err) {
        console.error('Stripe send invoice failed:', err.message);
        stripeNote = 'Stripe error: ' + err.message;
      }
    } else {
      hostedUrl = '#';
      pdfUrl = null;
      stripeNote = 'Stripe not configured; invoice marked open locally.';
      await supabase
        .from('invoices')
        .update({ status: 'open', issued_at: new Date().toISOString() })
        .eq('id', invoiceId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        stripe_invoice_id: stripeInvoiceId,
        hosted_url: hostedUrl,
        pdf_url: pdfUrl,
        note: stripeNote,
      }),
    };
  } catch (err) {
    console.error('send-invoice error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error sending invoice' }) };
  }
};

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, serviceKey);
}

function hasStripe() {
  return stripeSecret && !stripeSecret.toLowerCase().includes('dummy');
}

function toCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
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
    const { invoiceId, sendEmail = true, dueDate = null } = body;

    if (!invoiceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invoiceId is required' }),
      };
    }

    const supabase = getSupabase();
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients(id, email, name), invoice_items(*)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Invoice not found' }),
      };
    }

    const issuedAt = new Date();
    const dueAt = dueDate ? new Date(dueDate) : new Date(issuedAt.getTime() + 7 * 24 * 3600 * 1000);

    let stripeData = { hosted_invoice_url: null, invoice_pdf: null, stripe_invoice_id: invoice.stripe_invoice_id || null };

    if (hasStripe()) {
      const Stripe = require('stripe');
      const stripe = new Stripe(stripeSecret);

      const clientEmail = invoice.clients?.email;
      if (!clientEmail) {
        throw new Error('Client email required for Stripe invoice');
      }

      let stripeInvoiceId = invoice.stripe_invoice_id;
      let customerId;

      if (!stripeInvoiceId) {
        const existingCustomers = await stripe.customers.list({ email: clientEmail, limit: 1 });
        if (existingCustomers.data.length) {
          customerId = existingCustomers.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: clientEmail,
            name: invoice.clients?.name || clientEmail,
          });
          customerId = customer.id;
        }

        // Create invoice items for each line
        for (const item of invoice.invoice_items || []) {
          if (!item.description) continue;
          await stripe.invoiceItems.create({
            customer: customerId,
            description: item.description,
            quantity: item.quantity || 1,
            currency: invoice.currency || 'usd',
            unit_amount: toCents(item.unit_amount),
          });
        }

        const stripeInvoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: Math.max(1, Math.ceil((dueAt.getTime() - issuedAt.getTime()) / (24 * 3600 * 1000))),
          metadata: {
            supabase_invoice_id: invoice.id,
          },
          description: invoice.notes || undefined,
        });

        stripeInvoiceId = stripeInvoice.id;
      }

      const finalized = await stripe.invoices.finalizeInvoice(stripeInvoiceId, { auto_advance: false });
      if (sendEmail) {
        await stripe.invoices.sendInvoice(stripeInvoiceId);
      }

      const refreshed = await stripe.invoices.retrieve(stripeInvoiceId);
      stripeData = {
        hosted_invoice_url: refreshed.hosted_invoice_url,
        invoice_pdf: refreshed.invoice_pdf,
        stripe_invoice_id: stripeInvoiceId,
      };
    }

    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'open',
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        stripe_invoice_id: stripeData.stripe_invoice_id,
        hosted_url: stripeData.hosted_invoice_url,
        pdf_url: stripeData.invoice_pdf,
      })
      .eq('id', invoiceId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Log activity
    try {
      await supabase.from('client_activity').insert({
        client_email: invoice.clients?.email,
        activity: `Invoice ${updatedInvoice.number || ''} sent (${updatedInvoice.total} ${updatedInvoice.currency.toUpperCase()})`,
        type: 'invoice',
        timestamp: new Date().toISOString(),
      });
    } catch (activityError) {
      console.warn('Failed to log invoice activity', activityError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoice: updatedInvoice, stripe: stripeData }),
    };
  } catch (err) {
    console.error('send-invoice error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to send invoice' }),
    };
  }
};

