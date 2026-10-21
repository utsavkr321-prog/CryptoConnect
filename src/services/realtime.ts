import { API_URL } from './index';

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  format: 'TEXT' | 'LEGACY_ENCRYPTED';
  content: string | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt?: string | null;
};

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export function createChatRealtimeClient(
  token: string,
  conversationId: string | null,
  onStatus: (status: RealtimeStatus) => void,
  onMessage: (message: RealtimeMessage) => void,
  onReceipt: (messageId: string, deliveredAt: string) => void,
  onReadReceipt: (conversationId: string, messageIds: string[], readAt: string) => void,
  onPresence: (userId: string, online: boolean) => void,
  onReconnect: () => void,
  onProtocolError: (message: string) => void,
  onAuthenticationFailure: () => void,
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer = 0;
  let retryDelay = 500;
  let hasConnected = false;
  let subscribedConversation: string | null = null;
  let desiredConversation = conversationId;

  const send = (payload: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

  const scheduleReconnect = () => {
    onStatus('reconnecting');
    const backoffCeiling = retryDelay;
    retryDelay = Math.min(retryDelay * 2, 30_000);
    reconnectTimer = window.setTimeout(connect, Math.floor(Math.random() * backoffCeiling));
  };

  const connect = () => {
    if (stopped) return;
    onStatus(hasConnected ? 'reconnecting' : 'connecting');
    const endpoint = API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
    try { socket = new WebSocket(endpoint); }
    catch {
      scheduleReconnect();
      return;
    }
    socket.onopen = () => send({ type: 'authenticate', token });
    socket.onmessage = (event) => {
      let frame: { type?: string; error?: string; conversationId?: string; message?: RealtimeMessage; messageIds?: string[]; readAt?: string; userId?: string; online?: boolean };
      try { frame = JSON.parse(String(event.data)); } catch { return; }
      if (frame.type === 'ready') {
        hasConnected = true;
        retryDelay = 500;
        onStatus('connected');
        if (desiredConversation) {
          subscribedConversation = desiredConversation;
          send({ type: 'subscribe', conversationId: desiredConversation });
        }
        // Recover REST history on first connect as well as reconnect so messages
        // fetched while offline can be acknowledged after the socket is ready.
        onReconnect();
      } else if (frame.type === 'message' && frame.message) {
        onMessage(frame.message);
        if (frame.message.senderId !== currentUserId) send({ type: 'ack', messageId: frame.message.id });
      } else if (frame.type === 'receipt' && frame.message?.deliveredAt) {
        onReceipt(frame.message.id, frame.message.deliveredAt);
      } else if (frame.type === 'read_receipt' && frame.conversationId && frame.messageIds && frame.readAt) {
        onReadReceipt(frame.conversationId, frame.messageIds, frame.readAt);
      } else if (frame.type === 'presence' && frame.userId && typeof frame.online === 'boolean') {
        onPresence(frame.userId, frame.online);
      } else if (frame.type === 'error') {
        subscribedConversation = null;
        onProtocolError(frame.error || 'The live conversation action was rejected.');
      }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = (event) => {
      subscribedConversation = null;
      if (stopped) return;
      if (event.code === 1003 || event.code === 1008) {
        stopped = true;
        onStatus('offline');
        onAuthenticationFailure();
        return;
      }
      scheduleReconnect();
    };
  };

  let currentUserId = '';
  const heartbeat = window.setInterval(() => send({ type: 'heartbeat' }), 30_000);
  return {
    connect(userId: string) { currentUserId = userId; connect(); },
    setConversation(nextId: string | null) {
      desiredConversation = nextId;
      if (subscribedConversation && subscribedConversation !== nextId) send({ type: 'unsubscribe', conversationId: subscribedConversation });
      subscribedConversation = null;
      if (nextId && socket?.readyState === WebSocket.OPEN) {
        subscribedConversation = nextId;
        send({ type: 'subscribe', conversationId: nextId });
      }
    },
    acknowledgeMessages(messageIds: string[]) {
      if (stopped || socket?.readyState !== WebSocket.OPEN) return;
      messageIds.forEach((messageId) => send({ type: 'ack', messageId }));
    },
    close() {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeat);
      socket?.close(1000, 'Session ended');
      onStatus('offline');
    },
  };
}
