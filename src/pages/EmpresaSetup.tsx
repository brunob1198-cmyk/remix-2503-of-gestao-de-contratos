import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Search, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmpresaSetupPage() {
  const { user, refreshProfile, empresaId, loading } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Redirect when empresaId becomes available
  useEffect(() => {
    if (!loading && empresaId) {
      navigate("/medicoes/dashboard", { replace: true });
    }
  }, [loading, empresaId, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.rpc("setup_empresa", {
        _nome: nome,
        _cnpj: cnpj || null,
      });
      if (error) throw error;

      toast({ title: "Empresa criada com sucesso!" });
      await refreshProfile();
      navigate("/medicoes/dashboard", { replace: true });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !cnpjBusca.trim()) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.rpc("join_empresa_by_cnpj", {
        _cnpj: cnpjBusca.trim(),
      });
      if (error) throw error;

      toast({ title: "Solicitação enviada!", description: "Aguarde a aprovação do administrador da empresa." });
      await refreshProfile();
      navigate("/pending-approval", { replace: true });
    } catch (error: any) {
      const msg = error.message?.includes("não encontrada")
        ? "Nenhuma empresa encontrada com esse CNPJ. Verifique o número e tente novamente."
        : error.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Configurar Empresa</CardTitle>
          <CardDescription>
            Vincule-se a uma empresa existente ou crie uma nova para começar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="join" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="join" className="gap-2">
                <Search className="h-4 w-4" />
                Entrar em Empresa
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Nova
              </TabsTrigger>
            </TabsList>

            <TabsContent value="join">
              <form onSubmit={handleJoin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj-busca">CNPJ da Empresa</Label>
                  <Input
                    id="cnpj-busca"
                    value={cnpjBusca}
                    onChange={(e) => setCnpjBusca(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o CNPJ da empresa à qual deseja se vincular.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Buscando..." : "Entrar na Empresa"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Empresa *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar Empresa"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
