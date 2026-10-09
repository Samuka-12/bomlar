create extension if not exists pgcrypto;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ordem integer not null default 0
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  descricao text not null default '',
  preco numeric(12,2) not null check (preco >= 0),
  preco_de numeric(12,2) check (preco_de is null or preco_de >= preco),
  categoria_id uuid references public.categorias(id) on delete set null,
  tags text[] not null default '{}',
  ativo boolean not null default true,
  estoque integer check (estoque is null or estoque >= 0),
  criado_em timestamptz not null default now(),
  origem_id text unique,
  disponivel boolean,
  avaliacao_media numeric(3,2) check (avaliacao_media is null or avaliacao_media between 0 and 5),
  total_avaliacoes integer not null default 0 check (total_avaliacoes >= 0),
  avaliacoes jsonb not null default '[]'::jsonb
);

create table if not exists public.produto_imagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  url text not null,
  ordem integer not null default 0,
  unique (produto_id, ordem)
);

create table if not exists public.produto_variacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome text not null,
  valor text not null,
  preco_extra numeric(12,2) not null default 0,
  disponivel boolean
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  imagem_url text,
  link text,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create table if not exists public.quiz_perguntas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  ordem integer not null unique
);

create table if not exists public.quiz_opcoes (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.quiz_perguntas(id) on delete cascade,
  texto text not null,
  tags_pontos jsonb not null default '{}'::jsonb
);

create table if not exists public.quiz_respostas (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null,
  respostas jsonb not null default '{}'::jsonb,
  produto_recomendado_id uuid references public.produtos(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_nome text not null,
  email text not null,
  telefone text not null,
  itens jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'aguardando_pagamento',
  downsell_aceito boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid unique,
  nome text,
  whatsapp text not null,
  origem text not null default 'quiz',
  criado_em timestamptz not null default now()
);

create index if not exists produtos_ativo_preco_idx on public.produtos (ativo, preco);
create unique index if not exists quiz_respostas_sessao_id_uq on public.quiz_respostas (sessao_id);
alter table public.leads add column if not exists sessao_id uuid;
create unique index if not exists leads_sessao_id_uq on public.leads (sessao_id) where sessao_id is not null;
create index if not exists produtos_categoria_idx on public.produtos (categoria_id);
create index if not exists produto_imagens_produto_ordem_idx on public.produto_imagens (produto_id, ordem);
create index if not exists pedidos_criado_em_idx on public.pedidos (criado_em desc);
create index if not exists leads_criado_em_idx on public.leads (criado_em desc);

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_imagens enable row level security;
alter table public.produto_variacoes enable row level security;
alter table public.banners enable row level security;
alter table public.quiz_perguntas enable row level security;
alter table public.quiz_opcoes enable row level security;
alter table public.quiz_respostas enable row level security;
alter table public.pedidos enable row level security;
alter table public.leads enable row level security;

revoke all on public.categorias, public.produtos, public.produto_imagens, public.produto_variacoes, public.banners, public.quiz_perguntas, public.quiz_opcoes, public.quiz_respostas, public.pedidos, public.leads from anon, authenticated;
grant select on public.categorias, public.produtos, public.produto_imagens, public.produto_variacoes, public.banners, public.quiz_perguntas, public.quiz_opcoes to anon, authenticated;
grant insert on public.quiz_respostas, public.pedidos, public.leads to anon, authenticated;

create policy categorias_leitura_publica on public.categorias for select to anon, authenticated using (true);
create policy produtos_leitura_publica on public.produtos for select to anon, authenticated using (ativo = true);
create policy produto_imagens_leitura_publica on public.produto_imagens for select to anon, authenticated using (exists (select 1 from public.produtos p where p.id=produto_id and p.ativo=true));
create policy produto_variacoes_leitura_publica on public.produto_variacoes for select to anon, authenticated using (exists (select 1 from public.produtos p where p.id=produto_id and p.ativo=true));
create policy banners_leitura_publica on public.banners for select to anon, authenticated using (ativo = true);
create policy quiz_perguntas_leitura_publica on public.quiz_perguntas for select to anon, authenticated using (true);
create policy quiz_opcoes_leitura_publica on public.quiz_opcoes for select to anon, authenticated using (true);
create policy quiz_respostas_insert_publico on public.quiz_respostas for insert to anon, authenticated with check (true);
create policy pedidos_insert_publico on public.pedidos for insert to anon, authenticated with check (true);
create policy leads_insert_publico on public.leads for insert to anon, authenticated with check (true);

insert into public.quiz_perguntas (texto,ordem) values
 ('Qual cômodo você quer organizar?',1),
 ('Qual é o maior incômodo hoje?',2),
 ('Quanto espaço você tem?',3),
 ('Quem mora com você?',4),
 ('Quanto quer investir?',5)
on conflict (ordem) do nothing;

insert into public.quiz_opcoes (pergunta_id,texto,tags_pontos)
select p.id,o.texto,o.tags_pontos from public.quiz_perguntas p
join (values
 (1,'Cozinha','{"cozinha":8}'::jsonb),(1,'Quarto','{"quarto":8}'::jsonb),(1,'Banheiro','{"banheiro":8}'::jsonb),(1,'Lavanderia','{"lavanderia":8}'::jsonb),(1,'Sala','{"sala":8}'::jsonb),(1,'Área externa','{"externa":8}'::jsonb),
 (2,'Falta de espaço','{"espaco-pequeno":3}'::jsonb),(2,'Bagunça visível','{"organizacao":2}'::jsonb),(2,'Difícil de achar as coisas','{"gaveta":2}'::jsonb),(2,'Sujeira acumulada','{"pratico":2}'::jsonb),
 (3,'Pouco','{"espaco-pequeno":3}'::jsonb),(3,'Médio','{"compacto":2}'::jsonb),(3,'Bastante','{"grande":1}'::jsonb),
 (4,'Sozinho(a)','{"compacto":1}'::jsonb),(4,'Casal','{"rotina":1}'::jsonb),(4,'Família com crianças','{"familia":2}'::jsonb),
 (5,'Até R$ 50','{"orcamento-max":50}'::jsonb),(5,'Até R$ 100','{"orcamento-max":100}'::jsonb),(5,'Sem limite','{"orcamento-max":99999}'::jsonb)
) as o(ordem,texto,tags_pontos) on true
where p.ordem=o.ordem and not exists(select 1 from public.quiz_opcoes x where x.pergunta_id=p.id and x.texto=o.texto);
