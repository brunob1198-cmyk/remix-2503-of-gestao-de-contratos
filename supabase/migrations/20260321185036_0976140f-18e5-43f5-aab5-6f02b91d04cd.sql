
CREATE OR REPLACE FUNCTION public.setup_empresa(_nome text, _cnpj text DEFAULT NULL)
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
    RAISE EXCEPTION 'User already has an empresa';
  END IF;

  -- Create empresa
  INSERT INTO public.empresas (nome, cnpj)
  VALUES (_nome, _cnpj)
  RETURNING id INTO _empresa_id;

  -- Link profile
  UPDATE public.profiles
  SET empresa_id = _empresa_id
  WHERE id = _user_id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _empresa_id;
END;
$$;
