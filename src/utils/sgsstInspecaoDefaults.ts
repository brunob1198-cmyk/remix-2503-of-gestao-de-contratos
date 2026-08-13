export type TipoInspecao =
  | "Inspeção de Segurança"
  | "Inspeção de Área"
  | "Inspeção de Equipamento"
  | "Inspeção de EPI"
  | "Inspeção de Trabalho"
  | "Inspeção de Obra"
  | "Inspeção Comportamental"
  | "Outros";

export function getDefaultInspecaoItems(tipo: TipoInspecao): { ordem: number; descricao: string; categoria: string; obrigatorio: boolean }[] {
  switch (tipo) {
    case "Inspeção de EPI":
      return [
        { ordem: 1, descricao: "Capacete de segurança com jugular em bom estado", categoria: "EPI", obrigatorio: true },
        { ordem: 2, descricao: "Óculos de proteção sem trincas ou riscos severos", categoria: "EPI", obrigatorio: true },
        { ordem: 3, descricao: "Calçado de segurança com biqueira e solado antiderrapante", categoria: "EPI", obrigatorio: true },
        { ordem: 4, descricao: "Protetor auditivo tipo plug ou concha higienizado e dentro da validade", categoria: "EPI", obrigatorio: true },
        { ordem: 5, descricao: "Luvas adequadas para o risco específico da tarefa (raspa, nitrílica, isolante)", categoria: "EPI", obrigatorio: true },
      ];
    case "Inspeção de Equipamento":
      return [
        { ordem: 1, descricao: "Proteções mecânicas de partes móveis e giratórias instaladas", categoria: "Máquinas", obrigatorio: true },
        { ordem: 2, descricao: "Botão de emergência / parada de segurança operacional", categoria: "Máquinas", obrigatorio: true },
        { ordem: 3, descricao: "Aterramento elétrico da carcaça do equipamento verificado", categoria: "Máquinas", obrigatorio: true },
        { ordem: 4, descricao: "Ausência de vazamentos de óleo hidráulico ou combustível", categoria: "Máquinas", obrigatorio: false },
        { ordem: 5, descricao: "Checklist diário do operador preenchido e afixado no equipamento", categoria: "Documentação", obrigatorio: true },
      ];
    case "Inspeção de Área":
      return [
        { ordem: 1, descricao: "Vias de circulação e saídas de emergência desobstruídas", categoria: "Organização", obrigatorio: true },
        { ordem: 2, descricao: "Organização e limpeza (Programa 5S) mantidos no setor", categoria: "Organização", obrigatorio: true },
        { ordem: 3, descricao: "Guarda-corpo e rodapé instalados em aberturas no piso e bordas de laje", categoria: "Proteção Coletiva", obrigatorio: true },
        { ordem: 4, descricao: "Extintores de incêndio com acesso livre e sinalizados", categoria: "Combate a Incêndio", obrigatorio: true },
        { ordem: 5, descricao: "Iluminação e ventilação adequadas no ambiente de trabalho", categoria: "Ergonomia/Ambiente", obrigatorio: false },
      ];
    case "Inspeção Comportamental":
      return [
        { ordem: 1, descricao: "Trabalhadores cumprem os procedimentos de segurança estabelecidos", categoria: "Comportamento", obrigatorio: true },
        { ordem: 2, descricao: "Uso correto e contínuo dos EPIs indicados para a função", categoria: "Comportamento", obrigatorio: true },
        { ordem: 3, descricao: "Posicionamento seguro em relação à linha de fogo e cargas suspensas", categoria: "Comportamento", obrigatorio: true },
        { ordem: 4, descricao: "Orientação e diálogo diário de segurança (DDS) realizado antes do início", categoria: "Treinamento", obrigatorio: false },
      ];
    default:
      return [
        { ordem: 1, descricao: "Verificação visual das condições gerais de segurança da frente de trabalho", categoria: "Geral", obrigatorio: true },
        { ordem: 2, descricao: "Sinalização de segurança e delimitação de área mantidas", categoria: "Sinalização", obrigatorio: true },
        { ordem: 3, descricao: "EPIs e EPCs adequados e em uso pela equipe", categoria: "Proteção", obrigatorio: true },
      ];
  }
}
