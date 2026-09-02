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
  LayoutDashboard, FolderKanban,
  ClipboardList, Receipt, DollarSign, FileDown, ListChecks,
  HardHat, Boxes, BarChart3, LogOut, Users, Webhook, UserCircle,
  CalendarRange, ShoppingCart, Zap, Wand2,
  Pin, PinOff,
  Percent, Settings2, Activity,
  GripVertical, ShieldCheck, Briefcase, UserCheck, AlertTriangle, FileCheck, SearchCheck, Siren, AlertOctagon, HeartPulse, GraduationCap, Shield, FolderArchive, FileBarChart, ClipboardCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { cn } from "@/lib/utils";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

interface MenuItem {
  id: string;
  title: string;
  url: string;
  icon: any;
  telaId?: string;
  telaIds?: string[];
  adminOnly?: boolean;
  group: "gestao" | "sgsst";
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // Gestão de Contratos
  { id: "dashboard", title: "Dashboard", url: "/medicoes/dashboard", icon: LayoutDashboard, group: "gestao" },
  { id: "acompanhamento", title: "Acompanhamento Medições", url: "/medicoes/acompanhamento", icon: ListChecks, telaId: "acompanhamento", group: "gestao" },
  { id: "cadastros", title: "Cadastros", url: "/medicoes/cadastros", icon: FolderKanban, telaIds: ["projetos", "sites", "lpu"], group: "gestao" },
  { id: "checklists", title: "Checklists", url: "/medicoes/checklists", icon: ClipboardCheck, telaId: "checklists", group: "gestao" },
  { id: "diario", title: "Diário de Obra", url: "/medicoes/diario", icon: HardHat, telaId: "diario", group: "gestao" },
  { id: "rdo", title: "RDO", url: "/medicoes/rdo", icon: FileDown, telaId: "rdo", group: "gestao" },
  { id: "analise", title: "Análise de Obras", url: "/medicoes/analise", icon: BarChart3, telaId: "analise", group: "gestao" },
  { id: "planejamento", title: "Planejamento", url: "/medicoes/planejamento", icon: CalendarRange, telaId: "planejamento", group: "gestao" },
  { id: "recursos", title: "Recursos", url: "/medicoes/recursos", icon: Boxes, telaId: "recursos", group: "gestao" },
  { id: "medicao", title: "Lançar Medição", url: "/medicoes/medicao", icon: Receipt, telaId: "medicao", group: "gestao" },
  { id: "faturamento", title: "Portal de Faturamento", url: "/medicoes/faturamento", icon: DollarSign, telaId: "faturamento", group: "gestao" },
  { id: "relatorios", title: "Relatórios", url: "/medicoes/relatorios", icon: FileDown, telaId: "relatorios", group: "gestao" },
  { id: "supply-chain", title: "Supply Chain", url: "/medicoes/supply-chain", icon: ShoppingCart, telaId: "supply-chain", group: "gestao" },
  { id: "power-bi", title: "Power BI", url: "/medicoes/power-bi", icon: BarChart3, telaId: "power-bi", group: "gestao" },
  { id: "integracao", title: "Integração", url: "/medicoes/integracao", icon: Webhook, adminOnly: true, group: "gestao" },
  { id: "usuarios", title: "Gerenciar Usuários", url: "/medicoes/usuarios", icon: Users, adminOnly: true, group: "gestao" },
  { id: "perfil", title: "Meu Perfil", url: "/medicoes/perfil", icon: UserCircle, group: "gestao" },

  // SGSST PRO
  { id: "sgsst-dashboard", title: "SGSST - Dashboard", url: "/medicoes/sgsst/dashboard", icon: Activity, telaId: "sgsst-dashboard", group: "sgsst" },
  { id: "sgsst-colaboradores", title: "SGSST - Colaboradores", url: "/medicoes/sgsst/colaboradores", icon: UserCheck, telaId: "sgsst-colaboradores", group: "sgsst" },
  { id: "sgsst-seguranca", title: "SGSST - Segurança", url: "/medicoes/sgsst/pgr", icon: ShieldCheck, telaIds: ["sgsst-pgr", "sgsst-apr", "sgsst-pt", "sgsst-inspecoes", "sgsst-incidentes", "sgsst-nao-conformidades", "sgsst-riscos", "sgsst-funcoes"], group: "sgsst" },
  { id: "sgsst-pcmso", title: "SGSST - Saúde Ocupacional", url: "/medicoes/sgsst/pcmso", icon: HeartPulse, telaId: "sgsst-pcmso", group: "sgsst" },
  { id: "sgsst-treinamentos", title: "SGSST - Treinamentos", url: "/medicoes/sgsst/treinamentos", icon: GraduationCap, telaId: "sgsst-treinamentos", group: "sgsst" },
  { id: "sgsst-epis", title: "SGSST - EPI", url: "/medicoes/sgsst/epis", icon: Shield, telaId: "sgsst-epis", group: "sgsst" },
  { id: "sgsst-documentos", title: "SGSST - Documentos", url: "/medicoes/sgsst/documentos", icon: FolderArchive, telaId: "sgsst-documentos", group: "sgsst" },
  { id: "sgsst-relatorios", title: "SGSST - Relatórios", url: "/medicoes/sgsst/relatorios", icon: FileBarChart, telaId: "sgsst-relatorios", group: "sgsst" },
];

interface SortableMenuItemProps {
  item: MenuItem;
  collapsed: boolean;
}

function SortableMenuItem({ item, collapsed }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <SidebarMenuItem className="flex items-center group/item relative">
        {!collapsed && (
          <div
            {...attributes}
            {...listeners}
            className="absolute -left-1 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-40 hover:!opacity-100 transition-opacity z-10"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}
        <SidebarMenuButton asChild tooltip={item.title}>
          <NavLink
            to={item.url}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground w-full text-xs sm:text-sm"
            activeClassName="bg-accent text-accent-foreground font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}

export function MedicoesSidebar() {
  const { state, isPinned, setIsPinned } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, role, signOut } = useAuth();
  const { canView } = usePermissions();
  const avatarUrl = profile?.avatar_url;

  const [items, setItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem(`sidebar_order_${profile?.id || "default"}`);
    if (saved) {
      try {
        const savedIds = JSON.parse(saved) as string[];
        const sorted = [...DEFAULT_MENU_ITEMS].sort((a, b) => {
          const indexA = savedIds.indexOf(a.id);
          const indexB = savedIds.indexOf(b.id);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        return sorted;
      } catch (e) {
        console.error("Error parsing saved sidebar order", e);
      }
    }
    return DEFAULT_MENU_ITEMS;
  });

  useEffect(() => {
    if (profile?.id) {
      localStorage.setItem(`sidebar_order_${profile.id}`, JSON.stringify(items.map(i => i.id)));
    }
  }, [items, profile?.id]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (item.adminOnly && role !== "admin") return false;
      if (item.telaIds) {
        return item.telaIds.some(id => canView(id));
      }
      return item.telaId ? canView(item.telaId) : true;
    });
  }, [items, role, canView]);

  const gestaoItems = useMemo(() => visibleItems.filter((i) => i.group === "gestao"), [visibleItems]);
  const sgsstItems = useMemo(() => visibleItems.filter((i) => i.group === "sgsst"), [visibleItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleGestaoDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === active.id);
        const newIndex = prevItems.findIndex((item) => item.id === over.id);
        return arrayMove(prevItems, oldIndex, newIndex);
      });
    }
  }

  function handleSgsstDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === active.id);
        const newIndex = prevItems.findIndex((item) => item.id === over.id);
        return arrayMove(prevItems, oldIndex, newIndex);
      });
    }
  }

  const initials = profile?.nome
    ? profile.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full overflow-y-auto">
        {/* GRUPO 1: GESTÃO DE CONTRATOS */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 flex items-center justify-between">
            {!collapsed && (
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Gestão de Contratos
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? "Desafixar menu" : "Fixar menu"}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGestaoDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            >
              <SidebarMenu>
                <SortableContext
                  items={gestaoItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {gestaoItems.map((item) => (
                    <SortableMenuItem key={item.id} item={item} collapsed={collapsed} />
                  ))}
                </SortableContext>
              </SidebarMenu>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 2: SGSST PRO */}
        {sgsstItems.length > 0 && (
          <SidebarGroup className="mt-2 pt-2 border-t border-sidebar-border">
            <SidebarGroupLabel className="px-4 py-2 flex items-center justify-between">
              {!collapsed && (
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  SGSST PRO
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSgsstDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
              >
                <SidebarMenu>
                  <SortableContext
                    items={sgsstItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sgsstItems.map((item) => (
                      <SortableMenuItem key={item.id} item={item} collapsed={collapsed} />
                    ))}
                  </SortableContext>
                </SidebarMenu>
              </DndContext>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="mt-auto border-t p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={resolveFileUrl(avatarUrl)} key={avatarUrl} />}
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