import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Based on the logs, gemini-2.0-flash is invalid without the prefix, 
// and gemini-2.5-flash is allowed. We'll use 2.5-flash as the primary.
const PRIMARY_MODEL = 'google/gemini-2.5-flash';

async function fetchFileAsBase64(url: string): Promise<{ base64: string, contentType: string }> {
  console.log(`Fetching file from URL: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return {
    base64: btoa(binary),
    contentType
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader || '' } },
    }).auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { pdfBase64, fileName, contentType, filePath, fileUrl } = await req.json();
    let fileData = pdfBase64;
    let mimeType = contentType || 'application/pdf';

    if (fileUrl) {
      const fetched = await fetchFileAsBase64(fileUrl);
      fileData = fetched.base64;
      mimeType = fetched.contentType;
    } else if (filePath) {
      const { data: signedData, error: signedError } = await supabase.storage.from('contratos').createSignedUrl(filePath, 60 * 15);
      if (signedError || !signedData?.signedUrl) {
        throw new Error(`Failed to access storage: ${signedError?.message}`);
      }
      const fetched = await fetchFileAsBase64(signedData.signedUrl);
      fileData = fetched.base64;
      mimeType = fetched.contentType;
    }

    if (!fileData) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const systemPrompt = `Você é um assistente especializado em extrair dados estruturados de Contratos e Aditivos contratuais de engenharia/serviços. Analise o documento rigorosamente. NUNCA INVENTE DADOS. Se um campo não for encontrado, retorne null.
Retorne os dados em formato JSON estruturado.
{
  "valor_total": "string ou null",
  "prazo_inicio": "string ou null",
  "prazo_fim": "string ou null",
  "cnpjs_clientes": ["string"],
  "escopo": "string ou null",
  "condicoes_pagamento": "string ou null",
  "garantias": "string ou null",
  "liberacao_garantias": "string ou null",
  "medicoes": "string ou null",
  "multas": "string ou null",
  "reajuste": "string ou null",
  "observacoes": "string ou null"
}`;

    const makeAICall = async (document: any) => {
      console.log(`Calling AI Gateway: model=${PRIMARY_MODEL}, type=${document.type}`);
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: PRIMARY_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: `Extraia dados deste contrato: ${fileName || 'documento'}` },
                document
              ]
            }
          ],
          max_tokens: 1200,
        }),
      });
      return response;
    };

    // Try primary structure: type 'file' with base64 data
    let doc = {
      type: 'file',
      file: {
        file_data: fileData,
        filename: fileName || 'contrato.pdf',
        mime_type: mimeType
      }
    };

    let response = await makeAICall(doc);

    // Fallback logic: if it's an image, try image_url
    if (!response.ok && mimeType.startsWith('image/')) {
      const errorText = await response.text();
      console.warn(`Attempt 1 failed: ${errorText}. Retrying with image_url...`);
      
      doc = {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${fileData}`
        }
      } as any;
      
      response = await makeAICall(doc);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Final AI error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from AI');

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const extractedData = JSON.parse(jsonString);

    return new Response(JSON.stringify({ success: true, data: extractedData, fileName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
