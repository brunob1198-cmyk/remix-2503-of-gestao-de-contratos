import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistModelo, TipoRespostaChecklist } from "@/hooks/checklists/useChecklists";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Layers, HelpCircle, CheckSquare, Settings2, FolderCheck, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ChecklistModeloFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeloToEdit?: ChecklistModelo | null;
  onSave: (data: any) => Promise<void>;
}

interface SecaoDraft {
  titulo: string;
  ordem: number;
  itens: Array<{
    titulo: string;
    descricao?: string;
    tipo_resposta: TipoRespostaChecklist;
    opcoes_selecao?: string[];
    obrigatorio: boolean;
    ordem: number;
    exigir_comentario_nao_conforme: boolean;
    exigir_foto_nao_conforme: boolean;
    gerar_plano_acao_nao_conforme: boolean;
    peso_pontuacao: number;
    critico: boolean;
  }>;
}

export function ChecklistModeloFormDialog({
  open,
  onOpenChange,
  modeloToEdit,
  onSave,
}: ChecklistModeloFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Segurança do Trabalho");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [periodicidade, setPeriodicidade] = useState("Diario");
  const [projetoId, setProjetoId] = useState("");
  const [areaId, setAreaId] = useState("");

  // Estados de Geolocalização (PROMPT 020)
  const [exigirGeolocalizacao, setExigirGeolocalizacao] = useState<"nao" | "iniciar" | "finalizar" | "ambos">("nao");
  const [latitudeAlvo, setLatitudeAlvo] = useState<string>("");
  const [longitudeAlvo, setLongitudeAlvo] = useState<string>("");
  const [raioPermitidoMetros, setRaioPermitidoMetros] = useState<number>(200);
  const [bloquearForaRaio, setBloquearForaRaio] = useState<boolean>(false);

  const [secoes, setSecoes] = useState<SecaoDraft[]>([
    {
      titulo: "1. Inspeção Geral de Segurança",
      ordem: 1,
      itens: [
        {
          titulo: "Área de trabalho limpa, organizada e desobstruída?",
          descricao: "Verificar se há entulhos ou ferramentas espalhadas pelo piso.",
          tipo_resposta: "Conforme_NaoConforme_NA",
          obrigatorio: true,
          ordem: 1,
          exigir_comentario_nao_conforme: true,
          exigir_foto_nao_conforme: true,
          gerar_plano_acao_nao_conforme: true,
          peso_pontuacao: 1.0,
          critico: false,
        },
      ],
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Projetos & Areas
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_select_chk", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos" as any).select("id, codigo, nome").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas_select_chk", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("areas" as any).select("id, nome").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (modeloToEdit) {
      setNome(modeloToEdit.nome || "");
      setCategoria(modeloToEdit.categoria || "Segurança do Trabalho");
      setCodigo(modeloToEdit.codigo || "");
      setDescricao(modeloToEdit.descricao || "");
      setPeriodicidade(modeloToEdit.periodicidade_sugerida || "Diario");
      setProjetoId(modeloToEdit.projeto_id || "");
      setAreaId(modeloToEdit.area_id || "");
      setExigirGeolocalizacao((modeloToEdit.exigir_geolocalizacao as any) || "nao");
      setLatitudeAlvo(modeloToEdit.latitude_alvo ? String(modeloToEdit.latitude_alvo) : "");
      setLongitudeAlvo(modeloToEdit.longitude_alvo ? String(modeloToEdit.longitude_alvo) : "");
      setRaioPermitidoMetros(modeloToEdit.raio_permitido_metros || 200);
      setBloquearForaRaio(!!modeloToEdit.bloquear_fora_raio);

      if (modeloToEdit.secoes && modeloToEdit.secoes.length > 0) {
        setSecoes(
          modeloToEdit.secoes.map((s) => ({
            titulo: s.titulo,
            ordem: s.ordem,
            itens: (s.itens || []).map((i) => ({
              titulo: i.titulo,
              descricao: i.descricao || "",
              tipo_resposta: i.tipo_resposta,
              opcoes_selecao: i.opcoes_selecao || [],
              obrigatorio: i.obrigatorio,
              ordem: i.ordem,
              exigir_comentario_nao_conforme: i.exigir_comentario_nao_conforme,
              exigir_foto_nao_conforme: i.exigir_foto_nao_conforme,
              gerar_plano_acao_nao_conforme: i.gerar_plano_acao_nao_conforme,
              peso_pontuacao: i.peso_pontuacao,
              critico: !!i.critico,
            })),
          }))
        );
      }
    } else {
      setNome("");
      setCategoria("Segurança do Trabalho");
      // Em branco de propósito: o banco numera sequencialmente por empresa e ano.
      // Sugerir um código sorteado aqui anularia essa numeração.
      setCodigo("");
      setDescricao("");
      setPeriodicidade("Diario");
      setProjetoId("");
      setAreaId("");
      setExigirGeolocalizacao("nao");
      setLatitudeAlvo("");
      setLongitudeAlvo("");
      setRaioPermitidoMetros(200);
      setBloquearForaRaio(false);
      setSecoes([
        {
          titulo: "1. Inspeção Geral de Segurança",
          ordem: 1,
          itens: [
            {
              titulo: "Área de trabalho limpa, organizada e desobstruída?",
              descricao: "Verificar se há entulhos ou ferramentas espalhadas pelo piso.",
              tipo_resposta: "Conforme_NaoConforme_NA",
              obrigatorio: true,
              ordem: 1,
              exigir_comentario_nao_conforme: true,
              exigir_foto_nao_conforme: true,
              gerar_plano_acao_nao_conforme: true,
              peso_pontuacao: 1.0,
              critico: false,
            },
          ],
        },
      ]);
    }
  }, [modeloToEdit, open]);

  const handleAddSecao = () => {
    setSecoes([
      ...secoes,
      {
        titulo: `${secoes.length + 1}. Nova Seção`,
        ordem: secoes.length + 1,
        itens: [
          {
            titulo: "Novo Item de Verificação",
            tipo_resposta: "Conforme_NaoConforme_NA",
            obrigatorio: true,
            ordem: 1,
            exigir_comentario_nao_conforme: true,
            exigir_foto_nao_conforme: true,
            gerar_plano_acao_nao_conforme: true,
            peso_pontuacao: 1.0,
            critico: false,
          },
        ],
      },
    ]);
  };

  const handleRemoveSecao = (sIdx: number) => {
    setSecoes(secoes.filter((_, idx) => idx !== sIdx));
  };

  const handleAddItem = (sIdx: number) => {
    const updatedSecoes = [...secoes];
    updatedSecoes[sIdx].itens.push({
      titulo: "Novo Item de Verificação",
      tipo_resposta: "Conforme_NaoConforme_NA",
      obrigatorio: true,
      ordem: updatedSecoes[sIdx].itens.length + 1,
      exigir_comentario_nao_conforme: true,
      exigir_foto_nao_conforme: true,
      gerar_plano_acao_nao_conforme: true,
      peso_pontuacao: 1.0,
          critico: false,
    });
    setSecoes(updatedSecoes);
  };

  const handleRemoveItem = (sIdx: number, iIdx: number) => {
    const updatedSecoes = [...secoes];
    updatedSecoes[sIdx].itens = updatedSecoes[sIdx].itens.filter((_, idx) => idx !== iIdx);
    setSecoes(updatedSecoes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Preencha o nome do modelo de checklist.");
      return;
    }
    if (secoes.length === 0) {
      toast.error("Adicione ao menos uma seção ao checklist.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        nome: nome.trim(),
        categoria,
        // Vazio deixa o banco numerar sequencialmente. O sorteio de quatro dígitos
        // que estava aqui não tinha unicidade e colidia com o índice único.
        codigo: codigo.trim() || null,
        descricao: descricao.trim() || null,
        periodicidade_sugerida: periodicidade,
        projeto_id: projetoId && projetoId !== "todas" && projetoId !== "todos" ? projetoId : null,
        area_id: areaId && areaId !== "todas" && areaId !== "todos" ? areaId : null,
        exigir_geolocalizacao: exigirGeolocalizacao,
        latitude_alvo: latitudeAlvo ? parseFloat(latitudeAlvo) : null,
        longitude_alvo: longitudeAlvo ? parseFloat(longitudeAlvo) : null,
        raio_permitido_metros: raioPermitidoMetros || 200,
        bloquear_fora_raio: bloquearForaRaio,
        secoes,
      });
      onOpenChange(false);
    } catch (err) {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FolderCheck className="h-5 w-5 text-primary" />
            {modeloToEdit ? "Editar Modelo de Checklist" : "Construtor de Modelo de Checklist Inteligente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded border">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Nome do Modelo *</Label>
              <Input
                placeholder="Ex: Checklist Diário de Trabalho em Altura (NR-35)"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Código</Label>
              <Input
                placeholder="CHK-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Categoria Processual</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Segurança do Trabalho">Segurança do Trabalho (SST)</SelectItem>
                  <SelectItem value="Inspeção de Obra">Inspeção de Obra</SelectItem>
                  <SelectItem value="Veículos e Frotas">Veículos e Frotas</SelectItem>
                  <SelectItem value="Ferramentas e Equipamentos">Ferramentas e Equipamentos</SelectItem>
                  <SelectItem value="Máquinas e Motores">Máquinas e Motores</SelectItem>
                  <SelectItem value="Almoxarifado e Estoque">Almoxarifado e Estoque</SelectItem>
                  <SelectItem value="EPI e Proteção">EPI e Proteção</SelectItem>
                  <SelectItem value="Meio Ambiente">Meio Ambiente (SGA)</SelectItem>
                  <SelectItem value="Qualidade">Qualidade (SGQ)</SelectItem>
                  <SelectItem value="Manutenção Preventiva">Manutenção Preventiva</SelectItem>
                  <SelectItem value="Andaimes e Escadas">Andaimes e Escadas</SelectItem>
                  <SelectItem value="DDS e Diálogo de Segurança">DDS e Diálogo de Segurança</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Periodicidade Sugerida</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diario">Diário</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="Mensal">Mensal</SelectItem>
                  <SelectItem value="Por Evento">Por Evento / Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Obra / Projeto Alvo</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Todas as obras (Geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Obras / Geral</SelectItem>
                  {projetos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-3">
              <Label className="text-xs font-semibold">Descrição / Instruções aos Aplicadores</Label>
              <Input
                placeholder="Instruções gerais de preenchimento para os fiscais e técnicos..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* SEÇÃO CONFIGURAÇÃO GEOLOCALIZAÇÃO & RAIO */}
            <div className="sm:col-span-3 p-3 bg-white border border-slate-200 rounded-lg space-y-3">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" /> Configuração de Regras de Geolocalização (GPS)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Exigir Geolocalização</Label>
                  <Select value={exigirGeolocalizacao} onValueChange={(v: any) => setExigirGeolocalizacao(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não (Opcional)</SelectItem>
                      <SelectItem value="iniciar">Sim, ao Iniciar</SelectItem>
                      <SelectItem value="finalizar">Sim, ao Finalizar</SelectItem>
                      <SelectItem value="ambos">Sim, ao Iniciar e Finalizar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Latitude Alvo (Alocação)</Label>
                  <Input
                    placeholder="-23.550520"
                    value={latitudeAlvo}
                    onChange={(e) => setLatitudeAlvo(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Longitude Alvo (Alocação)</Label>
                  <Input
                    placeholder="-46.633308"
                    value={longitudeAlvo}
                    onChange={(e) => setLongitudeAlvo(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Raio Permitido (Metros)</Label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={raioPermitidoMetros}
                    onChange={(e) => setRaioPermitidoMetros(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center space-x-2 pt-4">
                  <input
                    type="checkbox"
                    id="chk_bloq_raio"
                    checked={bloquearForaRaio}
                    onChange={(e) => setBloquearForaRaio(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="chk_bloq_raio" className="text-xs font-semibold cursor-pointer text-slate-800">
                    Bloquear preenchimento se o usuário estiver fora da área permitida
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Builder Sections & Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Seções e Itens do Checklist
              </h3>
              <Button type="button" size="sm" onClick={handleAddSecao} variant="outline" className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Adicionar Seção
              </Button>
            </div>

            {secoes.map((secao, sIdx) => (
              <Card key={sIdx} className="border-slate-300">
                <CardHeader className="py-2.5 px-4 bg-slate-100/80 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <span className="font-bold text-xs">Seção {sIdx + 1}:</span>
                    <Input
                      className="text-xs font-semibold h-8 bg-white"
                      value={secao.titulo}
                      onChange={(e) => {
                        const updated = [...secoes];
                        updated[sIdx].titulo = e.target.value;
                        setSecoes(updated);
                      }}
                      placeholder="Título da seção..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSecao(sIdx)}
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="p-3 space-y-3">
                  {secao.itens.map((item, iIdx) => (
                    <div key={iIdx} className="p-3 bg-white border rounded-lg space-y-2 shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Item {iIdx + 1} *</Label>
                          <Input
                            className="text-xs font-medium"
                            placeholder="Pergunta ou item de verificação..."
                            value={item.titulo}
                            onChange={(e) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].titulo = e.target.value;
                              setSecoes(updated);
                            }}
                            required
                          />
                        </div>

                        <div className="w-[180px] space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Tipo de Resposta</Label>
                          <Select
                            value={item.tipo_resposta}
                            onValueChange={(val: TipoRespostaChecklist) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].tipo_resposta = val;
                              setSecoes(updated);
                            }}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Conforme_NaoConforme_NA">Conforme / Não Conforme / N/A</SelectItem>
                              <SelectItem value="Conforme_NaoConforme">Conforme / Não Conforme</SelectItem>
                              <SelectItem value="Sim_Nao_NA">Sim / Não / N/A</SelectItem>
                              <SelectItem value="Sim_Nao">Sim / Não</SelectItem>
                              <SelectItem value="OK_NaoOK">OK / Não OK</SelectItem>
                              <SelectItem value="Escala">Escala (1 a 5)</SelectItem>
                              <SelectItem value="Texto">Texto Livre</SelectItem>
                              <SelectItem value="Numero">Valor Numérico</SelectItem>
                              <SelectItem value="Data">Data</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(sIdx, iIdx)}
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Item Rules Toggle */}
                      <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 text-slate-600 bg-slate-50 p-2 rounded">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.exigir_comentario_nao_conforme}
                            onChange={(e) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].exigir_comentario_nao_conforme = e.target.checked;
                              setSecoes(updated);
                            }}
                          />
                          Exigir Comentário se Não Conforme
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.exigir_foto_nao_conforme}
                            onChange={(e) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].exigir_foto_nao_conforme = e.target.checked;
                              setSecoes(updated);
                            }}
                          />
                          Exigir Foto (Cloudflare R2) se NC
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-primary">
                          <input
                            type="checkbox"
                            checked={item.gerar_plano_acao_nao_conforme}
                            onChange={(e) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].gerar_plano_acao_nao_conforme = e.target.checked;
                              setSecoes(updated);
                            }}
                          />
                          Gerar Plano de Ação 5W2H
                        </label>

                        {/* Item impeditivo. Marcar também como obrigatório é
                            deliberado: item crítico em branco deixaria o veredito
                            da aplicação indefinido. */}
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-red-700">
                          <input
                            type="checkbox"
                            checked={item.critico}
                            onChange={(e) => {
                              const updated = [...secoes];
                              updated[sIdx].itens[iIdx].critico = e.target.checked;
                              if (e.target.checked) {
                                updated[sIdx].itens[iIdx].obrigatorio = true;
                              }
                              setSecoes(updated);
                            }}
                          />
                          Item crítico (reprova o checklist)
                        </label>

                        {/* O peso já existia no banco e no tipo, e não tinha campo:
                            era gravado sempre como 1 e ignorado no cálculo. Agora
                            entra na conta do índice de conformidade. */}
                        <label className="flex items-center gap-1.5">
                          <span>Peso no índice</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            className="h-7 w-16 text-[11px]"
                            value={item.peso_pontuacao}
                            onChange={(e) => {
                              const updated = [...secoes];
                              const valor = Number(e.target.value);
                              // Peso zero tiraria o item da conta sem ninguém ter
                              // marcado "não aplicável" — desvio invisível.
                              updated[sIdx].itens[iIdx].peso_pontuacao =
                                Number.isFinite(valor) && valor > 0 ? valor : 1;
                              setSecoes(updated);
                            }}
                          />
                        </label>
                      </div>

                      <p className="text-[11px] text-muted-foreground px-2">
                        Peso maior derruba mais o índice quando o item sai não conforme.
                        Use 1 para item de rotina e valores altos para o que envolve risco
                        grave — é o que faz o percentual medir risco e não quantidade de
                        linhas.
                      </p>

                      {item.critico && (
                        <p className="text-[11px] text-red-700 px-2 font-medium">
                          Item crítico: não conformidade aqui <strong>reprova o checklist
                          inteiro</strong>, independente do percentual. Peso gradua a nota;
                          crítico veta. Ele passa a ser obrigatório, porque em branco
                          deixaria a aprovação indefinida.
                        </p>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddItem(sIdx)}
                    className="w-full text-xs gap-1 border border-dashed border-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Item à Seção {sIdx + 1}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : modeloToEdit ? "Salvar Alterações" : "Salvar Modelo de Checklist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
