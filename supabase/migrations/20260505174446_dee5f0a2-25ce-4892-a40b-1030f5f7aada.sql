-- Tenta atualizar o cache_control padrão dos buckets públicos se a coluna existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'storage' 
        AND table_name = 'buckets' 
        AND column_name = 'cache_control'
    ) THEN
        UPDATE storage.buckets 
        SET cache_control = 'public, max-age=31536000, immutable'
        WHERE public = true;
    END IF;
END $$;
