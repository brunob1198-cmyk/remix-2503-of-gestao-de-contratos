
-- Habilitar RLS no esquema realtime se ainda não estiver (geralmente gerenciado pelo Supabase, mas garantimos a política)
-- Nota: Políticas em realtime.messages controlam quem pode se inscrever em quais canais.

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Users can only listen to their company pedidos_compra channel'
  ) THEN
    -- Permitir que usuários se inscrevam apenas em canais que correspondem ao seu empresa_id
    CREATE POLICY "Users can only listen to their company pedidos_compra channel"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      (extension = 'postgres_changes'::text) 
      AND (
        -- Padrão do canal: "pedidos_compra:UUID-DA-EMPRESA"
        topic = ('pedidos_compra:' || (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())::text)
      )
    );
  END IF;
END $$;
