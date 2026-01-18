/**
 * PRODUCTION-READY ANONYMOUS CHAT SYSTEM
 * Features: Smart Matchmaking, Session Recovery, Reputation System, Admin Dashboard
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// ===================================================================================
// CONFIGURATION & SECURITY
// ===================================================================================

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim());

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

// ===================================================================================
// SECURITY UTILITIES
// ===================================================================================

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

// ===================================================================================
// SESSION MANAGEMENT & RECOVERY
// ===================================================================================

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionToken -> sessionData
    this.socketToSession = new Map(); // socketId -> sessionToken
    this.SESSION_TTL = 60000; // 60 seconds
    this.MESSAGE_BUFFER_SIZE = 20;
    
    // Cleanup expired sessions every 30 seconds
    setInterval(() => this.cleanupExpiredSessions(), 30000);
  }

  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  createSession(socketId, userId, username) {
    const token = this.generateSessionToken();
    const session = {
      token,
      socketId,
      userId,
      username,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      currentRoom: null,
      currentMatch: null,
      messageBuffer: [],
      reconnectCount: 0
    };
    
    this.sessions.set(token, session);
    this.socketToSession.set(socketId, token);
    
    return token;
  }

  updateSession(token, updates) {
    const session = this.sessions.get(token);
    if (session) {
      Object.assign(session, updates, { lastActivity: Date.now() });
      return true;
    }
    return false;
  }

  addMessageToBuffer(token, message) {
    const session = this.sessions.get(token);
    if (session) {
      session.messageBuffer.push(message);
      if (session.messageBuffer.length > this.MESSAGE_BUFFER_SIZE) {
        session.messageBuffer.shift();
      }
    }
  }

  getSession(token) {
    const session = this.sessions.get(token);
    if (session && Date.now() - session.lastActivity < this.SESSION_TTL) {
      return session;
    }
    return null;
  }

  getSessionBySocket(socketId) {
    const token = this.socketToSession.get(socketId);
    return token ? this.getSession(token) : null;
  }

  reconnectSession(token, newSocketId) {
    const session = this.getSession(token);
    if (session) {
      // Remove old socket mapping
      this.socketToSession.delete(session.socketId);
      
      // Update session
      session.socketId = newSocketId;
      session.reconnectCount++;
      session.lastActivity = Date.now();
      
      // Create new socket mapping
      this.socketToSession.set(newSocketId, token);
      
      return session;
    }
    return null;
  }

  deleteSession(token) {
    const session = this.sessions.get(token);
    if (session) {
      this.socketToSession.delete(session.socketId);
      this.sessions.delete(token);
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TTL) {
        this.deleteSession(token);
      }
    }
  }
}

// ===================================================================================
// REPUTATION SYSTEM
// ===================================================================================

class ReputationSystem {
  constructor() {
    this.reputations = new Map(); // userId -> reputationData
    this.REPUTATION_DECAY = 0.95; // Decay multiplier per hour
    this.INITIAL_SCORE = 100;
    
    // Cleanup old reputations every hour
    setInterval(() => this.decayReputations(), 3600000);
  }

  initializeReputation(userId) {
    if (!this.reputations.has(userId)) {
      this.reputations.set(userId, {
        score: this.INITIAL_SCORE,
        messageCount: 0,
        avgResponseTime: 0,
        skipCount: 0,
        reportCount: 0,
        spamScore: 0,
        lastActivity: Date.now(),
        createdAt: Date.now()
      });
    }
    return this.reputations.get(userId);
  }

  getReputation(userId) {
    return this.reputations.get(userId) || this.initializeReputation(userId);
  }

  recordMessage(userId, isSpam = false) {
    const rep = this.getReputation(userId);
    rep.messageCount++;
    rep.lastActivity = Date.now();
    
    if (isSpam) {
      rep.spamScore += 10;
      rep.score = Math.max(0, rep.score - 5);
    } else if (rep.spamScore > 0) {
      rep.spamScore = Math.max(0, rep.spamScore - 1);
    }
  }

  recordResponseTime(userId, responseTimeMs) {
    const rep = this.getReputation(userId);
    if (rep.avgResponseTime === 0) {
      rep.avgResponseTime = responseTimeMs;
    } else {
      rep.avgResponseTime = (rep.avgResponseTime * 0.7) + (responseTimeMs * 0.3);
    }
  }

  recordSkip(userId) {
    const rep = this.getReputation(userId);
    rep.skipCount++;
    rep.score = Math.max(0, rep.score - 3);
    rep.lastActivity = Date.now();
  }

  recordReport(userId) {
    const rep = this.getReputation(userId);
    rep.reportCount++;
    rep.score = Math.max(0, rep.score - 15);
    rep.lastActivity = Date.now();
  }

  isToxic(userId) {
    const rep = this.getReputation(userId);
    return rep.score < 30 || rep.reportCount > 3 || rep.spamScore > 50;
  }

  getMatchmakingPriority(userId) {
    const rep = this.getReputation(userId);
    return Math.floor(rep.score / 20); // 0-5 priority levels
  }

  decayReputations() {
    const now = Date.now();
    for (const [userId, rep] of this.reputations.entries()) {
      // Remove reputation if inactive for 24 hours
      if (now - rep.lastActivity > 86400000) {
        this.reputations.delete(userId);
      } else {
        // Decay negative impacts slowly
        rep.skipCount = Math.floor(rep.skipCount * this.REPUTATION_DECAY);
        rep.spamScore = Math.floor(rep.spamScore * this.REPUTATION_DECAY);
        // Slowly recover score
        if (rep.score < this.INITIAL_SCORE) {
          rep.score = Math.min(this.INITIAL_SCORE, rep.score + 1);
        }
      }
    }
  }
}

// ===================================================================================
// SMART MATCHMAKING SYSTEM
// ===================================================================================

class SmartMatchmaking {
  constructor(reputationSystem) {
    this.reputation = reputationSystem;
    this.waitingQueue = new Map(); // priority -> Set<userId>
    this.userMetadata = new Map(); // userId -> matchmaking metadata
    this.activeMatches = new Map(); // matchId -> { user1, user2, startTime }
  }

  addToQueue(userId) {
    const rep = this.reputation.getReputation(userId);
    
    // Don't allow toxic users to match
    if (this.reputation.isToxic(userId)) {
      return { success: false, reason: 'reputation_too_low' };
    }

    const priority = this.reputation.getMatchmakingPriority(userId);
    
    if (!this.waitingQueue.has(priority)) {
      this.waitingQueue.set(priority, new Set());
    }
    
    this.waitingQueue.get(priority).add(userId);
    
    this.userMetadata.set(userId, {
      priority,
      joinedAt: Date.now(),
      activityLevel: this.calculateActivityLevel(rep),
      responseSpeed: rep.avgResponseTime
    });

    return { success: true, priority };
  }

  removeFromQueue(userId) {
    const metadata = this.userMetadata.get(userId);
    if (metadata) {
      const queue = this.waitingQueue.get(metadata.priority);
      if (queue) {
        queue.delete(userId);
        if (queue.size === 0) {
          this.waitingQueue.delete(metadata.priority);
        }
      }
      this.userMetadata.delete(userId);
    }
  }

  calculateActivityLevel(reputation) {
    // 0-100 score based on message frequency
    if (reputation.messageCount < 10) return 25; // new user
    if (reputation.messageCount < 50) return 50; // casual
    if (reputation.messageCount < 200) return 75; // active
    return 100; // very active
  }

  findMatch(userId) {
    const userMeta = this.userMetadata.get(userId);
    if (!userMeta) return null;

    // Try to find match in same priority first
    let match = this.findMatchInPriority(userId, userMeta.priority, userMeta);
    
    // If no match, try adjacent priorities
    if (!match && userMeta.priority > 0) {
      match = this.findMatchInPriority(userId, userMeta.priority - 1, userMeta);
    }
    if (!match && userMeta.priority < 5) {
      match = this.findMatchInPriority(userId, userMeta.priority + 1, userMeta);
    }

    if (match) {
      this.removeFromQueue(userId);
      this.removeFromQueue(match);
      
      const matchId = `match-${uuidv4()}`;
      this.activeMatches.set(matchId, {
        user1: userId,
        user2: match,
        startTime: Date.now()
      });
      
      return { matchId, partnerId: match };
    }

    return null;
  }

  findMatchInPriority(userId, priority, userMeta) {
    const queue = this.waitingQueue.get(priority);
    if (!queue || queue.size < 2) return null;

    const candidates = Array.from(queue).filter(id => id !== userId);
    
    if (candidates.length === 0) return null;

    // Find best match based on similar activity levels
    let bestMatch = null;
    let bestScore = Infinity;

    for (const candidateId of candidates) {
      const candidateMeta = this.userMetadata.get(candidateId);
      if (!candidateMeta) continue;

      // Calculate compatibility score (lower is better)
      const activityDiff = Math.abs(userMeta.activityLevel - candidateMeta.activityLevel);
      const timeDiff = Math.abs(userMeta.joinedAt - candidateMeta.joinedAt);
      
      const score = activityDiff + (timeDiff / 1000); // Weight activity more than wait time
      
      if (score < bestScore) {
        bestScore = score;
        bestMatch = candidateId;
      }
    }

    return bestMatch;
  }

  endMatch(matchId) {
    this.activeMatches.delete(matchId);
  }

  getQueueStats() {
    const stats = {
      totalWaiting: 0,
      byPriority: {}
    };
    
    for (const [priority, queue] of this.waitingQueue.entries()) {
      stats.byPriority[priority] = queue.size;
      stats.totalWaiting += queue.size;
    }
    
    return stats;
  }
}

// ===================================================================================
// ADMIN METRICS SYSTEM
// ===================================================================================

class AdminMetrics {
  constructor() {
    this.metrics = {
      totalConnections: 0,
      totalMessages: 0,
      totalReports: 0,
      peakConcurrentUsers: 0,
      messagesPerSecond: 0,
      activeRooms: new Map(),
      flaggedUsers: new Set(),
      hourlyStats: []
    };
    
    this.messageTimestamps = [];
    
    // Calculate messages/sec every second
    setInterval(() => this.calculateMessageRate(), 1000);
    
    // Store hourly stats
    setInterval(() => this.captureHourlySnapshot(), 3600000);
  }

  recordConnection() {
    this.metrics.totalConnections++;
  }

  recordMessage() {
    this.metrics.totalMessages++;
    this.messageTimestamps.push(Date.now());
  }

  recordReport(userId) {
    this.metrics.totalReports++;
    this.metrics.flaggedUsers.add(userId);
  }

  updateConcurrentUsers(count) {
    if (count > this.metrics.peakConcurrentUsers) {
      this.metrics.peakConcurrentUsers = count;
    }
  }

  updateRoomStats(roomId, roomName, userCount) {
    this.metrics.activeRooms.set(roomId, {
      name: roomName,
      users: userCount,
      lastUpdated: Date.now()
    });
  }

  calculateMessageRate() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Remove old timestamps
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > oneSecondAgo);
    
    this.metrics.messagesPerSecond = this.messageTimestamps.length;
  }

  captureHourlySnapshot() {
    this.metrics.hourlyStats.push({
      timestamp: Date.now(),
      totalMessages: this.metrics.totalMessages,
      peakUsers: this.metrics.peakConcurrentUsers,
      activeRooms: this.metrics.activeRooms.size
    });
    
    // Keep only last 24 hours
    if (this.metrics.hourlyStats.length > 24) {
      this.metrics.hourlyStats.shift();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeRooms: Array.from(this.metrics.activeRooms.entries()).map(([id, data]) => ({
        id,
        ...data
      })),
      flaggedUsers: Array.from(this.metrics.flaggedUsers)
    };
  }
}

// ===================================================================================
// INITIALIZE SYSTEMS
// ===================================================================================

const sessionManager = new SessionManager();
const reputationSystem = new ReputationSystem();
const matchmaking = new SmartMatchmaking(reputationSystem);
const adminMetrics = new AdminMetrics();

// ===================================================================================
// IN-MEMORY STATE
// ===================================================================================

const users = new Map(); // userId -> userData
const activeSockets = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> Set<socketId>
const publicRooms = new Map(); // roomId -> roomData
const privateChatRooms = new Map(); // chatId -> roomData
const typingUsers = new Map(); // roomId -> Set<userId>

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = {
  MESSAGE_INTERVAL: 500,
  MESSAGE_BURST: 5,
  TYPING_INTERVAL: 1000,
  REPORT_INTERVAL: 10000
};

const checkRateLimit = (userId, type) => {
  const now = Date.now();
  let limits = rateLimits.get(userId);
  if (!limits) {
    limits = { lastMessage: 0, messageCount: 0, lastTyping: 0, lastReport: 0, windowStart: now };
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

  if (type === 'report') {
    if (now - limits.lastReport < RATE_LIMIT.REPORT_INTERVAL) {
      return false;
    }
    limits.lastReport = now;
    return true;
  }

  return true;
};

// Initialize default public rooms
const defaultRooms = ['General Lounge', 'Tech & Coding', 'Anime & Gaming', 'Music & Vibe', 'Dating & Flirt'];
defaultRooms.forEach(name => {
  const id = `room-${uuidv4()}`;
  publicRooms.set(id, {
    id,
    name,
    participants: new Set(),
    createdAt: Date.now()
  });
});

// ===================================================================================
// HELPER FUNCTIONS
// ===================================================================================

const getOnlineUsers = () => {
  return Array.from(new Set(activeSockets.values()))
    .map(uid => users.get(uid))
    .filter(u => u !== undefined);
};

const getRoomsList = () => {
  return Array.from(publicRooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    participants: r.participants.size
  }));
};

const broadcastOnlineUsers = () => {
  const onlineUsers = getOnlineUsers();
  io.emit('onlineUsersUpdate', onlineUsers);
  adminMetrics.updateConcurrentUsers(onlineUsers.length);
};

const broadcastRoomsList = () => {
  const roomsList = getRoomsList();
  io.emit('roomsListUpdate', roomsList);
};

// ===================================================================================
// HTTP ENDPOINTS
// ===================================================================================

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

// Admin dashboard endpoint (protected by environment variable)
app.get('/admin/metrics', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const metrics = adminMetrics.getMetrics();
  const queueStats = matchmaking.getQueueStats();
  
  res.json({
    ...metrics,
    matchmaking: queueStats,
    sessions: {
      active: sessionManager.sessions.size,
      socketMappings: sessionManager.socketToSession.size
    },
    reputations: {
      tracked: reputationSystem.reputations.size
    }
  });
});

// ===================================================================================
// SOCKET.IO CONNECTION HANDLER
// ===================================================================================

io.on('connection', (socket) => {
  console.log(`[CONNECTION] Socket ${socket.id} connected`);
  adminMetrics.recordConnection();

  let currentUserId = null;
  let currentSessionToken = null;

  // ============================================
  // 1. USER JOIN (NEW SESSION)
  // ============================================
  
  socket.on('userJoin', (username, callback) => {
    if (!username || typeof username !== 'string') {
      return callback({ success: false, error: 'Invalid username' });
    }

    username = sanitize(username).substring(0, 30);
    if (!username) {
      return callback({ success: false, error: 'Username required' });
    }

    const userId = `user-${uuidv4()}`;
    
    // Create user
    users.set(userId, {
      id: userId,
      username,
      socketId: socket.id,
      joinedAt: Date.now(),
      status: 'online'
    });

    activeSockets.set(socket.id, userId);
    
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    currentUserId = userId;

    // Initialize reputation
    reputationSystem.initializeReputation(userId);

    // Create session with recovery token
    currentSessionToken = sessionManager.createSession(socket.id, userId, username);

    // Send initial data
    callback({
      success: true,
      userId,
      sessionToken: currentSessionToken,
      onlineUsers: getOnlineUsers(),
      publicRooms: getRoomsList()
    });

    // Broadcast updated user list
    broadcastOnlineUsers();

    console.log(`[USER_JOIN] ${username} (${userId}) - Session: ${currentSessionToken}`);
  });

  // ============================================
  // 2. SESSION RECONNECT
  // ============================================
  
  socket.on('reconnectSession', (sessionToken, callback) => {
    if (!sessionToken) {
      return callback({ success: false, error: 'Invalid session token' });
    }

    const session = sessionManager.reconnectSession(sessionToken, socket.id);
    
    if (!session) {
      return callback({ success: false, error: 'Session expired or invalid' });
    }

    const userId = session.userId;
    const user = users.get(userId);

    if (!user) {
      // User was cleaned up, recreate
      users.set(userId, {
        id: userId,
        username: session.username,
        socketId: socket.id,
        joinedAt: Date.now(),
        status: 'online'
      });
    } else {
      user.socketId = socket.id;
      user.status = 'online';
    }

    activeSockets.set(socket.id, userId);
    currentUserId = userId;
    currentSessionToken = sessionToken;

    // Restore user to previous state
    const restoredData = {
      success: true,
      userId,
      sessionToken,
      messageBuffer: session.messageBuffer,
      currentRoom: session.currentRoom,
      currentMatch: session.currentMatch,
      onlineUsers: getOnlineUsers(),
      publicRooms: getRoomsList()
    };

    // If user was in a room, rejoin them
    if (session.currentRoom) {
      socket.join(session.currentRoom);
    }

    callback(restoredData);
    broadcastOnlineUsers();

    console.log(`[RECONNECT] User ${userId} reconnected (attempt ${session.reconnectCount})`);
  });

  // ============================================
  // 3. SMART RANDOM CHAT MATCHING
  // ============================================
  
  socket.on('startRandomChat', (callback) => {
    if (!currentUserId) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    // Add to matchmaking queue
    const queueResult = matchmaking.addToQueue(currentUserId);
    
    if (!queueResult.success) {
      return callback({
        success: false,
        error: queueResult.reason === 'reputation_too_low' 
          ? 'Your reputation is too low to match. Please improve your behavior.'
          : 'Unable to join queue'
      });
    }

    // Try to find a match immediately
    const match = matchmaking.findMatch(currentUserId);
    
    if (match) {
      const { matchId, partnerId } = match;
      const partner = users.get(partnerId);
      
      if (!partner) {
        return callback({ success: false, error: 'Partner no longer available' });
      }

      // Create private chat room
      privateChatRooms.set(matchId, {
        id: matchId,
        participants: new Set([currentUserId, partnerId]),
        createdAt: Date.now(),
        type: 'random'
      });

      // Join both users to the room
      socket.join(matchId);
      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (partnerSocket) {
        partnerSocket.join(matchId);
      }

      // Update sessions
      if (currentSessionToken) {
        sessionManager.updateSession(currentSessionToken, { currentMatch: matchId });
      }

      // Notify both users
      callback({
        success: true,
        chatId: matchId,
        partner: {
          id: partnerId,
          username: partner.username
        }
      });

      socket.to(matchId).emit('matchFound', {
        chatId: matchId,
        partner: {
          id: currentUserId,
          username: users.get(currentUserId).username
        }
      });

      console.log(`[MATCH] ${currentUserId} matched with ${partnerId} (room: ${matchId})`);
    } else {
      // User is waiting in queue
      callback({
        success: true,
        waiting: true,
        priority: queueResult.priority,
        message: 'Looking for a compatible match...'
      });

      console.log(`[QUEUE] ${currentUserId} waiting in priority ${queueResult.priority}`);
    }
  });

  // ============================================
  // 4. CANCEL RANDOM CHAT
  // ============================================
  
  socket.on('cancelRandomChat', () => {
    if (currentUserId) {
      matchmaking.removeFromQueue(currentUserId);
      console.log(`[QUEUE_LEAVE] ${currentUserId} left queue`);
    }
  });

  // ============================================
  // 5. SKIP CURRENT MATCH
  // ============================================
  
  socket.on('skipMatch', (chatId, callback) => {
    if (!currentUserId || !chatId) {
      return callback({ success: false, error: 'Invalid request' });
    }

    const room = privateChatRooms.get(chatId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // Record skip in reputation
    reputationSystem.recordSkip(currentUserId);

    // Leave room
    socket.leave(chatId);
    
    // Notify partner
    socket.to(chatId).emit('partnerSkipped');

    // End match
    matchmaking.endMatch(chatId);
    
    // Clean up room
    room.participants.delete(currentUserId);
    if (room.participants.size === 0) {
      privateChatRooms.delete(chatId);
    }

    callback({ success: true });
    
    console.log(`[SKIP] ${currentUserId} skipped match ${chatId}`);
  });

  // ============================================
  // 6. SEND MESSAGE
  // ============================================
  
  socket.on('sendMessage', (data, callback) => {
    if (!validatePayload(data, { roomId: 'string', message: 'string' })) {
      return callback({ success: false, error: 'Invalid payload' });
    }

    if (!currentUserId || !checkRateLimit(currentUserId, 'message')) {
      return callback({ success: false, error: 'Rate limit exceeded' });
    }

    const { roomId, message: rawMessage } = data;
    const message = sanitize(rawMessage).substring(0, 1000);

    if (!message) {
      return callback({ success: false, error: 'Empty message' });
    }

    const user = users.get(currentUserId);
    if (!user) {
      return callback({ success: false, error: 'User not found' });
    }

    // Check for spam
    const isSpam = message.length > 500 || /(.)\1{10,}/.test(message);
    reputationSystem.recordMessage(currentUserId, isSpam);

    if (isSpam) {
      return callback({ success: false, error: 'Spam detected' });
    }

    const messageData = {
      id: `msg-${uuidv4()}`,
      roomId,
      senderId: currentUserId,
      senderName: user.username,
      message,
      timestamp: Date.now()
    };

    // Add to session buffer
    if (currentSessionToken) {
      sessionManager.addMessageToBuffer(currentSessionToken, messageData);
    }

    // Send to room (exclude sender)
    socket.to(roomId).emit('newMessage', messageData);

    // Record metrics
    adminMetrics.recordMessage();

    callback({ success: true, messageData });

    console.log(`[MESSAGE] ${user.username} in ${roomId}: ${message.substring(0, 50)}...`);
  });

  // ============================================
  // 7. TYPING INDICATOR
  // ============================================
  
  socket.on('typing', (roomId) => {
    if (!currentUserId || !roomId || !checkRateLimit(currentUserId, 'typing')) return;

    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Set());
    }
    
    typingUsers.get(roomId).add(currentUserId);
    
    socket.to(roomId).emit('userTyping', {
      userId: currentUserId,
      username: users.get(currentUserId)?.username
    });

    // Clear typing indicator after 3 seconds
    setTimeout(() => {
      const typing = typingUsers.get(roomId);
      if (typing) {
        typing.delete(currentUserId);
        socket.to(roomId).emit('userStoppedTyping', { userId: currentUserId });
      }
    }, 3000);
  });

  // ============================================
  // 8. REPORT USER/MESSAGE
  // ============================================
  
  socket.on('reportUser', (data, callback) => {
    if (!validatePayload(data, { targetUserId: 'string', reason: 'string' })) {
      return callback({ success: false, error: 'Invalid payload' });
    }

    if (!currentUserId || !checkRateLimit(currentUserId, 'report')) {
      return callback({ success: false, error: 'Rate limit exceeded' });
    }

    const { targetUserId, reason } = data;

    // Record report in reputation system
    reputationSystem.recordReport(targetUserId);

    // Record in admin metrics
    adminMetrics.recordReport(targetUserId);

    callback({ success: true, message: 'Report submitted. Thank you.' });

    console.log(`[REPORT] ${currentUserId} reported ${targetUserId} for: ${reason}`);
  });

  // ============================================
  // 9. JOIN PUBLIC ROOM
  // ============================================
  
  socket.on('joinRoom', (roomId, callback) => {
    if (!currentUserId || !roomId) {
      return callback({ success: false, error: 'Invalid request' });
    }

    const room = publicRooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    socket.join(roomId);
    room.participants.add(currentUserId);

    // Update session
    if (currentSessionToken) {
      sessionManager.updateSession(currentSessionToken, { currentRoom: roomId });
    }

    // Update admin metrics
    adminMetrics.updateRoomStats(roomId, room.name, room.participants.size);

    callback({
      success: true,
      room: {
        id: roomId,
        name: room.name,
        participants: room.participants.size
      }
    });

    // Notify room
    socket.to(roomId).emit('userJoinedRoom', {
      userId: currentUserId,
      username: users.get(currentUserId)?.username
    });

    broadcastRoomsList();

    console.log(`[ROOM_JOIN] ${currentUserId} joined ${room.name}`);
  });

  // ============================================
  // 10. LEAVE ROOM
  // ============================================
  
  socket.on('leaveRoom', (roomId) => {
    if (!currentUserId || !roomId) return;

    const room = publicRooms.get(roomId) || privateChatRooms.get(roomId);
    if (room) {
      socket.leave(roomId);
      room.participants.delete(currentUserId);

      socket.to(roomId).emit('userLeftRoom', {
        userId: currentUserId,
        username: users.get(currentUserId)?.username
      });

      broadcastRoomsList();
    }
  });

  // ============================================
  // 11. DISCONNECT HANDLER
  // ============================================
  
  socket.on('disconnect', () => {
    if (!currentUserId) return;

    console.log(`[DISCONNECT] ${currentUserId} disconnected`);

    // Remove from active sockets
    activeSockets.delete(socket.id);
    
    const userSocketSet = userSockets.get(currentUserId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        userSockets.delete(currentUserId);
      }
    }

    // Update user status (but keep user data for potential reconnect)
    const user = users.get(currentUserId);
    if (user) {
      user.status = 'offline';
    }

    // Remove from matchmaking queue
    matchmaking.removeFromQueue(currentUserId);

    // Leave all rooms
    for (const [roomId, room] of publicRooms.entries()) {
      if (room.participants.has(currentUserId)) {
        room.participants.delete(currentUserId);
        socket.to(roomId).emit('userLeftRoom', {
          userId: currentUserId,
          username: user?.username
        });
      }
    }

    // Handle private chat disconnection
    for (const [chatId, room] of privateChatRooms.entries()) {
      if (room.participants.has(currentUserId)) {
        socket.to(chatId).emit('partnerDisconnected');
        room.participants.delete(currentUserId);
        
        if (room.participants.size === 0) {
          privateChatRooms.delete(chatId);
          matchmaking.endMatch(chatId);
        }
      }
    }

    // Broadcast updated user list
    broadcastOnlineUsers();
    broadcastRoomsList();

    // Note: User data and session are kept for 60 seconds for reconnection
    // They will be cleaned up by the session manager
  });
});

// ===================================================================================
// START SERVER
// ===================================================================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Admin endpoint: /admin/metrics (requires X-Admin-Key header)`);
  console.log(`🔐 Set ADMIN_KEY environment variable for admin access`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
