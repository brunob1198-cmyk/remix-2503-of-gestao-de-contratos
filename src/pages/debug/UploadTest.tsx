import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runUploadSmokeTest } from "@/services/uploadSmokeTest";
import { Loader2, CheckCircle, XCircle, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UploadTestPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleRunTest = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await runUploadSmokeTest();
      setResults(res);
      if (res.error) {
        toast({ title: "Teste Falhou", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Teste Concluído", description: "Todos os passos passaram com sucesso!" });
      }
    } catch (err: any) {
      toast({ title: "Erro Inesperado", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Step = ({ label, passed, error }: { label: string; passed: boolean; error?: string }) => (
    <div className="flex items-center justify-between p-3 border-b last:border-0">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            R2 Upload Smoke Test
          </CardTitle>
          <CardDescription>
            Validação de ponta a ponta da integração com Cloudflare R2 e Worker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            onClick={handleRunTest} 
            disabled={loading}
            className="w-full h-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Executando Testes...</>
            ) : (
              <><PlayCircle className="h-5 w-5 mr-2" /> Iniciar Smoke Test</>
            )}
          </Button>

          {results && (
            <div className="border rounded-lg overflow-hidden">
              <Step label="Upload para R2" passed={results.upload} />
              <Step label="Verificação de Acessibilidade da URL" passed={results.verification} />
              <Step label="Cleanup (Remoção do arquivo de teste)" passed={results.cleanup} />
              
              {results.url && (
                <div className="p-3 bg-slate-50 text-xs break-all border-t">
                  <span className="font-bold block mb-1">URL Gerada:</span>
                  {results.url}
                </div>
              )}
              
              {results.error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm border-t">
                  <span className="font-bold block">Erro:</span>
                  {results.error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
