import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { login as apiLogin } from '../api/auth'; // Fixed path
import { getAdminToken, clearAdminToken } from '../utils/authToken';

interface AppContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  captureInterval: number;
  setCaptureInterval: (interval: number) => void;
  isLiveCapturing: boolean;
  setIsLiveCapturing: (capturing: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Custom hook for using the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

// For backward compatibility
export const useAppContext = useApp;

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [captureInterval, setCaptureInterval] = useState(3000); // 3 seconds default
  const [isLiveCapturing, setIsLiveCapturing] = useState(false);
  
  // State to track authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check auth on initial load based on presence of JWT
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    try {
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.token) {
          setIsAuthenticated(true);
          return;
        }
      }
    } catch {}
    setIsAuthenticated(false);
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    await apiLogin(username, password);
    // apiLogin stores user/token on success
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = () => {
    clearAdminToken();
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  const value = {
    isAuthenticated,
    setIsAuthenticated,
    login,
    logout,
    captureInterval,
    setCaptureInterval,
    isLiveCapturing,
    setIsLiveCapturing,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};