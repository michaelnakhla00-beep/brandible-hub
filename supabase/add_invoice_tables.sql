-- Invoices schema for Brandible Hub
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    CREATE TABLE public.invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
      number text UNIQUE,
      currency text NOT NULL DEFAULT 'usd',
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
      subtotal numeric NOT NULL DEFAULT 0,
      tax numeric NOT NULL DEFAULT 0,
      total numeric NOT NULL DEFAULT 0,
      issued_at timestamptz,
      due_at timestamptz,
      paid_at timestamptz,
      stripe_invoice_id text,
      pdf_url text,
      hosted_url text,
      notes text,
      meta jsonb DEFAULT '{}'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
  ) THEN
    CREATE TABLE public.invoice_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
      description text NOT NULL,
      quantity numeric NOT NULL DEFAULT 1,
      unit_amount numeric NOT NULL DEFAULT 0,
      amount numeric GENERATED ALWAYS AS (quantity * unit_amount) STORED
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    CREATE TABLE public.payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
      provider text NOT NULL CHECK (provider IN ('stripe','manual')),
      amount numeric NOT NULL,
      currency text NOT NULL DEFAULT 'usd',
      status text NOT NULL CHECK (status IN ('succeeded','failed','pending')),
      provider_ref text,
      received_at timestamptz DEFAULT now(),
      meta jsonb DEFAULT '{}'::jsonb
    );
  END IF;
END $$;


