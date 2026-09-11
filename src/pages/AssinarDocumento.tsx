import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  assinarPorToken,
  buscarPorToken,
  recusarPorToken,
  type AssinaturaPorToken,
} from "@/services/assinaturaEmFila";
import { progressoDaFila, vezDeAssinar } from "@/utils/assinaturaFila";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Página pública de assinatura, aberta pelo link individual.
 *
 * Rota fora do `ProtectedRoute` de propósito: quem assina é o trabalhador, o
 * instrutor, a testemunha — gente que não tem conta no sistema. Exigir login aqui
 * inviabilizaria o fluxo inteiro, que é justamente o de assinar sem ser usuário.
 *
 * O QUE ESTA TELA NÃO FAZ, E POR QUÊ
 *
 * Não confia na própria checagem para liberar o ato. Ela esconde o botão quando
 * não é a vez, mas quem grava a assinatura confere a ordem de novo no serviço —
 * a tela é conveniência, não controle. A ordem é o que este fluxo promete, e uma
 * promessa que só a interface guarda não é guardada.
 */
export default function AssinarDocumentoPage() {
  const { token } = useParams<{ token: string }>();

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<AssinaturaPorToken | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [arquivoFinal, setArquivoFinal] = useState<string | null>(null);

  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarRecusa, setMostrarRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const carregar = async () => {
    if (!token) return;
    setCarregando(true);
    try {
      setDados(await buscarPorToken(token));
    } catch (e) {
      toast.error(`Não foi possível abrir o documento: ${(e as Error).message}`);
      setDados({ encontrado: false });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (carregando) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!dados?.encontrado) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="py-8 text-center space-y-2">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="font-semibold">Link inválido ou expirado</p>
            <p className="text-sm text-muted-foreground">
              Confira se o endereço recebido está completo. Se o problema continuar,
              peça um novo link a quem enviou o documento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fila = dados.fila ?? [];
  const progresso = progressoDaFila(fila);
  const hojeLocal = (() => {
    const d = new Date();
    const dois = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
  })();

  const vez = vezDeAssinar({
    signatarios: fila,
    signatarioId: dados.signatarioId ?? "",
    expiraEm: dados.expiraEm,
    agora: hojeLocal,
  });

  const confirmar = async () => {
    if (!token) return;
    setEnviando(true);
    try {
      const r = await assinarPorToken({ token, confirmacao });
      if (r.assinou !== true) {
        toast.error(r.motivo, { description: r.comoResolver });
        await carregar();
        return;
      }
      setAssinou(true);
      setArquivoFinal(r.arquivoAssinado ?? null);
      toast.success(
        r.filaConcluida
          ? "Assinatura registrada. Documento concluído."
          : "Assinatura registrada. O próximo signatário será avisado."
      );
      await carregar();
    } catch (e) {
      toast.error(`Erro ao assinar: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  };

  const recusar = async () => {
    if (!token || !motivoRecusa.trim()) {
      toast.error("Informe o motivo da recusa.");
      return;
    }
    setEnviando(true);
    try {
      const r = await recusarPorToken({ token, motivo: motivoRecusa.trim() });
      if (!r.ok) {
        toast.error(r.erro ?? "Não foi possível registrar a recusa.");
        return;
      }
      toast.success("Recusa registrada. O solicitante foi notificado no sistema.");
      setMostrarRecusa(false);
      await carregar();
    } catch (e) {
      toast.error(`Erro ao recusar: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="text-center space-y-1">
        <ShieldCheck className="h-9 w-9 text-primary mx-auto" />
        <h1 className="text-xl font-bold">Assinatura de documento</h1>
        <p className="text-sm text-muted-foreground">
          {dados.nome}
          {dados.cargo ? ` — ${dados.cargo}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {dados.moduloOrigem} · {dados.entidadeTipo}
          </p>

          {/*
            O documento é aberto antes de assinar, e não depois. Assinar um título
            sem ver o conteúdo é o vício que a assinatura eletrônica costuma
            introduzir; aqui o arquivo é o primeiro elemento da tela.
          */}
          {dados.arquivoOriginal ? (
            <Button variant="outline" className="w-full" asChild>
              <a
                href={resolveFileUrl(dados.arquivoOriginal)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4 mr-2" /> Abrir o documento
              </a>
            </Button>
          ) : (
            <p className="text-amber-700">
              O arquivo não foi anexado à solicitação. Peça o documento ao solicitante
              antes de assinar.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Fila de assinaturas ({progresso.assinados} de {progresso.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {[...fila]
            .sort((a, b) => a.ordem - b.ordem)
            .map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 p-2 rounded border ${
                  s.id === dados.signatarioId ? "bg-primary/5 border-primary/30" : ""
                }`}
              >
                <span className="text-xs text-muted-foreground w-5">{s.ordem}º</span>
                <span className="flex-1 font-medium">{s.nome}</span>
                {s.status === "ASSINADO" && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Assinou
                  </Badge>
                )}
                {s.status === "RECUSADO" && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1">
                    <XCircle className="h-3 w-3" /> Recusou
                  </Badge>
                )}
                {s.status === "PENDENTE" && (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Pendente
                  </Badge>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      {assinou ? (
        <Card className="border-emerald-300 bg-emerald-50/50">
          <CardContent className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <p className="font-semibold text-emerald-900">Assinatura registrada</p>
            {arquivoFinal && (
              <Button variant="outline" asChild>
                <a href={resolveFileUrl(arquivoFinal)} target="_blank" rel="noopener noreferrer">
                  Baixar o documento assinado
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : vez.pode === true ? (
        <Card className="border-primary/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Confirmar assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {/*
              Digitar o próprio nome é o gesto que separa o clique acidental do ato
              deliberado. Não prova identidade — e o texto diz isso, em vez de
              sugerir uma segurança que este meio não tem.
            */}
            <div className="space-y-1.5">
              <Label htmlFor="conf">Digite seu nome completo para confirmar</Label>
              <Input
                id="conf"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={dados.nome ?? ""}
                autoComplete="off"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Ao confirmar, ficam registrados a data e hora, o endereço de rede e o
              dispositivo usado. É uma assinatura eletrônica simples, válida entre as
              partes que a aceitam; ela não substitui certificado digital ICP-Brasil
              onde a lei o exigir.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                disabled={enviando || confirmacao.trim().length < 3}
                onClick={confirmar}
              >
                {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Assinar documento
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setMostrarRecusa((v) => !v)}
                disabled={enviando}
              >
                Recusar
              </Button>
            </div>

            {mostrarRecusa && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="motivo">Motivo da recusa</Label>
                <Textarea
                  id="motivo"
                  rows={3}
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Descreva por que não pode assinar este documento."
                />
                {/* A recusa encerra a fila para todos — dizer isso antes evita que
                    alguém use "recusar" achando que é "adiar". */}
                <p className="text-xs text-amber-700">
                  A recusa interrompe a fila para todos os signatários. O solicitante
                  precisará abrir uma nova solicitação.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={recusar}
                  disabled={enviando || !motivoRecusa.trim()}
                >
                  Confirmar recusa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="py-5 space-y-1">
            <p className="font-semibold text-amber-900">{vez.motivo}</p>
            <p className="text-sm text-amber-800">{vez.comoResolver}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
