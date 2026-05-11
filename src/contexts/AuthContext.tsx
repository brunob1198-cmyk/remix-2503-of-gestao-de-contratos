import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "interno" | "cliente";

interface Profile {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  empresa_id: string | null;
  aprovado: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  empresaId: string | null;
  aprovado: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  empresaId: null,
  aprovado: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaLogoUrl, setEmpresaLogoUrl] = useState<string | null>(null);

  const fetchProfileAndRole = async (userId: string) => {
    let profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    // If no profile exists (trigger may have been missing), create one
    if (!profileRes.data && !profileRes.error) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("profiles").insert({
          id: userData.user.id,
          nome: userData.user.user_metadata?.nome || userData.user.email,
        });
        // Re-fetch after creation
        profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      }
    }

    const roleRes = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();

    if (profileRes.error) {
      console.error("Erro ao carregar perfil:", profileRes.error.message);
      setProfile(null);
    } else if (profileRes.data) {
      setProfile({
        id: profileRes.data.id,
        nome: profileRes.data.nome,
        avatar_url: profileRes.data.avatar_url,
        empresa_id: profileRes.data.empresa_id,
        aprovado: (profileRes.data as any).aprovado ?? false,
      });
    } else {
      setProfile(null);
    }

    if (roleRes.error) {
      console.error("Erro ao carregar papel do usuário:", roleRes.error.message);
      setRole(null);
    } else if (roleRes.data) {
      setRole(roleRes.data.role as AppRole);
    } else {
      setRole(null);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfileAndRole(session.user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);

      if (nextSession?.user) {
        await fetchProfileAndRole(nextSession.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }

      if (mounted) setLoading(false);
    };

    // Get initial session first
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      syncAuthState(initialSession);
    });

    // Then listen for changes — use non-blocking callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        // Defer async work to avoid Supabase auth deadlock
        setTimeout(() => {
          syncAuthState(nextSession);
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role,
        empresaId: profile?.empresa_id ?? null,
        aprovado: profile?.aprovado ?? false,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
