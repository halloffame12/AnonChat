import { io, Socket } from 'socket.io-client';

// ENVIRONMENT VALIDATION
const SOCKET_URL = (import.meta as any).env.VITE_API_URL;
if (!SOCKET_URL && (import.meta as any).env.PROD) {
  throw new Error('VITE_API_URL environment variable is required in production');
}
const FALLBACK_URL = 'http://localhost:3001';

type Listener = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Record<string, Listener[]> = {};
  private currentToken: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  connect(token: string) {
    // Store token for potential reconnection
    this.currentToken = token;
    this.reconnectAttempts = 0;
    
    if (this.socket) {
      console.log('[Socket] Cleaning up existing connection');
      this.disconnect();
    }

    const url = SOCKET_URL || FALLBACK_URL;
    console.log(`[Socket] Connecting to ${url}...`);
    
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.emitInternal('connect');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
      this.emitInternal('connect_error', error);
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
      this.emitInternal('error', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.emitInternal('disconnect', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      this.emitInternal('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after', this.maxReconnectAttempts, 'attempts');
      this.emitInternal('reconnect_failed');
    });

    // Map incoming socket events to internal listeners
    const eventsToForward = [
      'lobby:update',
      'rooms:update',
      'private:request',
      'private:request:response',
      'private:start', 
      'random:matched',
      'message:receive',
      'message:ack',
      'typing',
      // Legacy events for backward compatibility
      'presence:update',
      'group:message',
      'private:message',
      'matchFound',
      'newMessage',
      'userTyping',
      'userStoppedTyping',
      'onlineUsersUpdate',
      'roomsListUpdate'
    ];

    eventsToForward.forEach(event => {
      this.socket?.on(event, (data) => {
        this.emitInternal(event, data);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('[Socket] Disconnecting and cleaning up listeners');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Get connection state
  getState(): { connected: boolean; id: string | null } {
    return {
      connected: this.socket?.connected ?? false,
      id: this.socket?.id ?? null
    };
  }

  // Register a listener for the React components
  on(event: string, callback: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    // Prevent duplicate listener registration
    if (this.listeners[event].includes(callback)) {
      console.warn(`[Socket] Duplicate listener prevented for event: ${event}`);
      return;
    }
    this.listeners[event].push(callback);
    if (this.listeners[event].length > 3) {
      console.warn(`[Socket] Multiple listeners (${this.listeners[event].length}) registered for: ${event}`);
    }
  }

  // Remove a listener
  off(event: string, callback: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== callback);
    // Clean up empty arrays to prevent memory leaks
    if (this.listeners[event].length === 0) {
      delete this.listeners[event];
    }
  }

  // Remove ALL listeners for an event (useful for cleanup)
  removeAllListenersForEvent(event: string) {
    if (this.listeners[event]) {
      delete this.listeners[event];
    }
  }

  // Get listener count for debugging
  getListenerCount(event: string): number {
    return this.listeners[event]?.length || 0;
  }

  // Get all listener counts (for debugging)
  getAllListenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event in this.listeners) {
      counts[event] = this.listeners[event].length;
    }
    return counts;
  }

  // Emit event from React components to the Server
  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Cannot send message: Socket not connected');
    }
  }

  // Emit with callback
  sendWithCallback(event: string, data: any, callback: (response: any) => void) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data, callback);
    } else {
      console.warn('[Socket] Cannot send message: Socket not connected');
      callback({ success: false, error: 'Not connected' });
    }
  }

  // Internal helper to trigger registered React listeners
  private emitInternal(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(...args);
        } catch (error) {
          console.error(`[Socket] Error in listener for ${event}:`, error);
        }
      });
    }
  }
}

export const socketService = new SocketService();
