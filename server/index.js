const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- In-Memory State ---
// users: Map<userId, UserObject>
const users = new Map();
// activeSockets: Map<socketId, userId>
const activeSockets = new Map();
// rooms: Map<roomId, RoomObject>
const publicRooms = new Map();
// waitingQueue: Array<userId>
let waitingQueue = [];

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

// --- API Routes ---
app.post('/api/login', (req, res) => {
  const { username, age, gender, location } = req.body;
  
  if (!username || !age) {
    return res.status(400).json({ error: 'Username and age are required' });
  }

  const userId = uuidv4();
  // Generate a consistent avatar based on username using DiceBear
  // Styles: bottts, adventurer, fun-emoji, lorelei
  const avatarStyle = 'bottts'; 
  const avatar = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${username}`;

  const user = {
    id: userId,
    username,
    age,
    gender,
    location: location || 'Unknown',
    avatar,
    isOnline: true,
    lastSeen: new Date()
  };

  // Store user data
  users.set(userId, user);

  res.json({ user, token: userId });
});

// --- Socket.IO Middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  socket.userId = token;
  next();
});

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${userId} (${socket.id})`);

  // 1. Join default global channel for updates
  socket.join('global-updates');

  // 2. Register/Update user status
  activeSockets.set(socket.id, userId);
  const currentUser = users.get(userId);
  if (currentUser) {
    currentUser.isOnline = true;
    currentUser.lastSeen = new Date();
  }

  // 3. Broadcast new state to everyone
  io.emit('lobby:update', { 
    activeUsers: activeSockets.size,
    users: getOnlineUsers()
  });
  
  // Send room list to connected user
  socket.emit('rooms:update', getRoomsList());

  // --- Messaging ---
  socket.on('message:send', (data) => {
    const { chatId, content } = data;
    const sender = users.get(userId);
    
    const message = {
      id: uuidv4(),
      chatId,
      senderId: userId,
      senderName: sender?.username,
      senderAvatar: sender?.avatar,
      content,
      timestamp: new Date(),
      isRead: false,
      type: 'text'
    };
    io.to(chatId).emit('message:receive', message);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('typing', {
      chatId: data.chatId,
      userId: userId,
      isTyping: data.isTyping
    });
  });

  // --- Room Management ---
  socket.on('room:join', (data) => {
      const { roomId } = data;
      const room = publicRooms.get(roomId);
      if (room) {
          socket.join(roomId);
          room.participants.add(userId);
          
          // Notify room members
          io.to(roomId).emit('message:receive', {
              id: uuidv4(),
              chatId: roomId,
              senderId: 'system',
              content: `${currentUser?.username} joined the room.`,
              timestamp: new Date(),
              isRead: true,
              type: 'system'
          });

          // Update lists
          io.emit('rooms:update', getRoomsList());
      }
  });

  // --- Random Chat ---
  socket.on('random:search', () => {
    // Remove if already in queue
    waitingQueue = waitingQueue.filter(id => id !== userId);
    
    if (waitingQueue.length > 0) {
      const partnerId = waitingQueue.shift();
      
      // Check if partner is still connected
      const partnerSocketEntry = [...activeSockets.entries()].find(([_, uid]) => uid === partnerId);
      
      if (partnerSocketEntry) {
        const [partnerSocketId] = partnerSocketEntry;
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        
        if (partnerSocket) {
          const chatId = `random-${uuidv4()}`;
          socket.join(chatId);
          partnerSocket.join(chatId);

          // Get names
          const myData = users.get(userId);
          const partnerData = users.get(partnerId);

          // Notify me
          socket.emit('random:matched', {
            id: chatId,
            type: 'random',
            name: partnerData ? partnerData.username : 'Stranger',
            avatar: partnerData?.avatar,
            participants: [userId, partnerId],
            unreadCount: 0
          });

          // Notify partner
          partnerSocket.emit('random:matched', {
            id: chatId,
            type: 'random',
            name: myData ? myData.username : 'Stranger',
            avatar: myData?.avatar,
            participants: [partnerId, userId],
            unreadCount: 0
          });
        }
      } else {
        // Partner gone, queue myself
        waitingQueue.push(userId);
      }
    } else {
      waitingQueue.push(userId);
    }
  });

  // --- Private Chat Flow ---
  socket.on('private:request', (data) => {
    const { targetUserId } = data;
    const requester = users.get(userId);
    
    // Find target socket
    const targetSocketEntry = [...activeSockets.entries()].find(([_, uid]) => uid === targetUserId);
    
    if (targetSocketEntry) {
      const [targetSocketId] = targetSocketEntry;
      io.to(targetSocketId).emit('private:request', {
        requesterId: userId,
        requesterName: requester ? requester.username : 'Someone',
        requesterAvatar: requester ? requester.avatar : null
      });
    }
  });

  socket.on('private:request:response', (data) => {
    const { accepted, requesterId } = data;
    const targetUser = users.get(userId); // Me
    const requesterUser = users.get(requesterId);

    // Find requester socket
    const requesterSocketEntry = [...activeSockets.entries()].find(([_, uid]) => uid === requesterId);
    
    if (requesterSocketEntry) {
      const [requesterSocketId] = requesterSocketEntry;
      const requesterSocket = io.sockets.sockets.get(requesterSocketId);

      if (accepted && requesterSocket) {
        const chatId = `private-${uuidv4()}`;
        
        // Join both to room
        socket.join(chatId);
        requesterSocket.join(chatId);

        // Emit START to Requester
        requesterSocket.emit('private:start', {
          chatId,
          partnerId: userId,
          partnerName: targetUser ? targetUser.username : 'User',
          partnerAvatar: targetUser?.avatar,
          type: 'private'
        });

        // Emit START to Me (Acceptor)
        socket.emit('private:start', {
          chatId,
          partnerId: requesterId,
          partnerName: requesterUser ? requesterUser.username : 'User',
          partnerAvatar: requesterUser?.avatar,
          type: 'private'
        });

      } else {
        // Notify rejection
        io.to(requesterSocketId).emit('private:request:response', {
          accepted: false,
          targetUserId: userId
        });
      }
    }
  });

  socket.on('chat:leave', (data) => {
      const { chatId } = data;
      socket.leave(chatId);
      
      // Update public rooms if needed
      if(publicRooms.has(chatId)) {
          const room = publicRooms.get(chatId);
          room.participants.delete(userId);
          io.emit('rooms:update', getRoomsList());
      }

      // Notify others in room
      socket.to(chatId).emit('message:receive', {
          id: uuidv4(),
          chatId,
          senderId: 'system',
          content: `${currentUser?.username || 'User'} left the chat.`,
          timestamp: new Date(),
          isRead: true,
          type: 'system'
      });
  });
  
  // --- Reporting ---
  socket.on('user:report', (data) => {
      const { reportedUserId, reason } = data;
      console.log(`[REPORT] User ${userId} reported ${reportedUserId} for: ${reason}`);
      // In a real app, save to DB
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
    activeSockets.delete(socket.id);
    waitingQueue = waitingQueue.filter(id => id !== userId);
    
    // Remove from all public rooms
    publicRooms.forEach(room => {
        if(room.participants.has(userId)) {
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
  });
});

// Use the environment variable PORT for deployment, fallback to 3001 for local
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});