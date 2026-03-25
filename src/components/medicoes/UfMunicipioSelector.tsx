import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMunicipios } from "@/hooks/useMunicipios";

interface UfMunicipioSelectorProps {
  uf: string;
  municipio: string;
  onUfChange: (uf: string) => void;
  onMunicipioChange: (municipio: string) => void;
  required?: boolean;
  className?: string;
}

export function UfMunicipioSelector({ uf, municipio, onUfChange, onMunicipioChange, required, className }: UfMunicipioSelectorProps) {
  const { municipios, isLoading, UF_LIST } = useMunicipios(uf);

  const handleUfChange = (value: string) => {
    onUfChange(value);
    onMunicipioChange("");
  };

  return (
    <>
      <div className={`space-y-2 ${className || ""}`}>
        <Label>UF {required && "*"}</Label>
        <Select value={uf} onValueChange={handleUfChange} required={required}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {UF_LIST.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`space-y-2 ${className || ""}`}>
        <Label>Município {required && "*"}</Label>
        <Select value={municipio} onValueChange={onMunicipioChange} required={required} disabled={!uf || isLoading}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o município"} />
          </SelectTrigger>
          <SelectContent>
            {municipios.map((m) => (
              <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
