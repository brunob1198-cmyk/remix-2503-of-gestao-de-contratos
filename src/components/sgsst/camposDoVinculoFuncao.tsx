import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CelulaEditavel } from "@/components/sgsst/CelulaEditavel";
import { validarInteiroPositivo, lerInteiroPositivo } from "@/utils/validacaoInteiro";
import {
  TIPO_EXPOSICAO_LABEL,
  TIPOS_EXPOSICAO,
  type FuncaoEpi,
  type FuncaoRisco,
  type TabelaVinculo,
} from "@/hooks/sgsst/useSgsstFuncaoVinculos";

/**
 * Os campos editáveis de um vínculo de função.
 *
 * Ficam aqui porque duas telas mostram os mesmos dados com layouts diferentes —
 * a tabela de gerenciamento e o resumo da função. Duplicar os campos faria as
 * duas divergirem: uma ganharia uma validação nova, um rótulo novo, e a outra
 * ficaria para trás sem ninguém notar.
 */

/** Grava um campo do vínculo. Recebe a tabela porque as três compartilham a mutation. */
export type AtualizarVinculo = (
  tabela: TabelaVinculo,
  id: string,
  campos: Record<string, unknown>
) => void;

/**
 * Tipo e tempo de exposição ao risco.
 *
 * São dados DO VÍNCULO, não do risco no catálogo: o mesmo ruído é habitual para
 * quem opera a serra e eventual para quem passa pelo setor.
 */
export function ExposicaoDoRisco({
  vinculo,
  onAtualizar,
}: {
  vinculo: FuncaoRisco;
  onAtualizar: AtualizarVinculo;
}) {
  return (
    <div className="min-w-[8.5rem] space-y-1">
      <Select
        value={vinculo.tipo_exposicao}
        onValueChange={(valor) =>
          onAtualizar("sgsst_funcao_riscos", vinculo.id, { tipo_exposicao: valor })
        }
      >
        <SelectTrigger className="h-7 text-xs" aria-label="Tipo de exposição">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIPOS_EXPOSICAO.map((t) => (
            <SelectItem key={t} value={t}>
              {TIPO_EXPOSICAO_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CelulaEditavel
        valor={vinculo.tempo_exposicao ?? ""}
        placeholder="8h/dia"
        ariaLabel="Tempo de exposição"
        onSalvar={(texto) =>
          onAtualizar("sgsst_funcao_riscos", vinculo.id, { tempo_exposicao: texto || null })
        }
      />
    </div>
  );
}

/** Leitura da exposição, para quem não tem permissão de editar. */
export function ExposicaoDoRiscoTexto({ vinculo }: { vinculo: FuncaoRisco }) {
  return (
    <>
      {TIPO_EXPOSICAO_LABEL[vinculo.tipo_exposicao]}
      {vinculo.tempo_exposicao && (
        <span className="block text-muted-foreground">{vinculo.tempo_exposicao}</span>
      )}
    </>
  );
}

/**
 * Obrigatório ou recomendado.
 *
 * Só o obrigatório gera pendência no dossiê do trabalhador: recomendação
 * aparecendo como falta viraria ruído e a lista inteira passaria a ser ignorada.
 */
export function ObrigatoriedadeDoVinculo({
  tabela,
  id,
  obrigatorio,
  onAtualizar,
}: {
  tabela: TabelaVinculo;
  id: string;
  obrigatorio: boolean;
  onAtualizar: AtualizarVinculo;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={obrigatorio}
        aria-label="Alternar obrigatoriedade"
        onCheckedChange={(valor) => onAtualizar(tabela, id, { obrigatorio: valor })}
      />
      <span className="text-xs text-muted-foreground">
        {obrigatorio ? "Obrigatório" : "Recomendado"}
      </span>
    </div>
  );
}

/** Quantidade padrão de entrega do EPI. */
export function QuantidadeDoEpi({
  vinculo,
  onAtualizar,
}: {
  vinculo: FuncaoEpi;
  onAtualizar: AtualizarVinculo;
}) {
  return (
    <CelulaEditavel
      valor={String(vinculo.quantidade_padrao)}
      inputMode="numeric"
      ariaLabel="Quantidade padrão"
      className="w-14"
      validar={validarInteiroPositivo(true, "a quantidade")}
      onSalvar={(texto) =>
        onAtualizar("sgsst_funcao_epis", vinculo.id, {
          quantidade_padrao: lerInteiroPositivo(texto),
        })
      }
    />
  );
}

/** Periodicidade de troca, em meses. Vazio é "sem troca programada". */
export function TrocaDoEpi({
  vinculo,
  onAtualizar,
}: {
  vinculo: FuncaoEpi;
  onAtualizar: AtualizarVinculo;
}) {
  return (
    <CelulaEditavel
      valor={vinculo.periodicidade_troca_meses ? String(vinculo.periodicidade_troca_meses) : ""}
      inputMode="numeric"
      placeholder="sem troca"
      ariaLabel="Troca em meses"
      className="w-20"
      validar={validarInteiroPositivo(false, "a troca")}
      onSalvar={(texto) =>
        onAtualizar("sgsst_funcao_epis", vinculo.id, {
          // Vazio grava null: "sem troca programada" é uma decisão, e não o
          // mesmo que zero mês.
          periodicidade_troca_meses: lerInteiroPositivo(texto),
        })
      }
    />
  );
}
