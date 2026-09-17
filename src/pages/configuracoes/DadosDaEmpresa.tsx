import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { LogoWithUpload } from "@/components/LogoUploader";
import {
  faltasNoTimbre,
  linhaDeContato,
  linhaDeEndereco,
} from "@/utils/linhasDoTimbre";

/**
 * Dados da empresa — o que sai no papel timbrado de todo PDF.
 *
 * POR QUE ESTA TELA PASSOU A EXISTIR
 *
 * O roteiro 0.5 manda "conferir se o logotipo e o endereço da empresa estão
 * preenchidos em Configurações". Não havia tela, não havia coluna de endereço, e
 * o timbre trazia os dados da AIVX fixos no código — o PDF de todo cliente saía
 * com o CNPJ da fabricante da ferramenta.
 *
 * VISÍVEL PARA TODOS, EDITÁVEL PELO ADMIN
 *
 * Decisão do dono. Quem não é admin precisa poder CONFERIR o que vai sair no
 * documento que ele emite — e é por isso que os campos aparecem preenchidos e
 * bloqueados, em vez de a tela sumir do menu. Tela escondida faz a pessoa achar
 * que o dado não existe; campo bloqueado diz que existe e de quem é a caneta.
 *
 * O PRÉ-VISTO É O RODAPÉ DE VERDADE
 *
 * As duas linhas mostradas abaixo são montadas pelas MESMAS funções que desenham
 * o rodapé do PDF. Uma imitação divergiria na primeira mudança de formato, e a
 * tela passaria a prometer um rodapé que o documento não tem.
 */
export default function DadosDaEmpresaPage() {
  const { empresa, isLoading, salvarEmpresa } = useEmpresaAtual();
  // A RLS de `empresas` so deixa o admin atualizar; a tela reflete a mesma
  // regra em vez de inventar outra, e o hook ainda confere o que o banco fez.
  const { role } = useAuth();
  const podeEditar = role === "admin";

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [site, setSite] = useState("");

  useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nome ?? "");
    setCnpj(empresa.cnpj ?? "");
    setEndereco(empresa.endereco ?? "");
    setTelefone(empresa.telefone ?? "");
    setEmail(empresa.email ?? "");
    setSite(empresa.site ?? "");
  }, [empresa]);

  // O pré-visto acompanha o que está sendo digitado, e não o que está gravado:
  // quem preenche quer ver o efeito antes de salvar.
  const emEdicao = {
    nome,
    cnpj,
    endereco,
    telefone,
    email,
    site,
    logoUrl: empresa?.logo_url ?? null,
  };

  const faltas = faltasNoTimbre(emEdicao);
  const contato = linhaDeContato(emEdicao);
  const enderecoDoRodape = linhaDeEndereco(emEdicao);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome da empresa é obrigatório.");
      return;
    }

    try {
      await salvarEmpresa.mutateAsync({ nome, cnpj, endereco, telefone, email, site });
      toast.success("Dados da empresa salvos. Os próximos PDFs já saem com eles.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Dados da Empresa
        </h1>
        <p className="text-sm text-muted-foreground">
          É o que sai no papel timbrado de todo PDF do SGSST: o logotipo no topo, e
          estes dados no rodapé de cada página.
        </p>
      </div>

      {!podeEditar && (
        <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-xs">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            Você pode conferir o que sai nos documentos, mas só o{" "}
            <strong>administrador</strong> da empresa altera estes dados.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm font-semibold">Logotipo</CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex items-center gap-4">
          <LogoWithUpload className="h-14" />
          <p className="text-xs text-muted-foreground">
            Aparece no topo de cada página dos PDFs <strong>e</strong> no cabeçalho
            das telas. Clique para enviar; PNG ou JPEG, até 5 MB.
            {!podeEditar && " O envio também é restrito ao administrador."}
          </p>
        </CardContent>
      </Card>

      <form onSubmit={salvar}>
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-semibold">Identificação e contato</CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome da empresa *</Label>
              <Input
                id="nome"
                value={nome}
                disabled={!podeEditar}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                disabled={!podeEditar}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                placeholder="(00) 0000-0000"
                value={telefone}
                disabled={!podeEditar}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="endereco">Endereço completo</Label>
              <Input
                id="endereco"
                placeholder="Rua, número — bairro, cidade – UF, CEP"
                value={endereco}
                disabled={!podeEditar}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@empresa.com.br"
                value={email}
                disabled={!podeEditar}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                placeholder="empresa.com.br"
                value={site}
                disabled={!podeEditar}
                onChange={(e) => setSite(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-semibold">
              Como o rodapé vai sair
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/*
              Montado pelas mesmas funções que desenham o PDF. Uma imitação
              divergiria na primeira mudança de formato.
            */}
            <div className="rounded border bg-muted/30 px-4 py-3 text-center">
              {contato ? (
                <p className="text-[11px] text-foreground">{contato}</p>
              ) : (
                <p className="text-[11px] italic text-muted-foreground">
                  (sem linha de contato)
                </p>
              )}
              {enderecoDoRodape ? (
                <p className="text-[10px] text-muted-foreground">{enderecoDoRodape}</p>
              ) : (
                <p className="text-[10px] italic text-muted-foreground">
                  (sem linha de endereço)
                </p>
              )}
            </div>

            {faltas.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Timbre completo.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {faltas.length} campo(s) em branco — o documento sai sem eles:
                </p>
                <ul className="pl-5 text-xs text-muted-foreground list-disc space-y-0.5">
                  {faltas.map((f) => (
                    <li key={String(f.campo)}>
                      <strong>{f.rotulo}</strong> — {f.consequencia}
                    </li>
                  ))}
                </ul>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Nada é preenchido por conta própria: um valor inventado aqui viraria
                  o dado de outra empresa no seu documento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {podeEditar && (
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={salvarEmpresa.isPending || !nome.trim()}>
              {salvarEmpresa.isPending ? "Salvando..." : "Salvar dados da empresa"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
