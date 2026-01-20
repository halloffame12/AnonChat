import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User, Gender } from '../types';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  login: (username: string, age: number, gender: Gender, location?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API URL for the Node.js backend
const SOCKET_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${SOCKET_URL}/api`;

// Session storage keys
const SESSION_KEY = 'anonchat_session';

interface StoredSession {
  user: User;
  token: string;
  timestamp: number;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const session: StoredSession = JSON.parse(storedSession);
        // Check if session is still valid (within 5 minutes)
        const SESSION_TTL = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - session.timestamp < SESSION_TTL) {
          console.log('[Auth] Restoring session for:', session.user.username);
          setUser(session.user);
          socketService.connect(session.token);
        } else {
          console.log('[Auth] Session expired, clearing');
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch (e) {
        console.error('[Auth] Failed to restore session:', e);
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    
    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount to allow session recovery
    };
  }, []);

  // Handle socket connection status
  useEffect(() => {
    const handleConnect = () => {
      console.log('[Auth] Socket connected');
      setConnectionError(null);
    };

    const handleConnectError = (error: Error) => {
      console.error('[Auth] Socket connection error:', error.message);
      setConnectionError(error.message);
      // Clear session on auth error
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('[Auth] Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server forced disconnect, likely auth issue
        setConnectionError('Disconnected by server');
      }
    };

    socketService.on('connect', handleConnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('disconnect', handleDisconnect);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('disconnect', handleDisconnect);
    };
  }, []);

  const login = useCallback(async (username: string, age: number, gender: Gender, location?: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, age, gender, location }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      
      if (!data.success || !data.user || !data.token) {
        throw new Error('Invalid server response');
      }
      
      // Store session for recovery
      const session: StoredSession = {
        user: data.user,
        token: data.token,
        timestamp: Date.now()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      
      // Update state with real user data from server
      setUser(data.user);
      
      // Connect socket with the returned token
      socketService.connect(data.token);

    } catch (error) {
      console.error("[Auth] Login error:", error);
      const message = error instanceof Error ? error.message : 'Login failed';
      setConnectionError(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const logout = useCallback(() => {
    console.log('[Auth] Logging out');
    setUser(null);
    setConnectionError(null);
    sessionStorage.removeItem(SESSION_KEY);
    socketService.disconnect();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isConnecting,
      connectionError,
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};