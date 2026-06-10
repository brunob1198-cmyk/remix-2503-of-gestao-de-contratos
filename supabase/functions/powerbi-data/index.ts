import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_VIEWS = [
  "view_bi_contratos",
  "view_bi_dim_categoria",
  "view_bi_dim_tempo",
  "view_bi_financeiro",
  "view_bi_producao",
  "view_producao_diario",
  "view_contratos",
  "view_bi_analise_obras",
  "view_quadro_geral_bi",
  "view_public_forecast",
];

const PAGE_SIZE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view");

    if (!view || !ALLOWED_VIEWS.includes(view)) {
      return new Response(
        JSON.stringify({
          error: "Parâmetro 'view' inválido",
          allowed: ALLOWED_VIEWS,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const hasManualRange = url.searchParams.has("limit") || url.searchParams.has("offset");
    const rows: unknown[] = [];

    if (hasManualRange) {
      const limit = parseInt(url.searchParams.get("limit") || String(PAGE_SIZE));
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const { data, error } = await supabase
        .from(view)
        .select("*")
        .range(offset, offset + limit - 1);

      if (error) throw error;
      rows.push(...(data || []));
    } else {
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from(view)
          .select("*")
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const page = data || [];
        rows.push(...page);

        if (page.length < PAGE_SIZE) break;
      }
    }

    return new Response(JSON.stringify(rows), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
