# 🚀 PRODUCTION DEPLOYMENT GUIDE

## ✅ Pre-Deployment Checklist

### Backend (Render)

- [ ] Create `.env` file in `server/` with production values:
  ```env
  PORT=3001
  ALLOWED_ORIGINS=https://anonchatweb.netlify.app
  ```
- [ ] Push latest code to GitHub
- [ ] Verify Render build command: `npm install`
- [ ] Verify Render start command: `node index.js`
- [ ] Set environment variables in Render dashboard
- [ ] Enable Render auto-deploy from GitHub
- [ ] Test `/health` endpoint after deployment

### Frontend (Netlify)

- [ ] Create `.env.production` with:
  ```env
  VITE_API_URL=https://anonchat-backend-6oc4.onrender.com
  ```
- [ ] Verify `_redirects` file exists in `public/`:
  ```
  /* /index.html 200
  ```
- [ ] Push latest code to GitHub
- [ ] Verify Netlify build command: `npm run build`
- [ ] Verify Netlify publish directory: `dist`
- [ ] Set environment variables in Netlify dashboard
- [ ] Enable Netlify auto-deploy from GitHub

---

## 🔒 Security Fixes Implemented

### Backend Security

1. **CORS Whitelist** ✅
   - Replaced wildcard `origin: "*"` with environment-based whitelist
   - Set `ALLOWED_ORIGINS=https://anonchatweb.netlify.app` in production

2. **Input Sanitization** ✅
   - All user inputs (username, messages, location) sanitized with `sanitize()` function
   - Removes HTML/script tags to prevent XSS attacks
   - Length limits enforced (username: 50 chars, message: 2000 chars)

3. **Rate Limiting** ✅
   - Message burst: max 5 messages per 10s window
   - Message throttle: 500ms between messages
   - Typing indicator: max 1 event per 1000ms
   - Per-user tracking with `rateLimits` Map

4. **Payload Validation** ✅
   - All socket events validated with `validatePayload()` function
   - Type checking and required field validation
   - Rejects malformed requests

5. **Authentication Middleware** ✅
   - Socket.IO middleware validates token on connection
   - Rejects connections without valid user token

6. **Error Handling** ✅
   - Try-catch blocks on all socket handlers
   - Centralized error logging
   - Graceful error responses to clients

7. **Health Endpoint** ✅
   - `GET /health` returns server status, uptime, metrics
   - Use for monitoring and uptime checks

---

## 🐛 Bug Fixes Implemented

### Backend Logic Fixes

1. **Race Condition in Random Matching** ✅
   - Changed `waitingQueue` from Array to Map<userId, timestamp>
   - Prevents duplicate matches and ghost users
   - Cleanup stale queue entries after 60s

2. **Memory Leaks in Room Cleanup** ✅
   - Added `privateChatRooms` Map with cleanup job
   - Removes empty rooms after 60s
   - Tracks room participants with Set

3. **Incomplete Disconnect Handling** ✅
   - Added `userSockets` Map to track multi-device connections
   - Only marks user offline when all sockets disconnect
   - Removes from waiting queue, all rooms, and chat sessions
   - Broadcasts lobby/rooms updates

4. **Missing Error Events** ✅
   - Added `error` socket event handler
   - Logs all socket errors for debugging

### Frontend Fixes

1. **Double Socket Connection Bug** ✅
   - Removed duplicate `connect()` call from App.tsx
   - Socket now only connected in AuthContext
   - Fixed memory leak from multiple socket instances

2. **Socket Listener Accumulation** ✅
   - Added listener tracking in SocketService
   - `disconnect()` now removes all registered listeners
   - Prevents memory leaks from orphaned listeners

3. **Missing Dependencies in useEffect** ✅
   - Added missing deps: `user`, `publicRooms`, `blockedUsers`
   - Fixed React warnings and stale closure bugs

4. **Cancel Search Not Emitting to Server** ✅
   - Added `socketService.send('random:cancel', {})` on cancel button
   - Server now removes user from waiting queue

5. **Optimistic Messages Without Ack** ✅
   - Added `tempId` to message sends
   - Server returns `message:ack` event with server-generated ID
   - Client replaces temp ID with real ID
   - Prevents duplicate messages in UI

### Frontend UX Improvements

1. **Accessibility (WCAG 2.1 AA)** ✅
   - Added `aria-label` to all icon-only buttons:
     - Back button: "Go back to chat list"
     - Menu button: "Open chat options menu" + `aria-expanded`
     - Emoji button: "Toggle emoji picker" + `aria-pressed`
     - Send button: "Send message"
     - Message input: `aria-label="Message input"`
   - Screen reader friendly

2. **Content Security Policy Compliance** ✅
   - Removed inline `style={{ height: 'auto' }}` from textarea
   - Now CSP-compatible (no `'unsafe-inline'` needed)

3. **Error Event Handlers** ✅
   - Added `connect_error` and `error` handlers in SocketService
   - Logs connection failures for debugging
   - Emits events for UI feedback

---

## 📦 Deployment Steps

### Step 1: Update Environment Variables

#### Render (Backend)

1. Go to Render dashboard → anonchat-backend
2. Environment → Add:
   ```
   ALLOWED_ORIGINS=https://anonchatweb.netlify.app
   ```
3. Save → Auto-redeploy

#### Netlify (Frontend)

1. Go to Netlify dashboard → anonchatweb
2. Site settings → Environment variables → Add:
   ```
   VITE_API_URL=https://anonchat-backend-6oc4.onrender.com
   ```
3. Save → Trigger deploy

### Step 2: Push Code to GitHub

```bash
git add .
git commit -m "🔒 Production audit fixes: security, bug fixes, accessibility"
git push origin main
```

### Step 3: Verify Deployments

1. **Backend Health Check**:

   ```bash
   curl https://anonchat-backend-6oc4.onrender.com/health
   ```

   Should return:

   ```json
   {
     "status": "ok",
     "uptime": 123.45,
     "users": 0,
     "connections": 0,
     "rooms": 5,
     "timestamp": 1234567890
   }
   ```

2. **Frontend**:
   - Visit https://anonchatweb.netlify.app
   - Check browser console for `[Socket] Connecting to https://anonchat-backend-6oc4.onrender.com`
   - Test login, messaging, random match

### Step 4: Monitor Production

- Render logs: https://dashboard.render.com/
- Netlify logs: https://app.netlify.com/
- Watch for:
  - Connection errors
  - Rate limit violations
  - CORS errors
  - Memory usage spikes

---

## 🛡️ Security Best Practices (Ongoing)

1. **Keep CORS Strict**
   - Only add trusted domains to `ALLOWED_ORIGINS`
   - Never use wildcard `*` in production

2. **Monitor Rate Limits**
   - Adjust `RATE_LIMIT` constants if legitimate users hit limits
   - Add IP-based rate limiting for login endpoint

3. **Add Logging Service** (Future)
   - Use LogRocket, Sentry, or Datadog
   - Track errors, performance, user flows

4. **Add Persistence** (Future)
   - Store messages in database (PostgreSQL, MongoDB)
   - Add user authentication (JWT, OAuth)
   - Implement session recovery from DB

5. **Add Admin Dashboard** (Future)
   - Real-time user moderation
   - Ban/timeout capabilities
   - Report review system

---

## ⚡ Performance Optimizations

### Render Cold Starts (Current Issue)

**Problem**: Render free tier spins down after 15 min of inactivity. First request after takes 30-60s.

**Solutions**:

1. **UptimeRobot** (Free):
   - Ping `/health` endpoint every 5 minutes
   - Keeps server warm
   - Setup: https://uptimerobot.com

2. **Render Keep-Alive Service** (Free):

   ```bash
   # Add to Render cron job (if available)
   */5 * * * * curl https://anonchat-backend-6oc4.onrender.com/health
   ```

3. **Upgrade to Paid Plan** ($7/mo):
   - No cold starts
   - Always-on instances
   - Better performance

### Frontend Performance

1. **Code Splitting** (Future):
   - Lazy load emoji picker
   - Lazy load chat components

2. **CDN Optimization**:
   - Netlify CDN already enabled ✅
   - No additional config needed

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] User can register with username/age/gender/location
- [ ] Socket connects successfully
- [ ] Public room list loads
- [ ] User can join public room
- [ ] User can send/receive messages in room
- [ ] User can start random chat search
- [ ] User can cancel random chat search
- [ ] Random match works (2 users searching)
- [ ] Private chat request works
- [ ] Typing indicators appear
- [ ] Emoji picker works
- [ ] User can report/block
- [ ] User can leave chat
- [ ] Disconnect/reconnect works
- [ ] Multiple devices same user works
- [ ] Rate limiting triggers on spam
- [ ] CORS blocks unauthorized origins

### Accessibility Testing

- [ ] Screen reader can read all buttons
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] ARIA labels accurate

### Browser Testing

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (iOS/macOS)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## 📊 Metrics to Monitor

### Server Metrics

- Active connections: `activeSockets.size`
- Registered users: `users.size`
- Active rooms: `publicRooms.size + privateChatRooms.size`
- Waiting queue size: `waitingQueue.size`
- Memory usage: `process.memoryUsage()`
- Uptime: `process.uptime()`

### Health Endpoint

```bash
curl https://anonchat-backend-6oc4.onrender.com/health
```

### Logs to Watch

- `[CONNECT]` / `[DISCONNECT]` - Connection lifecycle
- `[RANDOM MATCH]` - Successful matches
- `[MESSAGE ERROR]` - Failed message sends
- `[RATE LIMIT]` - Users hitting limits
- `[REPORT]` - User reports

---

## 🚨 Troubleshooting

### Issue: CORS Error in Browser Console

**Symptom**: `Access-Control-Allow-Origin` error
**Fix**:

1. Check Render env var: `ALLOWED_ORIGINS=https://anonchatweb.netlify.app`
2. Verify no trailing slash in URL
3. Restart Render service

### Issue: Socket Connection Fails

**Symptom**: `[Socket] Connection error` in console
**Fix**:

1. Check backend is running: `curl <backend-url>/health`
2. Verify `VITE_API_URL` in Netlify env vars
3. Check Render logs for errors

### Issue: Messages Not Sending

**Symptom**: Messages stuck in "Sending..." state
**Fix**:

1. Check rate limits (500ms between messages)
2. Verify socket is connected: check console logs
3. Check backend logs for errors

### Issue: Random Match Not Working

**Symptom**: Searching indefinitely, no match
**Fix**:

1. Need 2 users searching simultaneously
2. Check server logs for `[RANDOM QUEUE]` entries
3. Verify `waitingQueue` cleanup job running

---

## 🎯 Success Criteria

✅ **Production Ready** when:

1. Health endpoint returns 200 OK
2. CORS only allows your frontend domain
3. All XSS attack vectors sanitized
4. Rate limiting prevents spam
5. Socket connections authenticated
6. Error handling prevents crashes
7. Memory leaks eliminated
8. Accessibility score > 90 (Lighthouse)
9. Mobile responsive
10. All manual tests pass

---

## 📞 Support

### Issues & Bug Reports

- GitHub Issues: https://github.com/halloffame12/AnonChat/issues
- Include:
  - Steps to reproduce
  - Browser console logs
  - Server logs (if backend issue)
  - Expected vs actual behavior

### Resources

- Socket.IO Docs: https://socket.io/docs/v4/
- React Docs: https://react.dev/
- Render Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com/

---

**Last Updated**: Production Audit 2024
**Status**: ✅ All critical issues resolved
