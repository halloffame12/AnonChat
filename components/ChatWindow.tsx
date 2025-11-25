import React, { useState, useEffect, useRef } from 'react';
import { Message, ChatSession, ChatType, User } from '../types';
import { socketService } from '../services/socket';
import { Send, MoreVertical, Smile, ChevronLeft, Trash2, Flag, Ban } from 'lucide-react';
import { format } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';

// Simple Pop Sound (Base64 to avoid external file deps)
const POP_SOUND = "data:audio/mpeg;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQyAFRTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAACtWPOiY9AAIAAA0gAAABF4Wi2s08ADAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQZAAACtWPOiY9AAIAAA0gAAABF4Wi2s08ADAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQZAAACtWPOiY9AAIAAA0gAAABF4Wi2s08ADAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQZAAACtWPOiY9AAIAAA0gAAABF4Wi2s08ADAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

interface ChatWindowProps {
  session: ChatSession;
  currentUser: User;
  onBack?: () => void;
  onLeave?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, currentUser, onBack, onLeave }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio(POP_SOUND);
  }, []);

  useEffect(() => {
    // Load initial mock system message
    if (messages.length === 0) {
        setMessages([{
            id: 'init',
            chatId: session.id,
            senderId: 'system',
            content: `You joined ${session.name}`,
            timestamp: new Date(),
            isRead: true,
            type: 'system'
        }]);
    }

    const handleReceive = (msg: Message) => {
      if (msg.chatId === session.id) {
        // Filter out messages from blocked users
        if (blockedUsers.has(msg.senderId)) return;

        setMessages(prev => {
          // De-duplication for optimistic updates
          if (msg.senderId === currentUser.id) {
            const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.content === msg.content);
            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = msg;
              return newMessages;
            }
          }
          // Play sound for incoming messages (not own)
          if (msg.senderId !== currentUser.id && msg.type !== 'system') {
              audioRef.current?.play().catch(e => console.log('Audio play failed', e));
          }
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };
    
    socketService.on('message:receive', handleReceive);

    return () => {
      socketService.off('message:receive', handleReceive);
    };
  }, [session.id, currentUser.id, blockedUsers]);

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showEmoji]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: 'temp-' + Date.now(),
      chatId: session.id,
      senderId: currentUser.id,
      senderAvatar: currentUser.avatar,
      senderName: currentUser.username,
      content: inputText,
      timestamp: new Date(),
      isRead: false,
      type: 'text'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setShowEmoji(false);
    
    socketService.send('message:send', {
      chatId: session.id,
      content: newMessage.content,
      senderId: currentUser.id
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // Typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketService.send('typing', { chatId: session.id, isTyping: true });
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.send('typing', { chatId: session.id, isTyping: false });
    }, 2000);
  };

  const onEmojiClick = (emojiData: any) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleReport = () => {
      const otherUserId = session.participants.find(id => id !== currentUser.id);
      if (otherUserId) {
          socketService.send('user:report', { reportedUserId: otherUserId, reason: 'Harassment' });
          alert('User reported. Our team will review the chat logs.');
          setMenuOpen(false);
      }
  };

  const handleBlock = () => {
      const otherUserId = session.participants.find(id => id !== currentUser.id);
      if (otherUserId) {
          setBlockedUsers(prev => new Set(prev).add(otherUserId));
          alert('User blocked locally for this session.');
          setMenuOpen(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-white relative w-full">
      {/* Header */}
      <div className="h-20 border-b border-slate-100 flex items-center justify-between px-6 bg-white/90 backdrop-blur-sm z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
                onClick={onBack} 
                className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative">
            {session.avatar ? (
                <img src={session.avatar} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-100 shadow-sm" />
            ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                    session.type === ChatType.Group ? 'bg-orange-500' : 
                    session.type === ChatType.Random ? 'bg-purple-500' : 'bg-indigo-500'
                }`}>
                    {session.name.charAt(0)}
                </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 leading-tight">{session.name}</h2>
            <div className="text-xs flex items-center gap-1">
              {session.isTyping ? (
                <span className="text-primary font-medium italic animate-pulse">typing...</span>
              ) : (
                <span className="text-slate-500 font-medium">
                    {session.type === ChatType.Group ? `${session.participants.length} members` : 'Online'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {menuOpen && (
            <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 origin-top-right animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <button 
                    onClick={handleReport}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors"
                >
                    <Flag className="w-4 h-4 text-orange-500" /> Report User
                </button>
                <button 
                    onClick={handleBlock}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors"
                >
                    <Ban className="w-4 h-4 text-slate-500" /> Block User
                </button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button 
                    onClick={() => { onLeave && onLeave(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-3 font-medium transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> Leave Chat
                </button>
                </div>
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 scroll-smooth" 
        onClick={() => { setMenuOpen(false); setShowEmoji(false); }}
      >
        {messages.map((msg, index) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-6">
                <span className="bg-slate-200/60 text-slate-500 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-wide">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === currentUser.id;
          const isSequence = index > 0 && messages[index-1].senderId === msg.senderId && messages[index-1].type !== 'system';

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-slide-in group`}>
              <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                 {!isMe && !isSequence && (
                     <img 
                        src={msg.senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderId}`} 
                        alt="User" 
                        className="w-8 h-8 rounded-full bg-slate-200 shadow-sm mb-1"
                     />
                 )}
                 {!isMe && isSequence && <div className="w-8"></div>}
                 
                 <div className="flex flex-col">
                    {!isMe && !isSequence && session.type === ChatType.Group && (
                        <span className="text-[10px] text-slate-500 ml-1 mb-0.5 font-medium">{msg.senderName}</span>
                    )}
                    <div 
                        className={`px-5 py-3 shadow-sm relative transition-all ${
                        isMe 
                            ? 'bg-primary text-white rounded-2xl rounded-br-none' 
                            : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-none'
                        } ${isSequence ? 'mt-1' : ''}`}
                    >
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`text-[10px] mt-1 text-right opacity-70 font-medium flex justify-end gap-1 ${isMe ? 'text-indigo-100' : 'text-slate-400'}`}>
                           {format(new Date(msg.timestamp), 'h:mm a')}
                           {isMe && (
                               <span>{msg.isRead ? '• Read' : '• Sent'}</span>
                           )}
                        </div>
                    </div>
                 </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-white border-t border-slate-100 z-20 relative">
        {showEmoji && (
            <div className="absolute bottom-[88px] left-4 z-50 shadow-2xl rounded-2xl animate-fade-in-up">
                <EmojiPicker onEmojiClick={onEmojiClick} height={400} width={320} />
            </div>
        )}

        <div className="flex items-end gap-3 bg-slate-50 p-2 rounded-3xl border border-slate-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm">
          <button 
              onClick={() => setShowEmoji(!showEmoji)}
              className={`p-2.5 rounded-full transition-colors ${showEmoji ? 'text-primary bg-indigo-50' : 'text-slate-400 hover:text-primary hover:bg-white'}`}
          >
            <Smile className="w-6 h-6" />
          </button>
          <textarea
            className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-base text-slate-800 max-h-32 min-h-[44px] py-2.5 px-2 placeholder:text-slate-400"
            placeholder="Type a message..."
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ height: 'auto' }}
          />
          <button 
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="p-2.5 bg-primary text-white rounded-full hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/30"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};