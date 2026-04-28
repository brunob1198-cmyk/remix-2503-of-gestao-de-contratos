
import { isPointInUF } from "../lib/geoUtils";

/**
 * Simulação simples de teste de regressão.
 * Em um ambiente real com Vitest/Jest, usaríamos expect().
 */
export function runGeoTests() {
  const results = [];

  // Caso 1: Montes Claros/MG (Correto)
  const montesClarosMG = isPointInUF(-16.7269, -43.8609, "MG");
  results.push({ name: "Montes Claros em MG", pass: montesClarosMG === true });

  // Caso 2: Montes Claros em estado errado (Falso positivo antigo)
  const montesClarosNoES = isPointInUF(-16.7269, -43.8609, "ES");
  results.push({ name: "Montes Claros de MG NÃO deve estar no ES", pass: montesClarosNoES === false });

  // Caso 3: Bocaiuva/MG
  const bocaiuvaMG = isPointInUF(-17.1078, -43.8135, "MG");
  results.push({ name: "Bocaiúva em MG", pass: bocaiuvaMG === true });

  // Caso 4: Bocaiuva do Sul/PR (Mesmo nome, estado diferente)
  const bocaiuvaPR = isPointInUF(-25.2049, -49.1153, "PR");
  results.push({ name: "Bocaiúva do Sul no PR", pass: bocaiuvaPR === true });

  // Caso 5: Bocaiuva de MG no PR (Erro de ambiguidade)
  const bocaiuvaMGinPR = isPointInUF(-17.1078, -43.8135, "PR");
  results.push({ name: "Bocaiúva de MG NÃO deve estar no PR", pass: bocaiuvaMGinPR === false });

  console.table(results);
  return results;
}
