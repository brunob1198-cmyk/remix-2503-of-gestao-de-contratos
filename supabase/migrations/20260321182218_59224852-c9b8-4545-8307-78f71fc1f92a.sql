
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'interno', 'cliente');

-- 2. Create empresas table
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 3. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id),
  nome text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create user_sites table (associate clients to specific sites)
CREATE TABLE public.user_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, site_id)
);
ALTER TABLE public.user_sites ENABLE ROW LEVEL SECURITY;

-- 6. Add empresa_id to projetos and recursos
ALTER TABLE public.projetos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.recursos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);

-- 7. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Security definer helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles
  WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Helper: check if user can access a site
CREATE OR REPLACE FUNCTION public.user_can_access_site(_user_id uuid, _site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites s
    JOIN public.projetos p ON s.projeto_id = p.id
    WHERE s.id = _site_id
    AND p.empresa_id = public.get_user_empresa_id(_user_id)
    AND (
      public.get_user_role(_user_id) != 'cliente'
      OR EXISTS (SELECT 1 FROM public.user_sites WHERE user_id = _user_id AND site_id = _site_id)
    )
  )
$$;

-- Helper: check if user can access a projeto
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = _projeto_id
    AND empresa_id = public.get_user_empresa_id(_user_id)
  )
$$;

-- 9. RLS: empresas
CREATE POLICY "Users view own empresa" ON public.empresas FOR SELECT TO authenticated
  USING (id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Authenticated can insert empresa" ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admin can update empresa" ON public.empresas FOR UPDATE TO authenticated
  USING (id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 10. RLS: profiles
CREATE POLICY "View profiles same empresa" ON public.profiles FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 11. RLS: user_roles
CREATE POLICY "View own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 12. RLS: user_sites
CREATE POLICY "View own site assignments" ON public.user_sites FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admin manage site assignments" ON public.user_sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 13. Drop ALL old public access policies
DROP POLICY IF EXISTS "Acesso público projetos" ON public.projetos;
DROP POLICY IF EXISTS "Acesso público sites" ON public.sites;
DROP POLICY IF EXISTS "Acesso público itens_lpu" ON public.itens_lpu;
DROP POLICY IF EXISTS "Acesso público lancamentos_producao" ON public.lancamentos_producao;
DROP POLICY IF EXISTS "Acesso público lancamentos_medicao" ON public.lancamentos_medicao;
DROP POLICY IF EXISTS "Acesso público lancamentos_faturamento" ON public.lancamentos_faturamento;
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON public.escopo_itens;
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON public.escopos_historico;
DROP POLICY IF EXISTS "public_access" ON public.diarios_obra;
DROP POLICY IF EXISTS "public_access" ON public.diario_equipe;
DROP POLICY IF EXISTS "public_access" ON public.diario_equipamentos;
DROP POLICY IF EXISTS "public_access" ON public.diario_fotos;
DROP POLICY IF EXISTS "public_access" ON public.diario_producao;
DROP POLICY IF EXISTS "public_access" ON public.diario_veiculos;
DROP POLICY IF EXISTS "public_access" ON public.faturamentos;
DROP POLICY IF EXISTS "public_access" ON public.faturamento_itens;
DROP POLICY IF EXISTS "public_access" ON public.recursos;
DROP POLICY IF EXISTS "public_access" ON public.recurso_custos;

-- 14. New RLS: projetos
CREATE POLICY "View projetos" ON public.projetos FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), id));
CREATE POLICY "Insert projetos" ON public.projetos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update projetos" ON public.projetos FOR UPDATE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete projetos" ON public.projetos FOR DELETE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), id) AND public.has_role(auth.uid(), 'admin'));

-- 15. New RLS: sites
CREATE POLICY "View sites" ON public.sites FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), id));
CREATE POLICY "Insert sites" ON public.sites FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update sites" ON public.sites FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete sites" ON public.sites FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), id) AND public.has_role(auth.uid(), 'admin'));

-- 16. New RLS: itens_lpu
CREATE POLICY "View itens_lpu" ON public.itens_lpu FOR SELECT TO authenticated
  USING (projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Manage itens_lpu" ON public.itens_lpu FOR INSERT TO authenticated
  WITH CHECK ((projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), projeto_id)) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update itens_lpu" ON public.itens_lpu FOR UPDATE TO authenticated
  USING ((projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), projeto_id)) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete itens_lpu" ON public.itens_lpu FOR DELETE TO authenticated
  USING ((projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), projeto_id)) AND public.has_role(auth.uid(), 'admin'));

-- 17. Site-based tables RLS (lancamentos_producao, lancamentos_medicao, lancamentos_faturamento, escopo_itens, escopos_historico)
CREATE POLICY "View lancamentos_producao" ON public.lancamentos_producao FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage lancamentos_producao" ON public.lancamentos_producao FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update lancamentos_producao" ON public.lancamentos_producao FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete lancamentos_producao" ON public.lancamentos_producao FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View lancamentos_medicao" ON public.lancamentos_medicao FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage lancamentos_medicao" ON public.lancamentos_medicao FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update lancamentos_medicao" ON public.lancamentos_medicao FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete lancamentos_medicao" ON public.lancamentos_medicao FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View lancamentos_faturamento" ON public.lancamentos_faturamento FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage lancamentos_faturamento" ON public.lancamentos_faturamento FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update lancamentos_faturamento" ON public.lancamentos_faturamento FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete lancamentos_faturamento" ON public.lancamentos_faturamento FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View escopo_itens" ON public.escopo_itens FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage escopo_itens" ON public.escopo_itens FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update escopo_itens" ON public.escopo_itens FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete escopo_itens" ON public.escopo_itens FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View escopos_historico" ON public.escopos_historico FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage escopos_historico" ON public.escopos_historico FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');

-- 18. Diarios RLS (through diarios_obra -> sites)
CREATE POLICY "View diarios_obra" ON public.diarios_obra FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Insert diarios_obra" ON public.diarios_obra FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update diarios_obra" ON public.diarios_obra FOR UPDATE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete diarios_obra" ON public.diarios_obra FOR DELETE TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.has_role(auth.uid(), 'admin'));

-- Diario child tables: access through diario -> site
CREATE OR REPLACE FUNCTION public.user_can_access_diario(_user_id uuid, _diario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diarios_obra d
    WHERE d.id = _diario_id
    AND public.user_can_access_site(_user_id, d.site_id)
  )
$$;

CREATE POLICY "View diario_equipe" ON public.diario_equipe FOR SELECT TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id));
CREATE POLICY "Manage diario_equipe" ON public.diario_equipe FOR ALL TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id) AND public.get_user_role(auth.uid()) != 'cliente');

CREATE POLICY "View diario_equipamentos" ON public.diario_equipamentos FOR SELECT TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id));
CREATE POLICY "Manage diario_equipamentos" ON public.diario_equipamentos FOR ALL TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id) AND public.get_user_role(auth.uid()) != 'cliente');

CREATE POLICY "View diario_fotos" ON public.diario_fotos FOR SELECT TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id));
CREATE POLICY "Manage diario_fotos" ON public.diario_fotos FOR ALL TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id) AND public.get_user_role(auth.uid()) != 'cliente');

CREATE POLICY "View diario_producao" ON public.diario_producao FOR SELECT TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id));
CREATE POLICY "Manage diario_producao" ON public.diario_producao FOR ALL TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id) AND public.get_user_role(auth.uid()) != 'cliente');

CREATE POLICY "View diario_veiculos" ON public.diario_veiculos FOR SELECT TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id));
CREATE POLICY "Manage diario_veiculos" ON public.diario_veiculos FOR ALL TO authenticated
  USING (public.user_can_access_diario(auth.uid(), diario_id) AND public.get_user_role(auth.uid()) != 'cliente');

-- 19. Faturamentos RLS (through projeto)
CREATE POLICY "View faturamentos" ON public.faturamentos FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Manage faturamentos" ON public.faturamentos FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update faturamentos" ON public.faturamentos FOR UPDATE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete faturamentos" ON public.faturamentos FOR DELETE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View faturamento_itens" ON public.faturamento_itens FOR SELECT TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id));
CREATE POLICY "Manage faturamento_itens" ON public.faturamento_itens FOR ALL TO authenticated
  USING (public.user_can_access_site(auth.uid(), site_id) AND public.get_user_role(auth.uid()) != 'cliente');

-- 20. Recursos RLS (empresa-level)
CREATE POLICY "View recursos" ON public.recursos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Manage recursos" ON public.recursos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Update recursos" ON public.recursos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.get_user_role(auth.uid()) != 'cliente');
CREATE POLICY "Delete recursos" ON public.recursos FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View recurso_custos" ON public.recurso_custos FOR SELECT TO authenticated
  USING (recurso_id IN (SELECT id FROM public.recursos WHERE empresa_id = public.get_user_empresa_id(auth.uid())));
CREATE POLICY "Manage recurso_custos" ON public.recurso_custos FOR ALL TO authenticated
  USING (recurso_id IN (SELECT id FROM public.recursos WHERE empresa_id = public.get_user_empresa_id(auth.uid())) AND public.get_user_role(auth.uid()) != 'cliente');
