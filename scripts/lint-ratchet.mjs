#!/usr/bin/env node
/**
 * Gate de lint por "ratchet" (catraca).
 *
 * A base de código tem um passivo grande e espalhado de erros de lint
 * (sobretudo @typescript-eslint/no-explicit-any). Rodar `eslint .` de forma
 * bloqueante deixaria o CI permanentemente vermelho; rodar sem bloquear nada
 * faria o passivo crescer sem ninguém perceber.
 *
 * Este script resolve o meio: falha somente se a contagem de erros AUMENTAR
 * em relação ao baseline registrado em .eslint-baseline.json.
 *
 * Uso:
 *   node scripts/lint-ratchet.mjs             # verifica (usado no CI)
 *   node scripts/lint-ratchet.mjs --update    # regrava o baseline com o valor atual
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = path.join(ROOT, ".eslint-baseline.json");
const shouldUpdate = process.argv.includes("--update");

function runEslint() {
  try {
    return execFileSync(
      process.execPath,
      [path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"), ".", "-f", "json"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
    );
  } catch (err) {
    // eslint sai com código 1 quando encontra erros — isso é esperado aqui.
    // Só é falha real se não houver stdout aproveitável.
    if (err.stdout) return err.stdout;
    console.error("Falha ao executar o eslint:");
    console.error(err.stderr || err.message);
    process.exit(2);
  }
}

const results = JSON.parse(runEslint());

let errors = 0;
let warnings = 0;
const worst = [];
for (const file of results) {
  errors += file.errorCount;
  warnings += file.warningCount;
  if (file.errorCount > 0) {
    worst.push([path.relative(ROOT, file.filePath), file.errorCount]);
  }
}

if (shouldUpdate) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const updated = { ...baseline, errors, warnings };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Baseline atualizado: ${errors} erros, ${warnings} warnings.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
// A tolerância absorve a variação de contagem entre plataformas
// (Windows/Node 24 x Ubuntu/Node 22). Ver comentário em .eslint-baseline.json.
const tolerance = baseline.tolerance ?? 0;
const limit = baseline.errors;
const delta = errors - limit;

console.log(`Erros de lint: ${errors} (baseline ${limit}, tolerância +${tolerance})`);
console.log(`Warnings: ${warnings} (baseline ${baseline.warnings})`);

if (delta > tolerance) {
  console.error(
    `\n❌ O passivo de lint aumentou em ${delta} erro(s), ` +
      `acima da tolerância de ${tolerance}.\n` +
      `Corrija os problemas introduzidos antes do merge.\n` +
      `Rode \`npm run lint\` para ver os detalhes.\n`,
  );
  console.error("Arquivos com mais erros:");
  for (const [file, count] of worst.sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.error(`  ${String(count).padStart(4)}  ${file}`);
  }
  process.exit(1);
}

if (delta < 0) {
  console.log(
    `\n✅ Passivo reduzido em ${-delta} erro(s). ` +
      `Rode \`npm run lint:ratchet -- --update\` e commite o .eslint-baseline.json ` +
      `para travar esse ganho.\n`,
  );
} else if (delta > 0) {
  console.log(
    `\n✅ ${delta} erro(s) acima do baseline, dentro da tolerância de ${tolerance}. ` +
      `Provavelmente variação de plataforma, não regressão.\n`,
  );
} else {
  console.log("\n✅ Passivo de lint estável.\n");
}
