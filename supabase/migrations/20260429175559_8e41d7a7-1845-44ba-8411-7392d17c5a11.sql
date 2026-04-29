-- Habilitar extensões necessárias (o nome correto no Supabase é pg_net)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Adiciona campos para controle de reconciliação se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flash_integration_logs' AND column_name='reconciliado') THEN
        ALTER TABLE public.flash_integration_logs ADD COLUMN reconciliado BOOLEAN DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flash_integration_logs' AND column_name='reconciliado_at') THEN
        ALTER TABLE public.flash_integration_logs ADD COLUMN reconciliado_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Agenda o job para rodar a cada 10 minutos
SELECT cron.schedule(
    'contaazul-reconcile-job',
    '*/10 * * * *',
    $$
    SELECT
      net.http_post(
        url := 'https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-reconcile',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'
      ) as request_id;
    $$
);