ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pode_criar_cotacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pode_criar_pedido BOOLEAN DEFAULT false;

-- Grant permissions to authenticated users to update these if they are admins (handled by existing RLS or triggers usually)
-- Since RLS on profiles is likely restricted, we ensure the service_role and authenticated can work with it
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;