import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstAso, SgsstAsoInput, TipoExameOcupacional, AptidaoAso, StatusAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import {
  ATIVIDADE_ESPECIFICA_CURTO,
  APTIDAO_ATIVIDADE_LABEL,
  type AptidaoAtividade,
} from "@/utils/sgsstAptidaoAso";
import {
  CATEGORIAS_RISCO_ASO,
  CATEGORIA_RISCO_ASO_LABEL,
  agentesDaCategoria,
} from "@/utils/sgsstRiscosAso";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { useSgsstExames } from "@/hooks/sgsst/useSgsstAsosAndExames";
import { Stethoscope, AlertTriangle } from "lucide-react";
import { addYears, format } from "date-fns";

interface AsoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aso?: SgsstAso | null;
  initialExameId?: string | null;
  /** `exameIds` vai para a tabela de ligação, não para a linha do ASO. */
  onSave: (data: SgsstAsoInput & { exameIds: string[] }) => Promise<void>;
  isLoading?: boolean;
}

export function AsoFormDialog({
  open,
  onOpenChange,
  aso,
  initialExameId,
  onSave,
  isLoading = false,
}: AsoFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { pcmsoList } = useSgsstPcmso();
  const { exames } = useSgsstExames();

  const [colaboradorId, setColaboradorId] = useState("");
  const [exameId, setExameId] = useState("none");
  const [pcmsoId, setPcmsoId] = useState("none");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [tipo, setTipo] = useState<TipoExameOcupacional>("Periódico");
  /**
   * Vazio = a preencher pelo medico. Nao ha valor inicial: a coluna nascia com
   * DEFAULT APTO e o ASO saia afirmando aptidao que ninguem tinha concluido.
   */
  const [aptidao, setAptidao] = useState<AptidaoAso | "">("");
  const [aptoAltura, setAptoAltura] = useState<AptidaoAtividade | "">("");
  const [aptoEspacoConfinado, setAptoEspacoConfinado] = useState<AptidaoAtividade | "">("");
  const [aptoMaquinas, setAptoMaquinas] = useState<AptidaoAtividade | "">("");
  const [riscosMarcados, setRiscosMarcados] = useState<string[]>([]);
  const [semRiscoEspecifico, setSemRiscoEspecifico] = useState(false);
  const [unidade, setUnidade] = useState("");
  const [novaFuncao, setNovaFuncao] = useState("");
  const [dataExameClinico, setDataExameClinico] = useState("");
  const [validade, setValidade] = useState("");
  const [medicoResponsavel, setMedicoResponsavel] = useState("");
  const [crmMedico, setCrmMedico] = useState("");
  const [descricaoRestricao, setDescricaoRestricao] = useState("");
  const [dataInicioRestricao, setDataInicioRestricao] = useState("");
  const [dataTerminoRestricao, setDataTerminoRestricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<StatusAso>("ATIVO");
  const [descricaoRiscos, setDescricaoRiscos] = useState("");
  const [medicoCoordenador, setMedicoCoordenador] = useState("");
  const [crmCoordenador, setCrmCoordenador] = useState("");
  // Exames que compõem este ASO. A norma pede a indicação e a data de todos.
  const [exameIds, setExameIds] = useState<string[]>([]);

  useEffect(() => {
    if (aso) {
      setColaboradorId(aso.colaborador_id || "");
      setExameId(aso.exame_id || "none");
      setPcmsoId(aso.pcmso_id || "none");
      setNumeroDocumento(aso.numero_documento || "");
      setDataEmissao(aso.data_emissao ? aso.data_emissao.split("T")[0] : "");
      setTipo(aso.tipo || "Periódico");
      setAptidao(aso.aptidao || "");
      setAptoAltura(aso.apto_altura || "");
      setAptoEspacoConfinado(aso.apto_espaco_confinado || "");
      setAptoMaquinas(aso.apto_maquinas || "");
      setRiscosMarcados(aso.riscos_marcados ?? []);
      setSemRiscoEspecifico(!!aso.sem_risco_especifico);
      setUnidade(aso.unidade || "");
      setNovaFuncao(aso.nova_funcao || "");
      setDataExameClinico(aso.data_exame_clinico ? aso.data_exame_clinico.split("T")[0] : "");
      setValidade(aso.validade ? aso.validade.split("T")[0] : "");
      setMedicoResponsavel(aso.medico_responsavel || "");
      setCrmMedico(aso.crm_medico || "");
      setDescricaoRiscos(aso.descricao_riscos || "");
      setMedicoCoordenador(aso.medico_coordenador || "");
      setCrmCoordenador(aso.crm_coordenador || "");
      setExameIds((aso.exames ?? []).map((v) => v.exame_id));
      setDescricaoRestricao(aso.descricao_restricao || "");
      setDataInicioRestricao(aso.data_inicio_restricao ? aso.data_inicio_restricao.split("T")[0] : "");
      setDataTerminoRestricao(aso.data_termino_restricao ? aso.data_termino_restricao.split("T")[0] : "");
      setObservacoes(aso.observacoes || "");
      setStatus(aso.status || "ATIVO");
    } else {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextYearStr = format(addYears(new Date(), 1), "yyyy-MM-dd");

      setColaboradorId("");
      setExameId(initialExameId || "none");
      setPcmsoId("none");
      setNumeroDocumento("");
      setDataEmissao(todayStr);
      setTipo("Periódico");
      setAptidao("");
      setAptoAltura("");
      setAptoEspacoConfinado("");
      setAptoMaquinas("");
      setRiscosMarcados([]);
      setSemRiscoEspecifico(false);
      setUnidade("");
      setNovaFuncao("");
      setDataExameClinico("");
      setValidade(nextYearStr);
      setMedicoResponsavel("");
      setCrmMedico("");
      setDescricaoRestricao("");
      setDataInicioRestricao("");
      setDataTerminoRestricao("");
      setObservacoes("");
      setStatus("ATIVO");
      setDescricaoRiscos("");
      setMedicoCoordenador("");
      setCrmCoordenador("");
      setExameIds([]);

      if (initialExameId) {
        const foundExame = exames.find((e) => e.id === initialExameId);
        if (foundExame) {
          setColaboradorId(foundExame.colaborador_id);
          setPcmsoId(foundExame.pcmso_id || "none");
          setTipo(foundExame.tipo);
          // Quem chegou aqui a partir de um exame já quer esse exame no ASO.
          setExameIds([initialExameId]);
        }
      }
    }
  }, [aso, initialExameId, open]);

  // Handle auto-calculating 1 year validade upon emissions date change
  const handleEmissaoChange = (valStr: string) => {
    setDataEmissao(valStr);
    try {
      if (valStr) {
        const d = new Date(valStr);
        setValidade(format(addYears(d, 1), "yyyy-MM-dd"));
      }
    } catch {}
  };

  const isReadOnly = aso?.status === "SUBSTITUIDO" || aso?.status === "CANCELADO";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !dataEmissao || !validade) return;

    await onSave({
      colaborador_id: colaboradorId,
      exame_id: exameId === "none" ? null : exameId,
      pcmso_id: pcmsoId === "none" ? null : pcmsoId,
      numero_documento: numeroDocumento.trim() || null,
      data_emissao: dataEmissao,
      tipo,
      // Vazio vira NULL: o banco deixou de ter DEFAULT, e o PDF sai com as caixas
      // em branco para o medico preencher e assinar.
      aptidao: aptidao || null,
      apto_altura: aptoAltura || null,
      apto_espaco_confinado: aptoEspacoConfinado || null,
      apto_maquinas: aptoMaquinas || null,
      riscos_marcados: semRiscoEspecifico ? [] : riscosMarcados,
      sem_risco_especifico: semRiscoEspecifico,
      unidade: unidade.trim() || null,
      nova_funcao: novaFuncao.trim() || null,
      data_exame_clinico: dataExameClinico || null,
      validade,
      medico_responsavel: medicoResponsavel.trim() || null,
      crm_medico: crmMedico.trim() || null,
      descricao_restricao: aptidao === "APTO_COM_RESTRICAO" ? descricaoRestricao.trim() || null : null,
      data_inicio_restricao: aptidao === "APTO_COM_RESTRICAO" ? dataInicioRestricao || null : null,
      data_termino_restricao: aptidao === "APTO_COM_RESTRICAO" ? dataTerminoRestricao || null : null,
      observacoes: observacoes.trim() || null,
      status,
      descricao_riscos: descricaoRiscos.trim() || null,
      medico_coordenador: medicoCoordenador.trim() || null,
      crm_coordenador: crmCoordenador.trim() || null,
      exameIds,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            {aso ? "Editar ASO (Atestado de Saúde Ocupacional)" : "Emitir Novo ASO (Atestado de Saúde Ocupacional)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Este ASO está {aso?.status} e não permite alterações operacionais.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="colab">Colaborador / Trabalhador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId} disabled={isReadOnly}>
              <SelectTrigger id="colab">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNome} (CPF: {c.cpf || "—"}) — {c.funcao || "Sem função"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc">Número / Doc. ASO</Label>
              <Input
                id="doc"
                placeholder="Ex: ASO-2026-889"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Exame *</Label>
              <Select value={tipo} onValueChange={(val: TipoExameOcupacional) => setTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admissional">Admissional</SelectItem>
                  <SelectItem value="Periódico">Periódico</SelectItem>
                  <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                  <SelectItem value="Mudança de Risco/Função">Mudança de Risco/Função</SelectItem>
                  <SelectItem value="Demissional">Demissional</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aptidao">Conclusão de aptidão</Label>
              {/*
                Sem asterisco, e o vazio é uma opção com nome próprio. A conclusão
                é a única afirmação do ASO que só um médico pode fazer, e a coluna
                nascia com DEFAULT APTO — o documento saía atestando aptidão que
                ninguém tinha concluído.
              */}
              <Select
                value={aptidao || "PENDENTE"}
                onValueChange={(val) => setAptidao(val === "PENDENTE" ? "" : (val as AptidaoAso))}
                disabled={isReadOnly}
              >
                <SelectTrigger id="aptidao" className="font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE" className="text-muted-foreground">
                    A preencher pelo médico
                  </SelectItem>
                  <SelectItem value="APTO" className="text-emerald-700 font-bold">APTO</SelectItem>
                  <SelectItem value="APTO_COM_RESTRICAO" className="text-amber-700 font-bold">APTO COM RESTRIÇÃO</SelectItem>
                  <SelectItem value="INAPTO" className="text-red-700 font-bold">INAPTO</SelectItem>
                </SelectContent>
              </Select>
              {!aptidao && (
                <p className="text-[11px] text-muted-foreground">
                  O PDF sai com as caixas em branco, para o médico examinador marcar
                  e assinar.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Matriz, filial, obra..."
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novaFuncao">
                Nova função
                {tipo === "Mudança de Risco/Função" && " *"}
              </Label>
              {/* Só o exame de mudança precisa dela: sem isso, o ASO de mudança
                  não diz para QUAL função o trabalhador está apto. */}
              <Input
                id="novaFuncao"
                value={novaFuncao}
                onChange={(e) => setNovaFuncao(e.target.value)}
                placeholder={tipo === "Mudança de Risco/Função" ? "Função de destino" : "N/A"}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataExameClinico">Data do exame clínico</Label>
              <Input
                id="dataExameClinico"
                type="date"
                value={dataExameClinico}
                onChange={(e) => setDataExameClinico(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/*
            Aptidão por atividade. Três estados, e a distinção entre dois deles é o
            que evita erro dos dois lados: "não se aplica" não é "inapto", e campo
            em branco não é liberação.
          */}
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              E também foi considerado
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["ALTURA", aptoAltura, setAptoAltura],
                  ["ESPACO_CONFINADO", aptoEspacoConfinado, setAptoEspacoConfinado],
                  ["MAQUINAS", aptoMaquinas, setAptoMaquinas],
                ] as const
              ).map(([chave, valor, definir]) => (
                <div key={chave} className="space-y-1.5">
                  <Label className="text-xs">{ATIVIDADE_ESPECIFICA_CURTO[chave]}</Label>
                  <Select
                    value={valor || "PENDENTE"}
                    onValueChange={(v) =>
                      definir(v === "PENDENTE" ? "" : (v as AptidaoAtividade))
                    }
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE" className="text-muted-foreground">
                        Não avaliado
                      </SelectItem>
                      {(["APTO", "INAPTO", "NAO_SE_APLICA"] as const).map((op) => (
                        <SelectItem key={op} value={op}>
                          {APTIDAO_ATIVIDADE_LABEL[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              "Não avaliado" e "não se aplica" não autorizam a atividade. A PT de
              altura e a de espaço confinado consultam estes campos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataEmissao">Data de Emissão *</Label>
              <Input
                id="dataEmissao"
                type="date"
                value={dataEmissao}
                onChange={(e) => handleEmissaoChange(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade do ASO *</Label>
              <Input
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Seção Condicional de Restrições Ocupacionais */}
          {aptidao === "APTO_COM_RESTRICAO" && (
            <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-md space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                <AlertTriangle className="h-4 w-4" /> Detalhamento da Restrição Ocupacional
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descRestricao">Descrição da Restrição *</Label>
                <Input
                  id="descRestricao"
                  placeholder="Ex: Não realizar trabalho em altura acima de 2 metros por 90 dias"
                  value={descricaoRestricao}
                  onChange={(e) => setDescricaoRestricao(e.target.value)}
                  required={aptidao === "APTO_COM_RESTRICAO"}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="iniRest">Início da Restrição</Label>
                  <Input
                    id="iniRest"
                    type="date"
                    value={dataInicioRestricao}
                    onChange={(e) => setDataInicioRestricao(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fimRest">Término da Restrição</Label>
                  <Input
                    id="fimRest"
                    type="date"
                    value={dataTerminoRestricao}
                    onChange={(e) => setDataTerminoRestricao(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medico">Médico Examinador / Emitente</Label>
              <Input
                id="medico"
                placeholder="Ex: Dr. Roberto Guimarães"
                value={medicoResponsavel}
                onChange={(e) => setMedicoResponsavel(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm">CRM do Médico</Label>
              <Input
                id="crm"
                placeholder="Ex: CRM-SP 123456"
                value={crmMedico}
                onChange={(e) => setCrmMedico(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pcmso">PCMSO Vinculado</Label>
              <Select value={pcmsoId} onValueChange={setPcmsoId} disabled={isReadOnly}>
                <SelectTrigger id="pcmso">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem PCMSO Vinculado --</SelectItem>
                  {pcmsoList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo || "PCMSO"}] {p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exameOrigem">Exame Ocupacional de Origem</Label>
              <Select value={exameId} onValueChange={setExameId} disabled={isReadOnly}>
                <SelectTrigger id="exameOrigem">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem Exame Direto --</SelectItem>
                  {exames.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_exame} ({e.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bloco dos campos obrigatórios que faltavam no ASO. A norma exige a
                descrição dos riscos e a identificação dos dois médicos: quem
                coordena o PCMSO e quem examinou o trabalhador. */}
            <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-3 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Campos obrigatórios do ASO · NR-07
              </p>

              {/*
                A grade substituiu o campo de texto como registro dos perigos.
                Texto livre não se conta nem se confere: "Ruído", "ruido excessivo"
                e "exposição a ruído" são o mesmo agente e três strings. O texto
                continua abaixo, como complemento.
              */}
              <div className="space-y-2">
                <Label>Perigos e fatores de risco identificados *</Label>

                <div className="space-y-2 rounded-md border bg-background p-2 max-h-64 overflow-y-auto">
                  {CATEGORIAS_RISCO_ASO.map((categoria) => (
                    <div key={categoria}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORIA_RISCO_ASO_LABEL[categoria]}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                        {agentesDaCategoria(categoria).map((agente) => (
                          <label
                            key={agente.codigo}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <Checkbox
                              checked={riscosMarcados.includes(agente.codigo)}
                              // Marcar um agente desfaz a declaração de que não há
                              // risco: as duas coisas juntas são contraditórias, e o
                              // banco recusa a gravação.
                              disabled={isReadOnly || semRiscoEspecifico}
                              onCheckedChange={(marcado) =>
                                setRiscosMarcados((atuais) =>
                                  marcado
                                    ? [...atuais, agente.codigo]
                                    : atuais.filter((c) => c !== agente.codigo)
                                )
                              }
                            />
                            {agente.nome}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox
                    checked={semRiscoEspecifico}
                    disabled={isReadOnly}
                    onCheckedChange={(marcado) => {
                      setSemRiscoEspecifico(!!marcado);
                      if (marcado) setRiscosMarcados([]);
                    }}
                  />
                  Não há risco específico para a atividade
                </label>

                <p className="text-xs text-muted-foreground">
                  A NR-07 pede os perigos <strong>ou a sua inexistência</strong>. Deixar
                  tudo em branco não equivale a dizer que não há risco — é campo não
                  preenchido, e sai marcado como tal no ASO.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descRiscos">Complemento em texto</Label>
                <Textarea
                  id="descRiscos"
                  rows={2}
                  placeholder="O que a lista acima não cobre, e a classificação vinda do inventário de riscos do PGR."
                  value={descricaoRiscos}
                  onChange={(e) => setDescricaoRiscos(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="medCoord">Médico coordenador do PCMSO</Label>
                  <Input
                    id="medCoord"
                    placeholder="Nome do coordenador"
                    value={medicoCoordenador}
                    onChange={(e) => setMedicoCoordenador(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crmCoord">CRM do coordenador</Label>
                  <Input
                    id="crmCoord"
                    placeholder="CRM-UF 000000"
                    value={crmCoordenador}
                    onChange={(e) => setCrmCoordenador(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O coordenador do programa e o examinador podem ser pessoas diferentes —
                o examinador é o campo "Médico Examinador / Emitente" acima.
              </p>

              <div className="space-y-1.5">
                <Label>Exames que compõem este ASO</Label>
                {exames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum exame cadastrado ainda. Registre os exames na aba Exames antes
                    de emitir o ASO.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded border bg-background divide-y">
                    {exames.map((e) => {
                      const marcado = exameIds.includes(e.id);
                      return (
                        <label
                          key={e.id}
                          className="flex items-start gap-2 p-2 text-xs cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={marcado}
                            disabled={isReadOnly}
                            onCheckedChange={(v) =>
                              setExameIds((atual) =>
                                v === true
                                  ? [...atual, e.id]
                                  : atual.filter((x) => x !== e.id)
                              )
                            }
                            aria-label={`Incluir ${e.nome_exame} neste ASO`}
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{e.nome_exame}</span>
                            <span className="text-muted-foreground">
                              {" "}· {e.tipo}
                              {e.data_realizacao ? ` · ${e.data_realizacao}` : " · sem data"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {exameIds.length === 0
                    ? "Nenhum exame selecionado — o ASO sairá sem a indicação dos exames realizados."
                    : `${exameIds.length} exame(s) selecionado(s). Todos passarão a "Realizado" na emissão.`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações Gerais</Label>
            <Textarea
              id="obs"
              placeholder="Notas gerais sobre o ASO..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isReadOnly || !colaboradorId || !dataEmissao || !validade}>
              {isLoading ? "Salvando..." : aso ? "Atualizar ASO" : "Emitir ASO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
