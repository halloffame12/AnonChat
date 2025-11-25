import React, { useState } from 'react';
import { User, ChatSession, ChatType, Room } from '../types';
import { Users, MessageSquare, Search, Zap, MapPin, Hash } from 'lucide-react';

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
  onJoinRoom
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'rooms' | 'users'>('chats');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = onlineUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRooms = publicRooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100 w-full relative">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
             <img 
                src={currentUser.avatar} 
                alt="Me" 
                className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-lg shadow-indigo-500/20"
             />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{currentUser.username}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Online</span>
              <span className="text-xs text-slate-400">• {currentUser.age}yo</span>
            </div>
          </div>
        </div>

        <div className="flex p-1.5 bg-slate-100/80 rounded-xl">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'chats' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'rooms' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Rooms
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'users' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            People
          </button>
        </div>
      </div>

      {/* Search Bar (Shared) */}
      <div className="px-5 pt-2 pb-2">
         <div className="relative group">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'users' ? "Search people..." : "Search..."}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-smooth no-scrollbar p-3">
        {activeTab === 'chats' && (
          <div className="space-y-2">
            <button 
              onClick={onRandomChat}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-300 mb-6 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-bold text-base">Random Match</h4>
                <p className="text-xs text-indigo-100/90 font-medium">Find a stranger instantly</p>
              </div>
            </button>

            <div className="px-2 mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Chats</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{sessions.length}</span>
            </div>

            {sessions.length === 0 && (
                <div className="text-center py-10 opacity-50">
                    <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">No conversations yet</p>
                </div>
            )}

            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${
                  activeSessionId === session.id 
                    ? 'bg-indigo-50 text-primary ring-1 ring-indigo-100 shadow-sm' 
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="relative flex-shrink-0">
                  {session.avatar ? (
                     <img src={session.avatar} className="w-12 h-12 rounded-2xl bg-slate-200" alt="" />
                  ) : (
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${
                        session.type === ChatType.Group 
                            ? 'bg-orange-100 text-orange-600' 
                            : session.type === ChatType.Random 
                                ? 'bg-purple-100 text-purple-600'
                                : 'bg-blue-100 text-blue-600'
                    }`}>
                        {session.name.charAt(0)}
                    </div>
                  )}
                  {session.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
                      {session.unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className={`font-bold truncate text-sm ${activeSessionId === session.id ? 'text-primary' : 'text-slate-800'}`}>{session.name}</h4>
                    {session.lastMessage && (
                      <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                        {new Date(session.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate font-medium">
                    {session.isTyping ? (
                      <span className="text-primary flex items-center gap-1">
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                        typing...
                      </span>
                    ) : (
                      session.lastMessage?.content || 'Start chatting...'
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="space-y-2">
               <div className="flex items-center justify-between px-2 mb-2">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Public Rooms</span>
               </div>
               
               {filteredRooms.map(room => (
                   <div key={room.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group bg-white">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
                                 <Hash className="w-5 h-5" />
                             </div>
                             <div>
                                 <h4 className="font-bold text-slate-700 text-sm">{room.name}</h4>
                                 <p className="text-[10px] text-slate-400 font-medium">{room.participants} active users</p>
                             </div>
                        </div>
                        <button 
                            onClick={() => onJoinRoom(room.id)}
                            className="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg hover:bg-teal-100 transition-colors"
                        >
                            Join
                        </button>
                   </div>
               ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-2">
             <div className="px-2 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Online People</span>
             </div>

             {filteredUsers.length === 0 && (
                 <div className="text-center py-8 text-slate-400 text-sm">
                     No one else is online right now.
                 </div>
             )}

             {filteredUsers.map(user => (
               <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group bg-white">
                 <div className="flex items-center gap-3 min-w-0">
                   <div className="relative shrink-0">
                        <img src={user.avatar} className="w-10 h-10 rounded-full bg-slate-100" alt="" />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                   </div>
                   <div className="min-w-0">
                     <h4 className="font-bold text-slate-700 text-sm truncate">{user.username}</h4>
                     <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <span className="shrink-0">{user.age}yo • {user.gender}</span>
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
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl transition-all hover:bg-indigo-600 hover:text-white hover:shadow-md active:scale-95 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title="Start Chat"
                 >
                   <MessageSquare className="w-4 h-4" />
                 </button>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};