/**
 * PRODUCTION-READY ANONYMOUS CHAT SYSTEM
 * Features: Smart Matchmaking, Session Recovery, Reputation System, Admin Dashboard
 * v2.0 — Added: Read receipts, message reactions, reply-to, image upload, typing debounce
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createStore, getStore, setStore } = require('./storage');
const { createLogger } = require('./logger');

const log = createLogger('server');
const app = express();
const server = http.createServer(app);

// Initialize storage (in-memory dev / Redis prod)
let store;
(async () => {
  try {
    store = await createStore();
    setStore(store);
    log.info('Storage initialized', { type: store.constructor.name });
  } catch (err) {
    log.error('Failed to initialize storage', err);
  }
})();

// HTTP correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || `http-${crypto.randomBytes(4).toString('hex')}`;
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
});

// ===================================================================================
// CONFIGURATION & SECURITY
// ===================================================================================

const DEFAULT_ORIGINS = 'http://localhost:3000,http://localhost:3001,http://localhost:5173';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ALLOWED_ORIGINS) {
  console.warn('[SECURITY WARNING] ALLOWED_ORIGINS not set in production! Using default localhost origins.');
}
if (isProduction && ALLOWED_ORIGINS.some(origin => origin.includes('localhost'))) {
  console.warn('[SECURITY WARNING] Localhost origins detected in production CORS configuration.');
}

// Shared CORS origin validator.
// Returns a clean 403 (not a thrown 500) for blocked origins, so clients
// see an actionable error instead of a confusing "Internal Server Error".
const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  console.warn(`[CORS] Blocked origin: ${origin}`);
  const err = new Error('Not allowed by CORS');
  err.status = 403;
  err.code = 'CORS_NOT_ALLOWED';
  callback(err);
};

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Centralized error handler — returns JSON with the status set by the
// throwing code (e.g. CORS 403) instead of Express' default 500 HTML.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status === 500 ? 'Internal server error' : (err.message || 'Error');
  if (status >= 500) log.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(status).json({ error: message, code });
});

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO Redis adapter for horizontal scaling
(async () => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { createClient } = require('ioredis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = new createClient(redisUrl);
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      log.info('Socket.IO Redis adapter enabled', { url: redisUrl.replace(/\/\/.*@/, '//***@') });
    } catch (err) {
      log.warn('Failed to setup Socket.IO Redis adapter, falling back to in-process', { error: err.message });
    }
  }
})();

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

// Uploads directory for images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===================================================================================
// SESSION MANAGEMENT & RECOVERY
// ===================================================================================

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.socketToSession = new Map();
    this.SESSION_TTL = 60000;
    this.MESSAGE_BUFFER_SIZE = 20;

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
      this.socketToSession.delete(session.socketId);
      session.socketId = newSocketId;
      session.reconnectCount++;
      session.lastActivity = Date.now();
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
    this.reputations = new Map();
    this.REPUTATION_DECAY = 0.95;
    this.INITIAL_SCORE = 100;

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
        createdAt: Date.now(),
        events: []
      });
    }
    return this.reputations.get(userId);
  }

  getReputation(userId) {
    return this.reputations.get(userId) || this.initializeReputation(userId);
  }

  _logEvent(userId, event) {
    const rep = this.getReputation(userId);
    rep.events.push({ ...event, timestamp: Date.now() });
    if (rep.events.length > 100) rep.events.shift();
  }

  recordMessage(userId, isSpam = false) {
    const rep = this.getReputation(userId);
    rep.messageCount++;
    rep.lastActivity = Date.now();

    if (isSpam) {
      rep.spamScore += 10;
      rep.score = Math.max(0, rep.score - 5);
      this._logEvent(userId, { type: 'spam_message', delta: -5, newScore: rep.score });
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
    this._logEvent(userId, { type: 'skip', delta: -3, newScore: rep.score });
  }

  recordReport(userId) {
    const rep = this.getReputation(userId);
    rep.reportCount++;
    rep.score = Math.max(0, rep.score - 15);
    rep.lastActivity = Date.now();
    this._logEvent(userId, { type: 'report', delta: -15, newScore: rep.score });
  }

  isToxic(userId) {
    const rep = this.getReputation(userId);
    return rep.score < 30 || rep.reportCount > 3 || rep.spamScore > 50;
  }

  getMatchmakingPriority(userId) {
    const rep = this.getReputation(userId);
    return Math.floor(rep.score / 20);
  }

  decayReputations() {
    const now = Date.now();
    for (const [userId, rep] of this.reputations.entries()) {
      if (now - rep.lastActivity > 86400000) {
        this.reputations.delete(userId);
      } else {
        rep.skipCount = Math.floor(rep.skipCount * this.REPUTATION_DECAY);
        rep.spamScore = Math.floor(rep.spamScore * this.REPUTATION_DECAY);
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
    this.waitingQueue = new Map();
    this.userMetadata = new Map();
    this.activeMatches = new Map();
    this.recentlyMatched = new Map();
    this.SKIP_COOLDOWN = 300000;
    this.analytics = {
      totalSearches: 0,
      totalMatches: 0,
      totalSkips: 0,
      totalWaitTime: 0,
      matchedWaitTime: 0,
      totalCancels: 0
    };
  }

  addToQueue(userId) {
    if (shadowBannedUsers && shadowBannedUsers.has(userId)) {
      return { success: false, reason: 'reputation_too_low' };
    }

    const rep = this.reputation.getReputation(userId);

    if (this.reputation.isToxic(userId)) {
      return { success: false, reason: 'reputation_too_low' };
    }

    const priority = this.reputation.getMatchmakingPriority(userId);

    if (!this.waitingQueue.has(priority)) {
      this.waitingQueue.set(priority, new Set());
    }

    this.waitingQueue.get(priority).add(userId);
    this.analytics.totalSearches++;

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
    if (reputation.messageCount < 10) return 25;
    if (reputation.messageCount < 50) return 50;
    if (reputation.messageCount < 200) return 75;
    return 100;
  }

  recordMutualSkip(userId1, userId2) {
    const timeout = Date.now() + this.SKIP_COOLDOWN;
    this.recentlyMatched.set(`${userId1}:${userId2}`, timeout);
    this.recentlyMatched.set(`${userId2}:${userId1}`, timeout);
  }

  wasRecentlyMatched(userId1, userId2) {
    const timeout = this.recentlyMatched.get(`${userId1}:${userId2}`);
    if (timeout && Date.now() < timeout) return true;
    this.recentlyMatched.delete(`${userId1}:${userId2}`);
    this.recentlyMatched.delete(`${userId2}:${userId1}`);
    return false;
  }

  findMatch(userId) {
    const userMeta = this.userMetadata.get(userId);
    if (!userMeta) return null;

    let match = this.findMatchInPriority(userId, userMeta.priority, userMeta);

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
      const now = Date.now();
      this.activeMatches.set(matchId, {
        user1: userId,
        user2: match,
        startTime: now
      });

      this.analytics.totalMatches++;
      this.analytics.matchedWaitTime += (now - userMeta.joinedAt);

      return { matchId, partnerId: match };
    }

    return null;
  }

  findMatchInPriority(userId, priority, userMeta) {
    const queue = this.waitingQueue.get(priority);
    if (!queue || queue.size < 2) return null;

    const candidates = Array.from(queue).filter(id => id !== userId && !this.wasRecentlyMatched(userId, id));

    if (candidates.length === 0) return null;

    const currentUser = this._getUserData(userId);

    let bestMatch = null;
    let bestScore = Infinity;

    for (const candidateId of candidates) {
      const candidateMeta = this.userMetadata.get(candidateId);
      if (!candidateMeta) continue;

      const candidateUser = this._getUserData(candidateId);

      // Interest overlap bonus (up to -40 for perfect match = very strong signal)
      let interestBonus = 0;
      if (currentUser && candidateUser && currentUser.interests && candidateUser.interests) {
        const sharedInterests = currentUser.interests.filter(i => candidateUser.interests.includes(i));
        interestBonus = sharedInterests.length * 8; // -8 per shared interest (lower score = better)
      }

      const activityDiff = Math.abs(userMeta.activityLevel - candidateMeta.activityLevel);
      const timeDiff = Math.abs(userMeta.joinedAt - candidateMeta.joinedAt);

      const score = activityDiff + (timeDiff / 1000) - interestBonus;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = candidateId;
      }
    }

    return bestMatch;
  }

  _getUserData(userId) {
    return users.get(userId);
  }

  endMatch(matchId) {
    this.activeMatches.delete(matchId);
  }

  recordSkip() {
    this.analytics.totalSkips++;
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

  getAnalytics() {
    const a = this.analytics;
    return {
      totalSearches: a.totalSearches,
      totalMatches: a.totalMatches,
      totalSkips: a.totalSkips,
      avgWaitTimeMs: a.totalMatches > 0 ? Math.round(a.matchedWaitTime / a.totalMatches) : 0,
      matchSuccessRate: a.totalSearches > 0 ? Math.round((a.totalMatches / a.totalSearches) * 100) : 0,
      skipRate: a.totalMatches > 0 ? Math.round((a.totalSkips / a.totalMatches) * 100) : 0
    };
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

    setInterval(() => this.calculateMessageRate(), 1000);
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
// MESSAGE STORE (reactions, read receipts)
// ===================================================================================

class MessageStore {
  constructor() {
    this.messages = new Map();
    this.reactions = new Map();
    this.readReceipts = new Map();
    this.roomReadReceiptsEnabled = new Map();
  }

  storeMessage(messageData) {
    this.messages.set(messageData.id, {
      ...messageData,
      deliveredTo: new Set(),
      readBy: new Set()
    });
  }

  getMessage(messageId) {
    return this.messages.get(messageId);
  }

  markDelivered(messageId, userId) {
    const msg = this.messages.get(messageId);
    if (msg) {
      msg.deliveredTo.add(userId);
      return true;
    }
    return false;
  }

  markRead(messageId, userId) {
    const msg = this.messages.get(messageId);
    if (msg) {
      msg.readBy.add(userId);
      return true;
    }
    return false;
  }

  toggleReaction(messageId, userId, emoji) {
    if (!this.reactions.has(messageId)) {
      this.reactions.set(messageId, new Map());
    }
    const msgReactions = this.reactions.get(messageId);

    if (!msgReactions.has(emoji)) {
      msgReactions.set(emoji, new Set());
    }

    const reactors = msgReactions.get(emoji);
    if (reactors.has(userId)) {
      reactors.delete(userId);
      if (reactors.size === 0) {
        msgReactions.delete(emoji);
      }
      return { added: false, emoji };
    } else {
      reactors.add(userId);
      return { added: true, emoji };
    }
  }

  getReactions(messageId) {
    const msgReactions = this.reactions.get(messageId);
    if (!msgReactions) return [];

    return Array.from(msgReactions.entries()).map(([emoji, reactors]) => ({
      emoji,
      count: reactors.size,
      reactors: Array.from(reactors)
    }));
  }

  isReadReceiptsEnabled(roomId) {
    return this.roomReadReceiptsEnabled.get(roomId) !== false;
  }

  setReadReceiptsEnabled(roomId, enabled) {
    this.roomReadReceiptsEnabled.set(roomId, enabled);
  }
}

// ===================================================================================
// TRUST & SAFETY
// ===================================================================================

class ProfanityFilter {
  constructor() {
    this.wordlist = [
      'fuck', 'shit', 'ass', 'bitch', 'damn', 'cunt', 'dick', 'bastard', 'piss',
      'slut', 'whore', 'cock', 'pussy', 'douche', 'twat', 'fag', 'faggot',
      'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wop', 'raghead',
      'cracker', 'honky', 'tranny', 'retard', 'midget', 'mongoloid',
      'anus', 'arse', 'ballsack', 'blowjob', 'boner', 'boob', 'bollocks',
      'buttplug', 'clitoris', 'cum', 'dildo', 'ejaculate', 'fellatio',
      'labia', 'masturbate', 'orgasm', 'penis', 'scrotum', 'semen',
      'testicle', 'vagina', 'vulva', 'wank', 'porn', 'porno', 'pornography',
      'rape', 'sexual', 'suck', 'tits', 'titties', 'sperm', 'bukkake',
      'cuckold', 'erotic', 'incest', 'pedophile', 'nude', 'naked',
      'milf', 'hentai', 'bestiality', 'necrophilia', 'guro', 'scat',
      'kill yourself', 'kys', 'die', 'murder', 'suicide', 'terrorist',
      'allah akbar', 'heil hitler', 'nazi', 'kkk', 'white power',
      'beaner', 'wetback', 'gringo', 'ching chong', 'sand nigger',
      'towelhead', 'camel jockey', 'coon', 'darkie', 'jigaboo',
      'redskin', 'squaw', 'dyke', 'queer', 'homo', 'lesbo', 'sodomy'
    ];
    this.customFilter = null;
  }

  setCustomFilter(fn) { this.customFilter = fn; }

  check(text) {
    const lower = text.toLowerCase();
    for (const word of this.wordlist) {
      if (lower.includes(word)) return { flagged: true, matches: [word], source: 'wordlist' };
    }
    if (this.customFilter) {
      return this.customFilter(text);
    }
    return { flagged: false, matches: [], source: null };
  }

  getReport() {
    return { wordlistSize: this.wordlist.length, customFilter: !!this.customFilter };
  }
}

class SessionThrottle {
  constructor() {
    this.offenses = new Map();
    this.ipBans = new Map();
  }

  recordOffense(userId, ip) {
    let record = this.offenses.get(userId);
    if (!record) {
      record = { count: 0, timestamps: [], level: 'none', ip: ip || '0.0.0.0', until: 0 };
      this.offenses.set(userId, record);
    }
    record.count++;
    record.timestamps.push(Date.now());
    record.ip = ip || record.ip;

    if (record.count >= 8) {
      record.level = 'ip_ban';
      this.ipBans.set(record.ip, Date.now() + 3600000);
    } else if (record.count >= 5) {
      record.level = 'temp_ban';
      record.until = Date.now() + 300000;
    } else if (record.count >= 3) {
      record.level = 'cooldown';
      record.until = Date.now() + 30000;
    } else {
      record.level = 'warn';
    }
  }

  getStatus(userId) {
    const record = this.offenses.get(userId);
    if (!record) return { level: 'none', remainingMs: 0 };

    if (record.level === 'ip_ban') {
      const ipUntil = this.ipBans.get(record.ip);
      if (ipUntil && Date.now() < ipUntil) {
        return { level: 'ip_ban', remainingMs: ipUntil - Date.now() };
      }
      if (ipUntil) {
        this.ipBans.delete(record.ip);
        record.level = 'none';
        return { level: 'none', remainingMs: 0 };
      }
    }

    if (record.until && Date.now() < record.until) {
      return { level: record.level, remainingMs: record.until - Date.now() };
    }

    record.level = 'none';
    return { level: 'none', remainingMs: 0 };
  }

  isThrottled(userId) {
    const status = this.getStatus(userId);
    return status.level !== 'none' && status.level !== 'warn';
  }

  getThrottledUsers() {
    const result = [];
    for (const [userId, record] of this.offenses.entries()) {
      const status = this.getStatus(userId);
      if (status.level !== 'none') {
        result.push({ userId, offenseCount: record.count, ...status });
      }
    }
    return result;
  }
}

class ReportManager {
  constructor() {
    this.reports = [];
    this.nextId = 1;
  }

  submitReport(reporterUserId, reportedUserId, reason, messageSnapshots) {
    const report = {
      id: this.nextId++,
      reporterUserId,
      reportedUserId,
      reason,
      messageSnapshots: messageSnapshots || [],
      timestamp: Date.now(),
      status: 'pending',
      action: null,
      actionedBy: null
    };
    this.reports.push(report);
    return report;
  }

  getPendingReports() {
    return this.reports
      .filter(r => r.status === 'pending')
      .map(r => ({
        ...r,
        messageSnapshots: r.messageSnapshots.map(s => {
          if (typeof s === 'string') {
            try { return JSON.parse(JSON.stringify({ ...JSON.parse(s), senderId: '[redacted]' })); }
            catch { return '[redacted]'; }
          }
          return { ...s, senderId: '[redacted]' };
        })
      }));
  }

  _findReport(reportId) {
    return this.reports.find(r => r.id === reportId);
  }

  takeAction(reportId, action, adminKey) {
    const report = this._findReport(reportId);
    if (!report) return { success: false, error: 'Report not found' };
    if (report.status !== 'pending') return { success: false, error: 'Report already processed' };

    const validActions = ['mute', 'ban', 'shadow-ban'];
    if (!validActions.includes(action)) return { success: false, error: 'Invalid action' };

    report.status = 'reviewed';
    report.action = action;
    report.actionedBy = adminKey;
    return { success: true, report };
  }

  dismissReport(reportId, adminKey) {
    const report = this._findReport(reportId);
    if (!report) return { success: false, error: 'Report not found' };

    report.status = 'dismissed';
    report.actionedBy = adminKey;
    return { success: true, report };
  }

  getReportStats() {
    const byStatus = { pending: 0, reviewed: 0, dismissed: 0 };
    const byAction = { mute: 0, ban: 0, 'shadow-ban': 0 };
    const reportedMap = {};

    for (const report of this.reports) {
      byStatus[report.status] = (byStatus[report.status] || 0) + 1;
      if (report.action) byAction[report.action] = (byAction[report.action] || 0) + 1;
      reportedMap[report.reportedUserId] = (reportedMap[report.reportedUserId] || 0) + 1;
    }

    const mostReportedUsers = Object.entries(reportedMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    return { byStatus, byAction, mostReportedUsers, total: this.reports.length };
  }
}

// ===================================================================================
// INITIALIZE SYSTEMS
// ===================================================================================

const sessionManager = new SessionManager();
const reputationSystem = new ReputationSystem();
const matchmaking = new SmartMatchmaking(reputationSystem);
const adminMetrics = new AdminMetrics();
const messageStore = new MessageStore();
const profanityFilter = new ProfanityFilter();
const sessionThrottle = new SessionThrottle();
const reportManager = new ReportManager();

// ===================================================================================
// IN-MEMORY STATE
// ===================================================================================

const users = new Map();
const tokenToUser = new Map();
const activeSockets = new Map();
const userSockets = new Map();
const publicRooms = new Map();
const privateChatRooms = new Map();
const typingUsers = new Map();

const bannedUsers = new Set();
const shadowBannedUsers = new Set();
const mutedUsers = new Map();

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
    .filter(u => u !== undefined)
    .map(u => ({
      id: u.id,
      username: u.username,
      age: u.age,
      gender: u.gender,
      location: u.location,
      avatar: u.avatar,
      isOnline: true,
      interests: u.interests
    }));
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
  io.emit('lobby:update', {
    activeUsers: onlineUsers.length,
    users: onlineUsers
  });
  adminMetrics.updateConcurrentUsers(onlineUsers.length);
};

const broadcastRoomsList = () => {
  const roomsList = getRoomsList();
  io.emit('rooms:update', roomsList);
};

// Simple NSFW detection placeholder
const NSFW_WORDS = ['nsfw', 'explicit', 'xxx'];
const checkNSFW = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return NSFW_WORDS.some(w => lower.includes(w));
};

// Spam detection
const isSpamMessage = (content) => {
  return content.length > 500 || /(.)\1{10,}/.test(content) || /[A-Z]{10,}/.test(content);
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

// Public stats endpoint (no auth required)
app.get('/api/stats', (req, res) => {
  const onlineUsers = getOnlineUsers().length;
  const totalMessages = adminMetrics ? adminMetrics.metrics.totalMessages : 0;
  res.json({
    onlineUsers,
    totalMessages,
    timestamp: Date.now()
  });
});

// Prometheus metrics endpoint (machine-readable)
app.get('/metrics', (req, res) => {
  const online = getOnlineUsers().length;
  const metrics = [
    `# HELP anonchat_uptime_seconds Server uptime in seconds`,
    `# TYPE anonchat_uptime_seconds gauge`,
    `anonchat_uptime_seconds ${Math.floor(process.uptime())}`,
    ``,
    `# HELP anonchat_users_total Total registered users`,
    `# TYPE anonchat_users_total gauge`,
    `anonchat_users_total ${users.size}`,
    ``,
    `# HELP anonchat_active_connections Current active socket connections`,
    `# TYPE anonchat_active_connections gauge`,
    `anonchat_active_connections ${activeSockets.size}`,
    ``,
    `# HELP anonchat_online_users Current online users`,
    `# TYPE anonchat_online_users gauge`,
    `anonchat_online_users ${online}`,
    ``,
    `# HELP anonchat_rooms_total Total rooms (public + private)`,
    `# TYPE anonchat_rooms_total gauge`,
    `anonchat_rooms_total ${publicRooms.size + privateChatRooms.size}`,
    ``,
    `# HELP anonchat_messages_total Total messages sent`,
    `# TYPE anonchat_messages_total counter`,
    `anonchat_messages_total ${adminMetrics ? adminMetrics.metrics.totalMessages : 0}`,
    ``,
    `# HELP anonchat_messages_per_second Current messages per second`,
    `# TYPE anonchat_messages_per_second gauge`,
    `anonchat_messages_per_second ${adminMetrics ? adminMetrics.metrics.messagesPerSecond : 0}`,
    ``,
    `# HELP anonchat_active_matches Current active matches`,
    `# TYPE anonchat_active_matches gauge`,
    `anonchat_active_matches ${matchmaking ? matchmaking.activeMatches.size : 0}`,
    ``,
    `# HELP anonchat_queue_waiting Users waiting in matchmaking queue`,
    `# TYPE anonchat_queue_waiting gauge`,
    `anonchat_queue_waiting ${matchmaking ? matchmaking.getQueueStats().totalWaiting : 0}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(metrics);
});

app.post('/api/login', (req, res) => {
  try {
    const { username, age, gender, location, interests } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!age || typeof age !== 'number' || age < 13) {
      return res.status(400).json({ error: 'Valid age (13+) is required' });
    }

    const sanitizedUsername = sanitize(username).substring(0, 30);
    const sanitizedLocation = location ? sanitize(String(location)).substring(0, 100) : undefined;
    const sanitizedGender = ['Male', 'Female', 'Other'].includes(gender) ? gender : 'Other';
    const sanitizedInterests = Array.isArray(interests) ? interests.filter(i => typeof i === 'string').map(i => sanitize(i).substring(0, 30)).filter(Boolean).slice(0, 5) : [];

    if (!sanitizedUsername) {
      return res.status(400).json({ error: 'Invalid username after sanitization' });
    }

    const userId = `user-${uuidv4()}`;
    const authToken = crypto.randomBytes(32).toString('hex');
    const avatar = `https://api.dicebear.com/9.x/open-peeps/svg?seed=${userId}`;

    const user = {
      id: userId,
      username: sanitizedUsername,
      age: age,
      gender: sanitizedGender,
      location: sanitizedLocation,
      avatar: avatar,
      isOnline: false,
      authToken: authToken,
      createdAt: Date.now(),
      interests: sanitizedInterests
    };

    users.set(userId, user);
    tokenToUser.set(authToken, userId);

    reputationSystem.initializeReputation(userId);

    console.log(`[API_LOGIN] User created: ${sanitizedUsername} (${userId})`);

    res.json({
      success: true,
      user: {
        id: userId,
        username: sanitizedUsername,
        age: age,
        gender: sanitizedGender,
        location: sanitizedLocation,
        avatar: avatar,
        isOnline: true,
        interests: sanitizedInterests
      },
      token: authToken
    });
  } catch (error) {
    console.error('[API_LOGIN] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Placeholder for image upload endpoint
  res.json({ error: 'Upload endpoint requires multipart processing' });
});

app.get('/admin/metrics', (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const metrics = adminMetrics.getMetrics();
  const queueStats = matchmaking.getQueueStats();
  const analytics = matchmaking.getAnalytics();

  res.json({
    ...metrics,
    matchmaking: {
      ...queueStats,
      analytics,
      recentlyMatched: matchmaking.recentlyMatched.size,
      activeMatches: matchmaking.activeMatches.size
    },
    sessions: {
      active: sessionManager.sessions.size,
      socketMappings: sessionManager.socketToSession.size
    },
    reputations: {
      tracked: reputationSystem.reputations.size
    }
  });
});

app.get('/admin/reports', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const reports = reportManager.getPendingReports();
  const stats = reportManager.getReportStats();
  res.json({ reports, stats });
});

app.post('/admin/reports/:id/action', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const reportId = parseInt(req.params.id, 10);
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }
  const result = reportManager.takeAction(reportId, action, adminKey);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/admin/reports/:id/dismiss', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const reportId = parseInt(req.params.id, 10);
  const result = reportManager.dismissReport(reportId, adminKey);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.get('/admin/throttle', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const throttled = sessionThrottle.getThrottledUsers();
  res.json({ throttledUsers: throttled, total: throttled.length });
});

// ===================================================================================
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ===================================================================================

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log(`[SOCKET_AUTH] No token provided for socket ${socket.id}`);
    return next(new Error('Authentication token required'));
  }

  const userId = tokenToUser.get(token);
  if (!userId) {
    console.log(`[SOCKET_AUTH] Invalid token for socket ${socket.id}`);
    return next(new Error('Invalid authentication token'));
  }

  const authenticatedUser = users.get(userId);
  if (!authenticatedUser) {
    console.log(`[SOCKET_AUTH] User not found for token, socket ${socket.id}`);
    return next(new Error('User not found'));
  }

  socket.userId = authenticatedUser.id;
  socket.username = authenticatedUser.username;
  socket.userData = authenticatedUser;

  if (bannedUsers && bannedUsers.has(authenticatedUser.id)) {
    console.log(`[SOCKET_AUTH] Rejected banned user ${authenticatedUser.username} (${authenticatedUser.id})`);
    return next(new Error('Account suspended'));
  }

  if (shadowBannedUsers && shadowBannedUsers.has(authenticatedUser.id)) {
    console.log(`[SOCKET_AUTH] Shadow-banned user connected ${authenticatedUser.username} (${authenticatedUser.id})`);
    socket.shadowBanned = true;
  }

  console.log(`[SOCKET_AUTH] Authenticated ${authenticatedUser.username} (${authenticatedUser.id})`);
  next();
});

// ===================================================================================
// SOCKET.IO CONNECTION HANDLER
// ===================================================================================

io.on('connection', (socket) => {
  console.log(`[CONNECTION] Socket ${socket.id} connected (User: ${socket.username})`);
  adminMetrics.recordConnection();

  let currentUserId = socket.userId;
  let currentSessionToken = null;

  if (currentUserId) {
    const user = users.get(currentUserId);
    if (user) {
      user.socketId = socket.id;
      user.status = 'online';
      user.isOnline = true;

      activeSockets.set(socket.id, currentUserId);

      if (!userSockets.has(currentUserId)) {
        userSockets.set(currentUserId, new Set());
      }
      userSockets.get(currentUserId).add(socket.id);

      currentSessionToken = sessionManager.createSession(socket.id, currentUserId, user.username);

      socket.emit('lobby:update', {
        activeUsers: getOnlineUsers().length,
        users: getOnlineUsers()
      });
      socket.emit('rooms:update', getRoomsList());

      broadcastOnlineUsers();

      console.log(`[USER_ACTIVATED] ${user.username} (${currentUserId}) - Session: ${currentSessionToken}`);
    }
  }

  // ============================================
  // LEGACY: USER JOIN
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
    reputationSystem.initializeReputation(userId);
    currentSessionToken = sessionManager.createSession(socket.id, userId, username);

    callback({
      success: true,
      userId,
      sessionToken: currentSessionToken,
      onlineUsers: getOnlineUsers(),
      publicRooms: getRoomsList()
    });

    broadcastOnlineUsers();
    console.log(`[USER_JOIN] ${username} (${userId}) - Session: ${currentSessionToken}`);
  });

  // ============================================
  // LEGACY: SESSION RECONNECT
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

    if (session.currentRoom) {
      socket.join(session.currentRoom);
    }

    callback(restoredData);
    broadcastOnlineUsers();
    console.log(`[RECONNECT] User ${userId} reconnected (attempt ${session.reconnectCount})`);
  });

  // ============================================
  // SMART RANDOM CHAT MATCHING
  // ============================================

  socket.on('startRandomChat', (callback) => {
    if (!currentUserId) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const queueResult = matchmaking.addToQueue(currentUserId);

    if (!queueResult.success) {
      return callback({
        success: false,
        error: queueResult.reason === 'reputation_too_low'
          ? 'Your reputation is too low to match. Please improve your behavior.'
          : 'Unable to join queue'
      });
    }

    const match = matchmaking.findMatch(currentUserId);

    if (match) {
      const { matchId, partnerId } = match;
      const partner = users.get(partnerId);

      if (!partner) {
        return callback({ success: false, error: 'Partner no longer available' });
      }

      privateChatRooms.set(matchId, {
        id: matchId,
        participants: new Set([currentUserId, partnerId]),
        createdAt: Date.now(),
        type: 'random'
      });

      socket.join(matchId);
      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (partnerSocket) {
        partnerSocket.join(matchId);
      }

      if (currentSessionToken) {
        sessionManager.updateSession(currentSessionToken, { currentMatch: matchId });
      }

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
  // CANCEL RANDOM CHAT
  // ============================================

  socket.on('cancelRandomChat', () => {
    if (currentUserId) {
      matchmaking.removeFromQueue(currentUserId);
      console.log(`[QUEUE_LEAVE] ${currentUserId} left queue`);
    }
  });

  // ============================================
  // SKIP CURRENT MATCH
  // ============================================

  socket.on('skipMatch', (chatId, callback) => {
    if (!currentUserId || !chatId) {
      return callback({ success: false, error: 'Invalid request' });
    }

    const room = privateChatRooms.get(chatId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    reputationSystem.recordSkip(currentUserId);
    matchmaking.recordSkip();

    socket.leave(chatId);

    socket.to(chatId).emit('partnerSkipped');

    matchmaking.endMatch(chatId);

    room.participants.delete(currentUserId);
    if (room.participants.size === 0) {
      privateChatRooms.delete(chatId);
    } else {
      const remainingUserId = Array.from(room.participants)[0];
      matchmaking.recordMutualSkip(currentUserId, remainingUserId);
    }

    callback({ success: true });

    console.log(`[SKIP] ${currentUserId} skipped match ${chatId}`);
  });

  // ============================================
  // LEGACY: SEND MESSAGE
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

    const isSpam = isSpamMessage(message);
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

    if (currentSessionToken) {
      sessionManager.addMessageToBuffer(currentSessionToken, messageData);
    }

    socket.to(roomId).emit('newMessage', messageData);
    adminMetrics.recordMessage();

    callback({ success: true, messageData });

    console.log(`[MESSAGE] ${user.username} in ${roomId}: ${message.substring(0, 50)}...`);
  });

  // ============================================
  // LEGACY: TYPING INDICATOR
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

    setTimeout(() => {
      const typing = typingUsers.get(roomId);
      if (typing) {
        typing.delete(currentUserId);
        socket.to(roomId).emit('userStoppedTyping', { userId: currentUserId });
      }
    }, 3000);
  });

  // ============================================
  // LEGACY: REPORT USER
  // ============================================

  socket.on('reportUser', (data, callback) => {
    if (!validatePayload(data, { targetUserId: 'string', reason: 'string' })) {
      return callback({ success: false, error: 'Invalid payload' });
    }

    if (!currentUserId || !checkRateLimit(currentUserId, 'report')) {
      return callback({ success: false, error: 'Rate limit exceeded' });
    }

    const { targetUserId, reason } = data;

    reputationSystem.recordReport(targetUserId);
    adminMetrics.recordReport(targetUserId);

    reportManager.submitReport(currentUserId, targetUserId, reason, []);

    callback({ success: true, message: 'Report submitted. Thank you.' });

    console.log(`[REPORT] ${currentUserId} reported ${targetUserId} for: ${reason}`);
  });

  // ============================================
  // LEGACY: JOIN PUBLIC ROOM
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

    if (currentSessionToken) {
      sessionManager.updateSession(currentSessionToken, { currentRoom: roomId });
    }

    adminMetrics.updateRoomStats(roomId, room.name, room.participants.size);

    callback({
      success: true,
      room: {
        id: roomId,
        name: room.name,
        participants: room.participants.size
      }
    });

    socket.to(roomId).emit('userJoinedRoom', {
      userId: currentUserId,
      username: users.get(currentUserId)?.username
    });

    broadcastRoomsList();
    console.log(`[ROOM_JOIN] ${currentUserId} joined ${room.name}`);
  });

  // ============================================
  // LEGACY: LEAVE ROOM
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
  // FRONTEND COMPATIBLE EVENT HANDLERS
  // ============================================

  // random:search
  socket.on('random:search', (data) => {
    if (!currentUserId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const queueResult = matchmaking.addToQueue(currentUserId);

    if (!queueResult.success) {
      socket.emit('error', {
        message: queueResult.reason === 'reputation_too_low'
          ? 'Your reputation is too low to match. Please improve your behavior.'
          : 'Unable to join queue'
      });
      return;
    }

    const match = matchmaking.findMatch(currentUserId);

    if (match) {
      const { matchId, partnerId } = match;
      const partner = users.get(partnerId);
      const user = users.get(currentUserId);

      if (!partner) {
        socket.emit('error', { message: 'Partner no longer available' });
        return;
      }

      privateChatRooms.set(matchId, {
        id: matchId,
        participants: new Set([currentUserId, partnerId]),
        createdAt: Date.now(),
        type: 'random'
      });

      socket.join(matchId);
      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (partnerSocket) {
        partnerSocket.join(matchId);
      }

      if (currentSessionToken) {
        sessionManager.updateSession(currentSessionToken, { currentMatch: matchId });
      }

      socket.emit('random:matched', {
        id: matchId,
        type: 'random',
        name: partner.username,
        avatar: partner.avatar,
        participants: [currentUserId, partnerId],
        unreadCount: 0,
        lastMessage: {
          id: Date.now().toString(),
          chatId: matchId,
          senderId: 'system',
          content: `Matched with ${partner.username}`,
          timestamp: new Date(),
          isRead: true,
          type: 'system'
        }
      });

      if (partnerSocket) {
        partnerSocket.emit('random:matched', {
          id: matchId,
          type: 'random',
          name: user.username,
          avatar: user.avatar,
          participants: [partnerId, currentUserId],
          unreadCount: 0,
          lastMessage: {
            id: Date.now().toString(),
            chatId: matchId,
            senderId: 'system',
            content: `Matched with ${user.username}`,
            timestamp: new Date(),
            isRead: true,
            type: 'system'
          }
        });
      }

      console.log(`[MATCH] ${currentUserId} matched with ${partnerId} (room: ${matchId})`);
    } else {
      console.log(`[QUEUE] ${currentUserId} waiting in priority ${queueResult.priority}`);
    }
  });

  // random:cancel
  socket.on('random:cancel', () => {
    if (currentUserId) {
      matchmaking.removeFromQueue(currentUserId);
      console.log(`[QUEUE_LEAVE] ${currentUserId} left queue`);
    }
  });

  // private:request
  socket.on('private:request', (data) => {
    if (!currentUserId || !data || !data.targetUserId) return;

    const targetUser = users.get(data.targetUserId);
    const currentUser = users.get(currentUserId);

    if (!targetUser || !currentUser) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetUser.socketId);
    if (targetSocket) {
      targetSocket.emit('private:request', {
        requesterId: currentUserId,
        requesterName: currentUser.username,
        requesterAvatar: currentUser.avatar
      });
      console.log(`[PRIVATE_REQUEST] ${currentUser.username} -> ${targetUser.username}`);
    }
  });

  // private:request:response
  socket.on('private:request:response', (data) => {
    if (!currentUserId || !data) return;

    const { accepted, requesterId } = data;
    const requester = users.get(requesterId);
    const currentUser = users.get(currentUserId);

    if (!requester || !currentUser) return;

    const requesterSocket = io.sockets.sockets.get(requester.socketId);

    if (accepted) {
      const chatId = `private-${uuidv4()}`;

      privateChatRooms.set(chatId, {
        id: chatId,
        participants: new Set([currentUserId, requesterId]),
        createdAt: Date.now(),
        type: 'private'
      });

      socket.join(chatId);
      if (requesterSocket) {
        requesterSocket.join(chatId);
      }

      socket.emit('private:start', {
        chatId,
        partnerId: requesterId,
        partnerName: requester.username,
        partnerAvatar: requester.avatar
      });

      if (requesterSocket) {
        requesterSocket.emit('private:start', {
          chatId,
          partnerId: currentUserId,
          partnerName: currentUser.username,
          partnerAvatar: currentUser.avatar
        });
      }

      console.log(`[PRIVATE_START] Chat between ${currentUser.username} and ${requester.username}`);
    } else {
      if (requesterSocket) {
        requesterSocket.emit('private:request:response', {
          accepted: false,
          targetUserId: currentUserId
        });
      }
      console.log(`[PRIVATE_DECLINED] ${currentUser.username} declined ${requester.username}`);
    }
  });

  // room:join
  socket.on('room:join', (data) => {
    if (!currentUserId || !data || !data.roomId) return;

    const room = publicRooms.get(data.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    socket.join(data.roomId);
    room.participants.add(currentUserId);

    if (currentSessionToken) {
      sessionManager.updateSession(currentSessionToken, { currentRoom: data.roomId });
    }

    adminMetrics.updateRoomStats(data.roomId, room.name, room.participants.size);

    const user = users.get(currentUserId);
    const systemMessage = {
      id: `msg-${uuidv4()}`,
      chatId: data.roomId,
      senderId: 'system',
      content: `${user?.username} joined the room`,
      timestamp: new Date(),
      isRead: true,
      type: 'system'
    };

    socket.to(data.roomId).emit('message:receive', systemMessage);
    socket.emit('message:receive', systemMessage);

    broadcastRoomsList();
    console.log(`[ROOM_JOIN] ${currentUserId} joined ${room.name}`);
  });

  // chat:leave
  socket.on('chat:leave', (data) => {
    if (!currentUserId || !data || !data.chatId) return;

    const room = publicRooms.get(data.chatId) || privateChatRooms.get(data.chatId);
    if (room) {
      socket.leave(data.chatId);
      room.participants.delete(currentUserId);

      const user = users.get(currentUserId);
      socket.to(data.chatId).emit('message:receive', {
        id: `msg-${uuidv4()}`,
        chatId: data.chatId,
        senderId: 'system',
        content: `${user?.username} left the chat`,
        timestamp: new Date(),
        isRead: true,
        type: 'system'
      });

      if (privateChatRooms.has(data.chatId) && room.participants.size === 0) {
        privateChatRooms.delete(data.chatId);
      }

      broadcastRoomsList();
      console.log(`[CHAT_LEAVE] ${currentUserId} left ${data.chatId}`);
    }
  });

  // ============================================
  // message:send — ENHANCED with replyTo, attachments
  // ============================================

  socket.on('message:send', (data) => {
    if (!currentUserId || !data || !data.chatId || !data.content) return;

    if (!checkRateLimit(currentUserId, 'message')) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    if (mutedUsers && mutedUsers.has(currentUserId)) {
      const until = mutedUsers.get(currentUserId);
      if (Date.now() < until) {
        socket.emit('error', { message: 'You are muted. Please wait before sending messages.' });
        return;
      }
      mutedUsers.delete(currentUserId);
    }

    const content = sanitize(data.content).substring(0, 1000);
    if (!content) return;

    const user = users.get(currentUserId);
    if (!user) return;

    const isSpam = isSpamMessage(content);
    reputationSystem.recordMessage(currentUserId, isSpam);

    if (isSpam) {
      socket.emit('error', { message: 'Spam detected' });
      return;
    }

    // Profanity check
    const profanityResult = profanityFilter.check(content);
    if (profanityResult.flagged) {
      sessionThrottle.recordOffense(currentUserId, socket.handshake.address);
      console.log(`[PROFANITY] ${currentUserId} flagged: ${profanityResult.matches.join(', ')}`);
    }

    // NSFW check stub
    const nsfwFlagged = checkNSFW(content);

    const messageId = `msg-${uuidv4()}`;
    const messageData = {
      id: messageId,
      chatId: data.chatId,
      senderId: currentUserId,
      senderName: user.username,
      senderAvatar: user.avatar,
      content: content,
      timestamp: new Date(),
      isRead: false,
      type: data.attachment ? (data.attachment.type === 'gif' ? 'gif' : 'image') : 'text',
      status: 'sent',
      replyTo: data.replyTo || null,
      attachment: data.attachment || null,
      nsfwFlagged
    };

    messageStore.storeMessage(messageData);

    if (currentSessionToken) {
      sessionManager.addMessageToBuffer(currentSessionToken, messageData);
    }

    // Broadcast to room (exclude sender)
    socket.to(data.chatId).emit('message:receive', messageData);

    // Ack to sender with messageId
    if (data.tempId) {
      socket.emit('message:ack', { tempId: data.tempId, messageId: messageId });
    }

    adminMetrics.recordMessage();

    console.log(`[MESSAGE] ${user.username} in ${data.chatId}: ${content.substring(0, 50)}...`);
  });

  // ============================================
  // message:read — Read receipts
  // ============================================

  socket.on('message:read', (data) => {
    if (!currentUserId || !data || !data.chatId || !data.messageIds) return;

    if (!messageStore.isReadReceiptsEnabled(data.chatId)) return;

    const userId = currentUserId;
    data.messageIds.forEach((messageId) => {
      messageStore.markRead(messageId, userId);
    });

    // Notify sender(s)
    const room = publicRooms.get(data.chatId) || privateChatRooms.get(data.chatId);
    if (room) {
      const otherParticipants = Array.from(room.participants).filter(id => id !== currentUserId);
      otherParticipants.forEach(otherId => {
        const otherSockets = userSockets.get(otherId);
        if (otherSockets) {
          otherSockets.forEach(sid => {
            io.to(sid).emit('message:read', {
              chatId: data.chatId,
              messageIds: data.messageIds,
              readBy: currentUserId
            });
          });
        }
      });
    }
  });

  // ============================================
  // message:react — Emoji reactions
  // ============================================

  socket.on('message:react', (data) => {
    if (!currentUserId || !data || !data.messageId || !data.emoji) return;

    const { messageId, emoji } = data;
    const sanitizedEmoji = sanitize(emoji).substring(0, 10);
    if (!sanitizedEmoji) return;

    const result = messageStore.toggleReaction(messageId, currentUserId, sanitizedEmoji);

    // Get updated reactions
    const reactions = messageStore.getReactions(messageId);

    // Broadcast to the room
    const msg = messageStore.getMessage(messageId);
    if (msg) {
      io.to(msg.chatId).emit('message:reaction:update', {
        messageId,
        reactions,
        userId: currentUserId,
        ...result
      });
    }
  });

  // ============================================
  // read:receipts:toggle — Toggle read receipts per room
  // ============================================

  socket.on('read:receipts:toggle', (data) => {
    if (!currentUserId || !data || !data.chatId) return;

    messageStore.setReadReceiptsEnabled(data.chatId, data.enabled !== false);

    socket.emit('read:receipts:toggle', {
      chatId: data.chatId,
      enabled: data.enabled !== false
    });
  });

  // ============================================
  // user:report — Enhanced
  // ============================================

  socket.on('user:report', (data) => {
    if (!currentUserId || !data || !data.reportedUserId) return;

    if (!checkRateLimit(currentUserId, 'report')) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    const reason = data.reason || 'No reason provided';
    const messageSnapshots = data.messageSnapshots || [];

    reputationSystem.recordReport(data.reportedUserId);
    adminMetrics.recordReport(data.reportedUserId);

    reportManager.submitReport(currentUserId, data.reportedUserId, reason, messageSnapshots);

    console.log(`[REPORT] ${currentUserId} reported ${data.reportedUserId} for: ${reason} (${messageSnapshots.length} snapshots)`);
  });

  // ============================================
  // typing — ENHANCED with start/stop
  // ============================================

  socket.on('typing', (data) => {
    if (!currentUserId) return;

    const chatId = typeof data === 'object' ? data.chatId : data;
    const isTyping = typeof data === 'object' ? data.isTyping : true;

    if (!chatId || !checkRateLimit(currentUserId, 'typing')) return;

    if (isTyping) {
      if (!typingUsers.has(chatId)) {
        typingUsers.set(chatId, new Set());
      }
      typingUsers.get(chatId).add(currentUserId);

      socket.to(chatId).emit('typing', {
        chatId: chatId,
        isTyping: true,
        username: users.get(currentUserId)?.username
      });

      // Clear after 3 seconds of inactivity
      if (socket._typingTimer) clearTimeout(socket._typingTimer);
      socket._typingTimer = setTimeout(() => {
        const typing = typingUsers.get(chatId);
        if (typing) {
          typing.delete(currentUserId);
          socket.to(chatId).emit('typing', { chatId: chatId, isTyping: false });
        }
      }, 3000);
    } else {
      const typing = typingUsers.get(chatId);
      if (typing) {
        typing.delete(currentUserId);
        socket.to(chatId).emit('typing', { chatId: chatId, isTyping: false });
      }
      if (socket._typingTimer) clearTimeout(socket._typingTimer);
    }
  });

  // ============================================
  // DISCONNECT HANDLER
  // ============================================

  socket.on('disconnect', () => {
    if (!currentUserId) return;

    console.log(`[DISCONNECT] ${currentUserId} disconnected`);

    activeSockets.delete(socket.id);

    const userSocketSet = userSockets.get(currentUserId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        userSockets.delete(currentUserId);
      }
    }

    const user = users.get(currentUserId);
    if (user) {
      user.status = 'offline';
    }

    matchmaking.removeFromQueue(currentUserId);

    for (const [roomId, room] of publicRooms.entries()) {
      if (room.participants.has(currentUserId)) {
        room.participants.delete(currentUserId);
        socket.to(roomId).emit('userLeftRoom', {
          userId: currentUserId,
          username: user?.username
        });
      }
    }

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

    broadcastOnlineUsers();
    broadcastRoomsList();
  });
});

// ===================================================================================
// START SERVER
// ===================================================================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Admin endpoint: /admin/metrics (requires X-Admin-Key header)`);
  console.log(`🔐 Set ADMIN_KEY environment variable for admin access`);
  console.log(`🌐 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received. Starting graceful shutdown...');

  // Stop accepting new connections
  server.closeIdleConnections();

  // Notify all connected clients
  io.emit('server:shutdown', {
    message: 'Server is shutting down for maintenance. You will be reconnected automatically.',
    reconnectAfter: 5000
  });

  // Drain socket connections with timeout
  let drainTimeout = setTimeout(() => {
    log.warn('Drain timeout — forcing shutdown');
    forceExit();
  }, 15000);

  // Close Socket.IO (disconnects all clients)
  io.close(() => {
    clearTimeout(drainTimeout);
    log.info('Socket.IO connections closed');

    // Close HTTP server
    server.close(async () => {
      log.info('HTTP server closed');

      // Disconnect from storage (Redis / in-memory)
      try {
        const s = getStore();
        if (s && typeof s.disconnect === 'function') {
          await s.disconnect();
          log.info('Storage disconnected');
        }
      } catch (err) {
        log.error('Error disconnecting storage', err);
      }

      process.exit(0);
    });
  });

  // Force close after 15s
  function forceExit() {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }
});

// Also handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  process.emit('SIGTERM');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { reason: String(reason) });
});
