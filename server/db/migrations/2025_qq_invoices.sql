-- Customers & Jobs already exist; this only adds quotes/invoices.

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  customer_id uuid not null,
  job_id uuid,
  title text not null,
  notes text,
  status text not null default 'draft', -- draft | sent | accepted | rejected | converted
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_org_idx on quotes(org_id);
create index if not exists quotes_customer_idx on quotes(customer_id);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0
);

create index if not exists quote_items_quote_idx on quote_items(quote_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  customer_id uuid not null,
  job_id uuid,
  title text not null,
  notes text,
  status text not null default 'draft', -- draft | sent | paid | void
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_org_idx on invoices(org_id);
create index if not exists invoices_customer_idx on invoices(customer_id);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0
);

create index if not exists invoice_items_invoice_idx on invoice_items(invoice_id);