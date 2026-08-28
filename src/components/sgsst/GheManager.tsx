import { useMemo, useState } from "react";
import { useSgsstGhe, type SgsstGhe } from "@/hooks/sgsst/useSgsstGhe";
import { useSgsstFuncoes } from "@/hooks/sgsst/useSgsstFuncoes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { Plus, Edit2, Users, AlertTriangle, X, Layers } from "lucide-react";
import {
  proximoCodigoGhe,
  codigoEmUso,
  pendenciasDoGhe,
  type FuncaoDoGhe,
} from "@/utils/sgsstGhe";

/**
 * Gestão dos Grupos Homogêneos de Exposição.
 *
 * Vive ao lado do cadastro de funções e não dentro do PCMSO porque o GHE é da
 * empresa: o PGR inventaria o risco do grupo e o PCMSO planeja o exame do mesmo
 * grupo. Um GHE por documento faria os dois programas manterem listas
 * independentes de quem está no grupo — divergir sobre isso é o erro que o
 * agrupamento existe para evitar.
 *
 * O vínculo com função é a operação mais frequente aqui, então ela fica na
 * própria linha do grupo, sem abrir formulário.
 */

interface FormGhe {
  codigo: string;
  nome: string;
  setor: string;
  area_influencia: string;
  carga_horaria: string;
  quantidade_trabalhadores: string;
  descricao: string;
  status: "ativo" | "inativo";
}

const FORM_VAZIO: FormGhe = {
  codigo: "",
  nome: "",
  setor: "",
  area_influencia: "",
  carga_horaria: "",
  quantidade_trabalhadores: "",
  descricao: "",
  status: "ativo",
};

export function GheManager() {
  const { canEdit } = usePermissions();
  const podeEditar = canEdit("sgsst-funcoes");

  const {
    ghes,
    ghesCarregados,
    isLoading,
    temErro,
    vinculos,
    funcoesDoGhe,
    criar,
    atualizar,
    excluir,
    vincularFuncao,
    desvincularFuncao,
  } = useSgsstGhe();

  // Sem paginação: a lista de funções aqui alimenta um seletor, e um seletor
  // paginado esconde justamente a função que se procura.
  const { funcoes: todasFuncoes } = useSgsstFuncoes();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormGhe>(FORM_VAZIO);
  const [erroCodigo, setErroCodigo] = useState("");

  const funcoesAtivas = useMemo(
    () => (todasFuncoes ?? []).filter((f) => f.status !== "inativo"),
    [todasFuncoes]
  );

  const abrirNovo = () => {
    setEditandoId(null);
    setErroCodigo("");
    setForm({ ...FORM_VAZIO, codigo: proximoCodigoGhe(ghes.map((g) => g.codigo)) });
    setDialogAberto(true);
  };

  const abrirEdicao = (g: SgsstGhe) => {
    setEditandoId(g.id);
    setErroCodigo("");
    setForm({
      codigo: g.codigo,
      nome: g.nome,
      setor: g.setor ?? "",
      area_influencia: g.area_influencia ?? "",
      carga_horaria: g.carga_horaria ?? "",
      // Zero é declaração, não ausência: `?? ""` preservaria o 0 e `|| ""` o
      // apagaria.
      quantidade_trabalhadores:
        typeof g.quantidade_trabalhadores === "number"
          ? String(g.quantidade_trabalhadores)
          : "",
      descricao: g.descricao ?? "",
      status: (g.status as "ativo" | "inativo") ?? "ativo",
    });
    setDialogAberto(true);
  };

  const salvar = () => {
    const codigo = form.codigo.trim();
    if (!codigo || !form.nome.trim()) {
      setErroCodigo("Código e nome são obrigatórios.");
      return;
    }
    // Checa antes de enviar: o índice único do banco devolveria 23505, e "duplicate
    // key value violates unique constraint" não diz ao usuário o que fazer.
    if (codigoEmUso(codigo, ghes, editandoId)) {
      setErroCodigo(`O código ${codigo} já está em uso por outro grupo.`);
      return;
    }
    setErroCodigo("");

    const bruto = form.quantidade_trabalhadores.trim();
    const quantidade = bruto === "" ? null : Number(bruto);
    if (quantidade !== null && (!Number.isInteger(quantidade) || quantidade < 0)) {
      setErroCodigo("Quantidade de trabalhadores deve ser um número inteiro não negativo.");
      return;
    }

    const campos = {
      codigo,
      nome: form.nome.trim(),
      setor: form.setor.trim() || null,
      area_influencia: form.area_influencia.trim() || null,
      carga_horaria: form.carga_horaria.trim() || null,
      quantidade_trabalhadores: quantidade,
      descricao: form.descricao.trim() || null,
      status: form.status,
    };

    if (editandoId) {
      atualizar.mutate({ id: editandoId, ...campos }, { onSuccess: () => setDialogAberto(false) });
    } else {
      criar.mutate(campos, { onSuccess: () => setDialogAberto(false) });
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando grupos…</p>;
  }
  if (temErro) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Não foi possível carregar os grupos homogêneos de exposição.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">
            O <strong>GHE</strong> reúne funções com a mesma exposição, para que risco e exame
            sejam levantados uma vez para o conjunto (NR-01 1.5.4.4.4). O grupo é compartilhado
            com o PGR e com o PCMSO — e o vínculo por <strong>função</strong> continua valendo
            nos dois programas.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNovo} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo GHE
          </Button>
        )}
      </div>

      {ghesCarregados && ghes.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum GHE cadastrado</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Sem grupo, os riscos e exames continuam sendo levantados função por função — o que
              já funciona. O GHE serve para não repetir o mesmo levantamento em funções com a
              mesma exposição.
            </p>
          </CardContent>
        </Card>
      )}

      {ghes.map((ghe) => {
        const funcoes = funcoesDoGhe(ghe.id);
        const pendencias = funcoes
          ? pendenciasDoGhe({
              ghe,
              funcoes,
              // A matriz e os riscos vivem no documento; aqui interessa a
              // completude do cadastro do grupo. DESCONHECIDO evita que esta tela
              // acuse falta de exame que ela não consultou.
              matriz: { situacao: "DESCONHECIDO" },
              riscos: { situacao: "DESCONHECIDO" },
            })
          : [];

        const jaVinculadas = new Set((funcoes ?? []).map((f) => f.id));
        const disponiveis = funcoesAtivas.filter((f) => !jaVinculadas.has(f.id));

        return (
          <Card key={ghe.id} className={ghe.status === "inativo" ? "opacity-60" : ""}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {ghe.codigo}
                    </Badge>
                    <span className="font-semibold">{ghe.nome}</span>
                    {ghe.status === "inativo" && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[
                      ghe.setor && `Setor: ${ghe.setor}`,
                      ghe.area_influencia && `Área: ${ghe.area_influencia}`,
                      ghe.carga_horaria && `Jornada: ${ghe.carga_horaria}`,
                      typeof ghe.quantidade_trabalhadores === "number"
                        ? `${ghe.quantidade_trabalhadores} trabalhador(es) declarado(s)`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Cabeçalho do grupo não preenchido."}
                  </p>
                </div>

                {podeEditar && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(ghe)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <SgsstConfirmDelete
                      alvo={`o grupo ${ghe.codigo} — ${ghe.nome}`}
                      consequencia={
                        <>
                          As funções são <strong>desvinculadas</strong> do grupo, mas continuam
                          cadastradas. Exames do PCMSO e itens do inventário do PGR que apontavam
                          para este GHE <strong>não são excluídos</strong> — ficam sem grupo
                          vinculado, e o vínculo por função deles permanece intacto.
                        </>
                      }
                      onConfirm={() => excluir.mutate(ghe.id)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Users className="h-3.5 w-3.5" />
                  Funções do grupo
                  {funcoes && <span className="text-muted-foreground">({funcoes.length})</span>}
                </div>

                {funcoes === null ? (
                  <p className="text-xs text-muted-foreground">Carregando funções…</p>
                ) : funcoes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma função vinculada — o grupo ainda não alcança ninguém.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {funcoes.map((f) => (
                      <Badge key={f.id} variant="secondary" className="gap-1 pr-1">
                        {f.nome}
                        {!(f.descricao || "").trim() && (
                          <span title="Função sem descrição detalhada das atividades">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                          </span>
                        )}
                        {podeEditar && (
                          <button
                            type="button"
                            className="rounded-sm p-0.5 hover:bg-background"
                            onClick={() =>
                              desvincularFuncao.mutate({ gheId: ghe.id, funcaoId: f.id })
                            }
                            aria-label={`Desvincular ${f.nome}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}

                {podeEditar && disponiveis.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(funcaoId) =>
                      vincularFuncao.mutate({ gheId: ghe.id, funcaoId })
                    }
                  >
                    <SelectTrigger className="h-8 w-full max-w-xs text-xs">
                      <SelectValue placeholder="+ Vincular função ao grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {disponiveis.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="text-xs">
                          {f.nome}
                          {!(f.descricao || "").trim() && " — sem descrição"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {pendencias.length > 0 && (
                <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-500">
                  {pendencias.map((p) => (
                    <li key={p} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={dialogAberto}
        onOpenChange={(aberto) => {
          setDialogAberto(aberto);
          if (!aberto) {
            setEditandoId(null);
            setErroCodigo("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar GHE" : "Novo GHE"}</DialogTitle>
            <DialogDescription>
              Setor é a estrutura organizacional; área de influência é o local onde a exposição
              acontece. As duas frequentemente não coincidem, e o documento traz as duas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="GHE-01"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Operacional — oficina"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input
                value={form.setor}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
                placeholder="OPERACIONAL"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Área de influência</Label>
              <Input
                value={form.area_influencia}
                onChange={(e) => setForm({ ...form, area_influencia: e.target.value })}
                placeholder="OFICINA MECÂNICA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Carga horária</Label>
              <Input
                value={form.carga_horaria}
                onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })}
                placeholder="44 horas semanais"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trabalhadores no grupo</Label>
              <Input
                type="number"
                min={0}
                value={form.quantidade_trabalhadores}
                onChange={(e) =>
                  setForm({ ...form, quantidade_trabalhadores: e.target.value })
                }
                placeholder="—"
              />
              <p className="text-[11px] leading-tight text-muted-foreground">
                Quantidade declarada. O documento a confronta com os colaboradores ativos nas
                funções do grupo e aponta divergência.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição do grupo</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="O que caracteriza a exposição comum a este grupo."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "ativo" | "inativo" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {erroCodigo && <p className="text-sm text-destructive">{erroCodigo}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={criar.isPending || atualizar.isPending}>
              {editandoId ? "Salvar" : "Criar GHE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
