import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, Gender } from '../types';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, age: number, gender: Gender, location?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API URL for the Node.js backend
const SOCKET_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${SOCKET_URL}/api`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (username: string, age: number, gender: Gender, location?: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, age, gender, location }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      
      // Update state with real user data from server
      setUser(data.user);
      
      // Connect socket with the returned token
      socketService.connect(data.token);

    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    socketService.disconnect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};