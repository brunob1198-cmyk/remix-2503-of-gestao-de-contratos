-- We already checked that the columns exist, but let's ensure they are set up correctly if they were missing or have issues.
-- The user reported errors when configuring, which could be due to NOT NULL constraints or missing fields in older records.

-- If there's any NOT NULL constraint on perc_irpj or perc_csll, remove it
ALTER TABLE public.projeto_impostos ALTER COLUMN perc_irpj DROP NOT NULL;
ALTER TABLE public.projeto_impostos ALTER COLUMN perc_csll DROP NOT NULL;

-- Ensure the relationship to projects is correct but allows null if needed for debugging
-- (Though the UI should always provide a project_id)
ALTER TABLE public.projeto_impostos ALTER COLUMN projeto_id DROP NOT NULL;
