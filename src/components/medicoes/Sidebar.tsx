import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderKanban, MapPin, FileSpreadsheet,
  ClipboardList, Receipt, DollarSign, FileDown, ListChecks,
  HardHat, Boxes, BarChart3, LogOut, Users, Webhook, UserCircle,
  CalendarRange, ShoppingCart, History,
} from "lucide-react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  telaId?: string; // maps to permission tela
  telaIds?: string[]; // allows multiple permission checks
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/medicoes/dashboard", icon: LayoutDashboard, telaId: "dashboard" },
  { title: "Acompanhamento Medições", url: "/medicoes/acompanhamento", icon: ListChecks, telaId: "acompanhamento" },
  { title: "Cadastros", url: "/medicoes/cadastros", icon: FolderKanban, telaIds: ["projetos", "sites", "lpu"] },
  { title: "Diário de Obra", url: "/medicoes/diario", icon: HardHat, telaId: "diario" },
  { title: "Diário de Campo", url: "/medicoes/diario-campo", icon: MapPin, telaId: "diario" },
  { title: "RDO", url: "/medicoes/rdo", icon: FileDown, telaId: "rdo" },
  { title: "Análise de Obras", url: "/medicoes/analise", icon: BarChart3, telaId: "analise" },
  { title: "Planejamento", url: "/medicoes/planejamento", icon: CalendarRange, telaId: "planejamento" },
  { title: "Recursos", url: "/medicoes/recursos", icon: Boxes, telaId: "recursos" },
  { title: "Lançar Produção", url: "/medicoes/producao", icon: ClipboardList, telaId: "producao" },
  { title: "Lançar Medição", url: "/medicoes/medicao", icon: Receipt, telaId: "medicao" },
  { title: "Portal de Faturamento", url: "/medicoes/faturamento", icon: DollarSign, telaId: "faturamento" },
  { title: "Relatórios", url: "/medicoes/relatorios", icon: FileDown, telaId: "relatorios" },
  
  { title: "Supply Chain", url: "/medicoes/supply-chain", icon: ShoppingCart, telaId: "supply-chain" },
  { title: "Log de Alterações", url: "/medicoes/audit-log", icon: History, adminOnly: true },
  { title: "Integração ERP", url: "/medicoes/integracao-erp", icon: Webhook, telaId: "integracao-erp", adminOnly: true },
];

export function MedicoesSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, role, signOut } = useAuth();
  const { canView } = usePermissions();

  const visibleItems = menuItems.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    if (item.telaIds) {
      return item.telaIds.some(id => canView(id));
    }
    return item.telaId ? canView(item.telaId) : true;
  });

  const initials = profile?.nome
    ? profile.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="px-4 py-2 text-lg font-bold">
            {!collapsed && "Gestão de Contratos"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Admin-only: Gerenciar Usuários */}
              {role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/medicoes/usuarios"
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <Users className="h-5 w-5" />
                      {!collapsed && <span>Gerenciar Usuários</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Meu Perfil */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/medicoes/perfil"
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <UserCircle className="h-5 w-5" />
                    {!collapsed && <span>Meu Perfil</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User info + logout */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.nome || "Usuário"}</p>
                <p className="text-xs text-muted-foreground capitalize">{role || "—"}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
