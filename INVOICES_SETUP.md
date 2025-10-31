# Invoice System Setup

Follow these steps when you are ready to hook Brandible Hub to Stripe.

## 1. Supabase schema

Run the migrations in `supabase/add_invoice_tables.sql` (and, if you have not already, `supabase/add_project_activity.sql`). These create the `invoices`, `invoice_items`, and `payments` tables and ensure project activity persists across refreshes.

## 2. Stripe account

1. Create or sign into your Stripe account (using your branded email as soon as it is available).
2. In **Developers → API keys**, copy your **Secret key** (start with the test key).
3. Optional but recommended: in **Settings → Email → Invoices** enable invoice emails so Stripe sends them automatically.
4. Configure tax rates, coupons, or additional currencies as needed.

## 3. Netlify environment variables

In *Site settings → Build & deploy → Environment* add:

- `STRIPE_SECRET_KEY` = your Stripe secret key (test for now).
- `STRIPE_WEBHOOK_SECRET` = leave blank until you create the webhook in the next step.

Redeploy the site (Trigger deploy → Clear cache and deploy) after changing environment variables.

## 4. Stripe webhook

After the functions deploy:

1. Note the Netlify Function URL for `stripe-webhook` (e.g. `https://YOUR_SITE/.netlify/functions/stripe-webhook`).
2. In Stripe → **Developers → Webhooks**, add an endpoint pointing to that URL.
3. Subscribe to these events: `invoice.finalized`, `invoice.sent`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`.
4. Copy the signing secret Stripe provides, store it as `STRIPE_WEBHOOK_SECRET` in Netlify, and redeploy.

## 5. Local dependencies (optional)

Because the Netlify functions now use the Stripe SDK, run `npm install` locally to install the dependency and generate a lockfile if you intend to use `netlify dev`.

## 6. What to expect

- Admins can create invoices inside the client modal. Checking “Send invoice immediately” finalizes and emails the Stripe invoice when Stripe keys are configured.
- Admin invoice builder supports tax %, discount %, and file attachments (stored in Supabase Storage and referenced on the invoice record).
- Clients see a responsive invoice table with status pills, pay/PDF actions, and a detail modal showing line items, totals, and attachments.
- Stripe webhooks keep Supabase in sync (status, hosted link, paid date, payment records).
- If Stripe credentials are missing or set to a placeholder (e.g. `sk_test_dummy`), invoices are stored in Supabase as drafts and no Stripe calls are made—ideal for UI testing before enabling payments.

