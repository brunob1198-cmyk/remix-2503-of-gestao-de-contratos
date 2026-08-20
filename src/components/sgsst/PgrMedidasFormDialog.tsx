import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SgsstPgrMedidaControle,
  SgsstPgrMedidaControleInput,
  type ResultadoVerificacao,
} from "@/hooks/sgsst/useSgsstPgr";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench, ClipboardCheck, Info } from "lucide-react";

interface PgrMedidasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventarioId: string;
  medida?: SgsstPgrMedidaControle | null;
  onSave: (data: SgsstPgrMedidaControleInput) => Promise<void>;
  isLoading?: boolean;
}

export function PgrMedidasFormDialog({
  open,
  onOpenChange,
  inventarioId,
  medida,
  onSave,
  isLoading = false,
}: PgrMedidasFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI">("Engenharia");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<"pendente" | "em_andamento" | "implementado" | "cancelado">("pendente");
  const [dataImplementacao, setDataImplementacao] = useState("");
  const [observacao, setObservacao] = useState("");

  // --- NR-01 1.5.5.2: acompanhamento e afericao dos resultados ---
  const [formaAcompanhamento, setFormaAcompanhamento] = useState("");
  const [verificadorId, setVerificadorId] = useState<string>("none");
  const [dataVerificacao, setDataVerificacao] = useState("");
  const [resultadoVerificacao, setResultadoVerificacao] = useState<ResultadoVerificacao | "">("");
  const [observacaoVerificacao, setObservacaoVerificacao] = useState("");

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_medidas", empresaId],
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
    if (medida) {
      setDescricao(medida.descricao || "");
      setTipo(medida.tipo || "Engenharia");
      setResponsavelId(medida.responsavel_id || "none");
      setPrazo(medida.prazo ? medida.prazo.split("T")[0] : "");
      setStatus(medida.status || "pendente");
      setDataImplementacao(medida.data_implementacao ? medida.data_implementacao.split("T")[0] : "");
      setObservacao(medida.observacao || "");
      setFormaAcompanhamento(medida.forma_acompanhamento || "");
      setVerificadorId(medida.verificador_id || "none");
      setDataVerificacao(medida.data_verificacao ? medida.data_verificacao.split("T")[0] : "");
      setResultadoVerificacao(medida.resultado_verificacao || "");
      setObservacaoVerificacao(medida.observacao_verificacao || "");
    } else {
      setDescricao("");
      setTipo("Engenharia");
      setResponsavelId("none");
      setPrazo("");
      setStatus("pendente");
      setDataImplementacao("");
      setObservacao("");
      setFormaAcompanhamento("");
      setVerificadorId("none");
      setDataVerificacao("");
      setResultadoVerificacao("");
      setObservacaoVerificacao("");
    }
  }, [medida, open]);

  // A aferição só faz sentido depois de implantar: cobrar resultado de medida
  // que ainda não existe seria cobrança indevida.
  const podeAferir = status === "implementado";
  const afericaoPendente = podeAferir && !resultadoVerificacao;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return;

    await onSave({
      inventario_id: inventarioId,
      descricao: descricao.trim(),
      tipo,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prazo: prazo || null,
      status,
      data_implementacao: status === "implementado" ? (dataImplementacao || new Date().toISOString().split("T")[0]) : (dataImplementacao || null),
      observacao: observacao.trim() || null,
      forma_acompanhamento: formaAcompanhamento.trim() || null,
      verificador_id: verificadorId === "none" ? null : verificadorId,
      data_verificacao: dataVerificacao || null,
      resultado_verificacao: resultadoVerificacao || null,
      observacao_verificacao: observacaoVerificacao.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-500" />
            {medida ? "Editar Medida de Controle" : "Nova Medida de Controle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição da Medida de Controle *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Instalação de escoramento metálico tipo caixão na vala"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Controle (Hierarquia de Proteção) *</Label>
              <Select
                value={tipo}
                onValueChange={(val: "Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI") => setTipo(val)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eliminação">1. Eliminação do Risco</SelectItem>
                  <SelectItem value="Substituição">2. Substituição / Troca</SelectItem>
                  <SelectItem value="Engenharia">3. Controle de Engenharia (EPC)</SelectItem>
                  <SelectItem value="Administrativa">4. Sinalização / Administrativa</SelectItem>
                  <SelectItem value="EPI">5. Equipamento de Proteção Individual (EPI)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável pela Execução</Label>
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
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(val: "pendente" | "em_andamento" | "implementado" | "cancelado") => setStatus(val)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="implementado">Implementado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataImpl">Data Implementação</Label>
              <Input
                id="dataImpl"
                type="date"
                value={dataImplementacao}
                onChange={(e) => setDataImplementacao(e.target.value)}
                disabled={status !== "implementado"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observações / Evidências da Medida</Label>
            <Textarea
              id="observacao"
              placeholder="Detalhes adicionais sobre a implementação da medida..."
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {/* ===== Acompanhamento e aferição (NR-01 1.5.5.2) ===== */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold leading-none">
                  Acompanhamento e aferição
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  A NR-01 1.5.5.2 pede as duas coisas junto com a medida: como o cumprimento
                  será acompanhado, e se a medida implantada de fato reduziu o risco.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acompanhamento">Forma de acompanhamento</Label>
              <Input
                id="acompanhamento"
                placeholder="Ex: Inspeção mensal com checklist; medição semestral de ruído"
                value={formaAcompanhamento}
                onChange={(e) => setFormaAcompanhamento(e.target.value)}
              />
            </div>

            {podeAferir ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="resultadoVer">Resultado da aferição</Label>
                    <Select
                      value={resultadoVerificacao || "nao_aferida"}
                      onValueChange={(v) =>
                        setResultadoVerificacao(
                          v === "nao_aferida" ? "" : (v as ResultadoVerificacao)
                        )
                      }
                    >
                      <SelectTrigger id="resultadoVer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_aferida">Não aferida</SelectItem>
                        <SelectItem value="EFICAZ">Eficaz</SelectItem>
                        <SelectItem value="PARCIALMENTE_EFICAZ">Parcialmente eficaz</SelectItem>
                        <SelectItem value="INEFICAZ">Ineficaz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="verificador">Quem aferiu</Label>
                    <Select value={verificadorId} onValueChange={setVerificadorId}>
                      <SelectTrigger id="verificador">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {responsaveis.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dataVer">Data da aferição</Label>
                    <Input
                      id="dataVer"
                      type="date"
                      value={dataVerificacao}
                      onChange={(e) => setDataVerificacao(e.target.value)}
                    />
                  </div>
                </div>

                {afericaoPendente && (
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    Medida marcada como implementada, mas sem aferição de resultado. Implantar
                    não é o mesmo que funcionar — a norma pede a verificação.
                  </p>
                )}

                {resultadoVerificacao === "INEFICAZ" && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Medida ineficaz: o risco continua. Registre no plano uma nova medida em vez
                    de deixar este item como resolvido.
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="obsVer">Observação da aferição</Label>
                  <Textarea
                    id="obsVer"
                    rows={2}
                    placeholder="O que foi verificado e como se concluiu o resultado..."
                    value={observacaoVerificacao}
                    onChange={(e) => setObservacaoVerificacao(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  A aferição de resultado aparece quando a medida for marcada como
                  <strong> implementada</strong>. Não faz sentido aferir o efeito de algo que
                  ainda não foi implantado.
                </span>
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !descricao.trim()}>
              {isLoading ? "Salvando..." : medida ? "Atualizar Medida" : "Salvar Medida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
