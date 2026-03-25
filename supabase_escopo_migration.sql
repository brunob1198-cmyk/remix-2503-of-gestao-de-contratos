-- Crie a tabela escopo_itens
create table public.escopo_itens (
  id uuid not null default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade on update cascade,
  nome text not null,
  unidade text not null,
  quantidade numeric not null default 0,
  valor_unitario numeric not null default 0,
  custo_unitario numeric not null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint escopo_itens_pkey primary key (id)
);

-- Crie a tabela escopos_historico
create table public.escopos_historico (
  id uuid not null default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade on update cascade,
  snapshot jsonb not null,
  created_at timestamp with time zone null default now(),
  constraint escopos_historico_pkey primary key (id)
);

-- Habilitar RLS e criar políticas liberadas para authed/anon (ajuste se seu app usar regras RLS customizadas)
alter table public.escopo_itens enable row level security;
alter table public.escopos_historico enable row level security;

create policy "Enable all actions for authenticated users"
on public.escopo_itens
as permissive
for all
to public
using ( true )
with check ( true );

create policy "Enable all actions for authenticated users"
on public.escopos_historico
as permissive
for all
to public
using ( true )
with check ( true );
