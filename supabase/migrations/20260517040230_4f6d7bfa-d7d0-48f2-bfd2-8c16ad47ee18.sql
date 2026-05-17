CREATE OR REPLACE FUNCTION public.get_employee_cc_map(employee_ids text[])
RETURNS TABLE(employee_id text, cc_id text, cc_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (payload_json -> 'employee' ->> 'id')
    payload_json -> 'employee' ->> 'id'        AS employee_id,
    payload_json -> 'costCenter' ->> 'id'      AS cc_id,
    payload_json -> 'costCenter' ->> 'name'    AS cc_name
  FROM flash_transactions_raw
  WHERE
    payload_json -> 'costCenter' IS NOT NULL
    AND payload_json -> 'employee' ->> 'id' = ANY(employee_ids)
  ORDER BY
    payload_json -> 'employee' ->> 'id',
    created_at DESC;
$$;