ALTER TABLE public.fornecedores 
ADD COLUMN IF NOT EXISTS score_prazo NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_preco NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_qualidade NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_responsividade NUMERIC DEFAULT 0;

-- Update existing records to initialize component scores if they have a total score
UPDATE public.fornecedores 
SET score_prazo = score,
    score_preco = score,
    score_qualidade = score,
    score_responsividade = score
WHERE score > 0 AND score_prazo = 0;

-- Function to calculate the total score
CREATE OR REPLACE FUNCTION public.calculate_supplier_score() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.score := (COALESCE(NEW.score_prazo, 0) * 0.4) + 
               (COALESCE(NEW.score_preco, 0) * 0.3) + 
               (COALESCE(NEW.score_qualidade, 0) * 0.2) + 
               (COALESCE(NEW.score_responsividade, 0) * 0.1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate score before insert or update
DROP TRIGGER IF EXISTS tr_calculate_supplier_score ON public.fornecedores;
CREATE TRIGGER tr_calculate_supplier_score
BEFORE INSERT OR UPDATE OF score_prazo, score_preco, score_qualidade, score_responsividade
ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.calculate_supplier_score();
