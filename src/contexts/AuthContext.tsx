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
  // Deduplicação global: evita múltiplos requests simultâneos para o mesmo usuário
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  // Marca fetch pendente quando a rede falhou — usado para retry ao voltar online
  const pendingRefreshRef = useRef<string | null>(null);

  const applyProfileData = (
    profileData: Profile | null,
    roleData: AppRole | null,
    logoUrl: string | null,
  ) => {
    setProfile(profileData);
    setRole(roleData);
    setEmpresaLogoUrl(logoUrl);
  };

  const doFetch = async (userId: string, force: boolean) => {
    if (!force) {
      const cached = readAuthCache(userId);
      if (cached) {
        applyProfileData(cached.profile, cached.role, cached.empresaLogoUrl);
        lastFetchedUserIdRef.current = userId;
        return;
      }
    } else {
      // Force: exibe cache imediatamente (se houver) e atualiza em background
      const cached = readAuthCache(userId);
      if (cached) {
        applyProfileData(cached.profile, cached.role, cached.empresaLogoUrl);
      }
    }

    try {
      let profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

      if (!profileRes.data && !profileRes.error) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase.from("profiles").insert({
            id: userData.user.id,
            nome: userData.user.user_metadata?.nome || userData.user.email,
          });
          profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        }
      }

      const roleRes = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();

      let nextProfile: Profile | null = null;
      let nextRole: AppRole | null = null;
      let nextLogo: string | null = null;

      if (profileRes.error) throw profileRes.error;
      if (profileRes.data) {
        nextProfile = {
          id: profileRes.data.id,
          nome: profileRes.data.nome,
          avatar_url: profileRes.data.avatar_url,
          empresa_id: profileRes.data.empresa_id,
          aprovado: (profileRes.data as any).aprovado ?? false,
        };
      }

      if (roleRes.error) throw roleRes.error;
      if (roleRes.data) nextRole = roleRes.data.role as AppRole;

      if (profileRes.data?.empresa_id) {
        const { data: empData, error: empErr } = await supabase
          .from("empresas")
          .select("logo_url")
          .eq("id", profileRes.data.empresa_id)
          .maybeSingle();
        if (empErr) throw empErr;
        nextLogo = empData?.logo_url || null;
      }

      applyProfileData(nextProfile, nextRole, nextLogo);
      lastFetchedUserIdRef.current = userId;
      pendingRefreshRef.current = null;
      writeAuthCache({
        userId,
        cachedAt: Date.now(),
        profile: nextProfile,
        role: nextRole,
        empresaLogoUrl: nextLogo,
      });
    } catch (err) {
      // Fallback: mantém cache exibido e marca refresh pendente para quando a rede voltar
      console.warn("[Auth] Falha ao carregar profile — usando cache. Retry ao reconectar.", err);
      pendingRefreshRef.current = userId;
      const cached = readAuthCache(userId);
      if (cached) {
        applyProfileData(cached.profile, cached.role, cached.empresaLogoUrl);
        lastFetchedUserIdRef.current = userId;
      }
    }
  };

  const fetchProfileAndRole = (userId: string, force = false): Promise<void> => {
    const key = `${userId}:${force ? "force" : "soft"}`;
    const existing = inFlightRef.current.get(key);
    if (existing) return existing;
    const promise = doFetch(userId, force).finally(() => {
      inFlightRef.current.delete(key);
    });
    inFlightRef.current.set(key, promise);
    return promise;
  };

  const refreshProfile = async () => {
    if (session?.user) {
      // Invalida cache e recarrega (dedupado globalmente)
      clearAuthCache();
      lastFetchedUserIdRef.current = null;
      await fetchProfileAndRole(session.user.id, true);
    }
  };


  useEffect(() => {
    let mounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);

      if (nextSession?.user) {
        if (lastFetchedUserIdRef.current === nextSession.user.id) {
          if (mounted) setLoading(false);
          return;
        }
        await fetchProfileAndRole(nextSession.user.id);
      } else {
        lastFetchedUserIdRef.current = null;
        clearAuthCache();
        setProfile(null);
        setRole(null);
        setEmpresaLogoUrl(null);
      }

      if (mounted) setLoading(false);
    };


    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      syncAuthState(initialSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setTimeout(() => {
          syncAuthState(nextSession);
        }, 0);
      }
    );

    // Retry automático ao voltar online se houver refresh pendente
    const handleOnline = () => {
      const pending = pendingRefreshRef.current;
      if (pending) {
        fetchProfileAndRole(pending, true);
      }
    };
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    lastFetchedUserIdRef.current = null;
    inFlightRef.current.clear();
    pendingRefreshRef.current = null;
    clearAuthCache();
    setSession(null);
    setProfile(null);
    setRole(null);
    setEmpresaLogoUrl(null);
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
