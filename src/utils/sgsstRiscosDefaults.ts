import type { CategoriaRisco, TecnicaAvaliacao } from "@/hooks/sgsst/useSgsstRiscos";

export interface RiscoPadrao {
  codigo: string;
  nome: string;
  categoria: CategoriaRisco;
  agente?: string;
  fonte_geradora?: string;
  consequencia?: string;
  /** Só preenchido onde a norma fecha um número. Ver a nota sobre limites abaixo. */
  limite_tolerancia?: number;
  unidade_medida?: string;
  tecnica_avaliacao?: TecnicaAvaliacao;
  base_legal?: string;
}

/**
 * Catálogo inicial de perigos e riscos para obras.
 *
 * O catálogo é pré-requisito de PGR, APR e PT, e nascia vazio: o primeiro
 * usuário tinha de cadastrar cada risco à mão antes de montar o primeiro PGR.
 * Esta lista cobre os agentes recorrentes da construção civil, agrupados pelas
 * cinco categorias do inventário de riscos (NR-01 / GRO), e serve como ponto de
 * partida editável — não como cadastro definitivo.
 *
 * Os códigos seguem o padrão CATEGORIA-NN para manter ordenação previsível.
 *
 * SOBRE OS LIMITES DE TOLERÂNCIA: só há número onde a norma fecha um valor sem
 * ambiguidade — é o caso do ruído contínuo (85 dB(A) para 8 h, NR-15 Anexo 1).
 * Agentes químicos têm limite por substância, em tabela do Anexo 11, e o valor
 * varia com o tempo de exposição; calor depende do regime de trabalho e
 * descanso. Semear um número genérico nesses casos seria inventar dado técnico
 * que depois assinaria um PGR. Por isso fica só a unidade e a base legal, e quem
 * elabora o programa informa o limite do agente específico.
 *
 * Estes mesmos valores estão na migration 20260820140000, que enriquece
 * catálogos já populados. Os dois caminhos precisam continuar coincidindo.
 */
export const RISCOS_PADRAO: RiscoPadrao[] = [
  // Físicos — NR-15 anexos 1 a 10
  {
    codigo: "FIS-01",
    nome: "Ruído contínuo ou intermitente",
    categoria: "Físico",
    agente: "Ruído acima de 85 dB(A)",
    fonte_geradora: "Serra circular, marteletes, betoneira, compactadores",
    consequencia: "Perda auditiva induzida por ruído (PAIR)",
    limite_tolerancia: 85,
    unidade_medida: "dB(A)",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 1 — 85 dB(A) para 8h de exposição",
  },
  {
    codigo: "FIS-02",
    nome: "Vibração de corpo inteiro",
    categoria: "Físico",
    agente: "Vibração mecânica",
    fonte_geradora: "Operação de rolo compactador, escavadeira, caminhão",
    consequencia: "Lombalgia e doenças da coluna vertebral",
    unidade_medida: "m/s²",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 8 — vibração de corpo inteiro (VDVR e aren)",
  },
  {
    codigo: "FIS-03",
    nome: "Vibração localizada em mãos e braços",
    categoria: "Físico",
    agente: "Vibração mecânica",
    fonte_geradora: "Martelete, rompedor, lixadeira, vibrador de concreto",
    consequencia: "Síndrome de Raynaud e doença dos dedos brancos",
    unidade_medida: "m/s²",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 8 — vibração em mãos e braços (aren)",
  },
  {
    codigo: "FIS-04",
    nome: "Calor",
    categoria: "Físico",
    agente: "Sobrecarga térmica (IBUTG)",
    fonte_geradora: "Trabalho a céu aberto, concretagem, solda",
    consequencia: "Exaustão térmica, câimbras, intermação",
    unidade_medida: "IBUTG °C",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 3 — limite varia com o regime de trabalho e descanso",
  },
  {
    codigo: "FIS-05",
    nome: "Radiação não ionizante",
    categoria: "Físico",
    agente: "Radiação ultravioleta e infravermelha",
    fonte_geradora: "Solda elétrica, exposição solar prolongada",
    consequencia: "Queimaduras, catarata, lesões de pele",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-15 Anexo 7 — radiações não ionizantes",
  },
  {
    codigo: "FIS-06",
    nome: "Umidade",
    categoria: "Físico",
    agente: "Umidade excessiva",
    fonte_geradora: "Escavações, cura de concreto, serviços em subsolo",
    consequencia: "Dermatoses e doenças respiratórias",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-15 Anexo 10 — umidade",
  },

  // Químicos — NR-15 anexos 11 a 13
  {
    codigo: "QUI-01",
    nome: "Poeira de sílica cristalina",
    categoria: "Químico",
    agente: "Sílica livre cristalina",
    fonte_geradora: "Corte de concreto, perfuração de rocha, jateamento",
    consequencia: "Silicose e câncer de pulmão",
    unidade_medida: "mg/m³",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 12 — poeiras minerais; limite calculado pela fração respirável",
  },
  {
    codigo: "QUI-02",
    nome: "Poeira de cimento",
    categoria: "Químico",
    agente: "Cimento Portland (álcalis)",
    fonte_geradora: "Preparo de argamassa e concreto, alvenaria",
    consequencia: "Dermatite de contato e irritação respiratória",
    unidade_medida: "mg/m³",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-09 — sem limite específico na NR-15; avaliar pela ACGIH",
  },
  {
    codigo: "QUI-03",
    nome: "Vapores orgânicos de tintas e solventes",
    categoria: "Químico",
    agente: "Hidrocarbonetos aromáticos, xileno, tolueno",
    fonte_geradora: "Pintura, aplicação de impermeabilizante, limpeza de peças",
    consequencia: "Depressão do sistema nervoso central, dermatoses",
    unidade_medida: "ppm",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 11 — limite por substância (tolueno, xileno)",
  },
  {
    codigo: "QUI-04",
    nome: "Fumos metálicos de solda",
    categoria: "Químico",
    agente: "Óxidos de ferro, manganês e cromo",
    fonte_geradora: "Solda elétrica e corte oxiacetilênico",
    consequencia: "Febre dos fumos metálicos, doenças pulmonares",
    unidade_medida: "mg/m³",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-15 Anexo 11 — fumos metálicos; limite por metal",
  },
  {
    codigo: "QUI-05",
    nome: "Gases asfixiantes em espaço confinado",
    categoria: "Químico",
    agente: "Deficiência de oxigênio, H₂S, monóxido de carbono",
    fonte_geradora: "Poços, galerias, reservatórios, caixas de passagem",
    consequencia: "Asfixia e morte por intoxicação aguda",
    unidade_medida: "% O₂",
    tecnica_avaliacao: "QUANTITATIVA",
    base_legal: "NR-33 — atmosfera entre 20,9% e 23% de O₂; medição obrigatória antes da entrada",
  },

  // Biológicos — NR-15 anexo 14
  {
    codigo: "BIO-01",
    nome: "Contato com esgoto e água contaminada",
    categoria: "Biológico",
    agente: "Bactérias, vírus e parasitas",
    fonte_geradora: "Serviços em rede de esgoto, galerias, drenagem",
    consequencia: "Leptospirose, hepatite A, verminoses",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-15 Anexo 14 — agentes biológicos; avaliação qualitativa",
  },
  {
    codigo: "BIO-02",
    nome: "Animais peçonhentos e vetores",
    categoria: "Biológico",
    agente: "Aranhas, escorpiões, serpentes, insetos",
    fonte_geradora: "Terreno com mato, entulho, materiais estocados",
    consequencia: "Acidentes por envenenamento, doenças transmitidas por vetor",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-15 Anexo 14 — agentes biológicos; avaliação qualitativa",
  },

  // Ergonômicos — NR-17
  {
    codigo: "ERG-01",
    nome: "Levantamento e transporte manual de cargas",
    categoria: "Ergonômico",
    agente: "Sobrecarga musculoesquelética",
    fonte_geradora: "Movimentação de sacos de cimento, blocos, ferragem",
    consequencia: "Lombalgia, hérnia de disco, lesões articulares",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-17 — análise ergonômica do trabalho (AET)",
  },
  {
    codigo: "ERG-02",
    nome: "Postura forçada e trabalho agachado",
    categoria: "Ergonômico",
    agente: "Postura inadequada prolongada",
    fonte_geradora: "Assentamento de piso, armação, acabamento",
    consequencia: "Lesões de joelho e coluna, LER/DORT",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-17 — análise ergonômica do trabalho (AET)",
  },
  {
    codigo: "ERG-03",
    nome: "Movimento repetitivo",
    categoria: "Ergonômico",
    agente: "Repetitividade de movimentos",
    fonte_geradora: "Amarração de ferragem, pintura, alvenaria",
    consequencia: "Tendinite, tenossinovite, LER/DORT",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-17 — análise ergonômica do trabalho (AET)",
  },
  {
    codigo: "ERG-04",
    nome: "Jornada prolongada e trabalho sob pressão de prazo",
    categoria: "Ergonômico",
    agente: "Fatores psicossociais e organizacionais",
    fonte_geradora: "Metas de cronograma, horas extras, turnos estendidos",
    consequencia: "Fadiga, estresse, aumento da probabilidade de acidente",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-17 — análise ergonômica do trabalho (AET)",
  },

  // Acidentes — NR-18, NR-35, NR-10, NR-12
  {
    codigo: "ACI-01",
    nome: "Queda de altura",
    categoria: "Acidente",
    agente: "Trabalho acima de 2,00 m",
    fonte_geradora: "Andaimes, lajes, periferia de edificação, escadas",
    consequencia: "Politraumatismo, invalidez permanente, óbito",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-35 — trabalho em altura acima de 2,00 m",
  },
  {
    codigo: "ACI-02",
    nome: "Queda de materiais e ferramentas",
    categoria: "Acidente",
    agente: "Projeção e queda de objetos",
    fonte_geradora: "Trabalho em pavimentos superpostos, içamento de carga",
    consequencia: "Traumatismo craniano, fraturas",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-18 — proteção contra queda de materiais",
  },
  {
    codigo: "ACI-03",
    nome: "Choque elétrico",
    categoria: "Acidente",
    agente: "Energia elétrica",
    fonte_geradora: "Instalações provisórias, rede energizada, ferramentas elétricas",
    consequencia: "Queimaduras, fibrilação ventricular, óbito",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-10 — segurança em instalações e serviços em eletricidade",
  },
  {
    codigo: "ACI-04",
    nome: "Contato com partes móveis de máquina",
    categoria: "Acidente",
    agente: "Zona de prensagem e corte",
    fonte_geradora: "Serra circular, policorte, betoneira sem proteção",
    consequencia: "Amputação e lesões graves em membros",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-12 — máquinas e equipamentos",
  },
  {
    codigo: "ACI-05",
    nome: "Soterramento em escavação",
    categoria: "Acidente",
    agente: "Desmoronamento de talude",
    fonte_geradora: "Valas e escavações sem escoramento adequado",
    consequencia: "Asfixia por soterramento, óbito",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-18 — escavações, fundações e desmonte",
  },
  {
    codigo: "ACI-06",
    nome: "Atropelamento e prensagem por equipamento móvel",
    categoria: "Acidente",
    agente: "Circulação de veículos e máquinas",
    fonte_geradora: "Tráfego de caminhões, retroescavadeira, empilhadeira",
    consequencia: "Politraumatismo, óbito",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-11 e NR-12 — transporte e movimentação de materiais",
  },
  {
    codigo: "ACI-07",
    nome: "Incêndio e explosão",
    categoria: "Acidente",
    agente: "Materiais combustíveis e inflamáveis",
    fonte_geradora: "Trabalho a quente, armazenamento de GLP e solventes",
    consequencia: "Queimaduras graves, óbito",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-23 — proteção contra incêndios",
  },
  {
    codigo: "ACI-08",
    nome: "Corte e perfuração",
    categoria: "Acidente",
    agente: "Superfícies cortantes e pontiagudas",
    fonte_geradora: "Ferragem exposta, chapas metálicas, ferramentas manuais",
    consequencia: "Cortes, perfurações, risco de tétano",
    tecnica_avaliacao: "QUALITATIVA",
    base_legal: "NR-18 e NR-06 — proteção contra cortes e perfurações",
  },
];
