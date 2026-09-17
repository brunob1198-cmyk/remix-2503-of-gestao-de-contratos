import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { useCustomLogo } from "@/hooks/useCustomLogo";
import { useToast } from "@/hooks/use-toast";

export function LogoWithUpload({ className = "h-10" }: { className?: string }) {
  const { customLogo, uploadLogo, removeLogo } = useCustomLogo();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadLogo(file);
      toast({ title: "Logo atualizado com sucesso!" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar logo",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  /*
    A remoção agora fala com o banco, então pode falhar — por falta de permissão,
    por exemplo. Antes era um `localStorage.removeItem`, que não falha nunca, e o
    clique podia ignorar o resultado sem prejuízo.
  */
  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeLogo();
      toast({ title: "Logo removido" });
    } catch (err) {
      toast({
        title: "Não foi possível remover o logo",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative group flex items-center">
      {customLogo ? (
        <img src={customLogo} alt="Logo" className={`${className} object-contain cursor-pointer rounded`} onClick={() => inputRef.current?.click()} />
      ) : (
        <div
          className={`${className} aspect-square rounded bg-muted flex items-center justify-center cursor-pointer border border-dashed border-muted-foreground/30`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 text-white" />
      </div>
      {customLogo && (
        <button
          onClick={handleRemove}
          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
