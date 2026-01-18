// Socket event constants to prevent typos
export const SOCKET_EVENTS = {
  // Server -> Client
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR: 'error',
  LOBBY_UPDATE: 'lobby:update',
  ROOMS_UPDATE: 'rooms:update',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_ACK: 'message:ack',
  TYPING: 'typing',
  RANDOM_MATCHED: 'random:matched',
  PRIVATE_REQUEST: 'private:request',
  PRIVATE_REQUEST_RESPONSE: 'private:request:response',
  PRIVATE_START: 'private:start',
  
  // Client -> Server
  MESSAGE_SEND: 'message:send',
  TYPING_SEND: 'typing',
  ROOM_JOIN: 'room:join',
  CHAT_LEAVE: 'chat:leave',
  RANDOM_SEARCH: 'random:search',
  RANDOM_CANCEL: 'random:cancel',
  PRIVATE_REQUEST_SEND: 'private:request',
  PRIVATE_RESPOND: 'private:request:response',
  USER_REPORT: 'user:report',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
