import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useServices } from "@/presentation/providers/services";
import i18n from "@/presentation/i18n";
import type { Lang, Profile } from "@/domain";

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  setUser: (p: Profile) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices().commands;
  const [user, setUserState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((p: Profile | null) => {
    setUserState(p);
    if (p?.language && p.language !== i18n.language) i18n.changeLanguage(p.language);
  }, []);

  useEffect(() => {
    auth.getSession().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [setUser, auth]);

  const value: AuthState = {
    user,
    loading,
    signIn: async (email, password) => {
      const uiLang = (["hy", "en", "ru"] as Lang[]).find((l) => l === i18n.language);
      const p = await auth.signIn(email, password, uiLang);
      setUser(p);
      return p;
    },
    signOut: async () => {
      await auth.signOut();
      setUserState(null);
    },
    setUser,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
