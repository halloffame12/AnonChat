# AnonChat Live - Production Ready Anonymous Chat

A real-time, anonymous chat application featuring private messaging, random matchmaking, and group chat lobbies. Built with React (Vite) and Node.js (Socket.IO).

## Features

- **Anonymous Login**: No email required, just pick a username.
- **Real-time Messaging**: Instant delivery with Socket.IO.
- **Random Matching**: Connect with strangers instantly.
- **Private Chats**: Request to chat with specific users from the online list.
- **Public Rooms**: Join themed rooms like Tech, Anime, Music, etc.
- **Responsive Design**: Mobile-first UI with smooth transitions.

---

## 🚀 Setup Guide (Local Development)

### Prerequisites
- **Node.js** (v18 or higher)
- **npm**

### 1. Backend Setup
The backend handles WebSocket connections and user sessions.

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
    *The server will run on `http://localhost:3001`*

### 2. Frontend Setup
The frontend is a Vite + React application.

1.  Open a new terminal and navigate to the root directory (where `package.json` for the frontend is located).
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser at `http://localhost:5173`.

---

## ☁️ Deployment Guide

This application is split into two parts: the **Backend** (Node.js) and the **Frontend** (React). You must deploy them separately.

### Step 1: Deploy Backend to Render

1.  Push your code to a GitHub repository.
2.  Log in to [Render](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  Fill in the following details:
    *   **Name**: `anonchat-backend` (or similar)
    *   **Root Directory**: `server` (Important! The backend code is in this subfolder).
    *   **Environment**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
6.  Click **Create Web Service**.
7.  Wait for deployment to finish. **Copy the backend URL** (e.g., `https://anonchat-backend.onrender.com`).

### Step 2: Deploy Frontend to Netlify

1.  Log in to [Netlify](https://netlify.com).
2.  Click **Add new site** -> **Import from existing project**.
3.  Connect your GitHub repository.
4.  Fill in the build settings:
    *   **Base directory**: (Leave empty or `/`)
    *   **Build command**: `npm run build`
    *   **Publish directory**: `dist`
5.  **Environment Variables**:
    You need to tell the frontend where to find your Render backend.
    *   Click **Add environment variable**.
    *   Key: `VITE_API_URL`
    *   Value: Your Render Backend URL (e.g., `https://anonchat-backend.onrender.com`) - *Do not add a trailing slash / at the end*.
6.  Click **Deploy**.

### Step 3: Troubleshooting

*   **Connection Error?**: Ensure your `VITE_API_URL` in Netlify does **not** have a trailing slash.
*   **Redirects**: A `_redirects` file has been added to the `public` folder to ensure the app works if you refresh the page on Netlify.
*   **CORS**: The server is currently configured to allow all origins (`origin: "*"`). This is fine for initial deployment.
