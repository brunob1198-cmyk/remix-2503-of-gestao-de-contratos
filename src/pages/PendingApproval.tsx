import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { signOut, session, empresaId, aprovado, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!empresaId) {
      navigate("/empresa-setup", { replace: true });
      return;
    }

    if (aprovado) {
      navigate("/medicoes/acompanhamento", { replace: true });
    }
  }, [loading, session, empresaId, aprovado, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Acesso Pendente</CardTitle>
          <CardDescription>
            Sua solicitação de acesso foi enviada. O administrador da empresa precisa aprovar sua conta antes que você possa utilizar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Você receberá acesso assim que o administrador aprovar sua conta.
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
