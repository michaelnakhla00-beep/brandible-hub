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

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    if (!user || !(user.app_metadata?.roles || []).includes('admin')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { invoiceId } = JSON.parse(event.body || '{}');
    if (!invoiceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invoiceId is required' }) };
    }

    const supabase = getSupabase();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients:client_id(email, name), invoice_items(*)')
      .eq('id', invoiceId)
      .single();
    if (invoiceError) throw invoiceError;
    if (!invoice) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    let hostedUrl = invoice.hosted_url;
    let pdfUrl = invoice.pdf_url;
    let stripeInvoiceId = invoice.stripe_invoice_id;
    let stripeNote = null;

    if (invoice.status === 'paid') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, hosted_url: hostedUrl, pdf_url: pdfUrl, note: 'Invoice already paid.' }),
      };
    }

    if (stripeConfigured) {
      const stripe = getStripe();
      try {
        const customer = await stripe.customers.create(
          { email: invoice.clients?.email, name: invoice.clients?.name },
          { idempotencyKey: `${invoice.clients?.email || 'client'}-${invoice.id}-resend` }
        );

        const normalizedItems = normalizeItems(invoice.invoice_items || []);
        for (const item of normalizedItems) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            description: item.description,
            quantity: item.quantity,
            unit_amount: Math.round(item.unit_amount * 100),
            currency: invoice.currency,
          });
        }

        const meta = invoice.meta || {};
        if (meta.taxRate && invoice.tax) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            description: 'Tax',
            quantity: 1,
            unit_amount: Math.round(Number(invoice.tax) * 100),
            currency: invoice.currency,
          });
        }

        if (meta.discountAmount) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            description: 'Discount',
            quantity: 1,
            unit_amount: Math.round(-Number(meta.discountAmount) * 100),
            currency: invoice.currency,
          });
        }

        const params = {
          customer: customer.id,
          collection_method: 'send_invoice',
          auto_advance: true,
          footer: invoice.notes || undefined,
        };
        if (invoice.due_at) {
          const dueDate = new Date(invoice.due_at);
          if (!Number.isNaN(dueDate.getTime())) {
            const days = Math.max(0, Math.round((dueDate - new Date()) / (1000 * 60 * 60 * 24)));
            params.days_until_due = days || 30;
          }
        }

        const draft = await stripe.invoices.create(params);
        const finalized = await stripe.invoices.finalizeInvoice(draft.id);
        await stripe.invoices.sendInvoice(draft.id);

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
        console.error('Stripe send invoice failed:', err);
        stripeNote = `Stripe error: ${err.message}`;
      }
    } else {
      await supabase
        .from('invoices')
        .update({ status: 'open', issued_at: new Date().toISOString() })
        .eq('id', invoiceId);
      stripeNote = 'Stripe not configured; invoice status moved to open locally.';
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
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unexpected error sending invoice' }) };
  }
};
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

