-- Fix existing user who signed up before trigger existed
INSERT INTO public.profiles (id, nome, empresa_id, aprovado)
VALUES ('d088cd8f-8466-4c6a-8f65-efc9a2457522', 'brunob1198@gmail.com', '66031b3d-d26c-4621-bbf7-c8a640e515f1', true)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, aprovado = true;

-- Ensure admin role exists for this user
INSERT INTO public.user_roles (user_id, role)
VALUES ('d088cd8f-8466-4c6a-8f65-efc9a2457522', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;