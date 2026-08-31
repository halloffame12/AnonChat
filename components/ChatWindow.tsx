import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, ChatSession, ChatType, User, ReplyTo, MessageReaction } from '../types';
import { socketService } from '../services/socket';
import {
  Send, MoreVertical, Smile, ChevronLeft, Trash2, Flag, Ban,
  Check, CheckCheck, Loader2, AlertCircle, Reply, X, SkipForward
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

function formatMessageTime(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}
import EmojiPicker from 'emoji-picker-react';
import AvatarPeep from './AvatarPeep';

const EMOJI_REACTION_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [reactingToMessage, setReactingToMessage] = useState<string | null>(null);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(session.readReceiptsEnabled !== false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const ackTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
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
        if (blockedUsers.has(msg.senderId)) return;

        setMessages(prev => {
          if (msg.senderId === currentUser.id) {
            const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.content === msg.content);
            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = { ...msg, status: 'sent' };
              return newMessages;
            }
          }
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    const handleAck = (data: { tempId: string, messageId: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.tempId) {
          if (ackTimeoutRef.current.has(m.id)) {
            clearTimeout(ackTimeoutRef.current.get(m.id)!);
            ackTimeoutRef.current.delete(m.id);
          }
          return { ...m, id: data.messageId, status: 'sent' };
        }
        return m;
      }));
    };

    const handleReadReceipt = (data: { chatId: string, messageIds: string[], readBy: string }) => {
      if (data.chatId === session.id) {
        setMessages(prev => prev.map(m =>
          data.messageIds.includes(m.id) ? { ...m, status: 'read', isRead: true } : m
        ));
      }
    };

    const handleReactionUpdate = (data: {
      messageId: string,
      reactions: MessageReaction[],
      userId: string,
      added: boolean,
      emoji: string
    }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          return {
            ...m,
            reactions: data.reactions.map(r => ({
              ...r,
              hasReacted: r.reactors.includes(currentUser.id)
            }))
          };
        }
        return m;
      }));
    };

    const handleFailed = (data: { tempId: string, error: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.tempId ? { ...m, status: 'failed' } : m
      ));
    };

    const handlePartnerSkipped = () => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        content: 'Partner skipped to a new match',
        timestamp: new Date(),
        chatId: session.id,
        isRead: true,
        type: 'system'
      }]);
    };

    const handlePartnerDisconnected = () => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        content: 'Partner disconnected',
        timestamp: new Date(),
        chatId: session.id,
        isRead: true,
        type: 'system'
      }]);
    };

    socketService.on('message:receive', handleReceive);
    socketService.on('message:ack', handleAck);
    socketService.on('message:read', handleReadReceipt);
    socketService.on('message:reaction:update', handleReactionUpdate);
    socketService.on('message:failed', handleFailed);
    socketService.on('partnerSkipped', handlePartnerSkipped);
    socketService.on('partnerDisconnected', handlePartnerDisconnected);

    return () => {
      socketService.off('message:receive', handleReceive);
      socketService.off('message:ack', handleAck);
      socketService.off('message:read', handleReadReceipt);
      socketService.off('message:reaction:update', handleReactionUpdate);
      socketService.off('message:failed', handleFailed);
      socketService.off('partnerSkipped', handlePartnerSkipped);
      socketService.off('partnerDisconnected', handlePartnerDisconnected);
    };
  }, [session.id, currentUser.id, blockedUsers, scrollToBottom, readReceiptsEnabled]);

  useEffect(() => {
    if (!readReceiptsEnabled || !messagesContainerRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      const readIds: string[] = [];
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.getAttribute('data-msg-id');
          if (msgId && msgId.startsWith('msg-')) readIds.push(msgId);
        }
      });
      if (readIds.length > 0) {
        socketService.send('message:read', {
          chatId: session.id,
          messageIds: readIds
        });
        setMessages(prev => prev.map(m =>
          readIds.includes(m.id) ? { ...m, status: 'read', isRead: true } : m
        ));
      }
    }, { threshold: 0.5 });

    const msgElements = messagesContainerRef.current.querySelectorAll('[data-msg-id]');
    msgElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, session.id, readReceiptsEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showEmoji, scrollToBottom]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;

    const tempId = 'temp-' + Date.now();
    const newMessage: Message = {
      id: tempId,
      chatId: session.id,
      senderId: currentUser.id,
      senderAvatar: currentUser.avatar,
      senderName: currentUser.username,
      content: inputText,
      timestamp: new Date(),
      isRead: false,
      type: 'text',
      status: 'sending',
      replyTo: replyTo || undefined
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setShowEmoji(false);
    setReplyTo(null);

    socketService.send('message:send', {
      chatId: session.id,
      content: newMessage.content,
      senderId: currentUser.id,
      tempId,
      replyTo: replyTo || undefined
    });

    const timeout = setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'failed' } : m
      ));
    }, 10000);
    ackTimeoutRef.current.set(tempId, timeout);
  }, [inputText, session.id, currentUser, replyTo]);

  const retrySend = useCallback((failedMsg: Message) => {
    setMessages(prev => prev.map(m =>
      m.id === failedMsg.id ? { ...m, status: 'sending' } : m
    ));

    const tempId = 'temp-' + Date.now();
    socketService.send('message:send', {
      chatId: session.id,
      content: failedMsg.content,
      senderId: currentUser.id,
      tempId,
      replyTo: failedMsg.replyTo || undefined
    });

    setMessages(prev => prev.map(m =>
      m.id === failedMsg.id ? { ...m, id: tempId, status: 'sending' } : m
    ));

    const timeout = setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'failed' } : m
      ));
    }, 10000);
    ackTimeoutRef.current.set(tempId, timeout);
  }, [session.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (!isTyping) {
      setIsTyping(true);
      socketService.send('typing', { chatId: session.id, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.send('typing', { chatId: session.id, isTyping: false });
    }, 2000);
  }, [handleSend, isTyping, session.id]);

  const onEmojiClick = (emojiData: any) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleReact = (messageId: string, emoji: string) => {
    socketService.send('message:react', { messageId, emoji });
    setReactingToMessage(null);
  };

  const handleReplyTo = (msg: Message) => {
    if (msg.senderId === 'system') return;
    setReplyTo({
      messageId: msg.id,
      content: msg.content.substring(0, 80),
      senderName: msg.senderName || 'Unknown'
    });
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

  const handleToggleReadReceipts = () => {
    const newEnabled = !readReceiptsEnabled;
    setReadReceiptsEnabled(newEnabled);
    socketService.send('read:receipts:toggle', { chatId: session.id, enabled: newEnabled });
    setMenuOpen(false);
  };

  const handleSkip = () => {
    socketService.send('skipMatch', session.id, (res: any) => {
      if (res?.success && onLeave) onLeave();
    });
    setMenuOpen(false);
  };

  const StatusIcon = ({ status }: { status?: string }) => {
    switch (status) {
      case 'sending': return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'sent': return <Check className="w-3 h-3" />;
      case 'delivered': return <CheckCheck className="w-3 h-3" />;
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-300" />;
      case 'failed': return <AlertCircle className="w-3 h-3 text-accent" />;
      default: return null;
    }
  };

  const hasConversation = messages.some(m => m.type !== 'system');

  return (
    <div className="flex flex-col h-full bg-white relative w-full">
      {/* Header */}
      <div className="h-16 md:h-20 border-b border-warm-100 flex items-center justify-between px-4 md:px-6 bg-white/90 backdrop-blur-md z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="md:hidden icon-btn w-10 h-10 -ml-1 -mr-1"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative shrink-0">
            {session.type === ChatType.Group ? (
              <div className="w-10 h-10 rounded-2xl bg-sage/20 flex items-center justify-center">
                <span className="text-sage font-bold text-lg">{session.name.charAt(0)}</span>
              </div>
            ) : (
              <AvatarPeep seed={session.id} size={40} className="ring-2 ring-white shadow-sm" />
            )}
            <div className="badge-online absolute -bottom-0.5 -right-0.5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-dark text-sm md:text-base leading-tight truncate">{session.name}</h2>
            <div className="text-[11px] md:text-xs flex items-center gap-1">
              {session.isTyping ? (
                <span className="text-primary font-medium italic flex items-center gap-1">
                  typing
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              ) : (
                <span className="text-warm-500 font-medium">
                  {session.type === ChatType.Group
                    ? `${session.participantCount ?? session.participants.length} members`
                    : 'Online'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open chat menu"
            aria-expanded={menuOpen}
            className="icon-btn"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-soft border border-warm-100 py-1 z-30 origin-top-right animate-fade-in-down overflow-hidden">
                <button
                  onClick={handleToggleReadReceipts}
                  className="w-full text-left px-4 py-3 text-sm text-warm-700 hover:bg-warm-50 flex items-center gap-3 font-medium transition-colors"
                >
                  <CheckCheck className={`w-4 h-4 ${readReceiptsEnabled ? 'text-primary' : 'text-warm-400'}`} />
                  {readReceiptsEnabled ? 'Read Receipts On' : 'Read Receipts Off'}
                </button>
                <div className="h-px bg-warm-100 my-1" />
                <button
                  onClick={handleReport}
                  className="w-full text-left px-4 py-3 text-sm text-warm-700 hover:bg-warm-50 flex items-center gap-3 font-medium transition-colors"
                >
                  <Flag className="w-4 h-4 text-accent" /> Report User
                </button>
                <button
                  onClick={handleBlock}
                  className="w-full text-left px-4 py-3 text-sm text-warm-700 hover:bg-warm-50 flex items-center gap-3 font-medium transition-colors"
                >
                  <Ban className="w-4 h-4 text-warm-500" /> Block User
                </button>
                <div className="h-px bg-warm-100 my-1" />
                {session.type === ChatType.Random && (
                  <button
                    onClick={handleSkip}
                    className="w-full text-left px-4 py-3 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-3 font-medium transition-colors"
                  >
                    <SkipForward className="w-4 h-4" /> Skip to Next
                  </button>
                )}
                <button
                  onClick={() => { if (onLeave) onLeave(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-accent hover:bg-accent/10 flex items-center gap-3 font-medium transition-colors"
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
        ref={messagesContainerRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 bg-warm-50/50 scroll-smooth chat-scroll-area"
        onClick={() => { setMenuOpen(false); setShowEmoji(false); setReactingToMessage(null); setTappedMessageId(null); }}
      >
        {!hasConversation && (
          <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in">
            {session.type === ChatType.Group ? (
              <div className="w-16 h-16 rounded-3xl bg-sage/15 flex items-center justify-center mb-4">
                <span className="text-sage font-bold text-3xl">{session.name.charAt(0)}</span>
              </div>
            ) : (
              <AvatarPeep seed={session.id} size={64} className="ring-4 ring-white shadow-soft mb-4" />
            )}
            <h3 className="font-bold text-dark text-lg mb-1">
              {session.type === ChatType.Group ? `Say hi to ${session.name}` : `You're connected`}
            </h3>
            <p className="text-sm text-warm-500 max-w-[260px] leading-relaxed">
              {session.type === ChatType.Group
                ? 'This room is empty right now. Send the first message to start the conversation.'
                : 'Start the conversation with a friendly hello.'}
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="bg-warm-100 text-warm-500 text-[10px] font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === currentUser.id;
          const isSequence = index > 0 && messages[index-1].senderId === msg.senderId && messages[index-1].type !== 'system';

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} message-enter group`}>
              <div
                className={`flex items-end gap-2 max-w-[88%] md:max-w-[72%] ${isMe ? 'flex-row-reverse' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.matchMedia('(hover: none)').matches) {
                    setTappedMessageId(tappedMessageId === msg.id ? null : msg.id);
                    setReactingToMessage(null);
                  }
                }}
              >
                {/* Avatar — only show for non-sequence, non-self */}
                {!isMe && !isSequence && (
                  <div className="shrink-0 mb-1">
                    <AvatarPeep seed={msg.senderId} size={28} className="ring-2 ring-white shadow-sm" />
                  </div>
                )}
                {!isMe && isSequence && <div className="w-[36px] shrink-0" />}

                <div className="flex flex-col min-w-0" data-msg-id={msg.id}>
                  {!isMe && !isSequence && session.type === ChatType.Group && (
                    <span className="text-[10px] text-warm-500 ml-1 mb-0.5 font-semibold">{msg.senderName}</span>
                  )}

                  {/* Reply-to quote */}
                  {msg.replyTo && (
                    <div className={`text-[11px] px-3.5 py-1.5 rounded-t-lg border-b ${isMe ? 'bg-primary-dark text-white/80 border-primary/30' : 'bg-warm-100 text-warm-500 border-warm-200'} max-w-[90%]`}>
                      <span className="font-bold">↪ {msg.replyTo.senderName}</span>
                      <p className="truncate opacity-75">{msg.replyTo.content}</p>
                    </div>
                  )}

                  <div
                    className={`px-4 py-2.5 shadow-sm relative transition-all ${
                      isMe
                        ? 'bg-primary text-white rounded-2xl rounded-br-md'
                        : 'bg-white text-dark border border-warm-100 rounded-2xl rounded-bl-md shadow-sm'
                    } ${isSequence ? 'mt-0.5' : ''} ${msg.status === 'failed' ? 'border-accent border-2' : ''}`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>

                    {/* Reactions bar */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 border-t ${isMe ? 'border-white/20' : 'border-warm-100'} pt-1.5`}>
                        {msg.reactions.map(r => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReact(msg.id, r.emoji)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                              r.hasReacted
                                ? (isMe ? 'bg-white/20' : 'bg-primary/10 ring-1 ring-primary/30')
                                : (isMe ? 'hover:bg-white/10' : 'hover:bg-warm-100')
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className={`font-semibold ${isMe ? 'text-white/70' : 'text-warm-400'}`}>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] mt-1 flex justify-end gap-1 items-center ${isMe ? 'text-white/60' : 'text-warm-400'}`}>
                      <span>{formatMessageTime(msg.timestamp)}</span>
                      {isMe && <StatusIcon status={msg.status} />}
                    </div>
                  </div>

                  {/* Message actions bar */}
                  <div className={`flex gap-0.5 mt-0.5 transition-opacity ${
                    (tappedMessageId === msg.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReplyTo(msg); }}
                      className="p-2 text-warm-500 hover:text-primary transition-colors active:scale-90"
                      title="Reply"
                      aria-label="Reply to this message"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReactingToMessage(reactingToMessage === msg.id ? null : msg.id); }}
                      className="p-2 text-warm-500 hover:text-yellow-500 transition-colors active:scale-90"
                      title="React"
                      aria-label="React to this message"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Reaction emoji picker */}
                  {reactingToMessage === msg.id && (
                    <div className={`flex gap-1 mt-1 p-1.5 bg-white rounded-full shadow-soft border border-warm-100 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {EMOJI_REACTION_LIST.map(emoji => (
                        <button
                          key={emoji}
                          onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji); }}
                          className="w-8 h-8 flex items-center justify-center text-base hover:bg-warm-100 rounded-full transition-all hover:scale-125 active:scale-95"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Failed message retry */}
                  {isMe && msg.status === 'failed' && (
                    <button
                      onClick={() => retrySend(msg)}
                      className="mt-1 text-[11px] text-accent hover:text-accent font-semibold flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" /> Failed — Tap to retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-4 py-2 bg-warm-50 border-t border-warm-200 flex items-center gap-3 animate-slide-in">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-primary">↪ Replying to {replyTo.senderName}</span>
            <p className="text-sm text-warm-500 truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 hover:bg-warm-200 rounded-full text-warm-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white border-t border-warm-100 z-20 relative safe-area-bottom shrink-0">
        {showEmoji && (
          <div className="absolute bottom-full left-4 mb-2 z-50 shadow-2xl rounded-2xl animate-fade-in-up">
            <EmojiPicker onEmojiClick={onEmojiClick} height={350} width={Math.min(300, window.innerWidth - 32)} />
          </div>
        )}

        <div className="flex items-end gap-2 bg-warm-50 p-1.5 rounded-3xl border-2 border-warm-200 focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary transition-all shadow-sm">
          <button
            onClick={() => { setShowEmoji(!showEmoji); setTappedMessageId(null); }}
            aria-label={showEmoji ? 'Close emoji picker' : 'Open emoji picker'}
            aria-expanded={showEmoji}
            className={`p-2.5 min-w-[44px] min-h-[44px] rounded-full transition-colors shrink-0 flex items-center justify-center ${
              showEmoji ? 'text-primary bg-primary/10' : 'text-warm-500 hover:text-primary hover:bg-white'
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>
          <textarea
            className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-base text-dark max-h-28 min-h-[42px] py-2.5 px-1 placeholder:text-warm-400 touch-manipulation"
            placeholder="Type a message..."
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Message"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            aria-label="Send"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-warm touch-manipulation shrink-0"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
