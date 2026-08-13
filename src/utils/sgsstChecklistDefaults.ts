export type TipoPt =
  | "Trabalho a Quente"
  | "Trabalho em Altura"
  | "Espaço Confinado"
  | "Trabalho com Eletricidade"
  | "Escavação"
  | "Içamento"
  | "Trabalho com Produtos Químicos"
  | "Outros";

export function getDefaultChecklistItems(tipo: TipoPt): { item: string; obrigatorio: boolean }[] {
  switch (tipo) {
    case "Trabalho a Quente":
      return [
        { item: "Remoção ou proteção de materiais combustíveis/inflamáveis em raio de 10m", obrigatorio: true },
        { item: "Presença de extintor de incêndio carregado e inspecionado no local", obrigatorio: true },
        { item: "Equipamentos de solda/corte com mangueiras e válvulas de retenção checadas", obrigatorio: true },
        { item: "EPIs específicos (máscara de solda, avental de raspa, luva de raspa) disponíveis", obrigatorio: true },
        { item: "Observador de incêndio escalado durante e 30min após o término", obrigatorio: false },
      ];
    case "Trabalho em Altura":
      return [
        { item: "Inspeção diária do Cinto de Segurança Tipo Paraquedista e Talabarte Duplo com Absorvedor", obrigatorio: true },
        { item: "Ponto de Ancoragem testado e certificado (linha de vida estaiada ou ponto fixo)", obrigatorio: true },
        { item: "Isolamento e sinalização da área inferior contra queda de ferramentas/materiais", obrigatorio: true },
        { item: "Ferramentas manuais amarradas com cordel de segurança", obrigatorio: true },
        { item: "Verificação das condições meteorológicas (ausência de chuva/vento forte)", obrigatorio: true },
      ];
    case "Espaço Confinado":
      return [
        { item: "Avaliação da atmosfera (O2, gases inflamáveis e tóxicos) com detector calibrado", obrigatorio: true },
        { item: "Sistema de ventilação/exaustão forçada instalado e operante", obrigatorio: true },
        { item: "Vigia treinado posicionado no acesso do espaço confinado durante todo o trabalho", obrigatorio: true },
        { item: "Equipamento de resgate e sistema de içamento pronto para uso em emergência", obrigatorio: true },
        { item: "Comunicação contínua estabelecida entre vigia e trabalhadores internos", obrigatorio: true },
      ];
    case "Trabalho com Eletricidade":
      return [
        { item: "Desenergização, bloqueio e sinalização (Lockout & Tagout - LOTO) aplicados", obrigatorio: true },
        { item: "Constatação de ausência de tensão efetuada com instrumento calibrado", obrigatorio: true },
        { item: "Instalação de aterramento temporário com equipotencialização dos condutores", obrigatorio: true },
        { item: "Utilização de ferramentas isoladas 1000V e vestimenta NR-10 anti-arco elétrico", obrigatorio: true },
      ];
    case "Escavação":
      return [
        { item: "Sinalização e isolamento físico do perímetro da escavação", obrigatorio: true },
        { item: "Escoramento/blindagem de talude inspecionado por responsável técnico para valas > 1,25m", obrigatorio: true },
        { item: "Rampa ou escada de acesso/saída posicionada a menos de 7m dos trabalhadores", obrigatorio: true },
        { item: "Afastamento mínimo de 1,5m de equipamentos pesados e depósitos da borda", obrigatorio: true },
      ];
    case "Içamento":
      return [
        { item: "Plano de Rigging verificado e aprovado pelo engenheiro responsável", obrigatorio: true },
        { item: "Inspeção visual prévia de laços de cabo de aço, cintas sintéticas e manilhas", obrigatorio: true },
        { item: "Isolamento total do raio de giro da lança e carga suspensa", obrigatorio: true },
        { item: "Uso de cordas guia para direcionamento sem contato manual direto com a carga", obrigatorio: true },
      ];
    default:
      return [
        { item: "Área de trabalho sinalizada e isolada", obrigatorio: true },
        { item: "EPIs obrigatórios verificados e em bom estado", obrigatorio: true },
        { item: "Equipe instruída sobre os riscos e procedimentos de emergência", obrigatorio: true },
      ];
  }
}
