import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { LandingPage } from './components/LandingPage';
import { socketService } from './services/socket';
import { ChatSession, ChatType, Message, User, Room } from './types';
import { Loader2, CheckCircle, XCircle, MessageCircle, X, Check } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  
  // New States for Backend Integration
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<{ requesterId: string, requesterName: string, requesterAvatar?: string } | null>(null);

  // Initialize Socket connection upon login
  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect(user.id);
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, user]);

  // Handle Socket Events
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Update Online Users
    const handleLobbyUpdate = (data: { activeUsers: number, users: User[] }) => {
        setOnlineUsers(data.users.filter(u => u.id !== user?.id));
    };
    
    // 2. Room List Updates
    const handleRoomsUpdate = (rooms: Room[]) => {
        setPublicRooms(rooms);
    };

    // 3. Incoming Private Chat Request
    const handlePrivateRequest = (data: { requesterId: string, requesterName: string, requesterAvatar?: string }) => {
        setIncomingRequest(data);
    };

    // 4. Private Chat Started
    const handlePrivateStart = (data: { chatId: string, partnerId: string, partnerName: string, partnerAvatar?: string }) => {
         const newSession: ChatSession = {
           id: data.chatId,
           type: ChatType.Private,
           name: data.partnerName,
           avatar: data.partnerAvatar,
           participants: [user!.id, data.partnerId],
           unreadCount: 0,
           lastMessage: {
             id: Date.now().toString(),
             chatId: data.chatId,
             senderId: 'system',
             content: 'Private chat started',
             timestamp: new Date(),
             isRead: true,
             type: 'system'
           }
         };
         setSessions(prev => [newSession, ...prev]);
         setActiveSessionId(newSession.id);
         setIncomingRequest(null);
         showToast(`Chat started with ${data.partnerName}`, 'success');
    };

    // 5. Random Match Found
    const handleRandomMatch = (session: ChatSession) => {
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setIsSearching(false);
      showToast('Found a random match!', 'success');
    };

    // 6. Request Declined
    const handlePrivateResponse = (data: { accepted: boolean, targetUserId: string }) => {
      if (!data.accepted) {
        showToast('User declined your request', 'error');
      }
    };

    const handleTyping = (data: { chatId: string, isTyping: boolean }) => {
      setSessions(prev => prev.map(s => 
        s.id === data.chatId ? { ...s, isTyping: data.isTyping } : s
      ));
    };
    
    const handleReceiveMessage = (msg: Message) => {
        setSessions(prev => {
            // Check if session exists for this message
            const exists = prev.find(s => s.id === msg.chatId);
            
            // If it's a message for a room we just joined but don't have a session for yet
            if (!exists && msg.type === 'system' && msg.content.includes('joined')) {
                 // Fetch room info (simplified for this demo: finding from publicRooms)
                 const room = publicRooms.find(r => r.id === msg.chatId);
                 if(room) {
                     return [{
                         id: room.id,
                         type: ChatType.Group,
                         name: room.name,
                         participants: [], // Populated by server in real app
                         unreadCount: 0,
                         lastMessage: msg
                     }, ...prev];
                 }
            }

            return prev.map(s => {
                if (s.id === msg.chatId) {
                    return {
                        ...s,
                        lastMessage: msg,
                        unreadCount: s.id !== activeSessionId ? s.unreadCount + 1 : s.unreadCount
                    };
                }
                return s;
            });
        });
    };

    socketService.on('lobby:update', handleLobbyUpdate);
    socketService.on('rooms:update', handleRoomsUpdate);
    socketService.on('private:request', handlePrivateRequest);
    socketService.on('private:start', handlePrivateStart);
    socketService.on('random:matched', handleRandomMatch);
    socketService.on('private:request:response', handlePrivateResponse);
    socketService.on('typing', handleTyping);
    socketService.on('message:receive', handleReceiveMessage);

    return () => {
      socketService.off('lobby:update', handleLobbyUpdate);
      socketService.off('rooms:update', handleRoomsUpdate);
      socketService.off('private:request', handlePrivateRequest);
      socketService.off('private:start', handlePrivateStart);
      socketService.off('random:matched', handleRandomMatch);
      socketService.off('private:request:response', handlePrivateResponse);
      socketService.off('typing', handleTyping);
      socketService.off('message:receive', handleReceiveMessage);
    };
  }, [isAuthenticated, activeSessionId, user, publicRooms]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message: msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const startRandomChat = () => {
    setIsSearching(true);
    socketService.send('random:search', { userId: user?.id });
  };

  const startPrivateChat = (targetUserId: string) => {
    showToast('Requesting private chat...', 'info');
    socketService.send('private:request', { userId: user?.id, targetUserId });
  };

  const joinRoom = (roomId: string) => {
      const room = publicRooms.find(r => r.id === roomId);
      if(room) {
           // Optimistically add session
           const newSession: ChatSession = {
               id: room.id,
               type: ChatType.Group,
               name: room.name,
               participants: [],
               unreadCount: 0
           };
           
           // Check if already exists
           if(!sessions.find(s => s.id === roomId)) {
               setSessions(prev => [newSession, ...prev]);
           }
           setActiveSessionId(roomId);
           socketService.send('room:join', { roomId });
      }
  };

  const respondToRequest = (accepted: boolean) => {
      if (!incomingRequest) return;
      socketService.send('private:request:response', {
          accepted,
          requesterId: incomingRequest.requesterId
      });
      setIncomingRequest(null);
  };

  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unreadCount: 0 } : s));
  };
  
  const handleLeaveSession = (id: string) => {
    socketService.send('chat:leave', { chatId: id });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(undefined);
    }
    showToast('Left conversation', 'info');
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // RENDER LANDING PAGE
  if (showLanding) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  // RENDER AUTH MODAL IF NOT LOGGED IN
  if (!isAuthenticated) return <LoginModal />;

  // RENDER MAIN APP
  return (
    <div className="flex h-screen h-[100dvh] bg-slate-100 overflow-hidden relative font-sans">
      {/* Sidebar */}
      <div className={`${activeSessionId ? 'hidden md:flex' : 'flex w-full'} md:w-80 lg:w-96 h-full flex-shrink-0 transition-all duration-300 ease-in-out z-20`}>
        <Sidebar 
          currentUser={user!} 
          sessions={sessions} 
          activeSessionId={activeSessionId}
          onSelectSession={handleSessionSelect}
          onRandomChat={startRandomChat}
          onStartPrivateChat={startPrivateChat}
          onlineUsers={onlineUsers}
          publicRooms={publicRooms}
          onJoinRoom={joinRoom}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full bg-white shadow-xl relative z-10 ${!activeSessionId ? 'hidden md:flex' : 'flex w-full'}`}>
        {activeSession ? (
          <ChatWindow 
            session={activeSession} 
            currentUser={user!} 
            onBack={() => setActiveSessionId(undefined)}
            onLeave={() => handleLeaveSession(activeSession.id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 pattern-grid">
            <img src={user!.avatar} className="w-24 h-24 rounded-full bg-slate-200 mb-6 shadow-xl border-4 border-white" alt="My Avatar" />
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Welcome, {user!.username}</h2>
            <p className="text-slate-500 font-medium text-center px-4">Select a chat or find a stranger to talk to.</p>
            <button onClick={startRandomChat} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-full font-medium shadow-lg hover:bg-indigo-700 transition-all">
              Start Random Chat
            </button>
          </div>
        )}
      </div>

      {/* Incoming Request Modal */}
      {incomingRequest && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-fade-in px-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up border border-slate-100">
                <div className="flex flex-col items-center text-center">
                    <img 
                        src={incomingRequest.requesterAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${incomingRequest.requesterId}`} 
                        className="w-20 h-20 rounded-2xl bg-slate-100 mb-4 shadow-lg border-2 border-white animate-bounce"
                        alt="Avatar"
                    />
                    <h3 className="text-xl font-bold text-slate-800">Chat Request</h3>
                    <p className="text-slate-500 mt-2 mb-6">
                        <span className="font-bold text-slate-700">{incomingRequest.requesterName}</span> wants to start a private chat with you.
                    </p>
                    <div className="flex w-full gap-3">
                        <button 
                            onClick={() => respondToRequest(false)}
                            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            <X className="w-5 h-5" /> Decline
                        </button>
                        <button 
                            onClick={() => respondToRequest(true)}
                            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-105"
                        >
                            <Check className="w-5 h-5" /> Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Search Overlay */}
      {isSearching && (
        <div className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center animate-fade-in px-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-zoom-in max-w-xs w-full text-center">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-ping"></div>
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center relative z-10">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Finding a match...</h3>
            <p className="text-slate-500 mb-8 text-sm">Connecting you with someone random.</p>
            <button 
              onClick={() => setIsSearching(false)}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up w-full max-w-xs md:w-auto flex justify-center px-4">
            <div className={`flex items-center gap-3 px-6 py-3.5 rounded-full shadow-xl border ${
              notification.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
              notification.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
              'bg-slate-800 border-slate-700 text-white'
            }`}>
              {notification.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
              <span className="font-medium text-sm truncate">{notification.message}</span>
            </div>
          </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}