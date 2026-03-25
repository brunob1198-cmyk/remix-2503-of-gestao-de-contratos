import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Municipio {
  id: string;
  codigo_ibge: string;
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
}

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export function useMunicipios(uf?: string) {
  const { data: municipios = [], isLoading } = useQuery({
    queryKey: ["municipios_ibge", uf],
    queryFn: async () => {
      if (!uf) return [];
      const { data, error } = await supabase
        .from("municipios_ibge" as any)
        .select("*")
        .eq("uf", uf)
        .order("nome");
      if (error) throw error;
      return data as unknown as Municipio[];
    },
    enabled: !!uf,
    staleTime: Infinity, // Municipalities don't change
  });

  return { municipios, isLoading, UF_LIST };
}
