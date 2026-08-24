import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wind,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Camera,
} from "lucide-react";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { SgsstEvidenciasDialog } from "@/components/sgsst/SgsstEvidenciasDialog";
import {
  useSgsstPtAtmosfera,
  type SgsstPtParticipante,
} from "@/hooks/sgsst/useSgsstPt";
import {
  avaliarLiberacaoEntrada,
  avaliarMedicao,
  MOMENTO_AJUDA,
  MOMENTO_LABEL,
  OXIGENIO_MAXIMO,
  OXIGENIO_MINIMO_ENTRADA,
  INFLAMAVEIS_MAXIMO_LIE,
  type MomentoMedicao,
  type SituacaoParametro,
} from "@/utils/sgsstAtmosfera";
import { parseLimite } from "@/utils/sgsstRiscoLimite";

/**
 * Avaliação atmosférica da PT de espaço confinado — NR-33.
 *
 * A PT podia ser aprovada e executada sem que ninguém tivesse medido oxigênio,
 * inflamáveis ou contaminantes. Este painel é o registro que a norma coloca
 * ANTES da entrada, e o veredito de liberação que faltava.
 */

interface PtAtmosferaPanelProps {
  ptId: string;
  participantes: readonly SgsstPtParticipante[];
  allowEdit?: boolean;
}

const ICONE_SITUACAO: Record<SituacaoParametro, typeof CheckCircle2> = {
  APROVADO: CheckCircle2,
  REPROVADO: XCircle,
  ATENCAO: AlertTriangle,
  NAO_MEDIDO: HelpCircle,
};

const TOM_SITUACAO: Record<SituacaoParametro, string> = {
  APROVADO: "text-emerald-700 dark:text-emerald-400",
  REPROVADO: "text-red-700 dark:text-red-400",
  ATENCAO: "text-amber-700 dark:text-amber-500",
  NAO_MEDIDO: "text-muted-foreground",
};

export function PtAtmosferaPanel({
  ptId,
  participantes,
  allowEdit = false,
}: PtAtmosferaPanelProps) {
  // A foto do visor do detector e o que sustenta a leitura no documento: o numero
  // digitado a mao nao mostra o equipamento nem a hora do aparelho.
  const [fotosDe, setFotosDe] = useState<{ id: string; subtitulo: string } | null>(null);

  const { medicoes, isLoading, error, refetch, criarMedicao, removerMedicao } =
    useSgsstPtAtmosfera(ptId);

  const [aberto, setAberto] = useState(false);
  const [momento, setMomento] = useState<MomentoMedicao>("ANTES_ENTRADA");
  const [oxigenio, setOxigenio] = useState("");
  const [causaConhecida, setCausaConhecida] = useState(false);
  const [inflamaveis, setInflamaveis] = useState("");
  const [contaminanteNome, setContaminanteNome] = useState("");
  const [contaminanteValor, setContaminanteValor] = useState("");
  const [contaminanteUnidade, setContaminanteUnidade] = useState("ppm");
  const [contaminanteLimite, setContaminanteLimite] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [calibracaoValidade, setCalibracaoValidade] = useState("");
  const [medidoPorNome, setMedidoPorNome] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const liberacao = useMemo(
    () =>
      avaliarLiberacaoEntrada({
        medicoes,
        responsabilidades: participantes.map((p) => p.responsabilidade),
        hoje: new Date(),
      }),
    [medicoes, participantes]
  );

  const nOxigenio = parseLimite(oxigenio);
  const nInflamaveis = parseLimite(inflamaveis);
  const nContaminanteValor = parseLimite(contaminanteValor);
  const nContaminanteLimite = parseLimite(contaminanteLimite);

  const numerosInvalidos = [nOxigenio, nInflamaveis, nContaminanteValor, nContaminanteLimite].some(
    (v) => v === undefined
  );

  // O trigger do banco recusa medição sem nenhum parâmetro; a tela avisa antes
  // de tentar, em vez de mostrar um erro de banco.
  const semNenhumParametro =
    nOxigenio === null && nInflamaveis === null && nContaminanteValor === null;

  // Prévia do veredito com o que está digitado, para o usuário ver a conclusão
  // antes de salvar.
  const previa = useMemo(
    () =>
      avaliarMedicao(
        {
          momento,
          oxigenio_percentual: nOxigenio ?? null,
          causa_variacao_conhecida: causaConhecida,
          inflamaveis_percentual_lie: nInflamaveis ?? null,
          contaminante_nome: contaminanteNome,
          contaminante_valor: nContaminanteValor ?? null,
          contaminante_unidade: contaminanteUnidade,
          contaminante_limite: nContaminanteLimite ?? null,
          calibracao_validade: calibracaoValidade || null,
        },
        new Date()
      ),
    [
      momento,
      nOxigenio,
      causaConhecida,
      nInflamaveis,
      contaminanteNome,
      nContaminanteValor,
      contaminanteUnidade,
      nContaminanteLimite,
      calibracaoValidade,
    ]
  );

  const limpar = () => {
    setMomento("ANTES_ENTRADA");
    setOxigenio("");
    setCausaConhecida(false);
    setInflamaveis("");
    setContaminanteNome("");
    setContaminanteValor("");
    setContaminanteUnidade("ppm");
    setContaminanteLimite("");
    setEquipamento("");
    setNumeroSerie("");
    setCalibracaoValidade("");
    setMedidoPorNome("");
    setObservacoes("");
  };

  const salvar = () => {
    if (numerosInvalidos || semNenhumParametro) return;

    criarMedicao.mutate(
      {
        pt_id: ptId,
        medido_em: new Date().toISOString(),
        momento,
        oxigenio_percentual: nOxigenio ?? null,
        causa_variacao_conhecida: causaConhecida,
        inflamaveis_percentual_lie: nInflamaveis ?? null,
        contaminante_nome: contaminanteNome.trim() || null,
        contaminante_valor: nContaminanteValor ?? null,
        contaminante_unidade: contaminanteUnidade.trim() || null,
        contaminante_limite: nContaminanteLimite ?? null,
        equipamento: equipamento.trim() || null,
        numero_serie: numeroSerie.trim() || null,
        calibracao_validade: calibracaoValidade || null,
        medido_por_id: null,
        medido_por_nome: medidoPorNome.trim() || null,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          limpar();
          setAberto(false);
        },
      }
    );
  };

  const estado = resolveTableState({
    isLoading,
    error,
    isEmpty: medicoes.length === 0,
    modulo: "Medições atmosféricas",
    onRetry: refetch,
    emptyTitulo: "Nenhuma medição registrada",
    emptyDescricao:
      "A NR-33 proíbe a entrada em espaço confinado sem avaliação atmosférica prévia. Registre a medição de oxigênio, gases inflamáveis e contaminantes antes de liberar a entrada.",
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wind className="h-5 w-5 text-primary" />
          Avaliação atmosférica (NR-33)
        </h3>
        <p className="text-xs text-muted-foreground">
          Condição de entrada em espaço confinado. Oxigênio entre{" "}
          {String(OXIGENIO_MINIMO_ENTRADA).replace(".", ",")}% e {OXIGENIO_MAXIMO}%, inflamáveis
          abaixo de {INFLAMAVEIS_MAXIMO_LIE}% do LIE, contaminantes dentro do limite da NR-15.
        </p>
      </div>

      {/* Veredito de liberação */}
      <Card
        className={
          liberacao.liberado
            ? "border-l-4 border-l-emerald-500"
            : "border-l-4 border-l-red-500"
        }
      >
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            {liberacao.liberado ? (
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                {liberacao.liberado
                  ? "Entrada liberada pela avaliação atmosférica"
                  : "Entrada NÃO liberada"}
              </p>

              {liberacao.liberado ? (
                <p className="text-xs text-muted-foreground">
                  A medição pré-entrada mais recente está aprovada e há vigia designado. O
                  monitoramento durante a permanência continua obrigatório.
                </p>
              ) : (
                <ul className="space-y-1">
                  {liberacao.impedimentos.map((imp) => (
                    <li key={imp} className="flex items-start gap-1.5 text-xs">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                      {imp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {allowEdit && (
        <div className="flex justify-end">
          <Button
            variant={aberto ? "outline" : "default"}
            size="sm"
            onClick={() => setAberto((v) => !v)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {aberto ? "Cancelar" : "Registrar medição"}
          </Button>
        </div>
      )}

      {allowEdit && aberto && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="atm-momento">Momento da medição</Label>
              <Select
                value={momento}
                onValueChange={(v) => setMomento(v as MomentoMedicao)}
              >
                <SelectTrigger id="atm-momento" className="sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANTES_ENTRADA">Antes da entrada</SelectItem>
                  <SelectItem value="DURANTE">Durante a permanência</SelectItem>
                  <SelectItem value="APOS_INTERRUPCAO">Após interrupção</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{MOMENTO_AJUDA[momento]}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="atm-o2">Oxigênio (% volume)</Label>
                <Input
                  id="atm-o2"
                  inputMode="decimal"
                  placeholder="Ex: 20,8"
                  value={oxigenio}
                  onChange={(e) => setOxigenio(e.target.value)}
                  aria-invalid={nOxigenio === undefined}
                  className={nOxigenio === undefined ? "border-destructive" : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="atm-lie">Inflamáveis (% do LIE)</Label>
                <Input
                  id="atm-lie"
                  inputMode="decimal"
                  placeholder="Ex: 2"
                  value={inflamaveis}
                  onChange={(e) => setInflamaveis(e.target.value)}
                  aria-invalid={nInflamaveis === undefined}
                  className={nInflamaveis === undefined ? "border-destructive" : undefined}
                />
              </div>
            </div>

            {previa.oxigenio.situacao === "ATENCAO" && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {previa.oxigenio.mensagem}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="atm-causa"
                    checked={causaConhecida}
                    onCheckedChange={setCausaConhecida}
                  />
                  <Label htmlFor="atm-causa" className="text-xs whitespace-nowrap">
                    Causa conhecida e controlada
                  </Label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="atm-cont">Contaminante</Label>
                <Input
                  id="atm-cont"
                  placeholder="Ex: H₂S"
                  value={contaminanteNome}
                  onChange={(e) => setContaminanteNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-cont-val">Medido</Label>
                <Input
                  id="atm-cont-val"
                  inputMode="decimal"
                  value={contaminanteValor}
                  onChange={(e) => setContaminanteValor(e.target.value)}
                  aria-invalid={nContaminanteValor === undefined}
                  className={nContaminanteValor === undefined ? "border-destructive" : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-cont-un">Unidade</Label>
                <Input
                  id="atm-cont-un"
                  value={contaminanteUnidade}
                  onChange={(e) => setContaminanteUnidade(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-cont-lim">Limite (NR-15)</Label>
                <Input
                  id="atm-cont-lim"
                  inputMode="decimal"
                  value={contaminanteLimite}
                  onChange={(e) => setContaminanteLimite(e.target.value)}
                  aria-invalid={nContaminanteLimite === undefined}
                  className={nContaminanteLimite === undefined ? "border-destructive" : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="atm-equip">Detector</Label>
                <Input
                  id="atm-equip"
                  placeholder="Marca e modelo"
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-serie">Número de série</Label>
                <Input
                  id="atm-serie"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-calib">Calibração válida até</Label>
                <Input
                  id="atm-calib"
                  type="date"
                  value={calibracaoValidade}
                  onChange={(e) => setCalibracaoValidade(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="atm-quem">Quem mediu</Label>
                <Input
                  id="atm-quem"
                  placeholder="Deixe em branco para registrar você"
                  value={medidoPorNome}
                  onChange={(e) => setMedidoPorNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="atm-obs">Observações</Label>
                <Textarea
                  id="atm-obs"
                  rows={1}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            {/* Prévia do veredito com o que está digitado */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold">Conclusão desta medição</p>
              {(
                [
                  ["Oxigênio", previa.oxigenio],
                  ["Inflamáveis", previa.inflamaveis],
                  ["Contaminante", previa.contaminante],
                  ["Calibração", previa.calibracao],
                ] as const
              ).map(([rotulo, avaliacao]) => {
                const Icone = ICONE_SITUACAO[avaliacao.situacao];
                return (
                  <p key={rotulo} className="flex items-start gap-1.5 text-xs">
                    <Icone className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${TOM_SITUACAO[avaliacao.situacao]}`} />
                    <span>
                      <strong>{rotulo}:</strong> {avaliacao.mensagem}
                    </span>
                  </p>
                );
              })}
            </div>

            {numerosInvalidos && (
              <p className="text-xs text-destructive">
                Algum valor não é um número. Use vírgula para decimal (ex.: 20,8).
              </p>
            )}

            {semNenhumParametro && !numerosInvalidos && (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Informe ao menos um parâmetro medido — oxigênio, inflamáveis ou contaminante.
                Registro sem nenhum valor contaria como "atmosfera avaliada" sem ter sido.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={salvar}
                disabled={numerosInvalidos || semNenhumParametro || criarMedicao.isPending}
              >
                {criarMedicao.isPending ? "Salvando..." : "Registrar medição"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Momento</TableHead>
                <TableHead>O₂</TableHead>
                <TableHead>Inflamáveis</TableHead>
                <TableHead>Contaminante</TableHead>
                <TableHead>Detector</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Conclusão</TableHead>
                {allowEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {estado ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={allowEdit ? 9 : 8} className="p-0">
                    {estado}
                  </TableCell>
                </TableRow>
              ) : (
                medicoes.map((m) => {
                  const avaliacao = avaliarMedicao(m, new Date());
                  const vigente = liberacao.medicaoVigente?.id === m.id;

                  return (
                    <TableRow key={m.id} className={vigente ? "bg-muted/40" : ""}>
                      <TableCell className="text-xs whitespace-nowrap tabular-nums">
                        {new Date(m.medido_em).toLocaleString("pt-BR")}
                        {vigente && (
                          <span className="block text-primary">medição vigente</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {MOMENTO_LABEL[m.momento]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {m.oxigenio_percentual === null || m.oxigenio_percentual === undefined
                          ? "—"
                          : `${String(m.oxigenio_percentual).replace(".", ",")}%`}
                        {m.causa_variacao_conhecida && (
                          <span
                            className="block text-muted-foreground"
                            title="Causa da variação declarada conhecida e controlada"
                          >
                            causa controlada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {m.inflamaveis_percentual_lie === null ||
                        m.inflamaveis_percentual_lie === undefined
                          ? "—"
                          : `${String(m.inflamaveis_percentual_lie).replace(".", ",")}% LIE`}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.contaminante_valor === null || m.contaminante_valor === undefined ? (
                          "—"
                        ) : (
                          <>
                            {m.contaminante_nome || "Contaminante"}
                            <span className="block text-muted-foreground tabular-nums">
                              {String(m.contaminante_valor).replace(".", ",")}
                              {m.contaminante_unidade ? ` ${m.contaminante_unidade}` : ""}
                              {m.contaminante_limite !== null &&
                              m.contaminante_limite !== undefined
                                ? ` / LT ${String(m.contaminante_limite).replace(".", ",")}`
                                : ""}
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.equipamento || "—"}
                        {m.calibracao_validade && (
                          <span className="block text-muted-foreground">
                            cal. {new Date(`${m.calibracao_validade}T00:00:00`).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.medido_por_nome || m.medido_por?.nome || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {avaliacao.liberado ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs whitespace-nowrap"
                          >
                            Aprovada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-300 text-xs whitespace-nowrap"
                            title={avaliacao.impedimentos.join("\n")}
                          >
                            Reprovada
                          </Badge>
                        )}
                      </TableCell>
                      {/* A celula sai de dentro do allowEdit: ver a foto do
                          detector e leitura, e o vigia que confere no local
                          costuma nao ter permissao de editar. */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Fotos desta medição"
                            onClick={() =>
                              setFotosDe({
                                id: m.id,
                                subtitulo: `Medição de ${new Date(
                                  m.medido_em
                                ).toLocaleString("pt-BR")}`,
                              })
                            }
                          >
                            <Camera className="h-4 w-4" />
                          </Button>

                          {allowEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Remover medição"
                              onClick={() => removerMedicao.mutate(m.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A liberação usa a medição <strong>pré-entrada mais recente</strong> — uma medição nova
        reprovada não é salva por uma antiga aprovada. Medição feita com detector fora da
        calibração não conta como avaliação. Contaminante medido sem limite informado também não
        libera: há um número, mas nada contra o que compará-lo.
      </p>
      <SgsstEvidenciasDialog
        open={!!fotosDe}
        onOpenChange={(aberto) => !aberto && setFotosDe(null)}
        entidade="PT_MEDICAO"
        entidadeId={fotosDe?.id}
        permiteEditar={allowEdit}
        subtitulo={fotosDe?.subtitulo}
        ajuda="Fotografe o visor do detector com a leitura e o número de série. O valor digitado à mão não mostra o equipamento nem a hora do aparelho."
      />

    </div>
  );
}
