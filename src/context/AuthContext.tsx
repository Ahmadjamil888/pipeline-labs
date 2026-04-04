import { createContext, useContext, ReactNode } from 'react';
import { useAuth0, User as Auth0User } from '@auth0/auth0-react';

interface AuthContextType {
  user: Auth0User | null;
  isAuthenticated: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    logout,
    loginWithRedirect,
  } = useAuth0();

  const signOut = async () => {
    await logout({ 
      logoutParams: {
        returnTo: window.location.origin 
      }
    });
  };

  const value: AuthContextType = {
    user: user || null,
    isAuthenticated,
    loading: isLoading,
    signOut,
    loginWithRedirect,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
