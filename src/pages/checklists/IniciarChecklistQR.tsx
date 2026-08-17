import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PublicChecklistQRInfo } from "@/types/checklistsEvolution";
import { AplicarChecklistDialog } from "@/components/checklists/AplicarChecklistDialog";
import { ChecklistModelo } from "@/hooks/checklists/useChecklists";
import { QrCode, ShieldCheck, AlertTriangle, Loader2, Play, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IniciarChecklistQRPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [qrInfo, setQrInfo] = useState<PublicChecklistQRInfo | null>(null);
  const [modeloObj, setModeloObj] = useState<ChecklistModelo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token]);

  const validateToken = async (t: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_checklist_qr_info", { p_token: t });

      if (error || !data) {
        setQrInfo({ valid: false, error: "QR Code inválido ou expirado." });
        return;
      }

      const info = data as PublicChecklistQRInfo;
      setQrInfo(info);

      if (info.valid && info.modelo_id) {
        // Load complete checklist model structure
        const { data: modeloData } = await supabase
          .from("checklist_modelos" as any)
          .select("*, secoes:checklist_secoes(*, itens:checklist_itens(*))")
          .eq("id", info.modelo_id)
          .single();

        if (modeloData) {
          setModeloObj(modeloData as ChecklistModelo);
        }
      }
    } catch (err) {
      setQrInfo({ valid: false, error: "Erro ao consultar QR Code." });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!user) {
      // Redirect to login preserving destination
      navigate(`/auth?redirect=/checklists/iniciar/${token}`);
      return;
    }
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* HEADER BRANDING */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <QrCode className="h-10 w-10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase">PREENCHIMENTO VIA QR CODE</h1>
          <p className="text-xs text-slate-400">Acesso móvel rápido a checklists de campo vinculados.</p>
        </div>

        {loading || loadingAuth ? (
          <div className="p-8 text-center bg-slate-800 border border-slate-700 rounded-xl space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
            <p className="text-xs text-slate-400">Validando token seguro do QR Code...</p>
          </div>
        ) : !qrInfo?.valid ? (
          <Card className="bg-slate-800 border-red-500/30 text-slate-100 shadow-xl">
            <CardHeader className="text-center pb-2">
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-2" />
              <CardTitle className="text-base text-red-400">QR Code Inválido ou Desativado</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {qrInfo?.error || "Este QR Code foi desativado ou não permite novas aplicações."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 text-center">
              <Button onClick={() => navigate("/medicoes/checklists")} variant="outline" className="text-xs text-white border-slate-700">
                Voltar aos Checklists
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800 border-slate-700 text-slate-100 shadow-xl space-y-4 p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <Badge className="bg-emerald-600 text-white font-bold">QR CODE VÁLIDO</Badge>
                <span className="text-[11px] font-mono text-slate-400">{qrInfo.token}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Checklist Alocado</span>
                <h2 className="text-lg font-bold text-white leading-tight">{qrInfo.modelo_nome}</h2>
                <span className="text-xs text-emerald-400 font-semibold">{qrInfo.modelo_categoria}</span>
              </div>

              {qrInfo.vinculado_nome && (
                <div className="p-3 bg-slate-900/80 border border-slate-700/60 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Contexto Vinculado ({qrInfo.vinculado_tipo})
                  </span>
                  <div className="font-bold text-white text-xs">{qrInfo.vinculado_nome}</div>
                </div>
              )}

              {qrInfo.exigir_geolocalizacao !== "nao" && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Este checklist exige registro de geolocalização do dispositivo.</span>
                </div>
              )}
            </div>

            {!user ? (
              <div className="space-y-2 pt-2 border-t border-slate-700">
                <div className="p-3 bg-slate-900 rounded text-center text-xs text-slate-300 flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" />
                  Autenticação necessária para registrar a auditoria.
                </div>
                <Button onClick={handleStart} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs">
                  Fazer Login e Iniciar Checklist
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStart}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-xs gap-2"
              >
                <Play className="h-4 w-4" /> Iniciar Preenchimento do Checklist
              </Button>
            )}
          </Card>
        )}

        {/* EXECUTION DIALOG */}
        {modeloObj && (
          <AplicarChecklistDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            modelo={modeloObj}
          />
        )}
      </div>
    </div>
  );
}
