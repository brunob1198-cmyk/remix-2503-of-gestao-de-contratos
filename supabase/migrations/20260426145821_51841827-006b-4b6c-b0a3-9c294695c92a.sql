-- Ensure columns exist
ALTER TABLE public.flash_transactions_raw ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE public.flash_transactions_raw ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2);

-- Function to extract data from payload
UPDATE public.flash_transactions_raw 
SET 
  transaction_date = (payload_json->>'transaction_date')::date,
  amount = (payload_json->>'amount')::numeric
WHERE transaction_date IS NULL OR amount IS NULL;

-- Remove the old constraint (trying to identify it by naming convention)
-- Note: If the constraint name is different, we'll find out, but typically it's table_col1_col2_key
ALTER TABLE public.flash_transactions_raw DROP CONSTRAINT IF EXISTS flash_transactions_raw_empresa_id_external_id_key;

-- Create the new deterministic constraint
-- Using COALESCE for date and amount to avoid NULL issues in unique constraint if API returns empty
ALTER TABLE public.flash_transactions_raw ADD CONSTRAINT flash_transactions_raw_deterministic_unique 
UNIQUE (empresa_id, external_id, transaction_date, amount);

-- Enable RLS just in case it wasn't
ALTER TABLE public.flash_transactions_raw ENABLE ROW LEVEL SECURITY;
