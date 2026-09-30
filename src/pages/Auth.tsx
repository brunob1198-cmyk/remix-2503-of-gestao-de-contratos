import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus } from "lucide-react";
import { cnpjFormatado, cnpjLimpo } from "@/utils/cnpj";

export default function AuthPage() {
  const { session, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Empresa: mesma escolha que antes vivia na tela separada "/empresa-setup",
  // agora preenchida junto com login/cadastro. Só é usada se, depois de
  // autenticar, a conta ainda não tiver empresa vinculada — para quem já tem
  // (o caso comum de quem volta a entrar), o que estiver aqui é ignorado.
  const [empresaMode, setEmpresaMode] = useState<"join" | "create">("join");
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpjNova, setCnpjNova] = useState("");

  // Enquanto o submit está em andamento, o login já pode ter gerado uma sessão
  // (o listener do AuthContext atualiza `session` antes do handleSubmit terminar
  // de vincular a empresa) — sem esta trava, o redirect abaixo dispararia cedo
  // demais e o usuário cairia de novo em "/empresa-setup", recriando as duas
  // telas que esta mudança existe para eliminar.
  const [postAuthBusy, setPostAuthBusy] = useState(false);

  if (loading) return null;
  if (session && !postAuthBusy) return <Navigate to="/medicoes/acompanhamento" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setPostAuthBusy(true);

    try {
      let userId: string | null = null;

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        userId = data.user?.id ?? null;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        userId = data.user?.id ?? null;

        if (!data.session) {
          // Projeto exige confirmação por e-mail: ainda não há sessão para vincular
          // a empresa agora. O vínculo acontece depois, em "/empresa-setup", quando
          // a pessoa voltar pelo link do e-mail (essa tela continua de pé para isso).
          toast({
            title: "Cadastro realizado!",
            description: "Verifique seu e-mail para confirmar a conta.",
          });
          return;
        }
      }

      if (!userId) return;

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .maybeSingle();
      if (profErr) throw profErr;

      if (!prof?.empresa_id) {
        if (empresaMode === "join") {
          const cnpj = cnpjBusca.trim();
          if (!cnpj) throw new Error("Informe o CNPJ da empresa à qual deseja se vincular.");
          const { error: joinErr } = await supabase.rpc("join_empresa_by_cnpj", { _cnpj: cnpj });
          if (joinErr) {
            throw new Error(
              joinErr.message?.includes("não encontrada")
                ? "Nenhuma empresa encontrada com esse CNPJ. Verifique o número e tente novamente."
                : joinErr.message
            );
          }
        } else {
          if (!nomeEmpresa.trim()) throw new Error("Informe o nome da nova empresa.");
          const { error: createErr } = await supabase.rpc("setup_empresa", {
            _nome: nomeEmpresa.trim(),
            _cnpj: cnpjNova.trim() || null,
          });
          if (createErr) throw createErr;
        }
        await refreshProfile();
      }

      navigate("/medicoes/acompanhamento", { replace: true });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setPostAuthBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{isLogin ? "Entrar" : "Criar Conta"}</CardTitle>
          <CardDescription>
            {isLogin ? "Acesse sua conta e a empresa vinculada" : "Preencha os dados para criar sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Empresa</Label>
              <Tabs value={empresaMode} onValueChange={(v) => setEmpresaMode(v as "join" | "create")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="join" className="gap-2">
                    <Search className="h-4 w-4" />
                    Entrar em Empresa
                  </TabsTrigger>
                  <TabsTrigger value="create" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Nova Empresa
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="join" className="space-y-2 mt-3">
                  <Label htmlFor="cnpj-busca">CNPJ da Empresa</Label>
                  <Input
                    id="cnpj-busca"
                    value={cnpjBusca}
                    onChange={(e) => setCnpjBusca(cnpjFormatado(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o CNPJ da empresa à qual deseja se vincular. Se sua conta já pertence a uma
                    empresa, pode deixar em branco.
                  </p>
                </TabsContent>

                <TabsContent value="create" className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="nome-empresa">Nome da Empresa</Label>
                    <Input
                      id="nome-empresa"
                      value={nomeEmpresa}
                      onChange={(e) => setNomeEmpresa(e.target.value)}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj-nova">CNPJ (opcional)</Label>
                    <Input
                      id="cnpj-nova"
                      value={cnpjNova}
                      onChange={(e) => setCnpjNova(cnpjFormatado(e.target.value))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-4 pt-2 border-t">
              {!isLogin && (
                <div className="space-y-2 pt-4">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              )}
              <div className={`space-y-2 ${isLogin ? "pt-4" : ""}`}>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {isLogin && (
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Esqueceu a senha?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Aguarde..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isLogin ? (
              <p>
                Não tem conta?{" "}
                <button onClick={() => setIsLogin(false)} className="text-primary hover:underline">
                  Criar conta
                </button>
              </p>
            ) : (
              <p>
                Já tem conta?{" "}
                <button onClick={() => setIsLogin(true)} className="text-primary hover:underline">
                  Entrar
                </button>
              </p>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ao continuar, você declara estar ciente da{" "}
            <a href="/politica-de-privacidade.html" className="underline hover:text-primary">
              Política de Privacidade
            </a>{" "}
            e pode solicitar a{" "}
            <a href="/exclusao-de-conta.html" className="underline hover:text-primary">
              exclusão da sua conta
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
