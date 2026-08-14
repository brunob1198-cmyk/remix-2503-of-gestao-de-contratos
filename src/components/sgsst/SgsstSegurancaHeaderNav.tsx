import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileCheck,
  ClipboardList,
  ShieldCheck,
  SearchCheck,
  Siren,
  AlertOctagon,
  AlertTriangle,
  Briefcase,
  UserCheck,
} from "lucide-react";

export function SgsstSegurancaHeaderNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const tabs = [
    { id: "pgr", label: "PGR", path: "/medicoes/sgsst/pgr", icon: FileCheck },
    { id: "apr", label: "APR", path: "/medicoes/sgsst/apr", icon: ClipboardList },
    { id: "pt", label: "Permissão de Trabalho (PT)", path: "/medicoes/sgsst/pt", icon: ShieldCheck },
    { id: "inspecoes", label: "Inspeções", path: "/medicoes/sgsst/inspecoes", icon: SearchCheck },
    { id: "incidentes", label: "Incidentes & Acidentes", path: "/medicoes/sgsst/incidentes", icon: Siren },
    { id: "nao-conformidades", label: "Não Conformidades", path: "/medicoes/sgsst/nao-conformidades", icon: AlertOctagon },
    { id: "riscos", label: "Catálogo de Riscos", path: "/medicoes/sgsst/riscos", icon: AlertTriangle },
    { id: "funcoes", label: "Funções / Cargos", path: "/medicoes/sgsst/funcoes", icon: Briefcase },
    { id: "colaboradores", label: "Colaboradores", path: "/medicoes/sgsst/colaboradores", icon: UserCheck },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b mb-4 text-xs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentPath.startsWith(tab.path);
        return (
          <Button
            key={tab.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate(tab.path)}
            className={`gap-1.5 text-xs whitespace-nowrap ${isActive ? "font-bold border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
