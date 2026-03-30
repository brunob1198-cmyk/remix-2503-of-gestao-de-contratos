-- Create contratos table
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    cliente_ids UUID[] DEFAULT '{}',
    valor_total NUMERIC,
    prazo_inicio DATE,
    prazo_fim DATE,
    escopo TEXT,
    condicoes_pagamento TEXT,
    garantias TEXT,
    liberacao_garantias TEXT,
    medicoes TEXT,
    multas TEXT,
    reajuste TEXT,
    observacoes TEXT,
    arquivo_url TEXT,
    status_processamento TEXT DEFAULT 'pendente',
    contrato_pai_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add fk constraint to empresa_id if there's an empresas table 
-- (assuming it exists based on project structure, we will just keep it as a loose reference if it's managed via app logic or we can add it)

-- Add contrato_id and valor_total to projetos
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id);
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS valor_total NUMERIC DEFAULT 0;

-- Apply RLS to contratos
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Policies for contratos
CREATE POLICY "Enable read for authenticated users" ON contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON contratos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON contratos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON contratos FOR DELETE TO authenticated USING (true);
