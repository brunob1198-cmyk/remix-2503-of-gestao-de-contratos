-- Create areas table
CREATE TABLE areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(empresa_id, nome)
);

-- RLS Enable
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Areas Policies
CREATE POLICY "Usuários podem ver áreas de sua empresa"
  ON areas FOR SELECT
  USING (
    empresa_id IN (
      SELECT e.id FROM empresas e
      JOIN profiles p ON p.empresa_id = e.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem inserir áreas em sua empresa"
  ON areas FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT e.id FROM empresas e
      JOIN profiles p ON p.empresa_id = e.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar áreas de sua empresa"
  ON areas FOR UPDATE
  USING (
    empresa_id IN (
      SELECT e.id FROM empresas e
      JOIN profiles p ON p.empresa_id = e.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar áreas de sua empresa"
  ON areas FOR DELETE
  USING (
    empresa_id IN (
      SELECT e.id FROM empresas e
      JOIN profiles p ON p.empresa_id = e.id
      WHERE p.id = auth.uid()
    )
  );

-- Function to insert 'Geral' area for existing empresas and update existing projetos
DO $$
DECLARE
  rec record;
  new_area_id uuid;
BEGIN
  -- Loop through all existing empresas
  FOR rec IN SELECT id FROM empresas LOOP
    
    -- Insert the default "Geral" area for the empresa
    INSERT INTO areas (empresa_id, nome, descricao)
    VALUES (rec.id, 'Geral', 'Área vinculada automaticamente aos projetos anteriores à atualização.')
    RETURNING id INTO new_area_id;

    -- Add the column area_id to projetos if it hasn't been added yet
    -- We'll do the DDL outside the loop to avoid errors, but updating inside.
  END LOOP;
END $$;

-- Add area_id to projetos if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='projetos' AND column_name='area_id'
  ) THEN
    ALTER TABLE projetos ADD COLUMN area_id uuid REFERENCES areas(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Update existing projetos with the new "Geral" area ID of their respective empresa
DO $$
DECLARE
  emp record;
  geral_area_id uuid;
BEGIN
  FOR emp IN SELECT id FROM empresas LOOP
    SELECT id INTO geral_area_id FROM areas WHERE empresa_id = emp.id AND nome = 'Geral' LIMIT 1;
    
    IF geral_area_id IS NOT NULL THEN
      UPDATE projetos SET area_id = geral_area_id WHERE empresa_id = emp.id AND area_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Now make area_id NOT NULL for future inserts (optional but requested by user through UI validation, we can enforce it in DB too securely)
-- ALTER TABLE projetos ALTER COLUMN area_id SET NOT NULL;
-- (We will leave it nullable at DB level, but strongly required at UI, just in case).
