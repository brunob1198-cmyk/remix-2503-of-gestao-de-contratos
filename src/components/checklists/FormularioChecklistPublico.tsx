import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, HelpCircle, Loader2, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  aceitaNaoAplicavel,
  ehItemDeConformidade,
  ehNaoAplicavel,
  ehNaoConforme,
  pendenciasDoEnvio,
  situacaoDaPosicao,
  valorConforme,
  valorNaoConforme,
  type ItemPublico,
  type RespostaPublica,
} from "@/utils/checklistPublico";
import {
  responderChecklistPorQr,
  type ChecklistPorQr,
  type ResultadoDoEnvio,
} from "@/services/checklistPorQr";

/**
 * O checklist preenchido por quem escaneou o QR Code, sem login.
 *
 * POR QUE UM FORMULARIO SEPARADO, E NAO O `AplicarChecklistDialog`
 *
 * Aquele tem 1.352 linhas e depende de sessao, fila offline, planos de acao,
 * agendamento e permissoes. Nada disso existe aqui, e adaptar tudo a ausencia de
 * usuario espalharia condicionais por uma tela que hoje funciona. Este formulario
 * faz uma coisa so.
 *
 * OS BOTOES SAO DE CONFORMIDADE, NUNCA "SIM"/"NAO"
 *
 * Um item pode ser do tipo `Sim_Nao`, e ai o valor gravado e "Sim"/"Nao". Mas a
 * pergunta costuma ser escrita em que "Sim" e a resposta RUIM — "Houve arranhado
 * ou amassado?". Rotular o botao com o tipo inverteria o significado de metade dos
 * checklists sem nenhum aviso. Quem decide o rotulo e a conformidade; o tipo so
 * decide a string. Igual a tela interna.
 */

interface Props {
  dados: ChecklistPorQr;
  token: string;
  aoConcluir: (r: ResultadoDoEnvio) => void;
}

export function FormularioChecklistPublico({ dados, token, aoConcluir }: Props) {
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [respostas, setRespostas] = useState<Record<string, RespostaPublica>>({});
  const [enviando, setEnviando] = useState(false);
  const [posicao, setPosicao] = useState<{ latitude: number; longitude: number; precisao?: number } | null>(null);
  const [permissaoNegada, setPermissaoNegada] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const itens = useMemo(
    () => (dados.secoes ?? []).flatMap((s) => s.itens),
    [dados.secoes]
  );

  const posicaoSituacao = situacaoDaPosicao({
    exigirGeolocalizacao: dados.exigir_geolocalizacao ?? "nao",
    bloquearForaRaio: dados.bloquear_fora_raio ?? false,
    latitudeAlvo: dados.latitude_alvo,
    longitudeAlvo: dados.longitude_alvo,
    raioEmMetros: dados.raio_permitido_metros ?? 200,
    posicao,
    permissaoNegada,
  });

  const pendencias = pendenciasDoEnvio({ itens, respostas, quem: { nome } });
  const pendentePorItem = new Map(pendencias.map((p) => [p.itemId, p.motivo]));

  const bloqueadoPorPosicao =
    (posicaoSituacao.estado === "FORA" && posicaoSituacao.bloqueia) ||
    (posicaoSituacao.estado === "SEM_PERMISSAO" && posicaoSituacao.bloqueia);

  const pedirPosicao = () => {
    if (!navigator.geolocation) {
      setPermissaoNegada(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPosicao({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precisao: p.coords.accuracy,
        }),
      () => setPermissaoNegada(true),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const responder = (item: ItemPublico, valor: string) => {
    setRespostas((atual) => ({
      ...atual,
      [item.id]: { ...atual[item.id], valor },
    }));
  };

  const comentar = (item: ItemPublico, comentario: string) => {
    setRespostas((atual) => ({
      ...atual,
      [item.id]: { valor: atual[item.id]?.valor ?? "", comentario },
    }));
  };

  const enviar = async () => {
    setTentouEnviar(true);

    if (pendencias.length > 0) {
      toast.error(
        `Falta responder ${pendencias.length} ${pendencias.length === 1 ? "item" : "itens"}.`
      );
      return;
    }

    if (bloqueadoPorPosicao) {
      toast.error("Este checklist só pode ser preenchido dentro da área permitida.");
      return;
    }

    try {
      setEnviando(true);
      const r = await responderChecklistPorQr({
        token,
        nome,
        documento,
        observacoes,
        respostas,
        posicao,
      });
      aoConcluir(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o checklist.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* QUEM ESTA RESPONDENDO */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-300">
          Quem está respondendo
        </h2>

        <div className="space-y-1">
          <Label className="text-[11px] text-slate-400">Nome completo *</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            className="bg-slate-900 border-slate-700 text-slate-100 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-slate-400">CPF ou matrícula (opcional)</Label>
          <Input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="Para identificar quem respondeu"
            className="bg-slate-900 border-slate-700 text-slate-100 text-sm"
          />
        </div>

        {/*
          O sistema nao verificou nada sobre esta pessoa, e quem preenche precisa
          saber disso tanto quanto quem le o resultado depois.
        */}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Este preenchimento é feito sem login. O nome informado fica registrado
          como <strong className="text-slate-300">declarado por quem respondeu</strong>,
          e não como identidade verificada pelo sistema.
        </p>
      </section>

      {/* GEOLOCALIZACAO */}
      {posicaoSituacao.estado !== "NAO_EXIGIDA" && (
        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-300 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Localização
          </h2>

          {posicaoSituacao.estado === "AGUARDANDO" && (
            <Button size="sm" onClick={pedirPosicao} className="text-xs bg-emerald-600 hover:bg-emerald-700">
              Registrar minha localização
            </Button>
          )}

          {posicaoSituacao.estado === "SEM_PERMISSAO" && (
            <p className="text-xs text-amber-400">
              O aparelho não autorizou o acesso à localização.
              {posicaoSituacao.bloqueia
                ? " Este checklist exige a posição para ser preenchido."
                : " O checklist segue, mas sem o registro de onde foi feito."}
            </p>
          )}

          {posicaoSituacao.estado === "DENTRO" && (
            <p className="text-xs text-emerald-400">
              Localização registrada
              {posicaoSituacao.metros > 0 ? ` — ${posicaoSituacao.metros} m do ponto` : ""}.
            </p>
          )}

          {posicaoSituacao.estado === "FORA" && (
            <p className={`text-xs ${posicaoSituacao.bloqueia ? "text-red-400" : "text-amber-400"}`}>
              Você está a {posicaoSituacao.metros} m do ponto, fora do raio de{" "}
              {dados.raio_permitido_metros ?? 200} m.
              {posicaoSituacao.bloqueia
                ? " Este checklist não pode ser preenchido daqui."
                : " O checklist segue, e a distância fica registrada."}
            </p>
          )}
        </section>
      )}

      {/* SECOES */}
      {(dados.secoes ?? []).map((secao) => (
        <section key={secao.id} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-400">
            {secao.titulo}
          </h2>

          {secao.itens.map((item) => {
            const resposta = respostas[item.id];
            const valor = resposta?.valor ?? "";
            const nc = ehNaoConforme(valor);
            const pendencia = tentouEnviar ? pendentePorItem.get(item.id) : undefined;

            return (
              <div
                key={item.id}
                className={`rounded-xl p-3 space-y-2 border ${
                  pendencia ? "border-red-500/60 bg-red-500/5" : "border-slate-700 bg-slate-800/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm text-slate-100 flex-1">
                    {item.titulo}
                    {(item.obrigatorio || item.critico) && (
                      <span className="text-red-400 font-bold"> *</span>
                    )}
                  </span>
                  {item.critico && (
                    <Badge className="bg-red-600 text-white text-[10px] shrink-0">CRÍTICO</Badge>
                  )}
                </div>

                {item.descricao && (
                  <p className="text-[11px] text-slate-400">{item.descricao}</p>
                )}

                {ehItemDeConformidade(item.tipo_resposta) ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => responder(item, valorConforme(item.tipo_resposta))}
                      className={`text-xs h-9 gap-1 ${
                        valor && !nc && !ehNaoAplicavel(valor)
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Conforme
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => responder(item, valorNaoConforme(item.tipo_resposta))}
                      className={`text-xs h-9 gap-1 ${
                        nc
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Não Conforme
                    </Button>

                    {aceitaNaoAplicavel(item.tipo_resposta) && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => responder(item, "NA")}
                        className={`text-xs h-9 gap-1 ${
                          ehNaoAplicavel(valor)
                            ? "bg-slate-500 text-white"
                            : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                        }`}
                      >
                        <HelpCircle className="h-3.5 w-3.5" /> N/A
                      </Button>
                    )}
                  </div>
                ) : (
                  <Input
                    value={valor}
                    onChange={(e) => responder(item, e.target.value)}
                    type={item.tipo_resposta === "Numero" ? "number" : item.tipo_resposta === "Data" ? "date" : "text"}
                    placeholder="Sua resposta"
                    className="bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  />
                )}

                {nc && item.exigir_comentario_nao_conforme && (
                  <Textarea
                    value={resposta?.comentario ?? ""}
                    onChange={(e) => comentar(item, e.target.value)}
                    placeholder="Descreva o que encontrou (obrigatório)"
                    className="bg-slate-900 border-slate-700 text-slate-100 text-xs min-h-[60px]"
                  />
                )}

                {pendencia && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {pendencia}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ))}

      {/* OBSERVACOES E ENVIO */}
      <section className="space-y-2">
        <Label className="text-[11px] text-slate-400">Observações gerais (opcional)</Label>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="bg-slate-900 border-slate-700 text-slate-100 text-xs min-h-[70px]"
        />
      </section>

      {tentouEnviar && pendencias.length > 0 && (
        <p className="text-xs text-red-400">
          Faltam {pendencias.length} {pendencias.length === 1 ? "item" : "itens"} — os
          pendentes estão marcados em vermelho.
        </p>
      )}

      <Button
        onClick={enviar}
        disabled={enviando || bloqueadoPorPosicao}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {enviando ? "Enviando..." : "Enviar checklist"}
      </Button>
    </div>
  );
}
