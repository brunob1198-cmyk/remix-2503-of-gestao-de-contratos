import { useState, useEffect } from "react";
import { Contrato } from "@/types/medicoes";
import { parseISO, format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContratos } from "@/hooks/useContratos";
import { useClientes } from "@/hooks/useClientes";
import { useContractExtraction } from "@/hooks/useContractExtraction";
import { Loader2, UploadCloud, FileType2, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  contratoToEdit: Contrato | null;
  onClose: () => void;
  contratos: Contrato[]; // Main contracts for aditivos
}

export default function ContratosForm({ contratoToEdit, onClose, contratos }: Props) {
  const { createContrato, updateContrato } = useContratos();
  const { clientes } = useClientes();
  const { extrairContrato, isExtracting } = useContractExtraction();
  const { toast } = useToast();

  const [id, setId] = useState<string>("");
  const [contratoPaiId, setContratoPaiId] = useState<string>("none");
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [valorTotal, setValorTotal] = useState<string>("");
  const [prazoInicio, setPrazoInicio] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [escopo, setEscopo] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [garantias, setGarantias] = useState("");
  const [liberacaoGarantias, setLiberacaoGarantias] = useState("");
  const [medicoes, setMedicoes] = useState("");
  const [multas, setMultas] = useState("");
  const [reajuste, setReajuste] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [statusProcessamento, setStatusProcessamento] = useState("pendente");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (contratoToEdit) {
      setId(contratoToEdit.id);
      setContratoPaiId(contratoToEdit.contrato_pai_id || "none");
      setClienteIds(contratoToEdit.cliente_ids || []);
      setValorTotal(contratoToEdit.valor_total?.toString() || "");
      setPrazoInicio(contratoToEdit.prazo_inicio ? format(parseISO(contratoToEdit.prazo_inicio), "yyyy-MM-dd") : "");
      setPrazoFim(contratoToEdit.prazo_fim ? format(parseISO(contratoToEdit.prazo_fim), "yyyy-MM-dd") : "");
      setEscopo(contratoToEdit.escopo || "");
      setCondicoesPagamento(contratoToEdit.condicoes_pagamento || "");
      setGarantias(contratoToEdit.garantias || "");
      setLiberacaoGarantias(contratoToEdit.liberacao_garantias || "");
      setMedicoes(contratoToEdit.medicoes || "");
      setMultas(contratoToEdit.multas || "");
      setReajuste(contratoToEdit.reajuste || "");
      setObservacoes(contratoToEdit.observacoes || "");
      setArquivoUrl(contratoToEdit.arquivo_url || "");
      setStatusProcessamento(contratoToEdit.status_processamento || "concluido");
    } else {
      resetForm();
    }
  }, [contratoToEdit]);

  const resetForm = () => {
    setId("");
    setContratoPaiId("none");
    setClienteIds([]);
    setValorTotal("");
    setPrazoInicio("");
    setPrazoFim("");
    setEscopo("");
    setCondicoesPagamento("");
    setGarantias("");
    setLiberacaoGarantias("");
    setMedicoes("");
    setMultas("");
    setReajuste("");
    setObservacoes("");
    setArquivoUrl("");
    setStatusProcessamento("pendente");
    setSelectedFile(null);
  };

  const cleanCurrencyOrNumber = (val: string | null) => {
    if (!val) return "";
    // Remove all non-numeric characters except dots and commas
    let cleaned = val.replace(/[^\d.,]/g, "");
    
    // If there's both a dot and a comma, it's likely Brazilian format (e.g. 1.234,56)
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(',')) {
      // Just a comma (e.g. 1234,56)
      cleaned = cleaned.replace(",", ".");
    }
    
    return cleaned;
  };

  const handleExtrairIA = async () => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo", description: "Faça upload de um PDF ou imagem primeiro.", variant: "destructive" });
      return;
    }
    const result = await extrairContrato(selectedFile);
    if (result) {
      setValorTotal(cleanCurrencyOrNumber(result.valor_total));
      setPrazoInicio(result.prazo_inicio || "");
      setPrazoFim(result.prazo_fim || "");
      setEscopo(result.escopo || "");
      setCondicoesPagamento(result.condicoes_pagamento || "");
      setGarantias(result.garantias || "");
      setLiberacaoGarantias(result.liberacao_garantias || "");
      setMedicoes(result.medicoes || "");
      setMultas(result.multas || "");
      setReajuste(result.reajuste || "");
      setObservacoes(result.observacoes || "");
      setStatusProcessamento("concluido");
      
      // Auto-match CNPJs to Clients
      if (result.cnpjs_clientes && result.cnpjs_clientes.length > 0) {
        const foundClientIds: string[] = [];
        result.cnpjs_clientes.forEach(cnpjExtraido => {
          const digitsOnly = cnpjExtraido.replace(/[^\d]/g, "");
          const match = clientes.find(c => c.cnpj?.replace(/[^\d]/g, "") === digitsOnly);
          if (match && !foundClientIds.includes(match.id)) {
            foundClientIds.push(match.id);
          }
        });
        if (foundClientIds.length > 0) {
          setClienteIds(foundClientIds);
        }
      }
    } else {
      setStatusProcessamento("erro");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: Partial<Contrato> = {
      contrato_pai_id: contratoPaiId === "none" ? undefined : contratoPaiId,
      cliente_ids: clienteIds.length > 0 ? clienteIds : undefined,
      valor_total: valorTotal ? parseFloat(valorTotal.replace(",", ".")) : undefined,
      prazo_inicio: prazoInicio || undefined,
      prazo_fim: prazoFim || undefined,
      escopo,
      condicoes_pagamento: condicoesPagamento,
      garantias,
      liberacao_garantias: liberacaoGarantias,
      medicoes,
      multas,
      reajuste,
      observacoes,
      status_processamento: statusProcessamento,
      // arquivo_url upload to supabase storage here if implemented. Storing empty or previous for now since base64 was used.
      arquivo_url: arquivoUrl,
    };

    if (id) {
      updateContrato.mutate({ id, ...payload }, { onSuccess: onClose });
    } else {
      createContrato.mutate(payload, { onSuccess: onClose });
    }
  };

  const InputAvisoIA = ({ valor, label, objKey }: { valor: string, label: string, objKey?: string }) => {
    const isBaixaConfianca = statusProcessamento === "concluido" && !valor;
    return (
      <div className="space-y-1">
        <Label className={`text-sm ${isBaixaConfianca ? "text-yellow-600 font-semibold" : ""}`}>
          {label} {isBaixaConfianca && "⚠️ (Revisar)"}
        </Label>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 pb-12">
      <DialogHeader>
        <DialogTitle>{id ? "Editar Contrato" : "Novo Contrato ou Aditivo"}</DialogTitle>
      </DialogHeader>

      <div className="flex gap-6 h-full min-h-[500px]">
        {/* Left Col - PDF / Extractor */}
        <div className="w-1/3 flex flex-col gap-4 border-r pr-6">
          <div className={`p-4 border-2 border-dashed rounded-lg relative h-40 flex items-center justify-center flex-col gap-2 transition-colors ${selectedFile ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
            {selectedFile ? (
              <>
                <FileType2 className="h-8 w-8 text-blue-500" />
                <span className="text-sm font-medium text-center break-all px-2 text-blue-700">{selectedFile.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-1 h-6 text-[10px] text-blue-600 hover:text-blue-800 relative z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setStatusProcessamento("pendente");
                    const input = document.getElementById('contract-upload-input') as HTMLInputElement;
                    if (input) input.value = '';
                  }}
                >
                  Remover
                </Button>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <span className="text-sm text-slate-500 font-medium text-center">
                  Arraste ou clique para upar contrato<br/>
                  <span className="text-[10px] text-slate-400">(PDF, Word ou Imagem)</span>
                </span>
              </>
            )}
            <input 
              id="contract-upload-input"
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                if(e.target.files?.[0]) {
                  setSelectedFile(e.target.files[0]);
                  setStatusProcessamento("pendente");
                }
              }}
            />
          </div>
          
          <Button 
            onClick={handleExtrairIA} 
            disabled={!selectedFile || isExtracting} 
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
          >
            {isExtracting ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analisando com IA...</>
            ) : (
              <><BrainCircuit className="h-5 w-5 mr-2" /> Extrair Dados com IA</>
            )}
          </Button>

          {statusProcessamento === "concluido" && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
              ✅ Extração concluída. Revise os campos à direita.
            </div>
          )}
          {statusProcessamento === "erro" && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              ❌ Falha ao processar arquivo com a IA.
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-accent p-3 rounded-md mt-auto">
            <strong>Nota:</strong> A Inteligência Artificial tenta preencher todos os dados, verifique atentamente se os números de datas e valores estão corretos.
          </div>
        </div>

        {/* Right Col - Formulário */}
        <form id="contrato-form" onSubmit={handleSubmit} className="w-2/3 flex flex-col gap-5 overflow-y-auto pb-6 pr-2">
          
          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
             <div className="space-y-2">
                <Label className="text-sm font-bold">É um Aditivo de Contrato?</Label>
                <Select value={contratoPaiId} onValueChange={setContratoPaiId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione se for aditivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não, é um contrato principal</SelectItem>
                    {contratos.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.escopo?.slice(0,40) || c.id.slice(0,8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <p className="text-[10px] text-muted-foreground leading-tight">Os valores e vigência serão integrados na exibição do contrato pai.</p>
             </div>

             <div className="space-y-2">
                <InputAvisoIA valor={clienteIds.join(",")} label="Cliente Vinculado" />
                <Select 
                  value={clienteIds[0] || "none"} 
                  onValueChange={(val) => setClienteIds(val === "none" ? [] : [val])}
                >
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social} - {c.cnpj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <InputAvisoIA valor={valorTotal} label="Valor (R$)" />
              <Input type="number" step="0.01" placeholder="Ex: 15300.50" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={prazoInicio} label="Data Início" />
              <Input type="date" value={prazoInicio} onChange={(e) => setPrazoInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={prazoFim} label="Data Fim" />
              <Input type="date" value={prazoFim} onChange={(e) => setPrazoFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <InputAvisoIA valor={escopo} label="Resumo do Escopo / Objeto" />
            <Textarea rows={2} value={escopo} onChange={(e) => setEscopo(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <InputAvisoIA valor={condicoesPagamento} label="Condições de Pagamento" />
              <Textarea rows={2} value={condicoesPagamento} onChange={(e) => setCondicoesPagamento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={medicoes} label="Medições (Prazos/Regras)" />
              <Textarea rows={2} value={medicoes} onChange={(e) => setMedicoes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={garantias} label="Garantias Contratuais" />
              <Textarea rows={2} value={garantias} onChange={(e) => setGarantias(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={liberacaoGarantias} label="Liberação de Garantias" />
              <Textarea rows={2} value={liberacaoGarantias} onChange={(e) => setLiberacaoGarantias(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={multas} label="Multas e Penalidades" />
              <Textarea rows={2} value={multas} onChange={(e) => setMultas(e.target.value)} />
            </div>
            <div className="space-y-2">
              <InputAvisoIA valor={reajuste} label="Regra de Reajuste" />
              <Textarea rows={2} value={reajuste} onChange={(e) => setReajuste(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Observações Livres</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

        </form>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background/80 backdrop-blur flex justify-end gap-3 mt-4">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button 
          type="submit" 
          form="contrato-form" 
          disabled={createContrato.isPending || updateContrato.isPending}
        >
          {createContrato.isPending || updateContrato.isPending ? "Salvando..." : "Salvar Contrato"}
        </Button>
      </div>
    </div>
  );
}
