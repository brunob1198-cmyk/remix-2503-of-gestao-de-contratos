-- Enable realtime for pedidos_compra
ALTER TABLE public.pedidos_compra REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos_compra'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_compra;
  END IF;
END $$;