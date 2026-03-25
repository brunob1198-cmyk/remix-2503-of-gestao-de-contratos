
CREATE OR REPLACE FUNCTION public.join_empresa_by_cnpj(_cnpj text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _empresa_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have an empresa
  IF (SELECT empresa_id FROM public.profiles WHERE id = _user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário já está vinculado a uma empresa';
  END IF;

  -- Find empresa by CNPJ
  SELECT id INTO _empresa_id FROM public.empresas WHERE cnpj = _cnpj;
  
  IF _empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada com esse CNPJ';
  END IF;

  -- Link profile to empresa
  UPDATE public.profiles
  SET empresa_id = _empresa_id
  WHERE id = _user_id;

  -- Assign default role 'interno'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'interno')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _empresa_id;
END;
$$;
