import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";

// Cache TTL para profile/role/empresa (raramente mudam)
const AUTH_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutos
const AUTH_CACHE_KEY = "auth_profile_cache_v1";

type AuthCache = {
  userId: string;
  cachedAt: number;
  profile: Profile | null;
  role: AppRole | null;
  empresaLogoUrl: string | null;
};

function readAuthCache(userId: string): AuthCache | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthCache;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.cachedAt > AUTH_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAuthCache(entry: AuthCache) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

function clearAuthCache() {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
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
  empresaLogoUrl: string | null;
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
    empresaLogoUrl: null,
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
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const applyProfileData = (
    profileData: Profile | null,
    roleData: AppRole | null,
    logoUrl: string | null,
  ) => {
    setProfile(profileData);
    setRole(roleData);
    setEmpresaLogoUrl(logoUrl);
  };

  const fetchProfileAndRole = async (userId: string, force = false) => {
    if (!force) {
      const cached = readAuthCache(userId);
      if (cached) {
        applyProfileData(cached.profile, cached.role, cached.empresaLogoUrl);
        lastFetchedUserIdRef.current = userId;
        return;
      }
    }

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

    if (profileRes.data?.empresa_id) {
      const { data: empData } = await supabase
        .from("empresas")
        .select("logo_url")
        .eq("id", profileRes.data.empresa_id)
        .maybeSingle();
      
      setEmpresaLogoUrl(empData?.logo_url || null);
    } else {
      setEmpresaLogoUrl(null);
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
        empresaLogoUrl,
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
