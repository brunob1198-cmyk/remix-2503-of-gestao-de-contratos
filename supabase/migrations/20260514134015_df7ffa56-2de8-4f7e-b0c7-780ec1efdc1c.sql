-- Excluir a tabela timeline_eventos
DROP TABLE IF EXISTS public.timeline_eventos;

-- Remover políticas relacionadas ao bucket se existirem
DROP POLICY IF EXISTS "Authenticated upload timeline-evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Public read timeline-evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete timeline-evidencias" ON storage.objects;