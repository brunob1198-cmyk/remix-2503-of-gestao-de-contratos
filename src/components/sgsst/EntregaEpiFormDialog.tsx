import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstEpiEntregaInput, MotivoEntregaEpi, useSgsstEpis } from "@/hooks/sgsst/useSgsstEpis";
import { impedimentoDaEntrega, tetoDaEntrega } from "@/utils/movimentacaoDeEpi";
import { CapturaFotoCampo, type FotoCapturada } from "@/components/comum/CapturaFotoCampo";
import { payloadDaEvidencia, avisoDeFotoNaoEnviada } from "@/utils/evidenciaDaFoto";
import { useSgsstEvidencias } from "@/hooks/sgsst/useSgsstEvidencias";
import { uploadImage } from "@/services/uploadImage";
import { toast } from "sonner";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { PackageCheck, AlertTriangle, Camera, MapPin, MapPinOff, Trash2 } from "lucide-react";
import { resumoDosTamanhos, tamanhoSugerido } from "@/utils/tamanhoDoEpi";
import { Checkbox } from "@/components/ui/checkbox";

interface EntregaEpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Devolve a entrega criada. As fotos so podem ser ligadas DEPOIS que a linha
   * existe -- o `entidade_id` da evidencia e o id dela.
   */
  onSave: (data: SgsstEpiEntregaInput) => Promise<{ id: string } | void>;
  isLoading?: boolean;
}

export function EntregaEpiFormDialog({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
}: EntregaEpiFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { epis } = useSgsstEpis();

  const [colaboradorId, setColaboradorId] = useState("");
  const [epiId, setEpiId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [dataEntrega, setDataEntrega] = useState("");
  const [motivo, setMotivo] = useState<MotivoEntregaEpi>("PRIMEIRA_ENTREGA");
  const [tamanhoModelo, setTamanhoModelo] = useState("");
  const [observacao, setObservacao] = useState("");
  // NR-06 6.6.1 "d": orientar o trabalhador sobre uso, guarda e conservacao. O
  // padrao e falso de proposito — marcar por padrao transformaria a exigencia da
  // norma em texto decorativo que ninguem le.
  const [orientacaoUso, setOrientacaoUso] = useState(false);
  // Digitou algo? Entao a sugestao automatica para de mexer no campo.
  const [tamanhoTocado, setTamanhoTocado] = useState(false);

  useEffect(() => {
    setColaboradorId("");
    setEpiId("");
    setQuantidade(1);
    setDataEntrega(new Date().toISOString().split("T")[0]);
    setMotivo("PRIMEIRA_ENTREGA");
    setTamanhoModelo("");
    setObservacao("");
    setOrientacaoUso(false);
    setTamanhoTocado(false);
  }, [open]);

  const selectedEpi = epis.find((e) => e.id === epiId);
  /*
    O que impede a entrega, em uma frase. Antes so o CA vencido era tratado
    aqui; estoque zerado passava direto e o campo de quantidade ainda oferecia
    teto cem, porque `estoque_atual || 100` le zero como ausencia.
  */
  const impedimento = impedimentoDaEntrega(selectedEpi);

  const selectedColaborador = colaboradores.find((c) => c.id === colaboradorId);
  const tamanhosCadastrados = resumoDosTamanhos(selectedColaborador?.tamanhos);

  /**
   * Trocar o EPI destrava a sugestão.
   *
   * Sem isto, quem digitasse "42" para uma bota e depois trocasse o equipamento
   * por um capacete levaria o 42 junto — um tamanho que não é de ninguém, preso
   * ao registro por ter sido digitado antes da troca.
   */
  useEffect(() => {
    setTamanhoTocado(false);
  }, [epiId]);

  /**
   * Sugere o tamanho só onde o mapeamento é seguro — calçado, para EPI de pé.
   * Não sobrescreve o que a pessoa digitou: `tamanhoTocado` trava a sugestão.
   */
  useEffect(() => {
    if (tamanhoTocado) return;
    const sugerido = tamanhoSugerido(selectedEpi?.categoria, selectedColaborador?.tamanhos);
    setTamanhoModelo(sugerido ?? "");
  }, [tamanhoTocado, selectedEpi?.categoria, selectedColaborador?.tamanhos]);

  /*
    Fotos escolhidas antes de a entrega existir.

    Ficam aqui em memoria e sobem depois da gravacao, porque a evidencia
    precisa do id da entrega. O botao de camera na linha do registro continua
    valendo para acrescentar depois; isto cobre o momento em que a foto
    interessa -- a entrega do equipamento, com ele na mao.
  */
  /*
    Só a mutation interessa aqui: a consulta de evidências existentes fica
    desligada porque, no momento em que este formulário está aberto, a entrega
    ainda não existe e não há `entidade_id` a consultar.
  */
  const { adicionar: adicionarEvidencia } = useSgsstEvidencias("EPI_ENTREGA", undefined, {
    enabled: false,
  });

  const [fotos, setFotos] = useState<FotoCapturada[]>([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !epiId || impedimento) return;

    const criada = await onSave({
      colaborador_id: colaboradorId,
      epi_id: epiId,
      quantidade: Number(quantidade) || 1,
      data_entrega: dataEntrega || new Date().toISOString().split("T")[0],
      motivo,
      tamanho_modelo: tamanhoModelo.trim() || null,
      confirmacao_recebimento: true,
      observacao: observacao.trim() || null,
      orientacao_uso: orientacaoUso,
    });

    const entregaId = criada && "id" in criada ? criada.id : null;

    if (fotos.length > 0 && entregaId) {
      setEnviandoFotos(true);
      let falharam = 0;

      for (const foto of fotos) {
        try {
          const url = await uploadImage(foto.arquivo);
          if (!url) throw new Error("O envio nao devolveu o endereco do arquivo.");

          await adicionarEvidencia.mutateAsync(
            payloadDaEvidencia({
              entidade: "EPI_ENTREGA",
              entidadeId: entregaId,
              foto,
              url,
            })
          );
        } catch {
          falharam += 1;
        }
      }

      setEnviandoFotos(false);

      /*
        A entrega NAO e desfeita quando a foto falha: ela moveu estoque e o
        equipamento ja esta com o trabalhador. Desfaze-la trocaria um problema
        pequeno por um grande. O aviso diz o que faltou e onde completar.
      */
      if (falharam > 0) toast.warning(avisoDeFotoNaoEnviada(falharam));
    }

    setFotos([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Registrar Entrega / Substituição de EPI ao Colaborador
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="colab">Colaborador / Trabalhador Beneficiário *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colab">
                <SelectValue placeholder="Selecione o trabalhador..." />
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

          <div className="space-y-1.5">
            <Label htmlFor="epi">Equipamento de Proteção Individual (EPI) *</Label>
            <Select value={epiId} onValueChange={setEpiId}>
              <SelectTrigger id="epi">
                <SelectValue placeholder="Selecione o EPI no catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {epis.map((e) => {
                  const isVencido = e.statusValidadeCa === "VENCIDO";
                  return (
                    <SelectItem key={e.id} value={e.id} disabled={isVencido}>
                      {e.nome} (CA: {e.ca}) — Saldo: {e.estoque_atual} {e.unidade_medida} {isVencido ? "[CA VENCIDO - BLOQUEADO]" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {impedimento && (
            <div className="bg-red-50 text-red-800 p-3 rounded border border-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{impedimento}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade *</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                max={tetoDaEntrega(selectedEpi)}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataEnt">Data da Entrega *</Label>
              <Input
                id="dataEnt"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo da Entrega *</Label>
              <Select value={motivo} onValueChange={(val: MotivoEntregaEpi) => setMotivo(val)}>
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMEIRA_ENTREGA">Primeira Entrega</SelectItem>
                  <SelectItem value="SUBSTITUICAO">Substituição Periódica</SelectItem>
                  <SelectItem value="PERDA">Extravio / Perda</SelectItem>
                  <SelectItem value="DANIFICADO">EPI Danificado</SelectItem>
                  <SelectItem value="VENCIMENTO">Validade Vencida</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tam">Tamanho / Especificação do Modelo</Label>
            <Input
              id="tam"
              placeholder="Ex: Tamanho P, M, G, Calçado N° 41"
              value={tamanhoModelo}
              onChange={(e) => {
                setTamanhoTocado(true);
                setTamanhoModelo(e.target.value);
              }}
            />
            {/*
              A ficha do trabalhador já guarda calçado, camisa e calça. Mostrar aqui
              evita digitar de memória — bota folgada torce tornozelo, e o dado
              estava no sistema o tempo todo, a duas telas de distância.
            */}
            {tamanhosCadastrados && (
              <p className="text-xs text-muted-foreground">
                Cadastrado na ficha: {tamanhosCadastrados}
              </p>
            )}
          </div>

          {/* NR-06 6.6.1 alínea "d" */}
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Checkbox
              id="orientacao"
              checked={orientacaoUso}
              onCheckedChange={(v) => setOrientacaoUso(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="orientacao" className="text-xs font-semibold cursor-pointer">
                Trabalhador orientado quanto ao uso, guarda e conservação
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Exigência da NR-06 item 6.6.1 alínea "d". A ficha de entrega mostra esta
                marcação por fornecimento — entrega sem orientação sai apontada.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações / Termo de Recebimento</Label>
            <Textarea
              id="obs"
              placeholder="Declaro ter recebido o EPI acima em perfeitas condições e orientado sobre seu uso correto (NR-6)..."
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {/*
            A captura fica no fim, depois da observacao de recebimento: a foto
            documenta o estado do EPI que acabou de ser descrito acima.
          */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Foto do EPI entregue
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Registra o estado do equipamento no momento da entrega. Cada foto entra
              com data, hora e coordenada da captura, e sai na ficha do colaborador.
            </p>

            <CapturaFotoCampo
              disabled={isLoading || enviandoFotos}
              onCapturar={(foto) => setFotos((atual) => [...atual, foto])}
            />

            {fotos.length > 0 && (
              <ul className="space-y-1">
                {fotos.map((f, i) => (
                  <li
                    key={`${f.arquivo.name}-${f.capturadaEm}-${i}`}
                    className="flex items-center justify-between gap-2 text-[11px] bg-muted/50 rounded px-2 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {f.coordenada ? (
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                      ) : (
                        <MapPinOff className="h-3 w-3 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{f.arquivo.name}</span>
                      {!f.coordenada && (
                        <span className="text-amber-700 shrink-0">sem coordenada</span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      disabled={enviandoFotos}
                      onClick={() => setFotos((atual) => atual.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || enviandoFotos || !colaboradorId || !epiId || !!impedimento}
            >
              {enviandoFotos
                ? "Enviando fotos..."
                : isLoading
                  ? "Salvando..."
                  : "Confirmar & Registrar Entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
