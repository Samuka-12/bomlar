alter table public.pedidos
  add column if not exists checkout_id uuid;

create unique index if not exists pedidos_checkout_id_unique
  on public.pedidos (checkout_id)
  where checkout_id is not null;

create table if not exists public.pagamentos_pix (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  provedor text not null default 'ironpay' check (provedor = 'ironpay'),
  transaction_hash text unique,
  valor_centavos bigint not null check (valor_centavos > 0),
  status text not null default 'gerando_pix' check (status in (
    'gerando_pix',
    'aguardando_pagamento',
    'pago',
    'cancelado',
    'expirado',
    'reembolsado',
    'falhou',
    'reconciliacao_pendente',
    'pix_indisponivel'
  )),
  pix_copia_cola text,
  pix_qr_url text,
  pix_expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

create index if not exists pagamentos_pix_status_criado_idx
  on public.pagamentos_pix (status, criado_em desc);

alter table public.pagamentos_pix enable row level security;
revoke all on public.pagamentos_pix from anon, authenticated;
grant all on public.pagamentos_pix to service_role;
