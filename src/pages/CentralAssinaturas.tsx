import { useMemo, useState } from "react";
import { useAssinaturas, type SolicitacaoDeAssinatura } from "@/hooks/useAssinaturas";
import { urlDeAssinatura } from "@/services/assinaturaEmFila";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileDown,
  Mail,
  MessageCircle,
  RefreshCw,
  Plus,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { EnviarParaAssinaturaDialog } from "@/components/assinaturas/EnviarParaAssinaturaDialog";
import { toast } from "sonner";

/**
 * Serviço Central de Assinaturas Digital.
 *
 * A permissão com este nome existia no Gerenciar Usuários desde sempre, ligada a
 * uma função `canSignatureAction` que NENHUM componente chamava — e não havia
 * tela, rota nem item de menu. Ligar ou desligar a permissão não mudava nada.
 *
 * A PERGUNTA QUE ESTA TELA RESPONDE
 *
 * "O que está parado, e com quem." Uma lista de documentos que não diz de quem se
 * está esperando é a versão inútil desta tela: quem abre aqui abre porque alguém
 * não assinou, e precisa do link para cobrar.
 *
 * Por isso os botões de reenvio ficam em cada signatário pendente, e não num menu
 * escondido — reenviar é a ação mais frequente, não uma exceção.
 */
export default function CentralAssinaturasPage() {
  const { solicitacoes, isLoading, error, refetch, truncado } = useAssinaturas();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [aberta, setAberta] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const { profile } = useAuth();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return solicitacoes.filter((s) => {
      if (filtro === "aguardando" && s.progresso.situacao !== "AGUARDANDO") return false;
      if (filtro === "concluidas" && s.progresso.situacao !== "CONCLUIDA") return false;
      if (filtro === "recusadas" && s.progresso.situacao !== "RECUSADA") return false;

      if (!termo) return true;
      return (
        (s.documento_id ?? "").toLowerCase().includes(termo) ||
        s.modulo_origem.toLowerCase().includes(termo) ||
        s.entidade_tipo.toLowerCase().includes(termo) ||
        s.signatarios.some((x) => x.nome.toLowerCase().includes(termo))
      );
    });
  }, [solicitacoes, busca, filtro]);

  const contagem = useMemo(
    () => ({
      total: solicitacoes.length,
      aguardando: solicitacoes.filter((s) => s.progresso.situacao === "AGUARDANDO").length,
      concluidas: solicitacoes.filter((s) => s.progresso.situacao === "CONCLUIDA").length,
      recusadas: solicitacoes.filter((s) => s.progresso.situacao === "RECUSADA").length,
    }),
    [solicitacoes]
  );

  const dataBr = (valor?: string | null) => {
    if (!valor) return "—";
    try {
      return format(parseISO(valor), "dd/MM/yyyy HH:mm");
    } catch {
      return valor;
    }
  };

  const mensagem = (nome: string, url: string) =>
    `Olá, ${nome}. Há um documento aguardando sua assinatura.\n\n${url}\n\n` +
    `O link é individual e só funciona quando chegar a sua vez na fila.`;

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <SgsstErrorState error={error} modulo="Assinaturas" onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Serviço Central de Assinaturas Digital
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a fila de cada documento, reenvie o link de quem está pendente e
            baixe o arquivo assinado.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          {/*
            A central também ORIGINA, e não só acompanha. Sem isto, a única porta de
            entrada seria dentro de cada módulo — e documento que não nasce no
            sistema (contrato, ata, ordem de serviço em PDF) não teria por onde
            entrar na fila.
          */}
          {profile?.empresa_id && (
            <Button size="sm" onClick={() => setNovaAberta(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova solicitação
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { rotulo: "Solicitações", valor: contagem.total, cor: "" },
          { rotulo: "Aguardando", valor: contagem.aguardando, cor: "text-amber-600" },
          { rotulo: "Concluídas", valor: contagem.concluidas, cor: "text-emerald-600" },
          { rotulo: "Recusadas", valor: contagem.recusadas, cor: "text-red-600" },
        ].map((c) => (
          <Card key={c.rotulo}>
            <CardHeader className="py-2.5 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {c.rotulo}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold ${c.cor}`}>{c.valor}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por documento, módulo ou nome do signatário..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="aguardando">Aguardando assinatura</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
            <SelectItem value="recusadas">Recusadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {truncado && (
        <p className="text-xs text-amber-700">
          Mostrando as solicitações mais recentes. A lista bateu o teto e pode estar
          incompleta.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {solicitacoes.length === 0
              ? "Nenhuma solicitação de assinatura ainda. Elas aparecem aqui quando um documento é enviado para assinatura."
              : "Nenhuma solicitação corresponde ao filtro."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map((s) => (
            <LinhaDaSolicitacao
              key={s.id}
              solicitacao={s}
              aberta={aberta === s.id}
              alternar={() => setAberta((a) => (a === s.id ? null : s.id))}
              dataBr={dataBr}
              mensagem={mensagem}
              copiar={copiar}
            />
          ))}
        </div>
      )}

      {novaAberta && profile?.empresa_id && (
        <EnviarParaAssinaturaDialog
          open={novaAberta}
          onOpenChange={(v) => {
            setNovaAberta(v);
            // Recarrega ao fechar: a solicitacao recem-criada precisa aparecer na
            // lista sem o usuario ter de clicar em Atualizar.
            if (!v) void refetch();
          }}
          empresaId={profile.empresa_id}
          moduloOrigem="CENTRAL"
          entidadeTipo="documento_avulso"
          // Documento avulso não tem registro de origem no sistema. O identificador
          // é o instante da criação: serve para distinguir uma solicitação da outra
          // sem fingir que existe uma entidade por trás.
          entidadeId={`avulso-${Date.now()}`}
          permitirEditarTitulo
        />
      )}
    </div>
  );
}

function LinhaDaSolicitacao({
  solicitacao: s,
  aberta,
  alternar,
  dataBr,
  mensagem,
  copiar,
}: {
  solicitacao: SolicitacaoDeAssinatura;
  aberta: boolean;
  alternar: () => void;
  dataBr: (v?: string | null) => string;
  mensagem: (nome: string, url: string) => string;
  copiar: (texto: string) => void;
}) {
  const selo =
    s.progresso.situacao === "CONCLUIDA" ? (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Concluída
      </Badge>
    ) : s.progresso.situacao === "RECUSADA" ? (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1">
        <XCircle className="h-3 w-3" /> Recusada
      </Badge>
    ) : s.progresso.situacao === "SEM_SIGNATARIOS" ? (
      <Badge variant="outline" className="text-muted-foreground">Sem signatários</Badge>
    ) : (
      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1">
        <Clock className="h-3 w-3" /> Aguardando
      </Badge>
    );

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={alternar}>
            {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-sm">
              {s.documento_id || `${s.modulo_origem} — ${s.entidade_tipo}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.modulo_origem} · criada em {dataBr(s.created_at)}
            </p>
          </div>

          <span className="text-sm font-medium">
            {s.progresso.assinados} de {s.progresso.total}
          </span>

          {/*
            Dizer DE QUEM se está esperando é a razão de a tela existir. "3 de 5"
            informa o quanto falta; o nome informa a quem cobrar.
          */}
          {s.progresso.aguardando.length > 0 && (
            <span className="text-xs text-amber-700 max-w-[240px] truncate">
              aguardando {s.progresso.aguardando.join(", ")}
            </span>
          )}

          {selo}

          {s.documento?.arquivo_assinado && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={resolveFileUrl(s.documento.arquivo_assinado)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown className="h-3.5 w-3.5 mr-1" /> Assinado
              </a>
            </Button>
          )}
        </div>

        {aberta && (
          <div className="space-y-2 pt-2 border-t">
            {s.documento?.arquivo_original && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={resolveFileUrl(s.documento.arquivo_original)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver o documento enviado
                </a>
              </Button>
            )}

            {s.signatarios.map((sig) => {
              const url = sig.token ? urlDeAssinatura(sig.token) : null;
              const daVez = s.progresso.aguardando.includes(sig.nome);

              return (
                <div
                  key={sig.id}
                  className={`p-2.5 rounded border text-sm space-y-1.5 ${
                    daVez ? "bg-amber-50/60 border-amber-200" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{sig.ordem}º</span>
                    <span className="font-medium flex-1">{sig.nome}</span>
                    {sig.cargo && (
                      <span className="text-xs text-muted-foreground">{sig.cargo}</span>
                    )}
                    {sig.status === "ASSINADO" ? (
                      <span className="text-xs text-emerald-700">
                        assinou em {dataBr(sig.assinadoEm)}
                      </span>
                    ) : sig.status === "RECUSADO" ? (
                      <span className="text-xs text-red-700">
                        recusou{sig.recusa_motivo ? `: ${sig.recusa_motivo}` : ""}
                      </span>
                    ) : (
                      // Separar "abriu e não assinou" de "nem abriu" é o que decide
                      // entre cobrar a pessoa e reenviar o link.
                      <span className="text-xs text-muted-foreground">
                        {sig.primeiro_acesso_em
                          ? `abriu o link em ${dataBr(sig.primeiro_acesso_em)}`
                          : "ainda não abriu o link"}
                      </span>
                    )}
                  </div>

                  {url && sig.status === "PENDENTE" && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => copiar(url)}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar link
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" asChild>
                        <a
                          href={`mailto:${encodeURIComponent(sig.email ?? "")}?subject=${encodeURIComponent(
                            "Documento aguardando sua assinatura"
                          )}&body=${encodeURIComponent(mensagem(sig.nome, url))}`}
                        >
                          <Mail className="h-3 w-3 mr-1" /> E-mail
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" asChild>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(mensagem(sig.nome, url))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {s.documento?.hash_assinado && (
              <p className="text-[11px] text-muted-foreground font-mono break-all pt-1 border-t">
                SHA-256: {s.documento.hash_assinado}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
