import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TELAS } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Clock, Shield, Eye, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

interface UserRow {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  aprovado: boolean;
  cargo: string | null;
  empresa_id: string | null;
}

interface RoleRow {
  user_id: string;
  role: string;
}

interface PermRow {
  user_id: string;
  tela: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
}

export default function GerenciarUsuariosPage() {
  const { user: currentUser, empresaId, role: myRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userPerms, setUserPerms] = useState<PermRow[]>([]);
  const [permDialogOpen, setPermDialogOpen] = useState(false);

  const fetchUsers = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url, aprovado, cargo, empresa_id")
      .eq("empresa_id", empresaId);
    setUsers((data as UserRow[]) || []);

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role");
    setRoles((rolesData as RoleRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [empresaId]);

  const getUserRole = (userId: string) =>
    roles.find((r) => r.user_id === userId)?.role || null;

  const handleApprove = async (userId: string) => {
    await supabase.from("profiles").update({ aprovado: true } as any).eq("id", userId);
    // Assign default role if none
    if (!getUserRole(userId)) {
      await supabase.from("user_roles").insert([{ user_id: userId, role: "interno" as const }]);
    }
    toast({ title: "Usuário aprovado!" });
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    // Remove from empresa
    await supabase.from("profiles").update({ aprovado: false, empresa_id: null } as any).eq("id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_permissions").delete().eq("user_id", userId);
    toast({ title: "Acesso revogado." });
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Delete existing role
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert([{ user_id: userId, role: newRole as any }]);
    toast({ title: "Papel atualizado!" });
    fetchUsers();
  };

  const openPermissions = async (u: UserRow) => {
    setSelectedUser(u);
    const { data } = await supabase
      .from("user_permissions")
      .select("user_id, tela, pode_visualizar, pode_editar")
      .eq("user_id", u.id);
    setUserPerms((data as PermRow[]) || []);
    setPermDialogOpen(true);
  };

  const togglePerm = async (tela: string, field: "pode_visualizar" | "pode_editar", value: boolean) => {
    if (!selectedUser) return;
    const existing = userPerms.find((p) => p.tela === tela);
    if (existing) {
      await supabase
        .from("user_permissions")
        .update({ [field]: value } as any)
        .eq("user_id", selectedUser.id)
        .eq("tela", tela);
    } else {
      await supabase.from("user_permissions").insert({
        user_id: selectedUser.id,
        tela,
        pode_visualizar: field === "pode_visualizar" ? value : false,
        pode_editar: field === "pode_editar" ? value : false,
      });
    }
    // Refresh
    const { data } = await supabase
      .from("user_permissions")
      .select("user_id, tela, pode_visualizar, pode_editar")
      .eq("user_id", selectedUser.id);
    setUserPerms((data as PermRow[]) || []);
  };

  const getInitials = (name: string | null) =>
    name
      ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
      : "?";

  if (myRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => !u.aprovado && u.id !== currentUser?.id);
  const activeUsers = users.filter((u) => u.aprovado);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>

      {/* Pending Approval */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-amber-500" />
              Aguardando Aprovação ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {u.avatar_url && <AvatarImage src={resolveFileUrl(u.avatar_url)} />}
                    <AvatarFallback>{getInitials(u.nome)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{u.nome || "Sem nome"}</p>
                    {u.cargo && <p className="text-sm text-muted-foreground">{u.cargo}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(u.id)} className="gap-1">
                    <CheckCircle className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(u.id)} className="gap-1">
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários Ativos ({activeUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeUsers.map((u) => {
              const userRole = getUserRole(u.id);
              const isMe = u.id === currentUser?.id;
              return (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {u.avatar_url && <AvatarImage src={resolveFileUrl(u.avatar_url)} />}
                      <AvatarFallback>{getInitials(u.nome)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {u.nome || "Sem nome"}
                        {isMe && <Badge variant="secondary" className="ml-2 text-xs">Você</Badge>}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{userRole || "sem papel"}</Badge>
                        {u.cargo && <span className="text-xs text-muted-foreground">{u.cargo}</span>}
                      </div>
                    </div>
                  </div>
                  {!isMe && (
                    <div className="flex items-center gap-2">
                      <Select value={userRole || ""} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Papel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="interno">Interno</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => openPermissions(u)} className="gap-1">
                        <Shield className="h-4 w-4" /> Permissões
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleReject(u.id)}>
                        Revogar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissões - {selectedUser?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 items-center text-sm font-medium text-muted-foreground pb-2 border-b">
              <span>Tela</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Ver</span>
              <span className="flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar</span>
            </div>
            {TELAS.map((tela) => {
              const perm = userPerms.find((p) => p.tela === tela.id);
              return (
                <div key={tela.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 items-center py-1">
                  <Label className="text-sm">{tela.label}</Label>
                  <Switch
                    checked={perm?.pode_visualizar ?? false}
                    onCheckedChange={(v) => togglePerm(tela.id, "pode_visualizar", v)}
                  />
                  <Switch
                    checked={perm?.pode_editar ?? false}
                    onCheckedChange={(v) => togglePerm(tela.id, "pode_editar", v)}
                  />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
