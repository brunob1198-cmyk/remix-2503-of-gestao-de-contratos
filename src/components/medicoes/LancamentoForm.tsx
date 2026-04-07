import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { usePersistedState } from "@/hooks/usePersistedState";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSites } from "@/hooks/useSites";
import { useItensLpu } from "@/hooks/useItensLpu";
import { useProjetos } from "@/hooks/useProjetos";
import { Plus, Upload, FileSpreadsheet, Check, X } from "lucide-react";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";

interface LancamentoFormProps {
  tipo: "producao" | "medicao" | "faturamento";
  onSubmit: (data: any) => void;
  onBulkSubmit?: (data: any[]) => void;
  isLoading?: boolean;
}

interface ParsedLancamento {
  projeto_codigo?: string;
  site_codigo?: string;
  item_lpu_codigo: string;
  quantidade: number;
  data: string;
  extra?: string;
  extra2?: string;
  observacao?: string;
  status?: string;
}

export function LancamentoForm({ tipo, onSubmit, onBulkSubmit, isLoading }: LancamentoFormProps) {
  const { projetos } = useProjetos();
  const { sites } = useSites();

  const [projetoId, setProjetoId] = usePersistedState<string>(`lancamento_${tipo}_projeto_id`, "");
  const [siteId, setSiteId] = usePersistedState<string>(`lancamento_${tipo}_site_id`, "");
  const [itemLpuId, setItemLpuId] = useState<string>("");
  const [data, setData] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [quantidade, setQuantidade] = useState<string>("");
  const [empresaExecutora, setEmpresaExecutora] = useState<string>("");
  const [numeroMedicao, setNumeroMedicao] = useState<string>("");
  const [statusMedicao, setStatusMedicao] = useState<string>("aprovado");
  const [numeroNf, setNumeroNf] = useState<string>("");
  const [numeroPo, setNumeroPo] = useState<string>("");
  const [valorFaturado, setValorFaturado] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [uf, setUf] = useState<string>("");
  const [municipio, setMunicipio] = useState<string>("");

  // Get LPU items filtered by project
  const selectedSite = sites.find(s => s.id === siteId);
  const effectiveProjetoId = projetoId || selectedSite?.projeto_id;
  
  // Get all LPU items and filter by project
  const { itensLpu: allItensLpu } = useItensLpu();
  
  // Filter LPU items: show ONLY items linked to the selected project (avoid duplicates)
  // If no project is selected, show all active items grouped by codigo (prefer project-specific)
  const itensLpu = useMemo(() => {
    if (!effectiveProjetoId) return allItensLpu.filter(i => i.ativo);
    
    // Get items for the selected project
    const projectItems = allItensLpu.filter(i => 
      i.ativo && i.projeto_id === effectiveProjetoId
    );
    
    // Get codes of project-specific items
    const projectItemCodes = new Set(projectItems.map(i => i.codigo.toLowerCase()));
    
    // Get general items that don't have a project-specific version
    const generalItems = allItensLpu.filter(i => 
      i.ativo && !i.projeto_id && !projectItemCodes.has(i.codigo.toLowerCase())
    );
    
    return [...projectItems, ...generalItems];
  }, [allItensLpu, effectiveProjetoId]);

  // Excel import state
  const [parsedItems, setParsedItems] = useState<ParsedLancamento[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("manual");

  const filteredSites = projetoId 
    ? sites.filter(s => s.projeto_id === projetoId)
    : sites;

  const selectedItem = itensLpu.find(i => i.id === itemLpuId);
  const valorCalculado = selectedItem 
    ? Number(quantidade || 0) * Number(selectedItem.preco_unitario)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseData = {
      site_id: siteId,
      item_lpu_id: itemLpuId,
      quantidade: Number(quantidade),
      observacao: observacao || undefined,
    };

    if (tipo === "producao") {
      onSubmit({
        ...baseData,
        data_producao: data,
        empresa_executora: empresaExecutora || undefined,
        uf: uf || undefined,
        municipio: municipio || undefined,
      });
    } else if (tipo === "medicao") {
      onSubmit({
        ...baseData,
        data_medicao: data,
        numero_medicao: numeroMedicao || undefined,
        status: statusMedicao,
      });
    } else {
      onSubmit({
        ...baseData,
        data_faturamento: data,
        numero_nf: numeroNf || undefined,
        numero_po: numeroPo || undefined,
        valor_faturado: valorFaturado ? Number(valorFaturado) : undefined,
      });
    }

    // Reset form
    setQuantidade("");
    setObservacao("");
    if (tipo === "producao") { setEmpresaExecutora(""); setUf(""); setMunicipio(""); }
    if (tipo === "medicao") setNumeroMedicao("");
    if (tipo === "faturamento") {
      setNumeroNf("");
      setNumeroPo("");
      setValorFaturado("");
    }
  };

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Find header row
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (row && row.some((cell: any) => 
          typeof cell === 'string' && 
          (cell.toLowerCase().includes('site') || cell.toLowerCase().includes('quantidade') || cell.toLowerCase().includes('qtd'))
        )) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = jsonData[headerRowIndex]?.map((h: any) => 
        String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      ) || [];

      const findColumnIndex = (names: string[]) => {
        return headers.findIndex((h: string) => names.some(n => h.includes(n)));
      };

      const projetoIdx = findColumnIndex(['projeto', 'cod_projeto', 'codigo_projeto']);
      const siteIdx = findColumnIndex(['site', 'codigo_site', 'cod_site']);
      // For medicao, if no site column but projeto column exists, that's fine
      const itemIdx = findColumnIndex(['item', 'codigo_lpu', 'cod_lpu', 'item_lpu', 'lpu']);
      const qtdIdx = findColumnIndex(['quantidade', 'qtd', 'qty']);
      const dataIdx = findColumnIndex(['data', 'date']);
      const extraIdx = tipo === "producao" 
        ? findColumnIndex(['empresa', 'executora']) 
        : tipo === "medicao" 
          ? findColumnIndex(['numero', 'medicao', 'num']) 
          : findColumnIndex(['nf', 'nota', 'fiscal']);
      const extra2Idx = tipo === "faturamento" ? findColumnIndex(['po', 'pedido']) : -1;
      const statusIdx = findColumnIndex(['status']);
      const obsIdx = findColumnIndex(['observacao', 'obs']);

      const items: ParsedLancamento[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const siteCodigo = siteIdx >= 0 ? String(row[siteIdx] || '').trim() : '';
        const itemCodigo = String(row[itemIdx] || '').trim();
        const qtd = parseFloat(String(row[qtdIdx] || '0').replace(',', '.')) || 0;
        const projetoCodigo = projetoIdx >= 0 ? String(row[projetoIdx] || '').trim() : undefined;

        // For medicao, allow rows without site if projeto is present
        if (tipo === "medicao") {
          if (!projetoCodigo && !siteCodigo) continue;
        } else {
          if (!siteCodigo) continue;
        }
        if (!itemCodigo || qtd === 0) continue;

        let dataStr = '';
        if (dataIdx >= 0 && row[dataIdx]) {
          if (typeof row[dataIdx] === 'number') {
            // Excel date serial number - use UTC to avoid timezone offset issues
            const excelDate = new Date(Date.UTC(1899, 11, 30 + row[dataIdx]));
            const year = excelDate.getUTCFullYear();
            const month = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(excelDate.getUTCDate()).padStart(2, '0');
            dataStr = `${year}-${month}-${day}`;
          } else {
            // Parse date string formats - detect format based on values
            const dateValue = String(row[dataIdx]).trim();
            if (dateValue.includes('/')) {
              const parts = dateValue.split('/');
              if (parts.length === 3) {
                let day: string, month: string, year: string;
                const first = parseInt(parts[0], 10);
                const second = parseInt(parts[1], 10);
                let yearPart = parts[2];
                
                // Handle 2-digit years (e.g., 25 -> 2025)
                if (yearPart.length === 2) {
                  const yearNum = parseInt(yearPart, 10);
                  yearPart = yearNum < 50 ? `20${yearPart}` : `19${yearPart}`;
                }
                
                // Detect format: if first part > 12, it's DD/MM/YYYY, otherwise MM/DD/YYYY
                if (first > 12) {
                  // DD/MM/YYYY format
                  day = parts[0].padStart(2, '0');
                  month = parts[1].padStart(2, '0');
                } else if (second > 12) {
                  // MM/DD/YYYY format (second is day > 12)
                  month = parts[0].padStart(2, '0');
                  day = parts[1].padStart(2, '0');
                } else {
                  // Ambiguous - assume Brazilian format DD/MM/YYYY
                  day = parts[0].padStart(2, '0');
                  month = parts[1].padStart(2, '0');
                }
                year = yearPart;
                dataStr = `${year}-${month}-${day}`;
              } else {
                dataStr = dateValue;
              }
            } else if (dateValue.includes('-')) {
              // Already in ISO format
              dataStr = dateValue;
            } else {
              dataStr = dateValue;
            }
          }
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          dataStr = `${year}-${month}-${day}`;
        }

        items.push({
          projeto_codigo: projetoCodigo,
          site_codigo: siteCodigo || undefined,
          item_lpu_codigo: itemCodigo,
          quantidade: qtd,
          data: dataStr,
          extra: extraIdx >= 0 ? String(row[extraIdx] || '').trim() : undefined,
          extra2: extra2Idx >= 0 ? String(row[extra2Idx] || '').trim() : undefined,
          status: statusIdx >= 0 ? String(row[statusIdx] || 'aprovado').trim().toLowerCase() : 'aprovado',
          observacao: obsIdx >= 0 ? String(row[obsIdx] || '').trim() : undefined,
        });
      }

      setParsedItems(items);
      setFileName(file.name);
    };
    reader.readAsBinaryString(file);
  }, [tipo]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      parseExcel(acceptedFiles[0]);
    }
  }, [parseExcel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleBulkImport = () => {
    if (parsedItems.length > 0 && onBulkSubmit) {
      // Map site codes and item codes to IDs
      const mappedItems = parsedItems.map(item => {
        const site = item.site_codigo 
          ? sites.find(s => s.codigo.toLowerCase() === item.site_codigo!.toLowerCase())
          : undefined;
        
        // Determine project ID: prioritize project from spreadsheet, then fall back to site's project
        let projectId = site?.projeto_id;
        if (item.projeto_codigo) {
          const projeto = projetos.find(p => p.codigo.toLowerCase() === item.projeto_codigo!.toLowerCase());
          if (projeto) {
            projectId = projeto.id;
          }
        }
        
        // Get project-specific LPU first
        let itemLpu = allItensLpu.find(i => 
          i.codigo.toLowerCase() === item.item_lpu_codigo.toLowerCase() && 
          i.projeto_id === projectId
        );
        
        if (!itemLpu && projectId) {
          const searchCode = item.item_lpu_codigo.toLowerCase();
          itemLpu = allItensLpu.find(i => 
            i.projeto_id === projectId && 
            i.descricao.toLowerCase().startsWith(searchCode + '-')
          );
        }
        
        if (!itemLpu) {
          itemLpu = allItensLpu.find(i => 
            i.codigo.toLowerCase() === item.item_lpu_codigo.toLowerCase() && 
            !i.projeto_id
          );
        }
        
        if (!itemLpu) {
          const searchCode = item.item_lpu_codigo.toLowerCase();
          itemLpu = allItensLpu.find(i => 
            !i.projeto_id && 
            i.descricao.toLowerCase().startsWith(searchCode + '-')
          );
        }
        
        // For medicao, site is optional; for others, site is required
        if (tipo === "medicao") {
          if (!itemLpu || !projectId) return null;
        } else {
          if (!site || !itemLpu) return null;
        }

        const baseData = {
          site_id: site?.id || undefined,
          item_lpu_id: itemLpu.id,
          quantidade: item.quantidade,
          observacao: item.observacao || undefined,
        };

        if (tipo === "producao") {
          return {
            ...baseData,
            data_producao: item.data,
            empresa_executora: item.extra || undefined,
          };
        } else if (tipo === "medicao") {
          return {
            ...baseData,
            data_medicao: item.data,
            numero_medicao: item.extra || undefined,
            status: item.status || 'aprovado',
          };
        } else {
          return {
            ...baseData,
            data_faturamento: item.data,
            numero_nf: item.extra || undefined,
            numero_po: item.extra2 || undefined,
          };
        }
      }).filter(Boolean);

      onBulkSubmit(mappedItems);
      setParsedItems([]);
      setFileName("");
      setActiveTab("manual");
    }
  };

  const handleCancelImport = () => {
    setParsedItems([]);
    setFileName("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getTitulo = () => {
    switch (tipo) {
      case "producao": return "Lançar Produção";
      case "medicao": return "Lançar Medição";
      case "faturamento": return "Lançar Faturamento";
    }
  };

  const getDataLabel = () => {
    switch (tipo) {
      case "producao": return "Data da Produção";
      case "medicao": return "Data da Medição";
      case "faturamento": return "Data do Faturamento";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          {getTitulo()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="manual">Lançamento Manual</TabsTrigger>
            <TabsTrigger value="excel">Importar Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setSiteId(""); setItemLpuId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo} - {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Site *</Label>
                  <Select value={siteId} onValueChange={(v) => { setSiteId(v); setItemLpuId(""); }} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o site" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.codigo} - {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{getDataLabel()} *</Label>
                  <Input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <Label>Item LPU *</Label>
                  <Select value={itemLpuId} onValueChange={setItemLpuId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o item da LPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {itensLpu.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.codigo} - {item.descricao} ({formatCurrency(Number(item.preco_unitario))}/{item.unidade})
                          {item.projeto_id && " [Específico]"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {effectiveProjetoId && (
                    <p className="text-xs text-muted-foreground">
                      Mostrando itens do projeto selecionado e itens gerais
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="0"
                    required
                  />
                  {tipo === "producao" && (
                    <p className="text-xs text-muted-foreground">
                      Use valores negativos para ajustes/correções
                    </p>
                  )}
                </div>

                {tipo === "producao" && (
                  <>
                    <UfMunicipioSelector
                      uf={uf}
                      municipio={municipio}
                      onUfChange={setUf}
                      onMunicipioChange={setMunicipio}
                    />
                    <div className="space-y-2">
                      <Label>Empresa Executora</Label>
                      <Input
                        value={empresaExecutora}
                        onChange={(e) => setEmpresaExecutora(e.target.value)}
                        placeholder="Nome da empresa"
                      />
                    </div>
                  </>
                )}

                {tipo === "medicao" && (
                  <>
                    <div className="space-y-2">
                      <Label>Número da Medição</Label>
                      <Input
                        value={numeroMedicao}
                        onChange={(e) => setNumeroMedicao(e.target.value)}
                        placeholder="Ex: MED-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={statusMedicao} onValueChange={setStatusMedicao}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="enviada">Enviada</SelectItem>
                          <SelectItem value="aprovado">Aprovada</SelectItem>
                          <SelectItem value="rejeitado">Rejeitada</SelectItem>
                          <SelectItem value="finalizado">Finalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {tipo === "faturamento" && (
                  <>
                    <div className="space-y-2">
                      <Label>Número da NF</Label>
                      <Input
                        value={numeroNf}
                        onChange={(e) => setNumeroNf(e.target.value)}
                        placeholder="Ex: 12345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número do PO</Label>
                      <Input
                        value={numeroPo}
                        onChange={(e) => setNumeroPo(e.target.value)}
                        placeholder="Ex: PO-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Faturado</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorFaturado}
                        onChange={(e) => setValorFaturado(e.target.value)}
                        placeholder={formatCurrency(valorCalculado)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Valor Calculado</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted text-lg font-semibold">
                    {formatCurrency(valorCalculado)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={isLoading || !siteId || !itemLpuId || !quantidade}>
                {isLoading ? "Salvando..." : "Lançar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="excel">
            {parsedItems.length === 0 ? (
              <div className="space-y-4">
                <CardDescription>
                  Arraste um arquivo Excel (.xlsx, .xls) ou CSV contendo os lançamentos com colunas: {tipo === "medicao" ? "Projeto" : "Site"}, Item LPU, Quantidade, Data
                  {tipo === "producao" && ", Empresa (opcional)"}
                  {tipo === "medicao" && ", Número Medição (opcional), Status (opcional)"}
                  {tipo === "faturamento" && ", Número NF (opcional), Número PO (opcional)"}
                </CardDescription>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  {isDragActive ? (
                    <p className="text-lg">Solte o arquivo aqui...</p>
                  ) : (
                    <div>
                      <p className="text-lg mb-2">Arraste e solte um arquivo Excel aqui</p>
                      <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="font-medium">{fileName}</span>
                    <span className="text-muted-foreground">({parsedItems.length} lançamentos)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelImport}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleBulkImport} disabled={isLoading}>
                      <Check className="h-4 w-4 mr-1" />
                      {isLoading ? "Importando..." : "Importar"}
                    </Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tipo === "medicao" ? "Projeto" : "Site"}</TableHead>
                        <TableHead>Item LPU</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead>Data</TableHead>
                        {tipo === "producao" && <TableHead>Empresa</TableHead>}
                        {tipo === "medicao" && <TableHead>Nº Medição</TableHead>}
                        {tipo === "medicao" && <TableHead>Status</TableHead>}
                        {tipo === "faturamento" && <TableHead>Nº NF</TableHead>}
                        {tipo === "faturamento" && <TableHead>Nº PO</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedItems.slice(0, 20).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{tipo === "medicao" ? (item.projeto_codigo || item.site_codigo || "-") : (item.site_codigo || "-")}</TableCell>
                          <TableCell>{item.item_lpu_codigo}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell>{item.data}</TableCell>
                          {tipo === "producao" && <TableCell>{item.extra || "-"}</TableCell>}
                          {tipo === "medicao" && <TableCell>{item.extra || "-"}</TableCell>}
                          {tipo === "medicao" && <TableCell>{item.status || "aprovado"}</TableCell>}
                          {tipo === "faturamento" && <TableCell>{item.extra || "-"}</TableCell>}
                          {tipo === "faturamento" && <TableCell>{item.extra2 || "-"}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedItems.length > 20 && (
                    <p className="text-center text-muted-foreground py-2 text-sm">
                      Mostrando 20 de {parsedItems.length} lançamentos
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
