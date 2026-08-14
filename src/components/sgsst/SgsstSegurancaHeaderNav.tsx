import { useNavigate, useLocation } from "react-router-dom";
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
    { id: "pgr", label: "PGR", path: "/medicoes/sgsst/pgr", icon: FileCheck, color: "text-blue-600" },
    { id: "apr", label: "APR", path: "/medicoes/sgsst/apr", icon: ClipboardList, color: "text-indigo-600" },
    { id: "pt", label: "Permissão de Trabalho (PT)", path: "/medicoes/sgsst/pt", icon: ShieldCheck, color: "text-amber-600" },
    { id: "inspecoes", label: "Inspeções", path: "/medicoes/sgsst/inspecoes", icon: SearchCheck, color: "text-emerald-600" },
    { id: "incidentes", label: "Incidentes & Acidentes", path: "/medicoes/sgsst/incidentes", icon: Siren, color: "text-red-600" },
    { id: "nao-conformidades", label: "Não Conformidades", path: "/medicoes/sgsst/nao-conformidades", icon: AlertOctagon, color: "text-purple-600" },
    { id: "riscos", label: "Catálogo de Riscos", path: "/medicoes/sgsst/riscos", icon: AlertTriangle, color: "text-yellow-600" },
    { id: "funcoes", label: "Funções / Cargos", path: "/medicoes/sgsst/funcoes", icon: Briefcase, color: "text-sky-600" },
  ];

  return (
    <div className="w-full mb-4">
      {/* Folder Tab Container */}
      <div className="bg-slate-100/90 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath.startsWith(tab.path);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`group px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer border ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs border-slate-200/80 dark:border-slate-700 ring-1 ring-primary/20"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40"
                }`}
              >
                <div
                  className={`p-1 rounded-md transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500 group-hover:text-slate-700"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : tab.color}`} />
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
