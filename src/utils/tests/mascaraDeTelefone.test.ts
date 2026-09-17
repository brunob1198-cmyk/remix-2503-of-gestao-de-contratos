import { describe, expect, it } from "vitest";
import { mascararTelefone, telefoneCompleto } from "../mascaraDeTelefone";

/**
 * O telefone vai para o rodapé de todo PDF da empresa. A máscara é de
 * DIGITAÇÃO: precisa funcionar em número incompleto, porque `(62) 3300` é um
 * estado legítimo de quem ainda está escrevendo.
 */

describe("mascararTelefone — números completos", () => {
  it("fixo de 10 dígitos", () => {
    expect(mascararTelefone("6233001148")).toBe("(62) 3300-1148");
  });

  it("celular de 11 dígitos", () => {
    expect(mascararTelefone("62993001148")).toBe("(62) 99300-1148");
  });

  it("o hífen fica sempre 4 dígitos antes do fim", () => {
    // É o que faz o nono dígito do celular empurrar a divisão sozinho, sem a
    // máscara precisar saber se é fixo ou móvel.
    expect(mascararTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(mascararTelefone("11933334444")).toBe("(11) 93333-4444");
  });
});

describe("mascararTelefone — enquanto se digita", () => {
  it("acompanha dígito a dígito", () => {
    expect(mascararTelefone("6")).toBe("(6");
    expect(mascararTelefone("62")).toBe("(62");
    expect(mascararTelefone("623")).toBe("(62) 3");
    expect(mascararTelefone("6233")).toBe("(62) 33");
    expect(mascararTelefone("623300")).toBe("(62) 3300");
    expect(mascararTelefone("62330011")).toBe("(62) 3300-11");
  });

  it("vazio continua vazio, e não vira um parêntese solto", () => {
    expect(mascararTelefone("")).toBe("");
    expect(mascararTelefone("   ")).toBe("");
    expect(mascararTelefone("abc")).toBe("");
  });
});

describe("mascararTelefone — o que já vem formatado", () => {
  it("reaplicar não acumula pontuação", () => {
    // O valor vem do banco já mascarado e passa pela função de novo ao carregar.
    expect(mascararTelefone("(62) 3300-1148")).toBe("(62) 3300-1148");
    expect(mascararTelefone(mascararTelefone("6233001148"))).toBe("(62) 3300-1148");
  });

  it("aceita outras pontuações que a pessoa tenha usado", () => {
    expect(mascararTelefone("62 3300 1148")).toBe("(62) 3300-1148");
    expect(mascararTelefone("62-3300-1148")).toBe("(62) 3300-1148");
  });

  it("apagar um dígito não move o hífen de lugar", () => {
    // Contando do FIM, o hífen andaria a cada tecla — `(62) 330-0114`. Contando
    // do começo, ele entra uma vez e fica onde está.
    expect(mascararTelefone("(62) 3300-114")).toBe("(62) 3300-114");
    expect(mascararTelefone("(62) 3300-11")).toBe("(62) 3300-11");
  });
});

describe("mascararTelefone — mais dígitos do que a numeração comporta", () => {
  it("com código do país, NÃO trunca", () => {
    /*
      Cortar em 11 produziria um telefone que não é o que a pessoa colou — num
      campo que vai para o rodapé de todo documento. Campo sem formatação é
      visivelmente estranho e se corrige; número errado e bem formatado passa
      despercebido até alguém tentar ligar.
    */
    expect(mascararTelefone("+55 62 3300-1148")).toBe("556233001148");
  });

  it("não inventa formatação para o que não reconhece", () => {
    expect(mascararTelefone("12345678901234")).toBe("12345678901234");
  });
});

describe("telefoneCompleto", () => {
  it("dez e onze dígitos contam como completo", () => {
    expect(telefoneCompleto("(62) 3300-1148")).toBe(true);
    expect(telefoneCompleto("(62) 99300-1148")).toBe(true);
  });

  it("incompleto, vazio ou longo demais não", () => {
    expect(telefoneCompleto("(62) 3300")).toBe(false);
    expect(telefoneCompleto("")).toBe(false);
    expect(telefoneCompleto("556233001148")).toBe(false);
  });
});
