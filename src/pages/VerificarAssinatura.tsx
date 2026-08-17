import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SignatureService } from "@/services/SignatureService";
import { PublicSignatureVerification } from "@/types/signature";
import { ShieldCheck, CheckCircle2, XCircle, Search, FileText, Lock, AlertTriangle, Loader2 } from "lucide-react";

export default function VerificarAssinatura() {
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id");

  const initialId = paramId || queryId || "";
  const [requestIdInput, setRequestIdInput] = useState(initialId);
  const [activeId, setActiveId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<PublicSignatureVerification | null>(null);

  useEffect(() => {
    if (activeId) {
      loadVerification(activeId);
    }
  }, [activeId]);

  const loadVerification = async (id: string) => {
    if (!id.trim()) return;
    try {
      setLoading(true);
      const res = await SignatureService.getPublicVerification(id.trim());
      setVerification(res);
    } catch (err: any) {
      setVerification({
        valid: false,
        error: "Erro ao consultar integridade do documento.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestIdInput.trim()) {
      setActiveId(requestIdInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* HEADER BRANDING */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PORTAL DE VERIFICAÇÃO DE ASSINATURA</h1>
          <p className="text-xs text-slate-400">
            Consulte a autenticidade e a integridade de documentos assinados no SaaS.
          </p>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Informe o identificador da assinatura (UUID)..."
            value={requestIdInput}
            onChange={(e) => setRequestIdInput(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white text-xs h-10 placeholder:text-slate-500"
          />
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-10 gap-1.5 px-4 font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verificar
          </Button>
        </form>

        {/* RESULT CARD */}
        {loading && (
          <div className="p-8 text-center bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
            <p className="text-xs text-slate-400">Consultando integridade do documento...</p>
          </div>
        )}

        {!loading && verification && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5 shadow-2xl">
            {/* STATUS BADGE */}
            {verification.valid ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm text-emerald-300">✓ Documento Íntegro e Assinado</div>
                  <p className="text-[11px] text-emerald-400/80">
                    A assinatura eletrônica e o hash de integridade coincidem perfeitamente.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm text-red-300">Assinatura Inválida ou Não Encontrada</div>
                  <p className="text-[11px] text-red-400/80">
                    {verification.error || "O documento pode ter sido alterado, cancelado ou o código informado está incorreto."}
                  </p>
                </div>
              </div>
            )}

            {/* DETAILS TABLE */}
            {verification.valid && (
              <div className="space-y-3 text-xs border-t border-slate-700/60 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Assinante</span>
                    <span className="font-bold text-white text-sm">{verification.signer_nome}</span>
                    {verification.signer_cargo && (
                      <span className="text-slate-400 block text-[11px]">{verification.signer_cargo}</span>
                    )}
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Empresa</span>
                    <span className="font-bold text-white text-sm">{verification.empresa_nome}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Data / Hora</span>
                    <span className="font-semibold text-slate-200">
                      {verification.signed_at
                        ? new Date(verification.signed_at).toLocaleString("pt-BR")
                        : "Não informada"}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Método de Assinatura</span>
                    <span className="font-semibold text-emerald-400">
                      {verification.metodo === "GOV_BR"
                        ? "GOV.BR — Assinatura Digital"
                        : "Assinatura eletrônica do sistema"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Hash SHA-256 (Original)</span>
                  <p className="font-mono text-[10px] text-slate-300 break-all bg-slate-950 p-1.5 rounded">
                    {verification.hash_original || "N/A"}
                  </p>
                </div>

                {verification.arquivo_assinado_url && (
                  <div className="pt-2">
                    <a
                      href={verification.arquivo_assinado_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors"
                    >
                      <FileText className="h-4 w-4" /> Visualizar Documento Assinado (Cloudflare R2)
                    </a>
                  </div>
                )}

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300 flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso Legal & LGPD:</strong> Esta página de verificação expõe estritamente os metadados necessários para auditoria de autenticidade, preservando a confidencialidade e dados sensíveis dos demais usuários.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
          SaaS Central Signature Service • Preservação Criptográfica SHA-256 • Armazenamento Cloudflare R2
        </div>
      </div>
    </div>
  );
}
