export function calcularClassificacaoRisco(probabilidade: number, severidade: number) {
  const nivel = probabilidade * severidade;
  let classificacao: "BAIXO" | "MODERADO" | "ALTO" | "CRÍTICO" = "BAIXO";
  if (nivel <= 4) classificacao = "BAIXO";
  else if (nivel <= 9) classificacao = "MODERADO";
  else if (nivel <= 16) classificacao = "ALTO";
  else classificacao = "CRÍTICO";

  return { nivel, classificacao };
}
