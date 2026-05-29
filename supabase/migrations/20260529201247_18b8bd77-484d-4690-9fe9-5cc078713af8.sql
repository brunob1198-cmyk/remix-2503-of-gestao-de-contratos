CREATE OR REPLACE FUNCTION public.handle_r2_file_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
                -- In this version of pg_net, we use http_delete directly
                PERFORM net.http_delete(
                    url := worker_url || '?url=' || public.url_encode(old_url)
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
$function$;