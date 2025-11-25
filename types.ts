export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

export interface User {
  id: string;
  username: string;
  age: number;
  gender: Gender;
  location?: string;
  avatar: string; // New avatar URL field
  isOnline: boolean;
  lastSeen?: Date;
}

export enum ChatType {
  Group = 'group',
  Private = 'private',
  Random = 'random',
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string; // Helpful for group chats
  senderAvatar?: string; // Helpful for group chats
  content: string;
  timestamp: Date;
  isRead: boolean;
  type: 'text' | 'system';
}

export interface ChatSession {
  id: string;
  type: ChatType;
  name: string; // Group name or Other User's name
  avatar?: string; // URL or placeholder
  participants: string[]; // User IDs
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface Room {
  id: string;
  name: string;
  participants: number;
}