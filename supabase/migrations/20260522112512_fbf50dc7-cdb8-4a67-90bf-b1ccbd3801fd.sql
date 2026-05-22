-- Function to URL encode a string (for building the R2 worker delete URL)
CREATE OR REPLACE FUNCTION public.url_encode(text) RETURNS text AS $$
SELECT string_agg(
    CASE
        WHEN byte = 32 THEN '%20'
        WHEN (byte >= 48 AND byte <= 57) OR -- 0-9
             (byte >= 65 AND byte <= 90) OR -- A-Z
             (byte >= 97 AND byte <= 122) OR -- a-z
             byte IN (45, 46, 95, 126) THEN chr(byte) -- - . _ ~
        ELSE '%' || lpad(upper(to_hex(byte)), 2, '0')
    END,
    ''
)
FROM (
    SELECT get_byte(convert_to($1, 'utf-8'), i) AS byte
    FROM generate_series(0, length(convert_to($1, 'utf-8')) - 1) AS i
) AS bytes;
$$ LANGUAGE sql IMMUTABLE STRICT;

-- Function to handle R2 file cleanup via the Cloudflare Worker
CREATE OR REPLACE FUNCTION public.handle_r2_file_cleanup()
RETURNS TRIGGER AS $$
DECLARE
    worker_url TEXT := 'https://obras-upload-api.brunob1198.workers.dev/';
    r2_domain TEXT := 'r2.dev';
    old_url TEXT;
    new_url TEXT;
    col_name TEXT;
BEGIN
    -- TG_ARGV contains the column names to check
    FOR i IN 0 .. (array_length(TG_ARGV, 1) - 1) LOOP
        col_name := TG_ARGV[i];
        
        -- Get old URL from the OLD record
        EXECUTE format('SELECT ($1).%I', col_name) INTO old_url USING OLD;
        
        -- Get new URL from the NEW record if it's an UPDATE
        IF (TG_OP = 'UPDATE') THEN
            EXECUTE format('SELECT ($1).%I', col_name) INTO new_url USING NEW;
        ELSE
            new_url := NULL;
        END IF;

        -- Logic for cleanup:
        -- 1. Must be an R2 URL
        -- 2. If DELETE: clean up the old URL
        -- 3. If UPDATE: clean up the old URL ONLY if it changed or was removed
        IF old_url IS NOT NULL AND old_url LIKE '%' || r2_domain || '%' THEN
            IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (new_url IS NULL OR new_url <> old_url)) THEN
                -- Call the R2 worker asynchronously using pg_net
                -- We use url_encode to ensure the URL parameter is valid
                PERFORM net.http_request(
                    url := worker_url || '?url=' || public.url_encode(old_url),
                    method := 'DELETE'
                );
            END IF;
        END IF;
    END LOOP;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to the relevant tables
-- Diario Fotos
DROP TRIGGER IF EXISTS tr_cleanup_diario_fotos ON public.diario_fotos;
CREATE TRIGGER tr_cleanup_diario_fotos
AFTER DELETE OR UPDATE ON public.diario_fotos
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('url', 'thumb_url', 'thumb_600_url');

-- Diario Campo Fotos
DROP TRIGGER IF EXISTS tr_cleanup_diario_campo_fotos ON public.diario_campo_fotos;
CREATE TRIGGER tr_cleanup_diario_campo_fotos
AFTER DELETE OR UPDATE ON public.diario_campo_fotos
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('url', 'thumb_url', 'thumb_600_url');

-- Clientes
DROP TRIGGER IF EXISTS tr_cleanup_clientes ON public.clientes;
CREATE TRIGGER tr_cleanup_clientes
AFTER DELETE OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('logo_url');

-- Profiles
DROP TRIGGER IF EXISTS tr_cleanup_profiles ON public.profiles;
CREATE TRIGGER tr_cleanup_profiles
AFTER DELETE OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('avatar_url');

-- Contratos
DROP TRIGGER IF EXISTS tr_cleanup_contratos ON public.contratos;
CREATE TRIGGER tr_cleanup_contratos
AFTER DELETE OR UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('arquivo_url');

-- Empresas
DROP TRIGGER IF EXISTS tr_cleanup_empresas ON public.empresas;
CREATE TRIGGER tr_cleanup_empresas
AFTER DELETE OR UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('logo_url');

-- Lancamentos Medicao
DROP TRIGGER IF EXISTS tr_cleanup_lancamentos_medicao ON public.lancamentos_medicao;
CREATE TRIGGER tr_cleanup_lancamentos_medicao
AFTER DELETE OR UPDATE ON public.lancamentos_medicao
FOR EACH ROW EXECUTE FUNCTION public.handle_r2_file_cleanup('logo_empresa_url', 'capa_url');
