import { io, Socket } from 'socket.io-client';
import { Message, ChatSession, ChatType } from '../types';

// The URL of your Node.js backend
// Defaults to localhost if env var not set
const SOCKET_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

type Listener = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Record<string, Listener[]> = {};

  connect(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    console.log(`Connecting to socket server at ${SOCKET_URL}...`);
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'], // Try websocket first
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket server:', this.socket?.id);
      this.emitInternal('connect');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      this.emitInternal('disconnect');
    });

    // Map incoming socket events to internal listeners
    const eventsToForward = [
      'presence:update',
      'lobby:update',
      'rooms:update', // <--- ADDED THIS: Critical for receiving public rooms list
      'group:message',
      'private:request',
      'private:request:response',
      'private:start', 
      'private:message',
      'random:matched',
      'message:receive',
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
