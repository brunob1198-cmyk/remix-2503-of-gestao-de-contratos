-- Create missing profiles for existing auth users
INSERT INTO public.profiles (id, nome)
SELECT id, COALESCE(raw_user_meta_data->>'nome', email) 
FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Link test user to the empresa that was created
UPDATE public.profiles 
SET empresa_id = 'a977b0dc-c67c-421f-b7c0-4a0f8bd3204c'
WHERE id = '307ac2d0-9a10-4c4e-acea-9b4692e33ce4';

-- Assign admin role to test user
INSERT INTO public.user_roles (user_id, role) 
VALUES ('307ac2d0-9a10-4c4e-acea-9b4692e33ce4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;