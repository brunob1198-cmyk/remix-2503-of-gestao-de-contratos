
-- Create audit log table
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela text NOT NULL,
  operacao text NOT NULL, -- INSERT, UPDATE, DELETE
  registro_id text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  campos_alterados text[],
  user_id uuid,
  user_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_log_tabela ON public.audit_log(tabela);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_registro_id ON public.audit_log(registro_id);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- View policy: authenticated users can see audit logs
CREATE POLICY "View audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (true);

-- Insert policy: system/triggers can insert
CREATE POLICY "Insert audit_log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Delete policy: only admins
CREATE POLICY "Delete audit_log"
ON public.audit_log
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_key text;
  v_user_id uuid;
  v_user_email text;
  v_registro_id text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_registro_id := (OLD).id::text;
    
    INSERT INTO public.audit_log (tabela, operacao, registro_id, dados_anteriores, user_id, user_email)
    VALUES (TG_TABLE_NAME, 'DELETE', v_registro_id, v_old, v_user_id, v_user_email);
    
    RETURN OLD;
    
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_registro_id := (NEW).id::text;
    
    INSERT INTO public.audit_log (tabela, operacao, registro_id, dados_novos, user_id, user_email)
    VALUES (TG_TABLE_NAME, 'INSERT', v_registro_id, v_new, v_user_id, v_user_email);
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_registro_id := (NEW).id::text;
    
    -- Find changed columns
    v_changed := ARRAY[]::text[];
    FOR v_key IN SELECT jsonb_object_keys(v_new)
    LOOP
      IF v_key NOT IN ('updated_at', 'created_at') AND (v_old->v_key IS DISTINCT FROM v_new->v_key) THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    
    -- Only log if something actually changed
    IF array_length(v_changed, 1) > 0 THEN
      INSERT INTO public.audit_log (tabela, operacao, registro_id, dados_anteriores, dados_novos, campos_alterados, user_id, user_email)
      VALUES (TG_TABLE_NAME, 'UPDATE', v_registro_id, v_old, v_new, v_changed, v_user_id, v_user_email);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Add triggers to key tables
CREATE TRIGGER audit_sites AFTER INSERT OR UPDATE OR DELETE ON public.sites FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_projetos AFTER INSERT OR UPDATE OR DELETE ON public.projetos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_lancamentos_producao AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_producao FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_lancamentos_medicao AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_medicao FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_lancamentos_faturamento AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_faturamento FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diarios_obra AFTER INSERT OR UPDATE OR DELETE ON public.diarios_obra FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diarios_campo AFTER INSERT OR UPDATE OR DELETE ON public.diarios_campo FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_escopo_itens AFTER INSERT OR UPDATE OR DELETE ON public.escopo_itens FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_itens_lpu AFTER INSERT OR UPDATE OR DELETE ON public.itens_lpu FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_contratos AFTER INSERT OR UPDATE OR DELETE ON public.contratos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_clientes AFTER INSERT OR UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_recursos AFTER INSERT OR UPDATE OR DELETE ON public.recursos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diario_producao AFTER INSERT OR UPDATE OR DELETE ON public.diario_producao FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diario_equipe AFTER INSERT OR UPDATE OR DELETE ON public.diario_equipe FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diario_equipamentos AFTER INSERT OR UPDATE OR DELETE ON public.diario_equipamentos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_diario_veiculos AFTER INSERT OR UPDATE OR DELETE ON public.diario_veiculos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_faturamentos AFTER INSERT OR UPDATE OR DELETE ON public.faturamentos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER audit_faturamento_itens AFTER INSERT OR UPDATE OR DELETE ON public.faturamento_itens FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
