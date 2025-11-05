import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('faceattend_auth_token');
      if (token) {
        // Get stored user info from localStorage or set default
        const storedUser = localStorage.getItem('faceattend_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // Set default user if token exists but user info is missing
          const defaultUser = {
            id: 'admin',
            username: 'admin',
            email: '',
            role: 'admin'
          };
          setUser(defaultUser);
          localStorage.setItem('faceattend_user', JSON.stringify(defaultUser));
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('faceattend_auth_token');
      localStorage.removeItem('faceattend_user');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await api.post<{ success: boolean; access_token: string }>('/auth/login', {
      username,
      password,
    });

    if (response.success && response.access_token) {
      localStorage.setItem('faceattend_auth_token', response.access_token);
      // Set user info from username (backend doesn't return user object)
      const userData = {
        id: username,
        username: username,
        email: '',
        role: 'admin'
      };
      setUser(userData);
      // Store user info in localStorage for persistence
      localStorage.setItem('faceattend_user', JSON.stringify(userData));
    } else {
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    try {
      // Backend doesn't have logout endpoint, just clear local data
      await api.post('/auth/logout').catch(() => {
        // Ignore error if endpoint doesn't exist
      });
    } finally {
      localStorage.removeItem('faceattend_auth_token');
      localStorage.removeItem('faceattend_user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
