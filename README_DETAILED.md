# AnonChat Live - Detailed Documentation

## 🎯 Project Overview

**AnonChat Live** is a production-ready, real-time anonymous chat application that allows users to connect anonymously with strangers or friends through private messaging, group rooms, and random matching. Built with React (Vite) + TypeScript for the frontend and Node.js (Express + Socket.IO) for the backend.

### Key Features
- 🔐 **Anonymous Login** - No email/password required, just a username
- ⚡ **Real-time Messaging** - Instant message delivery via WebSocket (Socket.IO)
- 🎲 **Random Matching** - Connect with random users and have one-on-one conversations
- 💬 **Private Chats** - Request and accept private chat sessions with specific users
- 🏘️ **Group Rooms** - Join public rooms (Tech, Anime, Music, etc.) for group discussions
- 📱 **Responsive Design** - Fully mobile-friendly UI with smooth animations
- 🛡️ **Security Features** - CORS protection, payload validation, XSS prevention
- 📊 **Session Management** - Session recovery, reconnection handling, message buffering
- 🎨 **Modern UI** - Built with Tailwind CSS with DiceBear avatars

---

## 🏗️ Architecture

### Project Structure

```
AnonChat/
├── 📁 components/          # React UI components
│   ├── ChatWindow.tsx      # Main chat interface
│   ├── Sidebar.tsx         # Session list & controls
│   ├── LoginModal.tsx      # Authentication UI
│   ├── LandingPage.tsx     # Welcome screen
│   └── ui/                 # Reusable UI components
├── 📁 contexts/            # React Context for state management
│   └── AuthContext.tsx     # User authentication context
├── 📁 services/            # Business logic
│   └── socket.ts           # Socket.IO wrapper service
├── 📁 server/              # Backend (Node.js + Express)
│   ├── index.js            # Main server file (1172 lines)
│   └── package.json        # Backend dependencies
├── 📁 constants/           # App constants
├── 📁 public/              # Static files
├── App.tsx                 # Main app component
├── index.tsx               # React entry point
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── .env                    # Environment variables (LOCAL)
├── .env.example            # Example env file
└── package.json            # Frontend dependencies
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **Git**

### Installation & Running

#### 1️⃣ Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start the backend server
npm start
```

**Expected Output:**
```
🚀 Server running on http://localhost:3001
```

The backend will:
- Listen on `http://localhost:3001`
- Handle WebSocket connections from clients
- Manage user sessions, matchmaking, and room management
- Enforce CORS for `http://localhost:3000`

#### 2️⃣ Frontend Setup (New Terminal)

```bash
# From root directory (where App.tsx is located)

# Install dependencies
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
  VITE v7.2.4  ready in 234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Press q to quit
```

Open your browser to `http://localhost:3000`

---

## ⚙️ Configuration

### Environment Variables

#### Frontend (.env)
```dotenv
# Backend WebSocket/API server URL
VITE_API_URL=http://localhost:3001  # ✅ CORRECT PORT
```

**⚠️ COMMON ERROR:** The original `.env` file had `VITE_API_URL=http://localhost:3000`, causing connection failures. This has been **FIXED** to use port `3001`.

#### Backend (.env in server/)
```dotenv
# Define allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 🔍 Identified Issues & Fixes

### ✅ Issue #1: Incorrect API Port Configuration

**Problem:**
- `.env` file had `VITE_API_URL=http://localhost:3000`
- Backend runs on port `3001`
- This caused frontend to fail connecting to the backend

**Solution:**
- Updated `.env` to `VITE_API_URL=http://localhost:3001`
- Frontend now correctly connects to the backend server

**Status:** ✅ **FIXED**

---

## 📱 User Flow

### 1. Landing Page
User sees the welcome screen with "Get Started" button.

### 2. Login
User enters:
- **Username** (any string, no authentication)
- **Age** (must be 13+)
- **Gender** (Male/Female/Other)
- **Location** (optional)

Frontend sends to backend: `POST /api/login`
Backend responds with: `{ user: {...}, token: "..." }`

### 3. Main Chat Interface
After login, user sees:
- **Sidebar** (left): Active sessions, online users, public rooms
- **Chat Window** (right): Active conversation
- **Actions**: Random chat, private requests, room joining

### 4. Chat Types

#### Random Match
1. Click "Start Random Chat"
2. Frontend searches for available users
3. Backend matches two random users
4. Creates temporary session
5. Messages exchanged until one exits

#### Private Chat
1. Click on user in "Online Users" list
2. Send private request
3. Other user sees popup to accept/decline
4. On acceptance, create private session
5. Messages are stored per user pair

#### Group Rooms
1. Select room from "Public Rooms"
2. Join broadcasts user presence
3. All users in room receive messages
4. Leave removes user from room

---

## 🔌 API Endpoints (Backend)

### Authentication
```
POST /api/login
Request: { username, age, gender, location? }
Response: { user: User, token: string }
```

### WebSocket Events

**Client → Server:**
- `random:search` - Start random chat
- `random:cancel` - Cancel search
- `private:request` - Request private chat
- `private:request:response` - Accept/decline request
- `message:send` - Send message
- `room:join` - Join group room
- `room:leave` - Leave group room
- `typing` - Send typing indicator
- `chat:leave` - Leave current session

**Server → Client:**
- `connect` - Connection established
- `lobby:update` - Online users updated
- `rooms:update` - Available rooms list
- `random:matched` - Found random match
- `private:request` - Incoming chat request
- `private:start` - Private chat initiated
- `message:receive` - New message received
- `typing` - User typing
- `presence:update` - User status changed

---

## 🛠️ Backend Features (Node.js)

### Session Management
- Persistent session tokens with TTL
- Automatic cleanup of expired sessions
- Message buffering for reconnections
- Reconnection recovery

### Security
- CORS with whitelist validation
- Payload schema validation
- XSS prevention (HTML stripping)
- Rate limiting ready
- Secure token generation (crypto.randomBytes)

### Matchmaking
- Random user selection
- Prevents self-matching
- Respects online/offline status
- Automatic session cleanup on disconnect

### Room Management
- Dynamic room creation
- User presence tracking
- Message broadcasting
- Room deletion on empty

---

## 🎨 Frontend Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 5.2.2 | Type safety |
| Vite | 7.2.4 | Build tool |
| Socket.IO Client | 4.8.1 | Real-time communication |
| Tailwind CSS | 3.4.1 | Styling |
| Lucide React | 0.344.0 | Icons |
| Emoji Picker | 4.9.2 | Emoji selection |
| date-fns | 3.3.1 | Date formatting |

---

## 🗄️ Backend Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18.2 | Web framework |
| Socket.IO | 4.7.4 | WebSocket library |
| CORS | 2.8.5 | Cross-origin support |
| UUID | 9.0.1 | ID generation |

---

## 🚨 Troubleshooting

### ❌ "Cannot connect to backend"
```
Error: Failed to fetch from http://localhost:3000/api/login
```
**Solution:** Check `.env` file has `VITE_API_URL=http://localhost:3001`

### ❌ "Socket connection failed"
```
Error: Connection refused on localhost:3001
```
**Solution:** Start the backend server with `npm start` in `server/` directory

### ❌ "Port already in use"
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Solution:** Kill existing process or use different port:
```bash
# Windows PowerShell
Get-Process -Name node | Stop-Process
```

### ❌ "Module not found" errors
```
Error: Cannot find module 'socket.io-client'
```
**Solution:** Run `npm install` in both root and `server/` directories

### ❌ "Login fails silently"
- Check browser DevTools Console for errors
- Verify backend is running
- Check network tab in DevTools for failed requests
- Ensure `.env` has correct API URL

---

## 📝 Development Commands

### Frontend
```bash
npm run dev      # Start development server on :3000
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend
```bash
npm start        # Start backend on :3001
```

---

## 🔒 Security Considerations

✅ **Implemented:**
- CORS whitelist validation
- Input sanitization (XSS prevention)
- Payload validation schema
- Secure token generation
- Session token encryption

⚠️ **Additional Recommendations:**
- Add rate limiting on login endpoint
- Implement message encryption
- Add CSRF tokens for production
- Use HTTPS in production
- Implement user reputation system
- Add content moderation filters

---

## 📊 Performance Optimizations

- ✅ Socket.IO with fallback transports
- ✅ Message buffering for lost connections
- ✅ Efficient state updates (React Context)
- ✅ Lazy component loading
- ✅ CSS-in-JS minimized (Tailwind purging)
- ✅ TypeScript strict mode enabled

---

## 🌐 Production Deployment

### Frontend Deployment (Vercel/Netlify)
```bash
npm run build
# Deploy 'dist' folder
```

### Backend Deployment (Render/Railway)
```bash
# Update VITE_API_URL to production backend URL
# Deploy 'server/' folder
```

### Environment Variables (Production)
```dotenv
# Frontend
VITE_API_URL=https://anonchat-backend-xxxx.onrender.com

# Backend
ALLOWED_ORIGINS=https://anonchat-live.vercel.app,https://anonchat-backend-xxxx.onrender.com
```

---

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test on both frontend and backend
4. Submit pull request

---

## 📄 License

Project created for educational purposes.

---

## 📞 Support & Issues

For issues or questions:
1. Check troubleshooting section
2. Review backend logs in terminal
3. Check browser DevTools Console
4. Verify all dependencies installed

---

## 🎯 Next Features (Roadmap)

- [ ] User profiles with avatars
- [ ] Message search functionality
- [ ] Blocking/reporting users
- [ ] Message reactions/emojis
- [ ] File/image sharing
- [ ] Call/video integration
- [ ] Dark mode
- [ ] Persistence with database
- [ ] User authentication (OAuth)
- [ ] Admin moderation dashboard

---

**Last Updated:** January 20, 2026
**Status:** ✅ Production Ready (with minor fixes applied)
