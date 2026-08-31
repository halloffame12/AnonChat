import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { LandingPage } from './components/LandingPage';
import AvatarPeep from './components/AvatarPeep';
import { socketService } from './services/socket';
import { ChatSession, ChatType, Message, User, Room } from './types';
import { Loader2, CheckCircle, XCircle, X, Check, WifiOff, RefreshCw, Zap, Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<{ requesterId: string, requesterName: string, requesterAvatar?: string } | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [matchedPeepAnim, setMatchedPeepAnim] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleLobbyUpdate = (data: { activeUsers: number, users: User[] }) => {
      setOnlineUsers(data.users.filter(u => u.id !== user.id));
    };

    const handleRoomsUpdate = (rooms: Room[]) => {
      setPublicRooms(rooms);
      setSessions(prev => prev.map(s => {
        if (s.type === ChatType.Group) {
          const room = rooms.find(r => r.id === s.id);
          if (room) return { ...s, participantCount: room.participants };
        }
        return s;
      }));
    };

    const handlePrivateRequest = (data: { requesterId: string, requesterName: string, requesterAvatar?: string }) => {
      setIncomingRequest(data);
    };

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

    const handleRandomMatch = (session: ChatSession) => {
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setIsSearching(false);
      setMatchedPeepAnim(true);
      setTimeout(() => setMatchedPeepAnim(false), 1200);
      showToast('Found a random match!', 'success');
    };

    const handlePrivateResponse = (data: { accepted: boolean, targetUserId: string }) => {
      if (!data.accepted) showToast('User declined your request', 'error');
    };

    const handleTyping = (data: { chatId: string, isTyping: boolean }) => {
      setSessions(prev => prev.map(s => s.id === data.chatId ? { ...s, isTyping: data.isTyping } : s));
    };

    const handleReceiveMessage = (msg: Message) => {
      setSessions(prev => {
        const exists = prev.find(s => s.id === msg.chatId);
        if (!exists && msg.type === 'system' && msg.content.includes('joined')) {
          const room = publicRooms.find(r => r.id === msg.chatId);
          if (room) return [{ id: room.id, type: ChatType.Group, name: room.name, participants: [], participantCount: room.participants, unreadCount: 0, lastMessage: msg }, ...prev];
        }
        return prev.map(s => s.id === msg.chatId ? { ...s, lastMessage: msg, unreadCount: s.id !== activeSessionId ? s.unreadCount + 1 : s.unreadCount } : s);
      });
    };

    const handleReconnect = (_attemptNumber: number) => {
      setIsReconnecting(false);
      setReconnectCount(0);
      showToast('Reconnected successfully', 'success');
    };

    const handleReconnectFailed = () => {
      setIsReconnecting(true);
      setReconnectCount(prev => prev + 1);
    };

    const handleDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
        setReconnectCount(prev => prev + 1);
      }
    };

    const handleServerShutdown = (data: { message: string }) => {
      showToast(data.message, 'info');
    };

    const handlePartnerSkipped = () => {
      showToast('Partner left the chat', 'info');
      if (activeSessionId) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          lastMessage: { id: Date.now().toString(), chatId: activeSessionId, senderId: 'system', content: 'Partner skipped', timestamp: new Date(), isRead: true, type: 'system' }
        } : s));
      }
    };

    const handlePartnerDisconnected = () => {
      showToast('Partner disconnected', 'info');
    };

    const handleServerError = (data: { message: string }) => {
      showToast(data.message || 'Something went wrong', 'error');
    };

    socketService.on('lobby:update', handleLobbyUpdate);
    socketService.on('rooms:update', handleRoomsUpdate);
    socketService.on('private:request', handlePrivateRequest);
    socketService.on('private:start', handlePrivateStart);
    socketService.on('random:matched', handleRandomMatch);
    socketService.on('private:request:response', handlePrivateResponse);
    socketService.on('typing', handleTyping);
    socketService.on('message:receive', handleReceiveMessage);
    socketService.on('reconnect', handleReconnect);
    socketService.on('reconnect_failed', handleReconnectFailed);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('server:shutdown', handleServerShutdown);
    socketService.on('partnerSkipped', handlePartnerSkipped);
    socketService.on('partnerDisconnected', handlePartnerDisconnected);
    socketService.on('error', handleServerError);

    return () => {
      socketService.off('lobby:update', handleLobbyUpdate);
      socketService.off('rooms:update', handleRoomsUpdate);
      socketService.off('private:request', handlePrivateRequest);
      socketService.off('private:start', handlePrivateStart);
      socketService.off('random:matched', handleRandomMatch);
      socketService.off('private:request:response', handlePrivateResponse);
      socketService.off('typing', handleTyping);
      socketService.off('message:receive', handleReceiveMessage);
      socketService.off('reconnect', handleReconnect);
      socketService.off('reconnect_failed', handleReconnectFailed);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('server:shutdown', handleServerShutdown);
      socketService.off('partnerSkipped', handlePartnerSkipped);
      socketService.off('partnerDisconnected', handlePartnerDisconnected);
      socketService.off('error', handleServerError);
    };
  }, [isAuthenticated, activeSessionId, user]);

  // Close overlays with Escape + lock body scroll while a modal/search is open
  const overlayOpen = !!incomingRequest || isSearching;
  useEffect(() => {
    if (!overlayOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (incomingRequest) {
          respondToRequest(false);
        } else if (isSearching) {
          setIsSearching(false);
          socketService.send('random:cancel', {});
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [overlayOpen, incomingRequest, isSearching]);

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
    if (room) {
      if (!sessions.find(s => s.id === roomId)) {
        setSessions(prev => [{ id: room.id, type: ChatType.Group, name: room.name, participants: [], participantCount: room.participants, unreadCount: 0 }, ...prev]);
      } else {
        setSessions(prev => prev.map(s => s.id === roomId ? { ...s, participantCount: room.participants } : s));
      }
      setActiveSessionId(roomId);
      socketService.send('room:join', { roomId });
    }
  };

  const respondToRequest = (accepted: boolean) => {
    if (!incomingRequest) return;
    socketService.send('private:request:response', { accepted, requesterId: incomingRequest.requesterId });
    setIncomingRequest(null);
  };

  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unreadCount: 0 } : s));
  };

  const handleLeaveSession = (id: string) => {
    socketService.send('chat:leave', { chatId: id });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(undefined);
    showToast('Left conversation', 'info');
  };

  const handleLogout = () => {
    logout();
    setSessions([]);
    setActiveSessionId(undefined);
    setShowLanding(true);
    setSidebarOpen(false);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  if (showLanding) return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  if (!isAuthenticated) return <LoginModal />;

  return (
    <div className="flex h-screen h-screen-safe bg-warm-50 overflow-hidden relative font-sans app-shell">
      {/* Reconnection banner */}
      {isReconnecting && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-center gap-2 animate-fade-in-down shadow-lg">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">Connection lost. {reconnectCount > 0 ? `Retrying (${reconnectCount}/5)` : 'Reconnecting...'}</span>
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
        </div>
      )}

      {/* Mobile sidebar toggle (hidden while a chat is open to avoid covering input) */}
      {!activeSessionId && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-5 left-4 safe-area-bottom z-30 md:hidden w-14 h-14 bg-white rounded-2xl shadow-pop border border-warm-200 flex items-center justify-center text-primary hover:bg-warm-50 active:scale-95 transition-all"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
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
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Desktop sidebar */}
      <div className={`hidden md:flex md:w-80 lg:w-96 h-full flex-shrink-0 transition-all duration-300 ease-in-out z-20`}>
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
          onLogout={handleLogout}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col h-full bg-white shadow-xl relative z-10 min-w-0">
        {activeSession ? (
          <ChatWindow
            key={activeSession.id}
            session={activeSession}
            currentUser={user!}
            onBack={() => setActiveSessionId(undefined)}
            onLeave={() => handleLeaveSession(activeSession.id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-warm-50 to-white">
            <div className="max-w-sm text-center">
              <div className="relative inline-block mb-6">
                <AvatarPeep seed={user!.id} size={112} className="shadow-xl ring-4 ring-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-[3px] border-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-dark mb-2">Welcome back, {user!.username}</h2>
              <p className="text-warm-500 font-medium mb-6">
                Start a random chat, browse public rooms, or message someone new from the {`"People"`} tab.
              </p>
              <button
                onClick={startRandomChat}
                className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base"
              >
                <Zap className="w-5 h-5 fill-white mr-2" />
                Start Random Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Match-found animation */}
      {matchedPeepAnim && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="flex items-center gap-4 animate-match-found">
            <div className="w-24 h-24 md:w-32 md:h-32 animate-match-peep-left">
              <AvatarPeep seed={user?.id || 'me'} size={128} className="ring-4 ring-white shadow-2xl" />
            </div>
            <div className="text-3xl text-primary font-extrabold animate-match-pulse">+</div>
            <div className="w-24 h-24 md:w-32 md:h-32 animate-match-peep-right">
              <AvatarPeep seed={activeSession?.id || 'match'} size={128} className="ring-4 ring-white shadow-2xl" flip />
            </div>
          </div>
        </div>
      )}

      {/* Incoming request modal */}
      {incomingRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Incoming chat request"
          className="absolute inset-0 z-50 bg-dark/50 backdrop-blur-sm flex items-center justify-center animate-fade-in px-4"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up border border-warm-100">
            <div className="flex flex-col items-center text-center">
              <AvatarPeep seed={incomingRequest.requesterId} size={80} className="mb-4 ring-2 ring-white shadow-lg" />
              <h3 className="text-xl font-bold text-dark">Chat Request</h3>
              <p className="text-warm-500 mt-2 mb-6">
                <span className="font-bold text-dark">{incomingRequest.requesterName}</span> wants to chat privately.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => respondToRequest(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border-2 border-warm-200 text-warm-600 font-bold hover:bg-warm-50 flex items-center justify-center gap-2 transition-all"
                >
                  <X className="w-4 h-4" /> Decline
                </button>
                <button
                  onClick={() => respondToRequest(true)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-primary text-white font-bold hover:bg-primary-dark shadow-warm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" /> Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search overlay */}
      {isSearching && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Finding a random match"
          className="absolute inset-0 z-50 bg-dark/60 backdrop-blur-md flex items-center justify-center animate-fade-in px-4"
        >
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-zoom-in max-w-xs w-full text-center">
            <AvatarPeep seed={user?.id || 'searching'} size={80} className="mb-4 ring-2 ring-white opacity-80" />
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-ping" />
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center relative z-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-dark mb-1">Finding a match...</h3>
            <p className="text-warm-500 mb-8 text-sm">Connecting you with someone random.</p>
            <button
              onClick={() => { setIsSearching(false); socketService.send('random:cancel', {}); }}
              className="btn-secondary w-full"
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up w-auto max-w-[90vw] px-4">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-soft border ${
            notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
            'bg-white border-warm-200 text-dark shadow-soft'
          }`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 shrink-0 text-red-500" />}
            <span className="font-semibold text-sm">{notification.message}</span>
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
