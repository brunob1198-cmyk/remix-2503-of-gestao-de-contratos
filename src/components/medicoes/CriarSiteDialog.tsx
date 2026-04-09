import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";
import { useSites } from "@/hooks/useSites";
import { Plus } from "lucide-react";

interface CriarSiteDialogProps {
  projetoId: string;
  onSiteCreated: (siteId: string) => void;
}

export function CriarSiteDialog({ projetoId, onSiteCreated }: CriarSiteDialogProps) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const { createSite } = useSites(projetoId);

  const resetForm = () => {
    setCodigo("");
    setNome("");
    setUf("");
    setMunicipio("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !nome) return;

    createSite.mutate(
      { projeto_id: projetoId, codigo, nome, uf: uf || undefined, municipio: municipio || undefined },
      {
        onSuccess: async () => {
          // Fetch the newly created site to get its ID
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase
            .from("sites")
            .select("id")
            .eq("projeto_id", projetoId)
            .eq("codigo", codigo)
            .single();

          resetForm();
          setOpen(false);
          if (data?.id) {
            onSiteCreated(data.id);
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" disabled={!projetoId}>
          <Plus className="h-4 w-4" />
          Criar Site e Vincular
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="site-codigo">Código *</Label>
              <Input
                id="site-codigo"
                placeholder="Ex: 05-2026"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-nome">Nome *</Label>
              <Input
                id="site-nome"
                placeholder="Ex: CAM439"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          </div>

          <UfMunicipioSelector
            uf={uf}
            municipio={municipio}
            onUfChange={(v) => { setUf(v); setMunicipio(""); }}
            onMunicipioChange={setMunicipio}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!codigo || !nome || createSite.isPending}>
              {createSite.isPending ? "Criando..." : "Criar Site e Vincular"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
