-- Table to cache resolved coordinates from photos
CREATE TABLE IF NOT EXISTS public.foto_geolocalizacao_cache (
  url TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.foto_geolocalizacao_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Anyone can view photo geolocation cache"
ON public.foto_geolocalizacao_cache FOR SELECT
USING (true);

-- Allow insert/update for authenticated users (simplified for now)
CREATE POLICY "Authenticated users can manage photo geolocation cache"
ON public.foto_geolocalizacao_cache FOR ALL
USING (auth.role() = 'authenticated');

-- Index on created_at for potential cleanup
CREATE INDEX idx_foto_geolocalizacao_cache_created_at ON public.foto_geolocalizacao_cache (created_at);