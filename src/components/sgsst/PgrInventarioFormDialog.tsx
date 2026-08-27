import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  SgsstPgrInventario,
  SgsstPgrInventarioInput,
  calcularClassificacaoRisco,
  useSgsstFuncoesDoRisco,
} from "@/hooks/sgsst/useSgsstPgr";
import { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, ShieldCheck, Users, Ruler, Wand2, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  alineasPendentes,
  type ResultadoAvaliacao,
  type TecnicaAvaliacao,
  type TipoExposicao,
} from "@/utils/sgsstPgrInventario";
import {
  formatarLimite,
  parseLimite,
  compararComLimite,
  textoDaComparacao,
  contradizComparacao,
} from "@/utils/sgsstRiscoLimite";

interface PgrInventarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgrId: string;
  inventarioItem?: SgsstPgrInventario | null;
  riscosCatalogo: SgsstRisco[];
  /** Funções já vinculadas ao item, quando editando. */
  funcoesVinculadas?: string[];
  onSave: (data: SgsstPgrInventarioInput & { funcaoIds?: string[] }) => Promise<void>;
  isLoading?: boolean;
}

export function PgrInventarioFormDialog({
  open,
  onOpenChange,
  pgrId,
  inventarioItem,
  riscosCatalogo,
  funcoesVinculadas,
  onSave,
  isLoading = false,
}: PgrInventarioFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [riscoCatalogoId, setRiscoCatalogoId] = useState<string>("none");
  const [areaId, setAreaId] = useState<string>("none");
  const [atividade, setAtividade] = useState("");
  const [perigo, setPerigo] = useState("");
  const [fonteGeradora, setFonteGeradora] = useState("");
  const [consequencia, setConsequencia] = useState("");
  const [trabalhadoresExpostos, setTrabalhadoresExpostos] = useState<number>(1);
  const [probabilidade, setProbabilidade] = useState<number>(1);
  const [severidade, setSeveridade] = useState<number>(1);
  const [medidasExistentes, setMedidasExistentes] = useState("");
  const [medidasNecessarias, setMedidasNecessarias] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<"pendente" | "em_andamento" | "concluido" | "cancelado">("pendente");

  // --- Alineas que faltavam ao inventario (NR-01 1.5.7.3.2) ---
  const [tipoExposicao, setTipoExposicao] = useState<TipoExposicao | "">("");
  const [tempoExposicao, setTempoExposicao] = useState("");
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const [gruposExpostos, setGruposExpostos] = useState("");
  const [funcaoIds, setFuncaoIds] = useState<string[]>([]);
  const [tecnicaAvaliacao, setTecnicaAvaliacao] = useState<TecnicaAvaliacao | "">("");
  const [intensidadeMedida, setIntensidadeMedida] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("");
  const [limiteAplicado, setLimiteAplicado] = useState("");
  const [dataMedicao, setDataMedicao] = useState("");
  const [resultadoAvaliacao, setResultadoAvaliacao] = useState<ResultadoAvaliacao | "">("");
  const [metodologiaMedicao, setMetodologiaMedicao] = useState("");

  // Fase 2 pagando: escolhido o risco, o sistema ja sabe quais funcoes se expoem
  // a ele — e com que caracterizacao de exposicao.
  const { sugestoes } = useSgsstFuncoesDoRisco(
    open && riscoCatalogoId !== "none" ? riscoCatalogoId : null
  );

  // Load areas (setores)
  const { data: areas = [] } = useQuery({
    queryKey: ["areas_inventario", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Load responsaveis (profiles)
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_inventario", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (inventarioItem) {
      setRiscoCatalogoId(inventarioItem.risco_catalogo_id || "none");
      setAreaId(inventarioItem.area_id || "none");
      setAtividade(inventarioItem.atividade || "");
      setPerigo(inventarioItem.perigo || "");
      setFonteGeradora(inventarioItem.fonte_geradora || "");
      setConsequencia(inventarioItem.consequencia || "");
      setTrabalhadoresExpostos(inventarioItem.trabalhadores_expostos || 1);
      setProbabilidade(inventarioItem.probabilidade || 1);
      setSeveridade(inventarioItem.severidade || 1);
      setMedidasExistentes(inventarioItem.medidas_existentes || "");
      setMedidasNecessarias(inventarioItem.medidas_necessarias || "");
      setResponsavelId(inventarioItem.responsavel_id || "none");
      setPrazo(inventarioItem.prazo ? inventarioItem.prazo.split("T")[0] : "");
      setStatus(inventarioItem.status || "pendente");
      setTipoExposicao(inventarioItem.tipo_exposicao || "");
      setTempoExposicao(inventarioItem.tempo_exposicao || "");
      setDescricaoLocal(inventarioItem.descricao_local || "");
      setGruposExpostos(inventarioItem.grupos_expostos || "");
      setFuncaoIds(funcoesVinculadas ?? []);
      setTecnicaAvaliacao(inventarioItem.tecnica_avaliacao || "");
      setIntensidadeMedida(
        inventarioItem.intensidade_medida === null ||
          inventarioItem.intensidade_medida === undefined
          ? ""
          : String(inventarioItem.intensidade_medida).replace(".", ",")
      );
      setUnidadeMedida(inventarioItem.unidade_medida || "");
      setLimiteAplicado(
        inventarioItem.limite_tolerancia_aplicado === null ||
          inventarioItem.limite_tolerancia_aplicado === undefined
          ? ""
          : String(inventarioItem.limite_tolerancia_aplicado).replace(".", ",")
      );
      setDataMedicao(inventarioItem.data_medicao ? inventarioItem.data_medicao.split("T")[0] : "");
      setResultadoAvaliacao(inventarioItem.resultado_avaliacao || "");
      setMetodologiaMedicao(inventarioItem.metodologia_medicao || "");
    } else {
      setRiscoCatalogoId("none");
      setAreaId("none");
      setAtividade("");
      setPerigo("");
      setFonteGeradora("");
      setConsequencia("");
      setTrabalhadoresExpostos(1);
      setProbabilidade(1);
      setSeveridade(1);
      setMedidasExistentes("");
      setMedidasNecessarias("");
      setResponsavelId("none");
      setPrazo("");
      setStatus("pendente");
      setTipoExposicao("");
      setTempoExposicao("");
      setDescricaoLocal("");
      setGruposExpostos("");
      setFuncaoIds([]);
      setTecnicaAvaliacao("");
      setIntensidadeMedida("");
      setUnidadeMedida("");
      setLimiteAplicado("");
      setDataMedicao("");
      setResultadoAvaliacao("");
      setMetodologiaMedicao("");
    }
  }, [inventarioItem, open, funcoesVinculadas]);

  /**
   * Escolhido o risco do catálogo, herda o que já está cadastrado lá.
   *
   * Só preenche campo vazio — sobrescrever o que o usuário digitou seria pior que
   * não ajudar. O limite é COPIADO, não referenciado: se o catálogo mudar depois,
   * este inventário não pode mudar retroativamente.
   */
  const handleSelectRiscoCatalogo = (id: string) => {
    setRiscoCatalogoId(id);
    if (id === "none") return;

    const found = riscosCatalogo.find((r) => r.id === id);
    if (!found) return;

    if (!perigo) setPerigo(found.nome);
    if (!fonteGeradora && found.fonte_geradora) setFonteGeradora(found.fonte_geradora);
    if (!consequencia && found.consequencia) setConsequencia(found.consequencia);

    // Herança da fase 1: técnica, unidade e limite de tolerância.
    if (!tecnicaAvaliacao && found.tecnica_avaliacao) {
      setTecnicaAvaliacao(found.tecnica_avaliacao as TecnicaAvaliacao);
    }
    if (!unidadeMedida && found.unidade_medida) setUnidadeMedida(found.unidade_medida);
    if (
      !limiteAplicado &&
      found.limite_tolerancia !== null &&
      found.limite_tolerancia !== undefined
    ) {
      setLimiteAplicado(String(found.limite_tolerancia).replace(".", ","));
    }
  };

  /** Aplica a caracterização de exposição que as funções já declararam. */
  const aplicarSugestoes = () => {
    setFuncaoIds([...new Set([...funcaoIds, ...sugestoes.map((s) => s.funcao_id)])]);

    const comExposicao = sugestoes.find((s) => s.tipo_exposicao);
    if (!tipoExposicao && comExposicao?.tipo_exposicao) {
      setTipoExposicao(comExposicao.tipo_exposicao);
    }
    if (!tempoExposicao && comExposicao?.tempo_exposicao) {
      setTempoExposicao(comExposicao.tempo_exposicao);
    }
  };

  const alternarFuncao = (id: string) => {
    setFuncaoIds((atual) =>
      atual.includes(id) ? atual.filter((f) => f !== id) : [...atual, id]
    );
  };

  const intensidadeParseada = parseLimite(intensidadeMedida);
  const limiteParseado = parseLimite(limiteAplicado);

  // Posicao da medicao em relacao ao limite, e a sugestao de conclusao que
  // decorre dela. A sugestao nao e aplicada sozinha: quem preenche decide.
  const comparacao = compararComLimite(
    intensidadeParseada === undefined ? null : intensidadeParseada,
    limiteParseado === undefined ? null : limiteParseado
  );
  const resultadoSugerido: ResultadoAvaliacao | null =
    comparacao.posicao === "ACIMA"
      ? "ACIMA_LIMITE"
      : comparacao.posicao === "ABAIXO" || comparacao.posicao === "IGUAL"
        ? "ABAIXO_LIMITE"
        : null;
  const contradiz = contradizComparacao(resultadoAvaliacao || null, comparacao);
  const numerosInvalidos = intensidadeParseada === undefined || limiteParseado === undefined;

  // Mesma checagem que o PDF usa, para a tela avisar antes de salvar em vez de o
  // usuário descobrir o furo depois de emitir o documento.
  const pendencias = alineasPendentes({
    atividade,
    perigo,
    fonte_geradora: fonteGeradora,
    consequencia,
    descricao_local: descricaoLocal,
    area_id: areaId === "none" ? null : areaId,
    tipo_exposicao: tipoExposicao || null,
    tempo_exposicao: tempoExposicao,
    grupos_expostos: gruposExpostos,
    totalFuncoes: funcaoIds.length,
    probabilidade,
    severidade,
    medidas_existentes: medidasExistentes,
    tecnica_avaliacao: tecnicaAvaliacao || null,
    intensidade_medida: intensidadeParseada ?? null,
    data_medicao: dataMedicao || null,
    resultado_avaliacao: resultadoAvaliacao || null,
  });

  const { nivel, classificacao } = calcularClassificacaoRisco(probabilidade, severidade);

  const getClassificacaoBadgeColor = (c: string) => {
    switch (c) {
      case "BAIXO":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "MODERADO":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "ALTO":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "CRÍTICO":
        return "bg-red-100 text-red-800 border-red-300 font-bold";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atividade.trim() || !perigo.trim() || numerosInvalidos) return;

    await onSave({
      pgr_id: pgrId,
      risco_catalogo_id: riscoCatalogoId === "none" ? null : riscoCatalogoId,
      area_id: areaId === "none" ? null : areaId,
      atividade: atividade.trim(),
      perigo: perigo.trim(),
      fonte_geradora: fonteGeradora.trim() || null,
      consequencia: consequencia.trim() || null,
      trabalhadores_expostos: trabalhadoresExpostos || 1,
      probabilidade,
      severidade,
      medidas_existentes: medidasExistentes.trim() || null,
      medidas_necessarias: medidasNecessarias.trim() || null,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prazo: prazo || null,
      status,
      // Alíneas da NR-01 1.5.7.3.2
      tipo_exposicao: tipoExposicao || null,
      tempo_exposicao: tempoExposicao.trim() || null,
      descricao_local: descricaoLocal.trim() || null,
      grupos_expostos: gruposExpostos.trim() || null,
      tecnica_avaliacao: tecnicaAvaliacao || null,
      intensidade_medida: intensidadeParseada ?? null,
      unidade_medida: unidadeMedida.trim() || null,
      limite_tolerancia_aplicado: limiteParseado ?? null,
      data_medicao: dataMedicao || null,
      resultado_avaliacao: resultadoAvaliacao || null,
      metodologia_medicao: metodologiaMedicao.trim() || null,
      funcaoIds,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {inventarioItem ? "Editar Risco no Inventário PGR" : "Incluir Risco no Inventário PGR"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="riscoCatalogo">Vincular Risco do Catálogo</Label>
              <Select value={riscoCatalogoId} onValueChange={handleSelectRiscoCatalogo}>
                <SelectTrigger id="riscoCatalogo">
                  <SelectValue placeholder="Selecione do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Risco Personalizado / Fora do Catálogo --</SelectItem>
                  {riscosCatalogo.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      [{r.categoria}] {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area">Setor / Área de Exposição</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral do Canteiro --</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="atividade">Atividade / Operação Avaliada *</Label>
              <Input
                id="atividade"
                placeholder="Ex: Escavação de vala com retroescavadeira"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expostos">Trabalhadores Expostos</Label>
              <Input
                id="expostos"
                type="number"
                min={1}
                value={trabalhadoresExpostos}
                onChange={(e) => setTrabalhadoresExpostos(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perigo">Perigo / Fator de Risco *</Label>
            <Input
              id="perigo"
              placeholder="Ex: Risco de desmoronamento de terra em vala aberta"
              value={perigo}
              onChange={(e) => setPerigo(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fonte">Fonte Geradora / Agente</Label>
              <Input
                id="fonte"
                placeholder="Ex: Solo não escorado e vibração de veículo próximo"
                value={fonteGeradora}
                onChange={(e) => setFonteGeradora(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consequencia">Consequências / Lesões</Label>
              <Input
                id="consequencia"
                placeholder="Ex: Soterramento, fraturas, asfixia, óbito"
                value={consequencia}
                onChange={(e) => setConsequencia(e.target.value)}
              />
            </div>
          </div>

          {/* MATRIZ DE RISCO 5x5 */}
          <div className="bg-muted/40 p-3 rounded-md border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary">
                <ShieldCheck className="h-4 w-4" /> Matriz de Risco Ocupacional (Probabilidade × Severidade)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Nível N: <strong>{nivel}</strong></span>
                <Badge variant="outline" className={getClassificacaoBadgeColor(classificacao)}>
                  {classificacao}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="probabilidade" className="text-xs">Probabilidade (1 a 5)</Label>
                <Select
                  value={probabilidade.toString()}
                  onValueChange={(val) => setProbabilidade(parseInt(val))}
                >
                  <SelectTrigger id="probabilidade" className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Rara (Raríssima ocorrência)</SelectItem>
                    <SelectItem value="2">2 — Improvável (Ocorrência eventual)</SelectItem>
                    <SelectItem value="3">3 — Possível (Pode ocorrer algumas vezes)</SelectItem>
                    <SelectItem value="4">4 — Provável (Ocorre com frequência)</SelectItem>
                    <SelectItem value="5">5 — Quase certa (Ocorrência contínua/habitual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="severidade" className="text-xs">Severidade (1 a 5)</Label>
                <Select
                  value={severidade.toString()}
                  onValueChange={(val) => setSeveridade(parseInt(val))}
                >
                  <SelectTrigger id="severidade" className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Insignificante (Primeiros socorros leves)</SelectItem>
                    <SelectItem value="2">2 — Leve (Lesão sem afastamento / atendimento simples)</SelectItem>
                    <SelectItem value="3">3 — Moderada (Lesão com afastamento / sem sequelas)</SelectItem>
                    <SelectItem value="4">4 — Grave (Lesão grave / incapacidade permanente parcial)</SelectItem>
                    <SelectItem value="5">5 — Catastrófica (Incapacidade total permanente / óbito)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ===== Caracterização da exposição e grupos expostos ===== */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold leading-none">
                  Exposição e grupos expostos
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  A NR-01 1.5.7.3.2 pede como é a exposição e <strong>quais grupos</strong> estão
                  expostos. A quantidade, sozinha, não identifica ninguém.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tipoExp">Tipo de exposição</Label>
                <Select
                  value={tipoExposicao || "nao_informado"}
                  onValueChange={(v) =>
                    setTipoExposicao(v === "nao_informado" ? "" : (v as TipoExposicao))
                  }
                >
                  <SelectTrigger id="tipoExp">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informado</SelectItem>
                    <SelectItem value="HABITUAL">Habitual</SelectItem>
                    <SelectItem value="OCASIONAL">Ocasional</SelectItem>
                    <SelectItem value="EVENTUAL">Eventual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tempoExp">Tempo de exposição</Label>
                <Input
                  id="tempoExp"
                  placeholder="Ex: 8h/dia"
                  value={tempoExposicao}
                  onChange={(e) => setTempoExposicao(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qtdExpostos">Qtd. de expostos</Label>
                <Input
                  id="qtdExpostos"
                  type="number"
                  min={1}
                  value={trabalhadoresExpostos}
                  onChange={(e) => setTrabalhadoresExpostos(Number(e.target.value))}
                />
              </div>
            </div>

            {sugestoes.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs">
                    <strong>{sugestoes.length} função(ões)</strong> já declararam exposição a
                    este risco no cadastro de funções.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1 shrink-0"
                    onClick={aplicarSugestoes}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Usar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <label
                      key={s.funcao_id}
                      className="flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      <Checkbox
                        checked={funcaoIds.includes(s.funcao_id)}
                        onCheckedChange={() => alternarFuncao(s.funcao_id)}
                      />
                      {s.funcao?.nome ?? "função"}
                      {s.tipo_exposicao && (
                        <span className="text-muted-foreground">({s.tipo_exposicao})</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {riscoCatalogoId !== "none" && sugestoes.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Nenhuma função declarou exposição a este risco. Vincule o risco às funções na
                  tela de Funções e ele passa a ser sugerido aqui automaticamente.
                </span>
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="gruposExp">Outros grupos expostos</Label>
              <Input
                id="gruposExp"
                placeholder="Ex: Terceiros da empreiteira de fundação, visitantes"
                value={gruposExpostos}
                onChange={(e) => setGruposExpostos(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Para grupos que não correspondem a uma função cadastrada.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descLocal">Descrição do ambiente</Label>
              <Textarea
                id="descLocal"
                rows={2}
                placeholder="Ex: Subsolo sem ventilação natural, iluminação artificial, área confinada"
                value={descricaoLocal}
                onChange={(e) => setDescricaoLocal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A área vinculada diz onde no cadastro; isto diz como é o lugar — é o que
                caracteriza a exposição para quem fiscaliza.
              </p>
            </div>
          </div>

          {/* ===== Dados de monitoramento ===== */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Ruler className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold leading-none">Dados de monitoramento</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Sem medição, a classificação do risco é opinião. Só é exigido quando a
                  avaliação é quantitativa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tecnica">Técnica</Label>
                <Select
                  value={tecnicaAvaliacao || "nao_informado"}
                  onValueChange={(v) =>
                    setTecnicaAvaliacao(v === "nao_informado" ? "" : (v as TecnicaAvaliacao))
                  }
                >
                  <SelectTrigger id="tecnica">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informada</SelectItem>
                    <SelectItem value="QUALITATIVA">Qualitativa</SelectItem>
                    <SelectItem value="QUANTITATIVA">Quantitativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="intensidade">Intensidade medida</Label>
                <Input
                  id="intensidade"
                  inputMode="decimal"
                  placeholder="Ex: 92"
                  value={intensidadeMedida}
                  onChange={(e) => setIntensidadeMedida(e.target.value)}
                  aria-invalid={intensidadeParseada === undefined}
                  className={intensidadeParseada === undefined ? "border-destructive" : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unidade">Unidade</Label>
                <Input
                  id="unidade"
                  placeholder="dB(A)"
                  value={unidadeMedida}
                  onChange={(e) => setUnidadeMedida(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="limiteApl">Limite de tolerância</Label>
                <Input
                  id="limiteApl"
                  inputMode="decimal"
                  placeholder="Ex: 85"
                  value={limiteAplicado}
                  onChange={(e) => setLimiteAplicado(e.target.value)}
                  aria-invalid={limiteParseado === undefined}
                  className={limiteParseado === undefined ? "border-destructive" : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataMed">Data da medição</Label>
                <Input
                  id="dataMed"
                  type="date"
                  value={dataMedicao}
                  onChange={(e) => setDataMedicao(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resultadoAv">Conclusão</Label>
                <Select
                  value={resultadoAvaliacao || "nao_informado"}
                  onValueChange={(v) =>
                    setResultadoAvaliacao(
                      v === "nao_informado" ? "" : (v as ResultadoAvaliacao)
                    )
                  }
                >
                  <SelectTrigger id="resultadoAv">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informada</SelectItem>
                    <SelectItem value="ABAIXO_LIMITE">Abaixo do limite</SelectItem>
                    <SelectItem value="ACIMA_LIMITE">Acima do limite</SelectItem>
                    <SelectItem value="NAO_APLICAVEL">Não aplicável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Posição da medição em relação ao limite. É aritmética, então o
                sistema calcula e mostra; o que ele NÃO faz é dizer se estar acima
                é conforme ou não — isso depende do agente e segue declarado. */}
            {comparacao.posicao !== "INDETERMINADA" && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {formatarLimite(intensidadeParseada ?? null, unidadeMedida) ?? "—"} contra limite
                  de {formatarLimite(limiteParseado ?? null, unidadeMedida) ?? "—"}:
                </span>
                <span
                  className={`text-xs font-semibold ${
                    comparacao.posicao === "ACIMA" ? "text-destructive" : "text-emerald-700"
                  }`}
                >
                  {textoDaComparacao(comparacao)}
                </span>
                {resultadoSugerido && resultadoAvaliacao !== resultadoSugerido && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 gap-1.5 text-xs"
                    onClick={() => setResultadoAvaliacao(resultadoSugerido)}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Usar em Conclusão
                  </Button>
                )}
              </div>
            )}

            {/* Contradição não impede gravar — pode haver limite cadastrado
                errado ou unidade diferente. Mas passar calada é pior. */}
            {contradiz && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  A conclusão declarada não acompanha os números: {intensidadeMedida} contra um
                  limite de {limiteAplicado}. Confira a medição, a unidade ou o limite antes de
                  gravar.
                </span>
              </p>
            )}

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                A conclusão é declarada por você, e não calculada pelo sistema, porque há agente
                em que o limite é <strong>piso</strong> e não teto — em espaço confinado a
                NR-33 admite entrada com oxigênio entre 19,5% e 23%, então falta e excesso
                reprovam.
              </span>
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="metodMed">Metodologia da medição</Label>
              <Input
                id="metodMed"
                placeholder="Ex: NHO-01 (Fundacentro), dosimetria de jornada completa"
                value={metodologiaMedicao}
                onChange={(e) => setMetodologiaMedicao(e.target.value)}
              />
            </div>
          </div>

          {pendencias.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                {pendencias.length} alínea(s) da NR-01 1.5.7.3.2 ainda não atendidas
              </p>
              <ul className="mt-1.5 space-y-1">
                {pendencias.map((p) => (
                  <li key={`${p.alinea}-${p.titulo}`} className="text-xs text-amber-800 dark:text-amber-400">
                    <strong>{p.alinea})</strong> {p.titulo} — {p.detalhe}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                Dá para salvar assim e completar depois. O aviso reaparece aqui e no PDF.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="existentes">Medidas de Controle Existentes</Label>
            <Textarea
              id="existentes"
              placeholder="Descreva as proteções e EPIs já implementados..."
              rows={2}
              value={medidasExistentes}
              onChange={(e) => setMedidasExistentes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="necessarias">Medidas de Controle Necessárias / Plano de Ação</Label>
            <Textarea
              id="necessarias"
              placeholder="Descreva as adequações e ações corretivas a serem implementadas..."
              rows={2}
              value={medidasNecessarias}
              onChange={(e) => setMedidasNecessarias(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável da Ação</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Não Definido --</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome || "Sem Nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo Limite</Label>
              <Input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status do Risco</Label>
              <Select
                value={status}
                onValueChange={(val: "pendente" | "em_andamento" | "concluido" | "cancelado") => setStatus(val)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !atividade.trim() || !perigo.trim() || numerosInvalidos}>
              {isLoading ? "Salvando..." : inventarioItem ? "Atualizar Risco" : "Salvar no Inventário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
