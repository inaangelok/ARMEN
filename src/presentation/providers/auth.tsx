import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/composition-root";
import i18n from "@/presentation/i18n";
import type { Profile } from "@/domain/model";

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  setUser: (p: Profile) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((p: Profile | null) => {
    setUserState(p);
    if (p?.language && p.language !== i18n.language) i18n.changeLanguage(p.language);
  }, []);

  useEffect(() => {
    api.getSession().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [setUser]);

  const value: AuthState = {
    user,
    loading,
    signIn: async (email, password) => {
      let p = await api.signIn(email, password);
      // keep the language chosen on the login screen
      if (p.language !== i18n.language && ["hy", "en", "ru"].includes(i18n.language)) p = await api.updateMyProfile({ language: i18n.language as Profile["language"] });
      setUser(p);
      return p;
    },
    signOut: async () => {
      await api.signOut();
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
