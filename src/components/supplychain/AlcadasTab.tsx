import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAlcadasCompra, useCandidatosAAprovador } from "@/hooks/useAlcadasCompra";
import {
  TIPOS_COMPRA,
  TIPO_COMPRA_LABEL,
  avisosDeCobertura,
  rotuloTipoCompra,
  textoDaFaixa,
  type Alcada,
  type TipoCompra,
} from "@/lib/alcadaCompras";

/**
 * Cadastro das alçadas de aprovação de compra.
 *
 * Antes, a autorização era um booleano por usuário: quem tinha
 * `pode_aprovar_compra` aprovava R$ 200 em parafusos e R$ 400 mil em concreto pela
 * mesma checagem.
 *
 * Duas coisas que esta tela faz questão de dizer, porque alçada malcadastrada **não
 * dá erro** — ela simplesmente deixa de autorizar, e o efeito só aparece no dia em
 * que alguém precisa aprovar:
 *
 * - **Enquanto a lista está vazia, não existe controle de valor**, e isso está
 *   escrito no alto. Bloquear tudo até alguém cadastrar travaria as compras em
 *   andamento; deixar em silêncio faria o usuário achar que há controle onde não há.
 *
 * - **Os buracos de cobertura são apontados**: faixa sem aprovador, valor sem
 *   faixa, ausência de alçada sem teto. São os erros que só apareceriam na hora
 *   errada.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SEM_TIPO = "__QUALQUER__";

interface FormAlcada {
  nome: string;
  valor_minimo: string;
  valor_maximo: string;
  tipo_compra: string;
  observacoes: string;
  ativo: boolean;
  aprovadores: string[];
}

const FORM_VAZIO: FormAlcada = {
  nome: "",
  valor_minimo: "0",
  valor_maximo: "",
  tipo_compra: SEM_TIPO,
  observacoes: "",
  ativo: true,
  aprovadores: [],
};

export function AlcadasTab() {
  const { alcadas, isLoading, criar, atualizar, remover } = useAlcadasCompra();
  const { data: candidatos = [] } = useCandidatosAAprovador();
  const { canEdit } = usePermissions();
  const podeAdministrar = canEdit("supply-chain");

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Alcada | null>(null);
  const [form, setForm] = useState<FormAlcada>(FORM_VAZIO);

  const avisos = useMemo(() => avisosDeCobertura(alcadas), [alcadas]);
  const ativas = alcadas.filter((a) => a.ativo);

  const nomePorId = useMemo(
    () => new Map(candidatos.map((c) => [c.id as string, (c.nome as string) ?? "sem nome"])),
    [candidatos]
  );

  const abrirNova = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setAberto(true);
  };

  const abrirEdicao = (a: Alcada) => {
    setEditando(a);
    setForm({
      nome: a.nome,
      valor_minimo: String(a.valor_minimo ?? 0),
      valor_maximo: a.valor_maximo === null ? "" : String(a.valor_maximo),
      tipo_compra: a.tipo_compra ?? SEM_TIPO,
      observacoes: a.observacoes ?? "",
      ativo: a.ativo,
      aprovadores: [...a.aprovadores],
    });
    setAberto(true);
  };

  const minimo = Number(form.valor_minimo.replace(",", ".")) || 0;
  const maximo = form.valor_maximo.trim() === "" ? null : Number(form.valor_maximo.replace(",", ".")) || 0;

  const faixaInvalida = maximo !== null && maximo <= minimo;
  const podeSalvar = form.nome.trim().length > 0 && !faixaInvalida;

  const salvar = () => {
    if (!podeSalvar) return;

    const entrada = {
      nome: form.nome.trim(),
      valor_minimo: minimo,
      valor_maximo: maximo,
      tipo_compra: form.tipo_compra === SEM_TIPO ? null : (form.tipo_compra as TipoCompra),
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
      aprovadores: form.aprovadores,
    };

    const aoFechar = { onSuccess: () => setAberto(false) };
    if (editando) atualizar.mutate({ id: editando.id, ...entrada }, aoFechar);
    else criar.mutate(entrada, aoFechar);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Alçadas de aprovação
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Quem pode aprovar quanto, e de que tipo de compra. A faixa é conferida contra
            o valor da cotação vencedora.
          </p>
        </div>
        {podeAdministrar && (
          <Button onClick={abrirNova} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nova alçada
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/*
          O estado "sem regra" precisa estar escrito. Tabela vazia em silêncio faria
          o usuário achar que existe controle de valor onde não existe.
        */}
        {!isLoading && ativas.length === 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Nenhuma alçada cadastrada.</strong> Enquanto estiver assim, qualquer
              usuário com permissão de aprovar compras aprova{" "}
              <strong>qualquer valor</strong> — é o comportamento anterior, mantido para
              não travar as compras em andamento. Ao cadastrar a primeira alçada, a regra
              passa a valer para todas as aprovações.
            </span>
          </div>
        )}

        {avisos.map((aviso, i) => (
          <div
            key={`${aviso.problema}-${i}`}
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{aviso.mensagem}</span>
          </div>
        ))}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alçada</TableHead>
                <TableHead>Faixa de valor</TableHead>
                <TableHead>Tipo de compra</TableHead>
                <TableHead>Quem aprova</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Carregando alçadas...
                  </TableCell>
                </TableRow>
              ) : alcadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhuma alçada cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                alcadas.map((a) => (
                  <TableRow key={a.id} className={a.ativo ? "" : "opacity-50"}>
                    <TableCell>
                      <div className="font-medium">{a.nome}</div>
                      {!a.ativo && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          inativa
                        </Badge>
                      )}
                      {a.observacoes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.observacoes}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{textoDaFaixa(a)}</TableCell>
                    <TableCell>
                      {a.tipo_compra ? (
                        <Badge variant="outline">{TIPO_COMPRA_LABEL[a.tipo_compra]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">qualquer tipo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.aprovadores.length === 0 ? (
                        // Faixa sem aprovador é pior que faixa inexistente: parece
                        // configurada e não autoriza nada.
                        <span className="text-xs font-medium text-amber-700">
                          ninguém — nada nesta faixa pode ser aprovado
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.aprovadores.map((id) => (
                            <Badge key={id} variant="secondary" className="text-[10px]">
                              {nomePorId.get(id) ?? "usuário removido"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {podeAdministrar && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirEdicao(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remover.mutate(a.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar alçada" : "Nova alçada"}</DialogTitle>
            <DialogDescription>
              A faixa é comparada com o valor da cotação vencedora no momento da
              aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="alcada-nome">Nome *</Label>
              <Input
                id="alcada-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Gerência de obra — até R$ 20 mil"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alcada-min">Valor mínimo</Label>
                <Input
                  id="alcada-min"
                  inputMode="decimal"
                  value={form.valor_minimo}
                  onChange={(e) => setForm((f) => ({ ...f, valor_minimo: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alcada-max">Valor máximo</Label>
                <Input
                  id="alcada-max"
                  inputMode="decimal"
                  value={form.valor_maximo}
                  onChange={(e) => setForm((f) => ({ ...f, valor_maximo: e.target.value }))}
                  placeholder="em branco = sem teto"
                />
                {/* A alçada sem teto é a que impede uma compra grande de ficar sem
                    ninguém que possa aprová-la. */}
                <p className="text-[11px] text-muted-foreground">
                  Deixe em branco para a alçada mais alta, sem teto.
                </p>
              </div>
            </div>

            {faixaInvalida && (
              <p className="text-xs font-medium text-destructive">
                O valor máximo tem de ser maior que o mínimo.
              </p>
            )}

            {!faixaInvalida && (
              <p className="text-xs text-muted-foreground">
                Esta alçada cobre {maximo === null ? `de ${brl(minimo)} para cima` : `${brl(minimo)} a ${brl(maximo)}`}.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Tipo de compra</Label>
              <Select
                value={form.tipo_compra}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_compra: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_TIPO}>Qualquer tipo</SelectItem>
                  {TIPOS_COMPRA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_COMPRA_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Uma alçada de um tipo específico <strong>tem precedência</strong> sobre a
                de qualquer tipo na mesma faixa. Sem isso, cadastrar a regra específica
                não teria efeito.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quem aprova nesta faixa</Label>
              {candidatos.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Nenhum usuário tem permissão de aprovar compras no perfil. Marque essa
                  permissão em Gerenciar Usuários antes de montar a alçada.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {candidatos.map((c) => {
                    const id = c.id as string;
                    return (
                      <label key={id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.aprovadores.includes(id)}
                          onCheckedChange={(marcado) =>
                            setForm((f) => ({
                              ...f,
                              aprovadores: marcado
                                ? [...f.aprovadores, id]
                                : f.aprovadores.filter((x) => x !== id),
                            }))
                          }
                        />
                        {(c.nome as string) ?? "sem nome"}
                      </label>
                    );
                  })}
                </div>
              )}
              {/* Só quem tem a permissão aparece: colocar na alçada alguém sem ela
                  criaria uma faixa que não autoriza, e o motivo ficaria escondido. */}
              <p className="text-[11px] text-muted-foreground">
                A lista traz apenas quem tem permissão de aprovar compras no perfil.
              </p>
              {form.aprovadores.length === 0 && (
                <p className="text-xs font-medium text-amber-700">
                  Sem nenhum aprovador, nada nesta faixa poderá ser aprovado.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alcada-obs">Observações</Label>
              <Textarea
                id="alcada-obs"
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Regra interna, referência de política de compras..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: !!v }))}
              />
              Alçada ativa
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={!podeSalvar || criar.isPending || atualizar.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
