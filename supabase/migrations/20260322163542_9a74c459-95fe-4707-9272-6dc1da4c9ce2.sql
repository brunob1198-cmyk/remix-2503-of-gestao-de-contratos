-- Enforce empresa_id on projetos based on authenticated user's company
CREATE OR REPLACE FUNCTION public.enforce_projeto_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _empresa_id uuid;
BEGIN
  -- Allow privileged backend operations that don't carry end-user JWT
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _empresa_id := public.get_user_empresa_id(auth.uid());

  IF _empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.empresa_id := _empresa_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.empresa_id IS NULL THEN
    NEW.empresa_id := OLD.empresa_id;
  END IF;

  IF NEW.empresa_id <> _empresa_id THEN
    RAISE EXCEPTION 'empresa_id inválido para o usuário autenticado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_projeto_empresa_id ON public.projetos;
CREATE TRIGGER trg_enforce_projeto_empresa_id
BEFORE INSERT OR UPDATE ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_projeto_empresa_id();

-- Recreate policies to be resilient when empresa_id arrives null from client payload
DROP POLICY IF EXISTS "Insert projetos" ON public.projetos;
CREATE POLICY "Insert projetos"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(empresa_id, public.get_user_empresa_id(auth.uid())) = public.get_user_empresa_id(auth.uid())
  AND public.get_user_role(auth.uid()) <> 'cliente'
);

DROP POLICY IF EXISTS "Update projetos" ON public.projetos;
CREATE POLICY "Update projetos"
ON public.projetos
FOR UPDATE
TO authenticated
USING (
  public.user_can_access_projeto(auth.uid(), id)
  AND public.get_user_role(auth.uid()) <> 'cliente'
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.get_user_role(auth.uid()) <> 'cliente'
);