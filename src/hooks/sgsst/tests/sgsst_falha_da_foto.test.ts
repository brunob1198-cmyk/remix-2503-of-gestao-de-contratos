import { describe, it, expect } from "vitest";
import {
  classificarFalhaDaFoto,
  mensagemDaFalhaDaFoto,
  hostDaUrl,
  falhaEhDoHostInteiro,
} from "@/utils/sgsstFalhaDaFoto";

/**
 * O caso real: fotos num bucket público do Cloudflare R2 sem cabeçalho de CORS.
 * Medido no navegador, com a MESMA URL:
 *
 *   fetch(url) ..................... Failed to fetch
 *   <img src=url> .................. carrega, 512x512
 *   <img crossOrigin="anonymous"> .. erro
 *
 * O documento saía dizendo só "Failed to fetch", que é o que o navegador diz para
 * qualquer falha de rede e não indica nada a quem lê.
 */
describe("classificarFalhaDaFoto", () => {
  it("fetch falha e a imagem carrega: é CORS do host", () => {
    // O discriminador inteiro. A imagem carregar prova que o arquivo existe e é
    // público — o que falta é permissão para LER os bytes.
    expect(
      classificarFalhaDaFoto({ fetchRespondeu: false, imagemCarrega: true })
    ).toBe("CORS_DO_HOST");
  });

  it("fetch falha e a imagem também: é falta de resposta, não CORS", () => {
    expect(
      classificarFalhaDaFoto({ fetchRespondeu: false, imagemCarrega: false })
    ).toBe("SEM_RESPOSTA");
  });

  it("sem poder sondar a imagem, não afirma CORS", () => {
    // Chutar CORS aqui mandaria o usuário mexer na configuração do bucket por
    // causa de um problema que pode ser outro.
    expect(
      classificarFalhaDaFoto({ fetchRespondeu: false, imagemCarrega: null })
    ).toBe("OUTRA");
  });

  it("host respondeu 404 ou 403: arquivo ausente", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(
        classificarFalhaDaFoto({ fetchRespondeu: true, status }),
        `status ${status}`
      ).toBe("ARQUIVO_AUSENTE");
    }
  });

  it("conteúdo ilegível vence qualquer outra causa", () => {
    // Chegou a baixar; o problema é o arquivo, não a rede nem a permissão.
    expect(
      classificarFalhaDaFoto({
        fetchRespondeu: false,
        imagemCarrega: true,
        conteudoInvalido: true,
      })
    ).toBe("NAO_E_IMAGEM");
  });
});

describe("mensagemDaFalhaDaFoto", () => {
  it("no caso de CORS, diz o que configurar e nomeia o host", () => {
    // Mensagem que só descreve o sintoma faz abrir chamado; esta deixa o conserto
    // ao alcance de quem administra o bucket.
    const m = mensagemDaFalhaDaFoto("CORS_DO_HOST", {
      host: "pub-8e0d5fd8.r2.dev",
    });
    expect(m).toContain("pub-8e0d5fd8.r2.dev");
    expect(m).toContain("CORS");
    // E não deixa o usuário achar que perdeu a foto.
    expect(m).toContain("aparece na tela");
  });

  it("arquivo ausente cita o status quando há", () => {
    expect(mensagemDaFalhaDaFoto("ARQUIVO_AUSENTE", { status: 404 })).toContain("404");
  });

  it("causa desconhecida repassa o texto original em vez de inventar", () => {
    expect(mensagemDaFalhaDaFoto("OUTRA", { bruto: "algo específico" })).toBe(
      "algo específico"
    );
  });

  it("causa desconhecida sem texto ainda diz algo utilizável", () => {
    expect(mensagemDaFalhaDaFoto("OUTRA", {})).toBe("falha ao baixar o arquivo");
  });
});

describe("hostDaUrl", () => {
  it("extrai o host", () => {
    expect(hostDaUrl("https://pub-abc.r2.dev/foto.webp")).toBe("pub-abc.r2.dev");
  });

  it("URL inválida devolve vazio em vez de lançar", () => {
    // A emissão do PDF não pode quebrar por causa de uma URL malformada no banco.
    expect(hostDaUrl("nao-e-url")).toBe("");
  });
});

describe("falhaEhDoHostInteiro", () => {
  it("todas por CORS: é do host", () => {
    // CORS bloqueia todas as fotos igualmente, então cabe um aviso único em vez do
    // mesmo parágrafo repetido em cada moldura.
    expect(falhaEhDoHostInteiro(["CORS_DO_HOST", "CORS_DO_HOST"])).toBe(true);
  });

  it("causas mistas não são do host", () => {
    expect(falhaEhDoHostInteiro(["CORS_DO_HOST", "ARQUIVO_AUSENTE"])).toBe(false);
  });

  it("lista vazia não afirma nada", () => {
    expect(falhaEhDoHostInteiro([])).toBe(false);
  });
});
