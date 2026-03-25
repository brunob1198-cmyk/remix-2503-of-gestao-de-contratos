-- Backfill missing profile records for existing users
INSERT INTO public.profiles (id, nome, aprovado, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'nome', u.email),
  false,
  now(),
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Ensure company setup works even if profile row was missing
CREATE OR REPLACE FUNCTION public.setup_empresa(_nome text, _cnpj text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _empresa_id uuid;
  _existing_empresa_id uuid;
  _user_nome text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(u.raw_user_meta_data ->> 'nome', u.email)
  INTO _user_nome
  FROM auth.users u
  WHERE u.id = _user_id;

  INSERT INTO public.profiles (id, nome, aprovado)
  VALUES (_user_id, _user_nome, false)
  ON CONFLICT (id) DO NOTHING;

  SELECT empresa_id INTO _existing_empresa_id
  FROM public.profiles
  WHERE id = _user_id;

  IF _existing_empresa_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has an empresa';
  END IF;

  INSERT INTO public.empresas (nome, cnpj)
  VALUES (_nome, NULLIF(TRIM(_cnpj), ''))
  RETURNING id INTO _empresa_id;

  UPDATE public.profiles
  SET empresa_id = _empresa_id,
      aprovado = true,
      updated_at = now()
  WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _empresa_id;
END;
$function$;

-- Ensure join flow also works when legacy users don't have profile rows
CREATE OR REPLACE FUNCTION public.join_empresa_by_cnpj(_cnpj text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _empresa_id uuid;
  _existing_empresa_id uuid;
  _user_nome text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(u.raw_user_meta_data ->> 'nome', u.email)
  INTO _user_nome
  FROM auth.users u
  WHERE u.id = _user_id;

  INSERT INTO public.profiles (id, nome, aprovado)
  VALUES (_user_id, _user_nome, false)
  ON CONFLICT (id) DO NOTHING;

  SELECT empresa_id INTO _existing_empresa_id
  FROM public.profiles
  WHERE id = _user_id;

  IF _existing_empresa_id IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário já está vinculado a uma empresa';
  END IF;

  SELECT id INTO _empresa_id
  FROM public.empresas
  WHERE cnpj = _cnpj;

  IF _empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada com esse CNPJ';
  END IF;

  UPDATE public.profiles
  SET empresa_id = _empresa_id,
      aprovado = false,
      updated_at = now()
  WHERE id = _user_id;

  RETURN _empresa_id;
END;
$function$;