import { createContext, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearDevAuth } from "@/lib/api";

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  initials?: string;
  avatar_url?: string | null;
  avatar_seed?: string | null;
  avatar_variant?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedOrgId: string | null;
  organizations: any[];
  setSelectedOrgId: (orgId: string) => void;
  isProUser: boolean;
  setIsProUser: (isPro: boolean) => void;
  reload: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [organizations] = useState<any[]>([]);
  const [isProUser, setIsProUser] = useState(true); // Enable pro features for demo
  const queryClient = useQueryClient();

  // Check authentication status from session
  const { data: authData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 0, // Always fresh to catch session changes
  });

  const user = authData ? {
    id: authData.id,
    name: authData.name,
    email: authData.email,
    role: authData.role,
    initials: authData.name ? authData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U',
    avatar_url: authData.avatar_url,
    avatar_seed: authData.avatar_seed,
    avatar_variant: authData.avatar_variant
  } : null;

  const isAuthenticated = !!authData && !error;

  const reload = async () => {
    await refetch();
    // Also invalidate all other queries to refresh the app state
    queryClient.invalidateQueries();
  };

  const logout = () => {
    clearDevAuth(); // Clear any dev headers
    window.location.href = '/api/auth/logout';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      selectedOrgId: selectedOrgId || authData?.orgId,
      organizations,
      setSelectedOrgId,
      isProUser,
      setIsProUser,
      reload,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
