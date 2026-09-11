import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  criarSolicitacaoComFila,
  type NovoSignatario,
  type SolicitacaoComFila,
} from "@/services/assinaturaEmFila";
import { toast } from "sonner";

/**
 * Monta a fila de assinatura e entrega os links.
 *
 * POR QUE OS LINKS SÃO ENTREGUES PARA COPIAR, E NÃO ENVIADOS PELO SISTEMA
 *
 * Enviar e-mail automático exige um provedor transacional contratado, e WhatsApp
 * automático exige a API oficial da Meta com número verificado e modelos
 * aprovados. Nenhum dos dois existe hoje, e esperar por eles deixaria a fila
 * pronta e inutilizável.
 *
 * Os botões abrem o e-mail e o WhatsApp do próprio usuário com a mensagem pronta.
 * A mensagem sai da conta dele — do Outlook dele, do WhatsApp dele — que é
 * exatamente o que se quer num pedido de assinatura: o destinatário reconhece
 * quem está pedindo. O custo é um clique por signatário.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  moduloOrigem: string;
  entidadeTipo: string;
  entidadeId: string;
  /** Título que aparece para quem assina. */
  documentoId?: string | null;
  /** Gera o PDF a ser assinado. Só é chamado ao confirmar o envio. */
  gerarArquivo: () => Promise<File>;
  /** Fila pré-montada pelo módulo que abriu o diálogo. */
  signatariosSugeridos?: readonly NovoSignatario[];
}

interface LinhaDeSignatario extends NovoSignatario {
  chave: string;
}

let contador = 0;
const novaLinha = (ordem: number): LinhaDeSignatario => ({
  chave: `s-${contador++}`,
  nome: "",
  ordem,
  email: "",
  cargo: "",
});

export function EnviarParaAssinaturaDialog({
  open,
  onOpenChange,
  empresaId,
  moduloOrigem,
  entidadeTipo,
  entidadeId,
  documentoId,
  gerarArquivo,
  signatariosSugeridos,
}: Props) {
  const [linhas, setLinhas] = useState<LinhaDeSignatario[]>(() =>
    (signatariosSugeridos ?? []).length > 0
      ? (signatariosSugeridos ?? []).map((s, i) => ({ ...s, chave: `sug-${i}` }))
      : [novaLinha(1)]
  );
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<SolicitacaoComFila | null>(null);

  const alterar = (chave: string, campo: keyof NovoSignatario, valor: string | number) =>
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l))
    );

  /**
   * Move a linha na fila trocando a ordem com a vizinha.
   *
   * Mexe na `ordem`, e não na posição do array: é a ordem que o banco guarda e
   * que decide quem assina quando. Reordenar só o array deixaria a tela numa
   * sequência e a fila real em outra.
   */
  const mover = (chave: string, direcao: -1 | 1) =>
    setLinhas((atual) => {
      const ordenadas = [...atual].sort((a, b) => a.ordem - b.ordem);
      const i = ordenadas.findIndex((l) => l.chave === chave);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= ordenadas.length) return atual;

      const ordemA = ordenadas[i].ordem;
      ordenadas[i] = { ...ordenadas[i], ordem: ordenadas[j].ordem };
      ordenadas[j] = { ...ordenadas[j], ordem: ordemA };
      return ordenadas;
    });

  const enviar = async () => {
    const validas = linhas.filter((l) => l.nome.trim());
    if (validas.length === 0) {
      toast.error("Informe ao menos um signatário com nome.");
      return;
    }

    setEnviando(true);
    try {
      const arquivo = await gerarArquivo();
      const r = await criarSolicitacaoComFila({
        empresaId,
        moduloOrigem,
        entidadeTipo,
        entidadeId,
        documentoId,
        arquivo,
        signatarios: validas.map((l) => ({
          nome: l.nome.trim(),
          ordem: l.ordem,
          email: l.email?.trim() || null,
          cargo: l.cargo?.trim() || null,
        })),
      });
      setResultado(r);
      toast.success(`Fila criada com ${r.links.length} signatário(s).`);
    } catch (e) {
      toast.error(`Não foi possível criar a solicitação: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Enviar para assinatura
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Cada signatário tem um link próprio. Eles assinam na ordem abaixo — o
              link só libera a assinatura quando chegar a vez de cada um.
            </p>

            {resultado.links.map((l) => (
              <Card key={l.signatarioId}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{l.ordem}º</span>
                    <span className="font-semibold flex-1">{l.nome}</span>
                  </div>

                  <Input readOnly value={l.url} className="text-xs font-mono" />

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copiar(l.url)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>

                    {/*
                      `mailto:` abre o cliente de e-mail do próprio usuário — o
                      Outlook dele, com a conta dele. A mensagem sai do remetente
                      que o destinatário reconhece, sem provedor contratado e sem
                      o sistema guardar senha nenhuma.
                    */}
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`mailto:${encodeURIComponent(
                          linhas.find((x) => x.nome.trim() === l.nome)?.email ?? ""
                        )}?subject=${encodeURIComponent(
                          "Documento aguardando sua assinatura"
                        )}&body=${encodeURIComponent(mensagem(l.nome, l.url))}`}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" /> E-mail
                      </a>
                    </Button>

                    {/*
                      `wa.me` abre o WhatsApp do usuário com o texto pronto e ele
                      escolhe o contato. Não é a API oficial — e não precisa ser:
                      a API existe para o sistema enviar sozinho, e aqui quem envia
                      é a pessoa.
                    */}
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          mensagem(l.nome, l.url)
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Defina quem assina e em que ordem. Signatários com a mesma posição
              assinam em paralelo — é o caso das duas testemunhas.
            </p>

            {[...linhas]
              .sort((a, b) => a.ordem - b.ordem)
              .map((l, indice, lista) => (
                <Card key={l.chave}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={l.ordem}
                        onChange={(e) =>
                          alterar(l.chave, "ordem", Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-16 text-center"
                        title="Posição na fila"
                      />
                      <Input
                        placeholder="Nome completo *"
                        value={l.nome}
                        onChange={(e) => alterar(l.chave, "nome", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={indice === 0}
                        onClick={() => mover(l.chave, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={indice === lista.length - 1}
                        onClick={() => mover(l.chave, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600"
                        onClick={() =>
                          setLinhas((atual) => atual.filter((x) => x.chave !== l.chave))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="E-mail (para o botão de e-mail)"
                        value={l.email ?? ""}
                        onChange={(e) => alterar(l.chave, "email", e.target.value)}
                      />
                      <Input
                        placeholder="Cargo ou papel"
                        value={l.cargo ?? ""}
                        onChange={(e) => alterar(l.chave, "cargo", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas((atual) => [
                  ...atual,
                  novaLinha(Math.max(0, ...atual.map((x) => x.ordem)) + 1),
                ])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Acrescentar signatário
            </Button>

            <p className="text-xs text-muted-foreground">
              O documento é gerado no momento do envio e fica anexado à solicitação —
              cada signatário abre e lê antes de assinar.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button onClick={enviar} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Criar fila e gerar links
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
