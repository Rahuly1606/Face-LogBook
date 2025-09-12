import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  adminToken: string;
  setAdminToken: (token: string) => void;
  captureInterval: number;
  setCaptureInterval: (interval: number) => void;
  isLiveCapturing: boolean;
  setIsLiveCapturing: (capturing: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [adminToken, setAdminToken] = useState(import.meta.env.VITE_ADMIN_TOKEN || 'dev-admin-token');
  const [captureInterval, setCaptureInterval] = useState(3000); // 3 seconds default
  const [isLiveCapturing, setIsLiveCapturing] = useState(false);

  const value = {
    adminToken,
    setAdminToken,
    captureInterval,
    setCaptureInterval,
    isLiveCapturing,
    setIsLiveCapturing,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};