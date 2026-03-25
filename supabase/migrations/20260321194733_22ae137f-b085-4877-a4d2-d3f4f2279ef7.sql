
-- Add approval and personal fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS cargo text;

-- Create user_permissions table for granular screen-level permissions
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tela text NOT NULL,
  pode_visualizar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tela)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admin can manage all permissions for same empresa
CREATE POLICY "Admin manage permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND get_user_empresa_id(user_id) = get_user_empresa_id(auth.uid())
);

-- Users can view own permissions
CREATE POLICY "View own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Update join_empresa_by_cnpj to NOT auto-approve (user stays unapproved)
CREATE OR REPLACE FUNCTION public.join_empresa_by_cnpj(_cnpj text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _empresa_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF (SELECT empresa_id FROM public.profiles WHERE id = _user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário já está vinculado a uma empresa';
  END IF;

  SELECT id INTO _empresa_id FROM public.empresas WHERE cnpj = _cnpj;
  
  IF _empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada com esse CNPJ';
  END IF;

  -- Link profile to empresa but keep aprovado = false (pending admin approval)
  UPDATE public.profiles
  SET empresa_id = _empresa_id, aprovado = false
  WHERE id = _user_id;

  -- Do NOT assign role yet - admin will do it
  RETURN _empresa_id;
END;
$$;

-- Update setup_empresa to auto-approve the creator (admin)
CREATE OR REPLACE FUNCTION public.setup_empresa(_nome text, _cnpj text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _empresa_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF (SELECT empresa_id FROM public.profiles WHERE id = _user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already has an empresa';
  END IF;

  INSERT INTO public.empresas (nome, cnpj)
  VALUES (_nome, _cnpj)
  RETURNING id INTO _empresa_id;

  UPDATE public.profiles
  SET empresa_id = _empresa_id, aprovado = true
  WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _empresa_id;
END;
$$;

-- Function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT aprovado FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Admin can approve/reject users in same empresa
CREATE POLICY "Admin update profiles same empresa"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id = get_user_empresa_id(auth.uid())
);
