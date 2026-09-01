import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  buscarCep,
  cepCompleto,
  enderecoComComplemento,
  mascaraCep,
  MENSAGEM_CEP,
} from "@/utils/cep";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import {
  useSgsstClinicas,
  type SgsstClinica,
  type StatusClinica,
} from "@/hooks/sgsst/useSgsstClinicas";

/**
 * Clínicas credenciadas.
 *
 * O formulário é inline em vez de componente separado: são poucos campos e todos
 * de cadastro simples, sem regra de negócio que justifique um arquivo próprio.
 */
export function SgsstClinicasTab() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pcmso");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [filterStatus, setFilterStatus] = useState("todos");

  const { clinicas, total, isLoading, error, refetch, createClinica, updateClinica, removeClinica } =
    useSgsstClinicas({ page, pageSize, search: debouncedSearch, status: filterStatus });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<SgsstClinica | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [crm, setCrm] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  /**
   * Número e complemento ficam FORA do campo de logradouro.
   *
   * Sem essa separação, digitar o número significaria clicar no meio do texto que
   * a consulta acabou de preencher — e uma consulta nova apagaria o número junto.
   * Na gravação os dois são juntados por `enderecoComComplemento`, que insere o
   * complemento depois do logradouro e antes do bairro, como se escreve endereço.
   */
  const [enderecoComplemento, setEnderecoComplemento] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [examesRealizados, setExamesRealizados] = useState("");
  const [status, setStatus] = useState<StatusClinica>("ATIVA");

  /**
   * Consulta o CEP ao completar os oito dígitos.
   *
   * A clínica tem colunas próprias de cidade e UF, então a consulta preenche as
   * três coisas: logradouro e bairro no campo de endereço, e cidade e UF nos
   * campos delas. Jogar cidade e UF dentro da linha de endereço deixaria as
   * colunas vazias, e é por elas que a lista filtra e ordena.
   */
  const handleCepChange = async (valor: string) => {
    const mascarado = mascaraCep(valor);
    setCep(mascarado);

    if (!cepCompleto(mascarado)) return;

    setBuscandoCep(true);
    const resultado = await buscarCep(mascarado);
    setBuscandoCep(false);

    if (resultado.situacao === "OK") {
      const { logradouro, bairro, localidade, uf: ufDoCep } = resultado.endereco;
      setEndereco([logradouro, bairro].filter(Boolean).join(", "));
      setCidade(localidade);
      setUf(ufDoCep);
      toast.success(MENSAGEM_CEP.OK);
      return;
    }

    // Não apaga o que já estava escrito: o usuário pode ter digitado o endereço à
    // mão antes, e uma consulta que falhou não é motivo para perder isso.
    toast.warning(MENSAGEM_CEP[resultado.situacao]);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterStatus]);

  useEffect(() => {
    if (editando) {
      setNome(editando.nome || "");
      setCnpj(editando.cnpj || "");
      setResponsavel(editando.responsavel_tecnico || "");
      setCrm(editando.crm_responsavel || "");
      setTelefone(editando.telefone || "");
      setEmail(editando.email || "");
      setEndereco(editando.endereco || "");
      // O complemento nao tem coluna propria: ele foi gravado dentro do endereco. Ao
      // editar, o campo volta vazio de proposito — reaparecer com o texto que ja
      // esta na linha acima duplicaria o complemento na proxima gravacao.
      setCep("");
      setEnderecoComplemento("");
      setCidade(editando.cidade || "");
      setUf(editando.uf || "");
      setExamesRealizados(editando.exames_realizados || "");
      setStatus(editando.status || "ATIVA");
    } else {
      setNome("");
      setCnpj("");
      setResponsavel("");
      setCrm("");
      setTelefone("");
      setEmail("");
      setEndereco("");
      setCep("");
      setEnderecoComplemento("");
      setCidade("");
      setUf("");
      setExamesRealizados("");
      setStatus("ATIVA");
    }
  }, [editando, isFormOpen]);

  const temFiltroAtivo = searchTerm.trim().length > 0 || filterStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setFilterStatus("todos");
  };

  const abrirNova = () => {
    setEditando(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const payload = {
      nome: nome.trim(),
      cnpj: cnpj.trim() || null,
      responsavel_tecnico: responsavel.trim() || null,
      crm_responsavel: crm.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: enderecoComComplemento(endereco, enderecoComplemento) || null,
      cidade: cidade.trim() || null,
      // O banco só aceita UF com 2 letras; normalizar aqui evita erro no salvar.
      uf: uf.trim().toUpperCase().slice(0, 2) || null,
      exames_realizados: examesRealizados.trim() || null,
      observacoes: null,
      status,
    };

    if (editando) {
      await updateClinica.mutateAsync({ id: editando.id, ...payload });
    } else {
      await createClinica.mutateAsync(payload);
    }
    setIsFormOpen(false);
  };

  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: clinicas.length === 0,
    modulo: "Clínicas",
    onRetry: refetch,
    emptyTitulo: "Nenhuma clínica credenciada",
    emptyDescricao:
      "Cadastre quem realiza os exames para parar de digitar o nome à mão em cada lançamento e poder filtrar a agenda por prestador.",
    emptyAction: allowEdit ? (
      <Button size="sm" className="gap-2" onClick={abrirNova}>
        <Plus className="h-4 w-4" /> Cadastrar clínica
      </Button>
    ) : undefined,
    filtrado: temFiltroAtivo,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Clínicas credenciadas
          </h2>
          <p className="text-sm text-muted-foreground">
            Quem realiza os exames ocupacionais, com contato e endereço.
          </p>
        </div>

        {allowEdit && (
          <Button onClick={abrirNova} className="gap-2">
            <Plus className="h-4 w-4" /> Cadastrar clínica
          </Button>
        )}
      </div>

      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nome, cidade ou responsável técnico..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={
          filterStatus !== "todos"
            ? [
                {
                  label: "Status",
                  value: filterStatus === "ATIVA" ? "Ativa" : "Inativa",
                  onClear: () => setFilterStatus("todos"),
                },
              ]
            : []
        }
      >
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ATIVA">Ativa</SelectItem>
            <SelectItem value="INATIVA">Inativa</SelectItem>
          </SelectContent>
        </Select>
      </SgsstFilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clínica</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Responsável técnico</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade / UF</TableHead>
                <TableHead>Status</TableHead>
                {allowEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={allowEdit ? 7 : 6} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                clinicas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">
                      {c.nome}
                      {c.exames_realizados && (
                        <span className="block text-muted-foreground font-normal truncate max-w-[18rem]">
                          {c.exames_realizados}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{c.cnpj || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {c.responsavel_tecnico || "—"}
                      {c.crm_responsavel && (
                        <span className="block text-muted-foreground">{c.crm_responsavel}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.telefone || "—"}
                      {c.email && (
                        <span className="block text-muted-foreground truncate max-w-[14rem]">
                          {c.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.cidade ? `${c.cidade}${c.uf ? ` / ${c.uf}` : ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.status === "ATIVA"
                            ? "text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "text-xs bg-muted text-muted-foreground"
                        }
                      >
                        {c.status === "ATIVA" ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    {allowEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditando(c);
                              setIsFormOpen(true);
                            }}
                            title="Editar clínica"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <SgsstConfirmDelete
                            alvo={`a clínica "${c.nome}"`}
                            consequencia="Os exames já lançados nesta clínica ficam sem prestador vinculado. Se ela apenas parou de atender, prefira marcá-la como inativa."
                            onConfirm={() => removeClinica.mutate(c.id)}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={page + 1}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p - 1)}
            itemsPerPage={pageSize}
            onItemsPerPageChange={(v) => {
              setPageSize(v);
              setPage(0);
            }}
            totalItems={total}
          />
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editando ? "Editar clínica" : "Cadastrar clínica"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="cliNome">Nome da clínica *</Label>
              <Input
                id="cliNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cliCnpj">CNPJ</Label>
                <Input id="cliCnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliStatus">Status</Label>
                <Select value={status} onValueChange={(v: StatusClinica) => setStatus(v)}>
                  <SelectTrigger id="cliStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVA">Ativa</SelectItem>
                    <SelectItem value="INATIVA">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cliResp">Responsável técnico</Label>
                <Input
                  id="cliResp"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliCrm">CRM</Label>
                <Input id="cliCrm" value={crm} onChange={(e) => setCrm(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cliTel">Telefone</Label>
                <Input id="cliTel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliMail">E-mail</Label>
                <Input
                  id="cliMail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <h4 className="text-sm font-semibold leading-none">Endereço</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Digite o CEP e o logradouro, o bairro, a cidade e a UF são preenchidos pela
                  base dos Correios. Complete apenas o número e o complemento.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cliCep">
                    CEP
                  </Label>
                  <div className="relative">
                    <Input
                      id="cliCep"
                      placeholder="00.000-000"
                      inputMode="numeric"
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                    />
                    {buscandoCep && (
                      <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs" htmlFor="cliCompl">
                    Número / Complemento
                  </Label>
                  <Input
                    id="cliCompl"
                    placeholder="Ex.: 2392, Sala 4"
                    value={enderecoComplemento}
                    onChange={(e) => setEnderecoComplemento(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cliEnd">
                  Logradouro e bairro
                </Label>
                <Input
                  id="cliEnd"
                  placeholder="Preenchido pelo CEP — pode ser ajustado à mão"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs" htmlFor="cliCidade">
                    Cidade
                  </Label>
                  <Input
                    id="cliCidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cliUf">
                    UF
                  </Label>
                  <Input
                    id="cliUf"
                    maxLength={2}
                    placeholder="GO"
                    value={uf}
                    onChange={(e) => setUf(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cliExames">Exames realizados</Label>
              <Textarea
                id="cliExames"
                rows={2}
                placeholder="Ex.: audiometria, espirometria, acuidade visual, exames laboratoriais"
                value={examesRealizados}
                onChange={(e) => setExamesRealizados(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto livre: um credenciamento não tem lista fechada.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createClinica.isPending || updateClinica.isPending}
              >
                {createClinica.isPending || updateClinica.isPending
                  ? "Salvando…"
                  : editando
                    ? "Salvar"
                    : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
