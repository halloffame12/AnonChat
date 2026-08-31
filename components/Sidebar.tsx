import React, { useState, useEffect } from 'react';
import { User, ChatSession, ChatType, Room } from '../types';
import AvatarPeep, { AvatarPeepCluster } from './AvatarPeep';
import {
  MessageSquare, Search, Zap, MapPin, Hash, Users, MessageCircle,
  X, ChevronRight, LogOut
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  sessions: ChatSession[];
  activeSessionId?: string;
  onSelectSession: (id: string) => void;
  onRandomChat: () => void;
  onStartPrivateChat: (userId: string) => void;
  onlineUsers: User[];
  publicRooms: Room[];
  onJoinRoom: (roomId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  sessions,
  activeSessionId,
  onSelectSession,
  onRandomChat,
  onStartPrivateChat,
  onlineUsers,
  publicRooms,
  onJoinRoom,
  isOpen,
  onClose,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'rooms' | 'users'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredUsers = onlineUsers.filter(u =>
    u.username.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const filteredRooms = publicRooms.filter(r =>
    r.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#faf8f5] w-full">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex items-center justify-between px-5 pt-3 pb-1 md:hidden">
          <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="icon-btn w-10 h-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* User profile header */}
      <div className="px-5 pt-3 pb-4 border-b border-warm-200">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <AvatarPeep seed={currentUser.id} size={48} className="ring-2 ring-white shadow-md" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-dark text-base leading-tight truncate">{currentUser.username}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Online</span>
              <span className="text-[11px] text-warm-500">{currentUser.age} • {currentUser.gender}</span>
            </div>
          </div>
          {/* Online count badge (desktop) */}
          <div className="hidden md:flex items-center gap-1 text-[11px] text-warm-500 bg-warm-100 px-2 py-1 rounded-full font-medium">
            <Users className="w-3 h-3" />
            {onlineUsers.length}
          </div>
          {/* Logout */}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="p-2.5 rounded-full text-warm-500 hover:text-accent hover:bg-accent/10 transition-colors -mr-1"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex p-1 bg-warm-100 rounded-2xl">
          {(['chats', 'rooms', 'users'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'bg-white text-primary shadow-sm shadow-warm-200/50'
                  : 'text-warm-600 hover:text-primary'
              }`}
            >
              {tab === 'chats' && <><MessageCircle className="w-3 h-3 inline-block mr-1" />Chats</>}
              {tab === 'rooms' && <><Hash className="w-3 h-3 inline-block mr-1" />Rooms</>}
              {tab === 'users' && <><Users className="w-3 h-3 inline-block mr-1" />People</>}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={activeTab === 'users' ? "Search people" : `Search ${activeTab}`}
            placeholder={activeTab === 'users' ? "Search people..." : `Search ${activeTab}...`}
            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-warm-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-warm-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 chat-scroll-area">
        {activeTab === 'chats' && (
          <div className="space-y-1.5">
            {/* Random Match button */}
            <button
              onClick={onRandomChat}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary-dark text-white shadow-warm hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 mb-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-bold text-sm">Random Match</h4>
                <p className="text-[11px] text-white/70 font-medium">Meet someone new instantly</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Chat list header */}
            <div className="flex items-center justify-between px-1 py-1.5">
              <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Conversations</span>
              <span className="text-[10px] font-bold bg-warm-100 text-warm-500 px-2 py-0.5 rounded-full">{sessions.length}</span>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-warm-400">
                <AvatarPeep seed="empty-chats" size={72} className="opacity-50 mb-4" />
                <p className="text-sm font-semibold text-warm-500">No conversations yet</p>
                <p className="text-xs mt-1 text-warm-400">Tap "Random Match" to start</p>
              </div>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose?.();
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${
                    activeSessionId === session.id
                      ? 'bg-white text-primary shadow-soft ring-1 ring-primary/20'
                      : 'hover:bg-warm-100 text-warm-700'
                  }`}
                >
                  <div className="relative shrink-0">
                    {session.type === ChatType.Group ? (
                      <div className="w-12 h-12 rounded-2xl bg-sage/20 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-sage" />
                      </div>
                    ) : (
                      <AvatarPeep seed={session.id} size={48} className="rounded-2xl" />
                    )}
                    {session.unreadCount > 0 && (
                      <div className="badge-count">{session.unreadCount > 9 ? '9+' : session.unreadCount}</div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className={`font-bold truncate text-sm ${activeSessionId === session.id ? 'text-primary' : 'text-dark'}`}>{session.name}</h4>
                      {session.lastMessage && (
                        <span className="text-[10px] text-warm-400 font-medium shrink-0 ml-2">
                          {new Date(session.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-500 truncate font-medium">
                      {session.isTyping ? (
                        <span className="text-primary flex items-center gap-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                      ) : (
                        session.lastMessage?.content || 'Start chatting...'
                      )}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 py-1.5">
              <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Public Rooms</span>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-warm-400">
                <AvatarPeep seed="empty-rooms" size={72} className="opacity-50 mb-4" />
                <p className="text-sm font-semibold text-warm-500">No rooms found</p>
                <p className="text-xs mt-1 text-warm-400">Try a different search</p>
              </div>
            ) : (
              filteredRooms.map(room => (
                <div key={room.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-warm-100 transition-all group bg-white border border-warm-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sage/20 text-sage flex items-center justify-center shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-dark text-sm truncate">{room.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-warm-500 font-medium">{room.participants} online</span>
                        {room.participants > 0 && (
                          <AvatarPeepCluster
                            seeds={[`room-${room.id}-1`, `room-${room.id}-2`, `room-${room.id}-3`]}
                            size={16}
                            max={3}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onJoinRoom(room.id);
                      onClose?.();
                    }}
                    className="px-5 py-2 bg-primary/10 text-primary-dark text-xs font-bold rounded-xl hover:bg-primary hover:text-white transition-all shrink-0 min-h-[38px]"
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 py-1.5">
              <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Online People</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-warm-400">
                <AvatarPeep seed="empty-users" size={72} className="opacity-50 mb-4" />
                <p className="text-sm font-semibold text-warm-500">No one online</p>
                <p className="text-xs mt-1 text-warm-400">Check back later</p>
              </div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-warm-100 transition-all group bg-white border border-warm-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <AvatarPeep seed={user.id} size={44} className="ring-2 ring-white" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-dark text-sm truncate">{user.username}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-warm-500 font-medium">
                        <span>{user.age} • {user.gender}</span>
                        {user.location && (
                          <span className="flex items-center gap-0.5 truncate max-w-[80px]">
                            <MapPin className="w-2.5 h-2.5 shrink-0" /> {user.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onStartPrivateChat(user.id)}
                    className="p-2.5 bg-primary/10 text-primary rounded-xl transition-all hover:bg-primary hover:text-white hover:shadow-md active:scale-95 opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0 touch-manipulation"
                    title="Start chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Mobile: render as slide-in drawer with backdrop
  if (onClose) {
    return (
      <>
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-dark/40 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={onClose}
          />
        )}
        <div
          className={`fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[80vw] bg-[#faf8f5] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop: static sidebar
  return sidebarContent;
};
