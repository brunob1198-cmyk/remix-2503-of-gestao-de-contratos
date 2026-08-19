import type { CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";

export interface RiscoPadrao {
  codigo: string;
  nome: string;
  categoria: CategoriaRisco;
  agente?: string;
  fonte_geradora?: string;
  consequencia?: string;
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
  },
  {
    codigo: "FIS-02",
    nome: "Vibração de corpo inteiro",
    categoria: "Físico",
    agente: "Vibração mecânica",
    fonte_geradora: "Operação de rolo compactador, escavadeira, caminhão",
    consequencia: "Lombalgia e doenças da coluna vertebral",
  },
  {
    codigo: "FIS-03",
    nome: "Vibração localizada em mãos e braços",
    categoria: "Físico",
    agente: "Vibração mecânica",
    fonte_geradora: "Martelete, rompedor, lixadeira, vibrador de concreto",
    consequencia: "Síndrome de Raynaud e doença dos dedos brancos",
  },
  {
    codigo: "FIS-04",
    nome: "Calor",
    categoria: "Físico",
    agente: "Sobrecarga térmica (IBUTG)",
    fonte_geradora: "Trabalho a céu aberto, concretagem, solda",
    consequencia: "Exaustão térmica, câimbras, intermação",
  },
  {
    codigo: "FIS-05",
    nome: "Radiação não ionizante",
    categoria: "Físico",
    agente: "Radiação ultravioleta e infravermelha",
    fonte_geradora: "Solda elétrica, exposição solar prolongada",
    consequencia: "Queimaduras, catarata, lesões de pele",
  },
  {
    codigo: "FIS-06",
    nome: "Umidade",
    categoria: "Físico",
    agente: "Umidade excessiva",
    fonte_geradora: "Escavações, cura de concreto, serviços em subsolo",
    consequencia: "Dermatoses e doenças respiratórias",
  },

  // Químicos — NR-15 anexos 11 a 13
  {
    codigo: "QUI-01",
    nome: "Poeira de sílica cristalina",
    categoria: "Químico",
    agente: "Sílica livre cristalina",
    fonte_geradora: "Corte de concreto, perfuração de rocha, jateamento",
    consequencia: "Silicose e câncer de pulmão",
  },
  {
    codigo: "QUI-02",
    nome: "Poeira de cimento",
    categoria: "Químico",
    agente: "Cimento Portland (álcalis)",
    fonte_geradora: "Preparo de argamassa e concreto, alvenaria",
    consequencia: "Dermatite de contato e irritação respiratória",
  },
  {
    codigo: "QUI-03",
    nome: "Vapores orgânicos de tintas e solventes",
    categoria: "Químico",
    agente: "Hidrocarbonetos aromáticos, xileno, tolueno",
    fonte_geradora: "Pintura, aplicação de impermeabilizante, limpeza de peças",
    consequencia: "Depressão do sistema nervoso central, dermatoses",
  },
  {
    codigo: "QUI-04",
    nome: "Fumos metálicos de solda",
    categoria: "Químico",
    agente: "Óxidos de ferro, manganês e cromo",
    fonte_geradora: "Solda elétrica e corte oxiacetilênico",
    consequencia: "Febre dos fumos metálicos, doenças pulmonares",
  },
  {
    codigo: "QUI-05",
    nome: "Gases asfixiantes em espaço confinado",
    categoria: "Químico",
    agente: "Deficiência de oxigênio, H₂S, monóxido de carbono",
    fonte_geradora: "Poços, galerias, reservatórios, caixas de passagem",
    consequencia: "Asfixia e morte por intoxicação aguda",
  },

  // Biológicos — NR-15 anexo 14
  {
    codigo: "BIO-01",
    nome: "Contato com esgoto e água contaminada",
    categoria: "Biológico",
    agente: "Bactérias, vírus e parasitas",
    fonte_geradora: "Serviços em rede de esgoto, galerias, drenagem",
    consequencia: "Leptospirose, hepatite A, verminoses",
  },
  {
    codigo: "BIO-02",
    nome: "Animais peçonhentos e vetores",
    categoria: "Biológico",
    agente: "Aranhas, escorpiões, serpentes, insetos",
    fonte_geradora: "Terreno com mato, entulho, materiais estocados",
    consequencia: "Acidentes por envenenamento, doenças transmitidas por vetor",
  },

  // Ergonômicos — NR-17
  {
    codigo: "ERG-01",
    nome: "Levantamento e transporte manual de cargas",
    categoria: "Ergonômico",
    agente: "Sobrecarga musculoesquelética",
    fonte_geradora: "Movimentação de sacos de cimento, blocos, ferragem",
    consequencia: "Lombalgia, hérnia de disco, lesões articulares",
  },
  {
    codigo: "ERG-02",
    nome: "Postura forçada e trabalho agachado",
    categoria: "Ergonômico",
    agente: "Postura inadequada prolongada",
    fonte_geradora: "Assentamento de piso, armação, acabamento",
    consequencia: "Lesões de joelho e coluna, LER/DORT",
  },
  {
    codigo: "ERG-03",
    nome: "Movimento repetitivo",
    categoria: "Ergonômico",
    agente: "Repetitividade de movimentos",
    fonte_geradora: "Amarração de ferragem, pintura, alvenaria",
    consequencia: "Tendinite, tenossinovite, LER/DORT",
  },
  {
    codigo: "ERG-04",
    nome: "Jornada prolongada e trabalho sob pressão de prazo",
    categoria: "Ergonômico",
    agente: "Fatores psicossociais e organizacionais",
    fonte_geradora: "Metas de cronograma, horas extras, turnos estendidos",
    consequencia: "Fadiga, estresse, aumento da probabilidade de acidente",
  },

  // Acidentes — NR-18, NR-35, NR-10, NR-12
  {
    codigo: "ACI-01",
    nome: "Queda de altura",
    categoria: "Acidente",
    agente: "Trabalho acima de 2,00 m",
    fonte_geradora: "Andaimes, lajes, periferia de edificação, escadas",
    consequencia: "Politraumatismo, invalidez permanente, óbito",
  },
  {
    codigo: "ACI-02",
    nome: "Queda de materiais e ferramentas",
    categoria: "Acidente",
    agente: "Projeção e queda de objetos",
    fonte_geradora: "Trabalho em pavimentos superpostos, içamento de carga",
    consequencia: "Traumatismo craniano, fraturas",
  },
  {
    codigo: "ACI-03",
    nome: "Choque elétrico",
    categoria: "Acidente",
    agente: "Energia elétrica",
    fonte_geradora: "Instalações provisórias, rede energizada, ferramentas elétricas",
    consequencia: "Queimaduras, fibrilação ventricular, óbito",
  },
  {
    codigo: "ACI-04",
    nome: "Contato com partes móveis de máquina",
    categoria: "Acidente",
    agente: "Zona de prensagem e corte",
    fonte_geradora: "Serra circular, policorte, betoneira sem proteção",
    consequencia: "Amputação e lesões graves em membros",
  },
  {
    codigo: "ACI-05",
    nome: "Soterramento em escavação",
    categoria: "Acidente",
    agente: "Desmoronamento de talude",
    fonte_geradora: "Valas e escavações sem escoramento adequado",
    consequencia: "Asfixia por soterramento, óbito",
  },
  {
    codigo: "ACI-06",
    nome: "Atropelamento e prensagem por equipamento móvel",
    categoria: "Acidente",
    agente: "Circulação de veículos e máquinas",
    fonte_geradora: "Tráfego de caminhões, retroescavadeira, empilhadeira",
    consequencia: "Politraumatismo, óbito",
  },
  {
    codigo: "ACI-07",
    nome: "Incêndio e explosão",
    categoria: "Acidente",
    agente: "Materiais combustíveis e inflamáveis",
    fonte_geradora: "Trabalho a quente, armazenamento de GLP e solventes",
    consequencia: "Queimaduras graves, óbito",
  },
  {
    codigo: "ACI-08",
    nome: "Corte e perfuração",
    categoria: "Acidente",
    agente: "Superfícies cortantes e pontiagudas",
    fonte_geradora: "Ferragem exposta, chapas metálicas, ferramentas manuais",
    consequencia: "Cortes, perfurações, risco de tétano",
  },
];
