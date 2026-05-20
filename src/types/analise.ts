export interface AnaliseCustosRow {
  projetoId: string;
  projetoCodigo: string;
  projetoNome: string;
  area: string;
  cliente: string;
  referencia: string; // "Jan/2026"
  mesReferencia: string; // "2026-01"

  // ── RECEITA ──────────────────────────────────────
  poc: number; // Produção bruta (POC do período)
  impostos: {
    issqn: number;
    pis: number;
    cofins: number;
    inss: number;
    dara: number;
    icms: number;
    irpj: number;
    csll: number;
    totalPerc: number; // soma dos percentuais
    totalReais: number; // poc * totalPerc
  };
  producaoLiquida: number; // poc * (1 - impostos.totalPerc)

  // ── CUSTO DIRETO ──
  moObra: number;
  materiais: number;
  transporte: number;
  indiretos: number;
  custoDiretoReal: number;
  custoDiretoOrcado: number;
  deltaDireto: number;
  percCustoDiretoOrcado: number;
  percCustoDiretoReal: number;

  // ── GERÊNCIA ──
  gerenciaReal: number;
  gerenciaOrcada: number;
  deltaGerencia: number;
  percGerenciaOrcada: number;
  percGerenciaReal: number;
  pendentesCategorizacao: number;

  // ── CUSTO TOTAL ──
  custoTotalReal: number;
  custoTotalOrcado: number;
  resultadoTotal: number;

  // ── MB ──
  mbOrcada: number;
  mbRealizada: number;
  percMbOrcada: number;
  percMbReal: number;
  percMbMkp: number;

  // ── FLAGS ──
  alertaMb: boolean;
  alertaGerencia: boolean;
  semMkp: boolean;
  semImpostos: boolean;
}
