<div align="center">
  <img src="public/peeps-hero.png" alt="AnonChat Peeps" width="320" style="max-width:100%;">
  <h1 align="center" style="font-size: 3rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.5rem 0; background: linear-gradient(135deg, #7c5cbf, #e07a5f); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">AnonChat Live</h1>
  <p align="center" style="font-size: 1.25rem; color: #6b5b5b; font-weight: 500;">
    Talk to Strangers, Make Real Connections.
  </p>
  <p align="center">
    <a href="https://github.com/halloffame12/AnonChat/stargazers">
      <img src="https://img.shields.io/github/stars/halloffame12/AnonChat?style=for-the-badge&logo=github&color=7c5cbf" alt="GitHub Stars">
    </a>
    <a href="https://github.com/halloffame12/AnonChat/network">
      <img src="https://img.shields.io/github/forks/halloffame12/AnonChat?style=for-the-badge&logo=github&color=e07a5f" alt="GitHub Forks">
    </a>
    <a href="https://github.com/halloffame12/AnonChat/issues">
      <img src="https://img.shields.io/github/issues/halloffame12/AnonChat?style=for-the-badge&logo=github&color=81b29a" alt="GitHub Issues">
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-2d2323?style=for-the-badge" alt="MIT License">
    </a>
  </p>
</div>

---

**AnonChat Live** is a beautifully designed, real-time anonymous chat application where you can instantly connect with strangers from around the world. No sign-up, no personal data — just pick a name and start chatting.

Built with a warm, hand-drawn aesthetic using [Open Peeps](https://www.openpeeps.com/) illustrations, featuring private messaging, smart matchmaking, and public chat rooms.

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎭 | **Anonymous Login** | No email, no phone number. Just pick a username and go. |
| ⚡ | **Instant Matching** | Smart algorithm finds you a like-minded partner in seconds. |
| 💬 | **Private Chats** | Send private chat requests to anyone online. |
| 🏠 | **Public Rooms** | Join themed rooms — Tech, Anime, Music, and more. |
| 🎨 | **Open Peeps Avatars** | Unique hand-drawn avatar for every user. |
| 🔒 | **Secure & Private** | No data stored. Your history vanishes when you leave. |
| 📱 | **Fully Responsive** | Mobile-first design that works on every device. |
| 🚫 | **Report & Block** | Keep the community safe with moderation tools. |
| ♻️ | **Session Recovery** | Reconnect after disconnection without losing your chat. |

## 🎨 Design

The UI is built around a warm, inviting color palette:

- **Primary**: `#7c5cbf` — Warm purple
- **Accent**: `#e07a5f` — Terracotta
- **Sage**: `#81b29a` — Calm green
- **Background**: `#faf8f5` — Warm off-white

All user avatars are generated using [DiceBear Open Peeps](https://www.dicebear.com/styles/open-peeps/) — a CC0-licensed, hand-drawn illustration style by Pablo Stanley.

## 🏗️ Tech Stack

```
Frontend                     Backend
┌─────────────────────┐     ┌─────────────────────┐
│  React 18           │     │  Node.js 18+        │
│  TypeScript         │     │  Express            │
│  Vite               │     │  Socket.IO          │
│  Tailwind CSS       │     │  CORS, UUID         │
│  Socket.IO Client   │     │  Winston Logger      │
│  date-fns           │     └─────────────────────┘
│  lucide-react       │
│  emoji-picker-react │
└─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm

### Backend

```bash
cd server
npm install
cp .env.example .env   # configure if needed
npm start              # starts on :3001
```

### Frontend

```bash
cd ..
npm install
npm run dev            # starts on :3000
```

Open `http://localhost:3000` in your browser.

## ⚙️ Environment

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Backend URL (no trailing slash) |
| `PORT` | `3001` | Server port |
| `ALLOWED_ORIGINS` | localhost origins | CORS origins, comma-separated |

## 📁 Structure

```
anonchat-live/
├── App.tsx                 # Main app (routing, socket lifecycle)
├── components/
│   ├── LandingPage.tsx     # Landing page with live stats
│   ├── LoginModal.tsx      # Anonymous login flow
│   ├── Sidebar.tsx         # Chats / Rooms / Users tabs
│   ├── ChatWindow.tsx       # Main chat interface
│   └── AvatarPeep.tsx      # Open Peeps avatar component
├── contexts/
│   └── AuthContext.tsx      # Auth state management
├── services/
│   └── socket.ts           # Socket.IO service wrapper
├── server/
│   ├── index.js            # Express + Socket.IO server
│   └── ...
├── __tests__/
├── types.ts
├── tailwind.config.ts
└── vite.config.ts
```

## 📡 API

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | GET | Live online users & total messages (public) |
| `/api/login` | POST | Create anonymous session |
| `/health` | GET | Server health & metrics |
| `/admin/metrics` | GET | Admin dashboard (requires `X-Admin-Key`) |

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feat/amazing`)
5. Open a Pull Request

## 📄 License

MIT — feel free to use, modify, and distribute.

---

<div align="center">
  <sub>Built with ❤️ and lots of ☕ · Avatars by <a href="https://www.openpeeps.com/">Open Peeps</a> (CC0) by Pablo Stanley</sub>
  <br>
  <sub>
    <a href="https://github.com/halloffame12/AnonChat">GitHub</a> ·
    <a href="https://github.com/halloffame12/AnonChat/issues">Issues</a> ·
    <a href="https://github.com/halloffame12/AnonChat/discussions">Discussions</a>
  </sub>
</div>
