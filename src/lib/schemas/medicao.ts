import { z } from "zod";

export const gerarMedicaoSchema = z.object({
  periodoInicio: z.string().min(1, "Data de início obrigatória").regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (yyyy-MM-dd)"),
  periodoFim: z.string().min(1, "Data de fim obrigatória").regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (yyyy-MM-dd)"),
  numeroMedicao: z.string().max(50, "Máximo de 50 caracteres").optional().or(z.literal("")),
  tipoMedicao: z.enum(["separada", "agrupada", "mista"]),
  projetoId: z.string().uuid("Projeto inválido").optional().or(z.literal("")),
  siteId: z.string().uuid("Site inválido").optional().or(z.literal("")),
}).refine((data) => {
  if (!data.periodoInicio || !data.periodoFim) return true;
  return new Date(data.periodoFim) >= new Date(data.periodoInicio);
}, {
  message: "A data de fim deve ser igual ou posterior ao início",
  path: ["periodoFim"],
});

export const lancamentoSchema = z.object({
  siteId: z.string().uuid("Selecione um site"),
  itemLpuId: z.string().uuid("Selecione um item LPU"),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  dataMedicao: z.string().min(1, "Data obrigatória"),
});

export type GerarMedicaoInput = z.infer<typeof gerarMedicaoSchema>;
export type LancamentoInput = z.infer<typeof lancamentoSchema>;
