
-- Drop the overly permissive insert policy
DROP POLICY "Insert audit_log" ON public.audit_log;

-- The trigger function runs as SECURITY DEFINER so it bypasses RLS.
-- No need for an INSERT policy for authenticated users since only triggers should insert.
