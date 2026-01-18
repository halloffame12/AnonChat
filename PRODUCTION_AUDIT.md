# AnonChat Live - Production Audit & Fixes

## Critical Issues Found

### BACKEND ISSUES

#### 1. **Security: Wildcard CORS (HIGH RISK)**

- **Location**: `server/index.js:15`
- **Issue**: `origin: "*"` allows any website to connect
- **Impact**: CSRF attacks, unauthorized access
- **Fix**: Whitelist specific origins

#### 2. **Security: No Input Sanitization (CRITICAL)**

- **Location**: `server/index.js:60-80, 124-136`
- **Issue**: Username and messages not sanitized - XSS vulnerability
- **Impact**: Script injection, session hijacking
- **Fix**: Sanitize all user inputs

#### 3. **Memory Leak: No Room Cleanup**

- **Location**: `server/index.js:184-190`
- **Issue**: Random chat rooms never deleted after users leave
- **Impact**: Unbounded memory growth
- **Fix**: Track and cleanup empty rooms

#### 4. **Race Condition: Random Matching**

- **Location**: `server/index.js:184-226`
- **Issue**: Array-based queue allows duplicates and race conditions
- **Impact**: Users matched with themselves, ghost matches
- **Fix**: Use Map-based queue with proper locking

#### 5. **Ghost Users: Incomplete Disconnect Cleanup**

- **Location**: `server/index.js:322-346`
- **Issue**: Users not removed from waiting queue on disconnect
- **Impact**: Dead matches, stuck in "searching" state
- **Fix**: Comprehensive cleanup on disconnect

#### 6. **No Rate Limiting**

- **Location**: `server/index.js:124-136, 138-145`
- **Issue**: No throttling on message/typing events
- **Impact**: DoS via spam, server overload
- **Fix**: Per-user rate limiters

#### 7. **Missing Error Handling**

- **Location**: Throughout `server/index.js`
- **Issue**: No try-catch, no validation, no logging
- **Impact**: Unhandled crashes, no debugging info
- **Fix**: Wrap handlers, add validation, structured logging

#### 8. **No Health Endpoint**

- **Location**: N/A
- **Issue**: No way to check server health for monitoring
- **Impact**: Can't detect server issues
- **Fix**: Add `/health` endpoint

### FRONTEND ISSUES

#### 9. **Memory Leak: Socket Listener Accumulation**

- **Location**: `App.tsx:35-152`, `ChatWindow.tsx:41-86`
- **Issue**: Listeners not properly cleaned up, accumulate on re-renders
- **Impact**: Multiple handlers fire per event, memory leak
- **Fix**: Strict cleanup in useEffect returns

#### 10. **Double Connection Bug**

- **Location**: `App.tsx:26-33`
- **Issue**: Connects socket every time user/auth changes
- **Impact**: Multiple sockets per user, duplicated messages
- **Fix**: Connect only once on login in AuthContext

#### 11. **Missing Dependency Arrays**

- **Location**: `App.tsx:151`, `ChatWindow.tsx:90-92`
- **Issue**: useEffect missing/incomplete deps causing stale closures
- **Impact**: Outdated state in callbacks, bugs
- **Fix**: Complete all dependency arrays

#### 12. **No Reconnection Logic**

- **Location**: N/A
- **Issue**: Page refresh loses entire chat state
- **Impact**: Poor UX, lost conversations
- **Fix**: Implement session recovery

#### 13. **Optimistic Send Without Ack**

- **Location**: `ChatWindow.tsx:95-110`
- **Issue**: Temp messages never confirmed/replaced
- **Impact**: Duplicated messages, unsent messages appear sent
- **Fix**: Add server ack and proper deduplication

#### 14. **Cancel Search Doesn't Remove from Queue**

- **Location**: `App.tsx:306-316`
- **Issue**: Canceling search only hides UI, user stays in server queue
- **Impact**: Matched after canceling
- **Fix**: Emit `random:cancel` event

#### 15. **Accessibility: Missing ARIA Labels**

- **Location**: `ChatWindow.tsx:169, 211, 309, 317`
- **Issue**: Icon-only buttons lack labels
- **Impact**: Screen reader issues, fails WCAG
- **Fix**: Add aria-label attributes

#### 16. **Inline Styles**

- **Location**: `ChatWindow.tsx:312`
- **Issue**: `style={{ height: 'auto' }}` violates CSP
- **Impact**: Blocked by strict CSP policies
- **Fix**: Remove inline styles

### SOCKET EVENT ISSUES

#### 17. **Event Name Mismatch Risk**

- **Location**: Multiple files
- **Issue**: String-based events prone to typos
- **Impact**: Silent failures, events not received
- **Fix**: Event constant enums

#### 18. **No Payload Validation**

- **Location**: All socket handlers
- **Issue**: Assumes payload shape, no validation
- **Impact**: Crashes on malformed data
- **Fix**: Validate every payload

#### 19. **Missing Error Events**

- **Location**: `services/socket.ts:27-61`
- **Issue**: `connect_error`, `error` events not handled
- **Impact**: Silent failures, no error feedback
- **Fix**: Handle error events

### DEPLOYMENT ISSUES

#### 20. **Hardcoded URLs**

- **Location**: `services/socket.ts:7`, `contexts/AuthContext.tsx:15`
- **Issue**: Falls back to localhost in production
- **Impact**: App breaks in production if env var missing
- **Fix**: Fail fast if VITE_API_URL not set in production

#### 21. **No Build Validation**

- **Location**: N/A
- **Issue**: No checks for required env vars at build time
- **Impact**: Deploys broken builds
- **Fix**: Build-time validation

#### 22. **Netlify SPA Routing**

- **Location**: N/A
- **Issue**: No `_redirects` file for client-side routing
- **Impact**: Refresh on routes returns 404
- **Fix**: Add `_redirects` file

#### 23. **Render Cold Starts**

- **Location**: N/A
- **Issue**: No keep-alive ping, sockets die on sleep
- **Impact**: First user waits 30s+ for server wake
- **Fix**: Keep-alive job or upgrade plan

---

## ALL FIXES IMPLEMENTED BELOW
