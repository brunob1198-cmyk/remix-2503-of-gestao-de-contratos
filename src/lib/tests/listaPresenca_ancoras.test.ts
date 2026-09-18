import { describe, expect, it } from "vitest";
import { gerarArquivoListaPresenca } from "@/lib/listaPresencaDocumento";
import { ancoraDe, lerAncoras } from "@/utils/ancoraDeAssinatura";
import { ESPACO_PARA_ASSINAR } from "@/utils/blocoDeAssinaturaPdf";
import type {
  SgsstTreinamentoParticipante,
  SgsstTreinamentoTurma,
} from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * Relatado com print: o instrutor assinou pelo link, o nome dele saiu na folha
 * de assinaturas do fim, e a linha dele DENTRO do documento continuou em branco.
 *
 * Este teste emite o PDF de verdade e lê as âncoras dos metadados do arquivo —
 * a mesma coisa que `carimbarAssinaturas` lê na hora de fechar a fila. Testar o
 * bloco isolado provaria a geometria e não provaria que ela chega ao arquivo,
 * que é onde a cadeia estava partida.
 */

const TURMA = {
  id: "turma-1",
  instrutor: "Bruno Souza",
  instrutor_qualificacao: "Téc. Seg. do Trabalho",
  responsavel_tecnico: "Marina Reis",
  data_inicial: "2026-09-01",
  data_final: "2026-09-01",
  modalidade: "PRESENCIAL",
  carga_horaria: 8,
} as unknown as SgsstTreinamentoTurma;

const participante = (nome: string): SgsstTreinamentoParticipante =>
  ({
    colaborador: { nome, cpf: "000.000.000-00", funcao: { nome: "Pedreiro" } },
  }) as unknown as SgsstTreinamentoParticipante;

async function ancorasDoArquivo(dados: {
  turma: SgsstTreinamentoTurma;
  participantes: readonly SgsstTreinamentoParticipante[];
}) {
  const arquivo = await gerarArquivoListaPresenca({
    ...dados,
    empresa: null,
    geradoPor: "teste",
  });
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await arquivo.arrayBuffer());
  return lerAncoras(pdf.getKeywords());
}

describe("lista de presença — onde carimbar a assinatura", () => {
  it("instrutor e responsável técnico têm lugar no documento", async () => {
    // Era isto que faltava: só as células da tabela registravam âncora, então o
    // bloco de assinatura do fim ficava em branco por mais que eles assinassem.
    const ancoras = await ancorasDoArquivo({
      turma: TURMA,
      participantes: [participante("Ana Lima")],
    });

    expect(ancoraDe(ancoras, "Bruno Souza")).not.toBeNull();
    expect(ancoraDe(ancoras, "Marina Reis")).not.toBeNull();
    // E o participante continua com a dele, na tabela.
    expect(ancoraDe(ancoras, "Ana Lima")).not.toBeNull();
  }, 60000);

  it("a área de assinar do bloco é a reservada, e não a da tabela", async () => {
    const ancoras = await ancorasDoArquivo({
      turma: TURMA,
      participantes: [participante("Ana Lima")],
    });

    const instrutor = ancoraDe(ancoras, "Bruno Souza");
    expect(instrutor?.altura).toBe(ESPACO_PARA_ASSINAR);
    // Largura de um campo do bloco, muito maior que a coluna de assinatura da
    // tabela: se saísse com a largura da célula, a âncora veio do lugar errado.
    expect(instrutor?.largura).toBeGreaterThan(100);
  }, 60000);

  it("turma sem responsável técnico não inventa âncora", async () => {
    const ancoras = await ancorasDoArquivo({
      turma: { ...TURMA, responsavel_tecnico: null } as SgsstTreinamentoTurma,
      participantes: [participante("Ana Lima")],
    });

    expect(ancoraDe(ancoras, "Bruno Souza")).not.toBeNull();
    expect(ancoras.some((a) => a.chave === "marina reis")).toBe(false);
  }, 60000);

  it("instrutor que também é participante fica com uma âncora só", async () => {
    // Duas âncoras com a mesma chave fariam `ancoraDe` devolver nulo para as
    // duas — e o documento sairia SEM carimbo, pior do que estava.
    const ancoras = await ancorasDoArquivo({
      turma: TURMA,
      participantes: [participante("Bruno Souza")],
    });

    expect(ancoras.filter((a) => a.chave === "bruno souza")).toHaveLength(1);
    expect(ancoraDe(ancoras, "Bruno Souza")).not.toBeNull();
  }, 60000);

  it("as âncoras do bloco ficam dentro da página", async () => {
    // Coordenada fora da folha não dá erro nenhum: o carimbo simplesmente não
    // aparece, que é a forma deste defeito de se esconder.
    const arquivo = await gerarArquivoListaPresenca({
      turma: TURMA,
      participantes: [participante("Ana Lima")],
      empresa: null,
      geradoPor: "teste",
    });
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await arquivo.arrayBuffer());
    const ancoras = lerAncoras(pdf.getKeywords());

    for (const a of ancoras) {
      const pagina = pdf.getPage(a.pagina);
      const { width, height } = pagina.getSize();
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.largura).toBeLessThanOrEqual(width);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y + a.altura).toBeLessThanOrEqual(height);
    }
  }, 60000);
});
