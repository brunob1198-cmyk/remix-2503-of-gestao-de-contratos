
-- Diário de Obra principal
CREATE TABLE public.diarios_obra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  data date NOT NULL,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(site_id, data)
);

-- Produção do diário (vinculada a itens LPU)
CREATE TABLE public.diario_producao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  item_lpu_id uuid NOT NULL REFERENCES public.itens_lpu(id),
  quantidade numeric NOT NULL DEFAULT 0,
  preco_unitario_congelado numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Equipe (pessoas)
CREATE TABLE public.diario_equipe (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text,
  horas numeric NOT NULL DEFAULT 8,
  custo_hora numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Equipamentos
CREATE TABLE public.diario_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  horas numeric NOT NULL DEFAULT 8,
  custo_hora numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Veículos
CREATE TABLE public.diario_veiculos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  placa text,
  km_rodados numeric DEFAULT 0,
  custo_diaria numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Fotos
CREATE TABLE public.diario_fotos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  url text NOT NULL,
  classificacao text NOT NULL DEFAULT 'execucao',
  legenda text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.diarios_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_access" ON public.diarios_obra FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.diario_producao FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.diario_equipe FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.diario_equipamentos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.diario_veiculos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.diario_fotos FOR ALL TO public USING (true) WITH CHECK (true);

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('diario-fotos', 'diario-fotos', true);

CREATE POLICY "public_upload" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'diario-fotos');
CREATE POLICY "public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'diario-fotos');
CREATE POLICY "public_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'diario-fotos');
