import { io, Socket } from 'socket.io-client';
import { Message, ChatSession, ChatType } from '../types';

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

  connect(token: string) {
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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.emitInternal('connect');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
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

    // Map incoming socket events to internal listeners
    const eventsToForward = [
      'presence:update',
      'lobby:update',
      'rooms:update',
      'group:message',
      'private:request',
      'private:request:response',
      'private:start', 
      'private:message',
      'random:matched',
      'message:receive',
      'message:ack',
      'typing'
    ];

    eventsToForward.forEach(event => {
      this.socket?.on(event, (data) => {
        // console.log(`[Socket In] ${event}`, data);
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
  }

  // Register a listener for the React components
  on(event: string, callback: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // Remove a listener
  off(event: string, callback: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== callback);
  }

  // Emit event from React components to the Server
  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      // console.log(`[Socket Out] ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot send message: Socket not connected');
    }
  }

  // Internal helper to trigger registered React listeners
  private emitInternal(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }
}

export const socketService = new SocketService();
