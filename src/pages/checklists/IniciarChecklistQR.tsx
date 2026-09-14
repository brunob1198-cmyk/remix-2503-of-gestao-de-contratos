import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QrCode, ShieldCheck, AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormularioChecklistPublico } from "@/components/checklists/FormularioChecklistPublico";
import { checklistPorQr, type ChecklistPorQr, type ResultadoDoEnvio } from "@/services/checklistPorQr";

/**
 * Preenchimento de checklist pelo QR Code, SEM LOGIN.
 *
 * O QUE MUDOU E POR QUE
 *
 * Antes esta tela terminava num botão "Fazer Login e Iniciar Checklist". Exigir
 * conta é a fricção que faz o checklist de campo não ser preenchido: quem devolve
 * o veículo ou opera o andaime muitas vezes é terceirizado e não tem usuário no
 * sistema. A decisão foi liberar o preenchimento pelo link.
 *
 * E ela também corrigia um caminho que nunca funcionou para visitante: a página
 * carregava o modelo com um `select` direto em `checklist_modelos`, que a RLS
 * bloqueia para quem não está autenticado. Só quem já tinha conta chegava ao
 * formulário — e esse já podia aplicar o checklist pela tela normal.
 *
 * O QUE ISSO CUSTA
 *
 * O sistema não sabe quem respondeu; sabe o que a pessoa digitou. A tela diz isso
 * a quem preenche, e o registro grava a identidade como DECLARADA, em coluna
 * própria, nunca em `aplicador_id`. Quem tiver o link pode responder quantas vezes
 * quiser — contra isso há o QR poder ser desativado, o registro de IP e
 * user-agent, e a exigência de geolocalização dentro do raio.
 */
export default function IniciarChecklistQRPage() {
  const { token } = useParams<{ token: string }>();

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<ChecklistPorQr | null>(null);
  const [concluido, setConcluido] = useState<ResultadoDoEnvio | null>(null);

  useEffect(() => {
    if (!token) return;

    let ativo = true;
    setCarregando(true);

    checklistPorQr(token)
      .then((r) => ativo && setDados(r))
      .catch((e) =>
        ativo &&
        setDados({
          valido: false,
          erro: e instanceof Error ? e.message : "Não foi possível consultar o QR Code.",
        })
      )
      .finally(() => ativo && setCarregando(false));

    return () => {
      ativo = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-md mx-auto space-y-6 py-6">
        <header className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <QrCode className="h-10 w-10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase">
            Preenchimento via QR Code
          </h1>
          <p className="text-xs text-slate-400">
            Acesso móvel rápido a checklists de campo vinculados.
          </p>
        </header>

        {carregando && (
          <Card className="bg-slate-800 border-slate-700 p-6 flex items-center justify-center gap-2 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist…
          </Card>
        )}

        {!carregando && dados && !dados.valido && (
          <Card className="bg-slate-800 border-slate-700 p-6 space-y-2 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
            <h2 className="font-bold text-white">QR Code não disponível</h2>
            <p className="text-xs text-slate-400">{dados.erro}</p>
          </Card>
        )}

        {!carregando && dados?.valido && concluido && (
          <Card className="bg-slate-800 border-slate-700 p-6 space-y-3 text-center">
            {concluido.reprovado_por_item_critico ? (
              <XCircle className="h-10 w-10 text-red-400 mx-auto" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            )}

            <h2 className="font-bold text-white text-lg">Checklist enviado</h2>

            <p className="text-xs text-slate-300">
              {concluido.total_conforme} conforme
              {concluido.total_nao_conforme > 0
                ? `, ${concluido.total_nao_conforme} não conforme`
                : ""}
              .
            </p>

            {concluido.reprovado_por_item_critico && (
              // O veredito aparece aqui porque quem preencheu precisa saber que
              // levantou um impedimento, e não descobrir depois por outra pessoa.
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2">
                Há item crítico não conforme. O responsável pela obra será acionado.
              </p>
            )}

            <p className="text-[11px] text-slate-500">
              Você já pode fechar esta página.
            </p>
          </Card>
        )}

        {!carregando && dados?.valido && !concluido && (
          <>
            <Card className="bg-slate-800 border-slate-700 text-slate-100 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <Badge className="bg-emerald-600 text-white font-bold">QR CODE VÁLIDO</Badge>
                <span className="text-[11px] font-mono text-slate-400">{dados.token}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Checklist alocado
                </span>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {dados.modelo_nome}
                </h2>
                <span className="text-xs text-emerald-400 font-semibold">
                  {dados.modelo_categoria}
                </span>
              </div>

              {dados.vinculado_nome && (
                <div className="p-3 bg-slate-900/80 border border-slate-700/60 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Contexto vinculado ({dados.vinculado_tipo})
                  </span>
                  <div className="font-bold text-white text-xs">{dados.vinculado_nome}</div>
                </div>
              )}

              {dados.exigir_geolocalizacao !== "nao" && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Este checklist registra a localização do aparelho.</span>
                </div>
              )}
            </Card>

            <FormularioChecklistPublico
              dados={dados}
              token={token as string}
              aoConcluir={setConcluido}
            />
          </>
        )}
      </div>
    </div>
  );
}
