const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// SECURITY: CORS Whitelist
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by Socket.IO CORS'));
    },
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// SECURITY: Input Sanitization
const sanitize = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

const validatePayload = (data, schema) => {
  for (const [key, type] of Object.entries(schema)) {
    if (type === 'required' && !data[key]) return false;
    if (data[key] && typeof data[key] !== type && type !== 'required') return false;
  }
  return true;
};

// --- In-Memory State ---
const users = new Map();
const activeSockets = new Map();
const userSockets = new Map(); // userId -> Set<socketId>
const publicRooms = new Map();
const waitingQueue = new Map(); // userId -> timestamp (FIX: Was array, caused race conditions)
const privateChatRooms = new Map(); // chatId -> { participants: Set<userId>, createdAt }

// SECURITY: Rate Limiting
const rateLimits = new Map();
const RATE_LIMIT = {
  MESSAGE_INTERVAL: 500,
  MESSAGE_BURST: 5,
  TYPING_INTERVAL: 1000
};

const checkRateLimit = (userId, type) => {
  const now = Date.now();
  let limits = rateLimits.get(userId);
  if (!limits) {
    limits = { lastMessage: 0, messageCount: 0, lastTyping: 0, windowStart: now };
    rateLimits.set(userId, limits);
  }

  if (type === 'message') {
    if (now - limits.windowStart > 10000) {
      limits.messageCount = 0;
      limits.windowStart = now;
    }
    if (limits.messageCount >= RATE_LIMIT.MESSAGE_BURST) {
      if (now - limits.lastMessage < RATE_LIMIT.MESSAGE_INTERVAL) {
        return false;
      }
    }
    limits.lastMessage = now;
    limits.messageCount++;
    return true;
  }

  if (type === 'typing') {
    if (now - limits.lastTyping < RATE_LIMIT.TYPING_INTERVAL) {
      return false;
    }
    limits.lastTyping = now;
    return true;
  }

  return true;
};

// Initialize default rooms
const defaultRooms = ['General Lounge', 'Tech & Coding', 'Anime & Gaming', 'Music & Vibe', 'Dating & Flirt'];
defaultRooms.forEach(name => {
    // Check if room name already exists in map values to avoid dupes on hot reload
    const exists = Array.from(publicRooms.values()).some(r => r.name === name);
    if (!exists) {
        const id = `room-${uuidv4()}`;
        publicRooms.set(id, { id, name, participants: new Set() });
    }
});

// Helper to get online users list
const getOnlineUsers = () => {
  return Array.from(new Set(activeSockets.values()))
    .map(uid => users.get(uid))
    .filter(u => u !== undefined);
};

// Helper to get rooms list
const getRoomsList = () => {
    return Array.from(publicRooms.values()).map(r => ({
        id: r.id,
        name: r.name,
        participants: r.participants.size
    }));
};

// Cleanup helper for memory leaks
const cleanupEmptyRooms = () => {
  const now = Date.now();
  for (const [chatId, room] of privateChatRooms.entries()) {
    if (room.participants.size === 0 && now - room.createdAt > 60000) {
      privateChatRooms.delete(chatId);
    }
  }
};

// HEALTH ENDPOINT
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    users: users.size,
    connections: activeSockets.size,
    rooms: publicRooms.size + privateChatRooms.size,
    timestamp: Date.now()
  });
});

// --- API Routes ---
app.post('/api/login', (req, res) => {
  try {
    const { username, age, gender, location } = req.body;

    // Validation
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    if (!age || typeof age !== 'number' || age < 13 || age > 120) {
      return res.status(400).json({ error: 'Age must be between 13 and 120' });
    }

    const userId = uuidv4();
    const safeUsername = sanitize(username).slice(0, 50);
    const safeLocation = location ? sanitize(location).slice(0, 100) : 'Unknown';
    const avatarStyle = 'bottts';
    const avatar = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(safeUsername)}`;

    const user = {
      id: userId,
      username: safeUsername,
      age,
      gender: gender || 'Other',
      location: safeLocation,
      avatar,
      isOnline: true,
      lastSeen: new Date()
    };

    users.set(userId, user);
    console.log(`[LOGIN] User ${userId} (${safeUsername}) created`);

    res.json({ user, token: userId });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SOCKET.IO AUTHENTICATION MIDDLEWARE
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('Authentication error: invalid token'));
  }
  if (!users.has(token)) {
    return next(new Error('Authentication error: user not found'));
  }
  socket.userId = token;
  next();
});

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`[CONNECT] ${userId} (socket: ${socket.id})`);

  try {
    // Register user
    socket.join('global-updates');
    activeSockets.set(socket.id, userId);
    
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    const currentUser = users.get(userId);
    if (currentUser) {
      currentUser.isOnline = true;
      currentUser.lastSeen = new Date();
    }

    // Broadcast updates
    io.emit('lobby:update', {
      activeUsers: activeSockets.size,
      users: getOnlineUsers()
    });
    socket.emit('rooms:update', getRoomsList());

    // --- MESSAGE HANDLING WITH SECURITY ---
    socket.on('message:send', (data) => {
      try {
        if (!validatePayload(data, { chatId: 'string', content: 'string' })) {
          return socket.emit('error', { message: 'Invalid payload' });
        }

        const { chatId, content } = data;
        if (!content.trim() || content.length > 5000) {
          return socket.emit('error', { message: 'Invalid message length' });
        }

        if (!checkRateLimit(userId, 'message')) {
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }

        const sender = users.get(userId);
        const safeContent = sanitize(content).slice(0, 2000);

        const message = {
          id: uuidv4(),
          chatId,
          senderId: userId,
          senderName: sender?.username || 'Anonymous',
          senderAvatar: sender?.avatar,
          content: safeContent,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text'
        };

        io.to(chatId).emit('message:receive', message);
        socket.emit('message:ack', { tempId: data.tempId, messageId: message.id });
      } catch (error) {
        console.error('[MESSAGE ERROR]', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      try {
        if (!validatePayload(data, { chatId: 'string', isTyping: 'boolean' })) return;
        if (!checkRateLimit(userId, 'typing')) return;

        socket.to(data.chatId).emit('typing', {
          chatId: data.chatId,
          userId,
          isTyping: data.isTyping
        });
      } catch (error) {
        console.error('[TYPING ERROR]', error);
      }
    });

    // --- Room Management ---
    socket.on('room:join', (data) => {
      try {
        if (!validatePayload(data, { roomId: 'string' })) return;

        const room = publicRooms.get(data.roomId);
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        socket.join(data.roomId);
        room.participants.add(userId);

        io.to(data.roomId).emit('message:receive', {
          id: uuidv4(),
          chatId: data.roomId,
          senderId: 'system',
          content: `${currentUser?.username || 'User'} joined the room.`,
          timestamp: new Date().toISOString(),
          isRead: true,
          type: 'system'
        });

        io.emit('rooms:update', getRoomsList());
        console.log(`[ROOM JOIN] ${userId} joined ${data.roomId}`);
      } catch (error) {
        console.error('[ROOM JOIN ERROR]', error);
      }
    });

    // --- RANDOM MATCHING (FIXED: Use Map, not Array) ---
    socket.on('random:search', () => {
      try {
        // Remove from queue if already waiting
        waitingQueue.delete(userId);

        // Find available partner
        const availablePartners = Array.from(waitingQueue.entries())
          .filter(([partnerId]) => {
            const partnerSockets = userSockets.get(partnerId);
            return partnerId !== userId && partnerSockets && partnerSockets.size > 0;
          });

        if (availablePartners.length > 0) {
          const [partnerId] = availablePartners[0];
          waitingQueue.delete(partnerId);

          const partnerSocketId = Array.from(userSockets.get(partnerId))[0];
          const partnerSocket = io.sockets.sockets.get(partnerSocketId);

          if (!partnerSocket) {
            waitingQueue.set(userId, Date.now());
            return;
          }

          const chatId = `random-${uuidv4()}`;
          socket.join(chatId);
          partnerSocket.join(chatId);

          privateChatRooms.set(chatId, {
            participants: new Set([userId, partnerId]),
            createdAt: Date.now()
          });

          const myData = users.get(userId);
          const partnerData = users.get(partnerId);

          socket.emit('random:matched', {
            id: chatId,
            type: 'random',
            name: partnerData?.username || 'Stranger',
            avatar: partnerData?.avatar,
            participants: [userId, partnerId],
            unreadCount: 0
          });

          partnerSocket.emit('random:matched', {
            id: chatId,
            type: 'random',
            name: myData?.username || 'Stranger',
            avatar: myData?.avatar,
            participants: [partnerId, userId],
            unreadCount: 0
          });

          console.log(`[RANDOM MATCH] ${userId} <-> ${partnerId}`);
        } else {
          waitingQueue.set(userId, Date.now());
          console.log(`[RANDOM QUEUE] ${userId} added to queue`);
        }
      } catch (error) {
        console.error('[RANDOM SEARCH ERROR]', error);
      }
    });

    // --- CANCEL SEARCH (NEW) ---
    socket.on('random:cancel', () => {
      waitingQueue.delete(userId);
      console.log(`[RANDOM CANCEL] ${userId} left queue`);
    });

    // --- PRIVATE CHAT ---
    socket.on('private:request', (data) => {
      try {
        if (!validatePayload(data, { targetUserId: 'string' })) return;

        const targetSocketIds = userSockets.get(data.targetUserId);
        if (!targetSocketIds || targetSocketIds.size === 0) {
          return socket.emit('error', { message: 'User not online' });
        }

        const requester = users.get(userId);
        const targetSocketId = Array.from(targetSocketIds)[0];

        io.to(targetSocketId).emit('private:request', {
          requesterId: userId,
          requesterName: requester?.username || 'Someone',
          requesterAvatar: requester?.avatar
        });

        console.log(`[PRIVATE REQUEST] ${userId} -> ${data.targetUserId}`);
      } catch (error) {
        console.error('[PRIVATE REQUEST ERROR]', error);
      }
    });

    socket.on('private:request:response', (data) => {
      try {
        if (!validatePayload(data, { accepted: 'boolean', requesterId: 'string' })) return;

        const requesterSocketIds = userSockets.get(data.requesterId);
        if (!requesterSocketIds || requesterSocketIds.size === 0) {
          return socket.emit('error', { message: 'Requester offline' });
        }

        const requesterSocketId = Array.from(requesterSocketIds)[0];
        const requesterSocket = io.sockets.sockets.get(requesterSocketId);

        if (!data.accepted) {
          io.to(requesterSocketId).emit('private:request:response', {
            accepted: false,
            targetUserId: userId
          });
          return;
        }

        if (!requesterSocket) return;

        const chatId = `private-${uuidv4()}`;
        socket.join(chatId);
        requesterSocket.join(chatId);

        privateChatRooms.set(chatId, {
          participants: new Set([userId, data.requesterId]),
          createdAt: Date.now()
        });

        const targetUser = users.get(userId);
        const requesterUser = users.get(data.requesterId);

        requesterSocket.emit('private:start', {
          chatId,
          partnerId: userId,
          partnerName: targetUser?.username || 'User',
          partnerAvatar: targetUser?.avatar,
          type: 'private'
        });

        socket.emit('private:start', {
          chatId,
          partnerId: data.requesterId,
          partnerName: requesterUser?.username || 'User',
          partnerAvatar: requesterUser?.avatar,
          type: 'private'
        });

        console.log(`[PRIVATE CHAT] ${userId} <-> ${data.requesterId}`);
      } catch (error) {
        console.error('[PRIVATE RESPONSE ERROR]', error);
      }
    });

    // --- LEAVE CHAT ---
    socket.on('chat:leave', (data) => {
      try {
        if (!validatePayload(data, { chatId: 'string' })) return;

        socket.leave(data.chatId);

        // Update public room
        if (publicRooms.has(data.chatId)) {
          const room = publicRooms.get(data.chatId);
          room.participants.delete(userId);
          io.emit('rooms:update', getRoomsList());
        }

        // Update private room
        if (privateChatRooms.has(data.chatId)) {
          const room = privateChatRooms.get(data.chatId);
          room.participants.delete(userId);
        }

        socket.to(data.chatId).emit('message:receive', {
          id: uuidv4(),
          chatId: data.chatId,
          senderId: 'system',
          content: `${currentUser?.username || 'User'} left the chat.`,
          timestamp: new Date().toISOString(),
          isRead: true,
          type: 'system'
        });

        console.log(`[LEAVE] ${userId} left ${data.chatId}`);
      } catch (error) {
        console.error('[LEAVE ERROR]', error);
      }
    });

    // --- REPORTING ---
    socket.on('user:report', (data) => {
      try {
        if (!validatePayload(data, { reportedUserId: 'string', reason: 'string' })) return;

        const safeReason = sanitize(data.reason).slice(0, 500);
        console.log(`[REPORT] User ${userId} reported ${data.reportedUserId} for: ${safeReason}`);
        
        // TODO: Store in database for moderation
        socket.emit('report:ack', { success: true });
      } catch (error) {
        console.error('[REPORT ERROR]', error);
      }
    });

    // --- DISCONNECT HANDLER (CRITICAL: Complete cleanup) ---
    socket.on('disconnect', (reason) => {
      console.log(`[DISCONNECT] ${userId} (${socket.id}) - ${reason}`);

      try {
        activeSockets.delete(socket.id);
        waitingQueue.delete(userId);

        const socketSet = userSockets.get(userId);
        if (socketSet) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            userSockets.delete(userId);
          }
        }

        // Only mark offline if no other sockets
        if (!userSockets.has(userId)) {
          publicRooms.forEach(room => {
            if (room.participants.has(userId)) {
              room.participants.delete(userId);
            }
          });

          privateChatRooms.forEach(room => {
            if (room.participants.has(userId)) {
              room.participants.delete(userId);
            }
          });

          const user = users.get(userId);
          if (user) {
            user.isOnline = false;
            user.lastSeen = new Date();
          }

          io.emit('lobby:update', {
            activeUsers: activeSockets.size,
            users: getOnlineUsers()
          });
          io.emit('rooms:update', getRoomsList());
        }
      } catch (error) {
        console.error('[DISCONNECT ERROR]', error);
      }
    });

    // --- ERROR HANDLING ---
    socket.on('error', (error) => {
      console.error(`[SOCKET ERROR] ${userId}:`, error);
    });

  } catch (error) {
    console.error('[CONNECTION ERROR]', error);
    socket.disconnect(true);
  }
});

// ============= Cleanup Jobs =============
setInterval(() => {
  cleanupEmptyRooms();
  
  // Clean stale waiting queue entries (> 60s)
  const now = Date.now();
  for (const [userId, timestamp] of waitingQueue.entries()) {
    if (now - timestamp > 60000) {
      waitingQueue.delete(userId);
    }
  }
}, 30000);

// ============= Graceful Shutdown =============
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, closing server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

// ============= Start Server =============
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[CORS] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});