# AnonChat Live - Production Ready Anonymous Chat

A real-time, anonymous chat application featuring private messaging, random matchmaking, and group chat lobbies. Built with React (Vite + TypeScript) and Node.js (Express + Socket.IO).

## ✨ Features

- **Anonymous Login**: No email required, just pick a username.
- **Real-time Messaging**: Instant message delivery with Socket.IO.
- **Random Matching**: Connect with strangers instantly using smart matchmaking.
- **Private Chats**: Request to chat with specific users from the online list.
- **Public Rooms**: Join themed rooms like Tech, Anime, Music, etc.
- **Reputation System**: Smart matching based on user behavior.
- **Session Recovery**: Reconnect after disconnection without losing your session.
- **Responsive Design**: Mobile-first UI with smooth transitions.

---

## 🏗️ Tech Stack

### Frontend
- React 18 with TypeScript (strict mode)
- Vite (development & build)
- Tailwind CSS
- Socket.IO Client

### Backend
- Node.js 18+
- Express
- Socket.IO
- CORS, UUID, Crypto

---

## 🚀 Setup Guide (Local Development)

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)

### 1. Backend Setup

The backend handles WebSocket connections, user sessions, and API endpoints.

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# (Optional) Copy and configure environment variables
cp .env.example .env

# Start the server
npm start
```

The server will run on `http://localhost:3001` by default.

### 2. Frontend Setup

The frontend is a Vite + React + TypeScript application.

```bash
# From the root directory
# Install dependencies
npm install

# (Optional) Verify environment variables
# VITE_API_URL should point to your backend (default: http://localhost:3001)
cat .env

# Start the development server
npm run dev
```

Open your browser at `http://localhost:3000` (configured in vite.config.ts).

---

## ⚙️ Environment Variables

### Backend (`server/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000,http://localhost:5173,http://localhost:3001` |
| `ADMIN_KEY` | Secret key for admin dashboard | (required for admin access) |

### Frontend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (no trailing slash) | `http://localhost:3001` |

---

## 📡 API Documentation

### HTTP Endpoints

#### `GET /health`
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "users": 10,
  "connections": 15,
  "rooms": 7,
  "timestamp": 1704067200000
}
```

#### `POST /api/login`
Creates a new anonymous user session.

**Request Body:**
```json
{
  "username": "CyberNinja",
  "age": 25,
  "gender": "Male",
  "location": "New York"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "username": "CyberNinja",
    "age": 25,
    "gender": "Male",
    "location": "New York",
    "avatar": "https://api.dicebear.com/...",
    "isOnline": true
  },
  "token": "auth-token-hex"
}
```

#### `GET /admin/metrics`
Returns admin dashboard metrics. Requires `X-Admin-Key` header.

---

## 🔌 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `random:search` | `{ userId }` | Start searching for random match |
| `random:cancel` | `{}` | Cancel random match search |
| `private:request` | `{ userId, targetUserId }` | Request private chat |
| `private:request:response` | `{ accepted, requesterId }` | Accept/decline request |
| `room:join` | `{ roomId }` | Join a public room |
| `chat:leave` | `{ chatId }` | Leave a chat/room |
| `message:send` | `{ chatId, content, senderId, tempId }` | Send a message |
| `typing` | `{ chatId, isTyping }` | Typing indicator |
| `user:report` | `{ reportedUserId, reason }` | Report a user |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:update` | `{ activeUsers, users[] }` | Online users list update |
| `rooms:update` | `Room[]` | Public rooms list update |
| `random:matched` | `ChatSession` | Random match found |
| `private:request` | `{ requesterId, requesterName, requesterAvatar }` | Incoming chat request |
| `private:start` | `{ chatId, partnerId, partnerName, partnerAvatar }` | Private chat started |
| `private:request:response` | `{ accepted, targetUserId }` | Request response |
| `message:receive` | `Message` | New message received |
| `message:ack` | `{ tempId, messageId }` | Message acknowledged |
| `typing` | `{ chatId, isTyping }` | Typing status |
| `error` | `{ message }` | Error occurred |

---

## 📁 Folder Structure

```
anonchat-live/
├── .env                    # Frontend environment variables
├── .env.example            # Frontend env template
├── App.tsx                 # Main React app component
├── index.tsx               # React entry point
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Frontend dependencies
│
├── components/             # React components
│   ├── ChatWindow.tsx      # Chat interface
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── LoginModal.tsx      # Login form
│   ├── LandingPage.tsx     # Landing page
│   └── ui/                 # Reusable UI components
│       └── Button.tsx
│
├── contexts/               # React contexts
│   └── AuthContext.tsx     # Authentication state
│
├── services/               # Service layer
│   └── socket.ts           # Socket.IO client wrapper
│
├── server/                 # Backend
│   ├── index.js            # Express + Socket.IO server
│   ├── package.json        # Backend dependencies
│   ├── .env.example        # Backend env template
│   └── package-lock.json
│
└── public/                 # Static assets
    └── _redirects          # Netlify redirects
```

---

## ☁️ Deployment Guide

### Deploy Backend to Render

1. Push your code to a GitHub repository.
2. Log in to [Render](https://render.com).
3. Click **New +** → **Web Service**.
4. Connect your GitHub repository.
5. Configure:
   - **Name**: `anonchat-backend`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
6. Add environment variables:
   - `ALLOWED_ORIGINS`: Your frontend URL (e.g., `https://anonchat.netlify.app`)
   - `ADMIN_KEY`: Your secret admin key
7. Deploy and copy the backend URL.

### Deploy Frontend to Netlify

1. Log in to [Netlify](https://netlify.com).
2. Click **Add new site** → **Import from existing project**.
3. Connect your GitHub repository.
4. Configure build settings:
   - **Base directory**: (leave empty)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variable:
   - `VITE_API_URL`: Your Render backend URL (no trailing slash)
6. Deploy.

---

## 🔒 Security Features

- **Input Sanitization**: All user inputs are sanitized to prevent XSS attacks.
- **Rate Limiting**: Message and action rate limiting to prevent spam.
- **Token Authentication**: Socket connections require valid auth tokens.
- **CORS Protection**: Strict origin validation for API and WebSocket connections.
- **Reputation System**: Users with low reputation are blocked from matching.
- **Payload Validation**: All socket payloads are validated before processing.

---

## 🐛 Troubleshooting

### Connection Errors
- Ensure `VITE_API_URL` does not have a trailing slash.
- Verify the backend is running on the correct port.
- Check that CORS origins include your frontend URL.

### Socket Disconnections
- Sessions are preserved for 60 seconds after disconnect.
- The client will automatically attempt to reconnect.

### Build Errors
- Run `npm install` in both root and `server` directories.
- Ensure Node.js v18+ is installed.

---

## 📝 License

MIT License - See LICENSE file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with ❤️ for anonymous connections.
