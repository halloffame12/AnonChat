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
  avatar: string;
  isOnline: boolean;
  lastSeen?: Date;
  interests?: string[];
}

export enum ChatType {
  Group = 'group',
  Private = 'private',
  Random = 'random',
}

export interface ReplyTo {
  messageId: string;
  content: string;
  senderName: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactors: string[];
  hasReacted: boolean;
}

export interface MessageAttachment {
  type: 'image' | 'gif';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  type: 'text' | 'system' | 'image' | 'gif';
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: ReplyTo;
  reactions?: MessageReaction[];
  attachment?: MessageAttachment;
}

export interface ChatSession {
  id: string;
  type: ChatType;
  name: string;
  avatar?: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  readReceiptsEnabled?: boolean;
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