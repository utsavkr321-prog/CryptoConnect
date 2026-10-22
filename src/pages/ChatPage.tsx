import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Send, Copy, Check, CheckCheck, MoreVertical, UserPlus, ArrowLeft,
  Shield, ShieldCheck, Clock, MessageSquare, Phone, Info, X, UserCheck,
} from 'lucide-react';
import { ApiError, API_MODE, authService, contactService, conversationService, friendService, presenceService } from '../services';
import { createChatRealtimeClient, type RealtimeStatus } from '../services/realtime';
import { useAuth, useSettingsCtx, useToast } from '../context/AppContext';
import type { Conversation, Message, DirectoryUser } from '../types';
import { DEMO_USER } from '../data/mockData';
import { formatTime, formatRelativeTime } from '../utils/format';
import { EmptyState } from '../components/EmptyState';


function orderConversations(items: Conversation[]) {
  return [...items].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}

function mergeHistory(history: Message[], current: Message[]): Message[] {
  const byId = new Map(history.map((message) => [message.id, message]));
  const priority = { sending: 0, sent: 1, delivered: 2, read: 3 } as const;
  current.forEach((message) => {
    const persisted = byId.get(message.id);
    if (!persisted) { byId.set(message.id, message); return; }
    const status = priority[message.status] >= priority[persisted.status] ? message.status : persisted.status;
    byId.set(message.id, { ...persisted, ...message, status });
  });
  return [...byId.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

// ─── Contact Avatar ───────────────────────────────────────────────────────────

function Avatar({ name, status, size = 'md' }: { name: string; status: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-11 h-11 text-sm' };
  const dotSizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };
  const colors = [
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-indigo-500',
    'from-violet-500 to-purple-500',
    'from-amber-500 to-orange-500',
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold`}>
        {name.charAt(0)}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-2 border-[#111827] ${
        status === 'online' ? 'bg-emerald-400' : status === 'away' ? 'bg-amber-400' : 'bg-slate-600'
      }`} />
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConversationItem({
  conv,
  active,
  disabled,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-left transition-all duration-100 ${
        active ? 'bg-emerald-500/10 border-r-2 border-emerald-500' : 'hover:bg-slate-800/40 border-r-2 border-transparent'
      }`}
    >
      <Avatar name={conv.contact.name} status={conv.contact.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-sm font-medium truncate ${active ? 'text-emerald-300' : 'text-slate-200'}`}>
            {conv.contact.name}
          </p>
          <span className="text-xs text-slate-600 flex-shrink-0 ml-2">
            {formatRelativeTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
          {conv.unreadCount > 0 && <span className="ml-2 flex-shrink-0 min-w-5 h-5 px-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold inline-flex items-center justify-center" aria-label={`${conv.unreadCount} unread messages`}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  contactName,
  contactStatus,
}: {
  msg: Message;
  isMine: boolean;
  contactName: string;
  contactStatus: string;
}) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('success', 'Message copied to clipboard.');
    } catch {
      addToast('error', 'Failed to copy message.');
    }
  };

  return (
    <div className={`flex min-w-0 gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && (
        <Avatar name={contactName} status={contactStatus} size="sm" />
      )}
      <div className={`min-w-0 max-w-[85%] sm:max-w-[70%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`max-w-full break-words [overflow-wrap:anywhere] px-4 py-2.5 text-sm leading-relaxed ${isMine ? 'message-sent text-white' : 'message-received text-slate-200'}`}>
          {msg.contentUnavailable ? <span className="text-slate-400">Legacy encrypted message; its original key is unavailable.</span> : msg.content}
        </div>
        <div className={`flex items-center gap-2 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-slate-600">{formatTime(msg.timestamp)}</span>
          {isMine && (
            <span className={msg.status === 'read' ? 'text-emerald-400' : 'text-slate-500'} title={msg.status === 'read' ? 'Read by recipient' : msg.status === 'delivered' ? 'Delivered to recipient' : 'Sent; recipient delivery is not confirmed'}>
              {msg.status === 'delivered' || msg.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />}
              <span className="sr-only">{msg.status === 'read' ? 'Read by recipient' : msg.status === 'delivered' ? 'Delivered to recipient' : 'Sent; recipient delivery is not confirmed'}</span>
            </span>
          )}
          {msg.contentUnavailable && <span className="text-xs text-amber-500">Legacy message unavailable</span>}
          {!msg.contentUnavailable && <button
            onClick={handleCopy}
            className="min-h-8 min-w-8 flex items-center justify-center opacity-50 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
            aria-label="Copy message"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [openingContactId, setOpeningContactId] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<DirectoryUser[]>([]);
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<Set<string>>(new Set());
  const [directoryPresence, setDirectoryPresence] = useState<Record<string, boolean>>({});
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('offline');
  const realtimeRef = useRef<ReturnType<typeof createChatRealtimeClient> | null>(null);
  const activeConversationRef = useRef(activeId);
  const phoneLayoutRef = useRef(window.matchMedia('(max-width: 767px)').matches);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const previousMessageView = useRef<{ activeId: string | null; lastMessageId: string | null }>({ activeId: null, lastMessageId: null });
  const { addToast } = useToast();
  const { user } = useAuth();
  const { settings } = useSettingsCtx();
  const location = useLocation();
  const requestedContactId = (location.state as { contactId?: string } | null)?.contactId;

  useEffect(() => { activeConversationRef.current = activeId; }, [activeId]);

  const applyPresence = useCallback((userId: string, online: boolean) => {
    setConversations((previous) => previous.map((conversation) => conversation.contact.id === userId
      ? { ...conversation, contact: { ...conversation.contact, status: online ? 'online' : 'offline' } }
      : conversation));
  }, []);

  useEffect(() => {
    if (!API_MODE || conversations.length === 0) return;
    const ids = [...new Set(conversations.map((conversation) => conversation.contact.id))];
    void Promise.allSettled(ids.map((id) => presenceService.status([id]))).then((results) => results.forEach((result) => {
      if (result.status === 'fulfilled') result.value.forEach((entry) => applyPresence(entry.userId, entry.online));
    }));
  }, [conversations.length, applyPresence]);

  useEffect(() => {
    if (!showNewConversation || !API_MODE) return;
    void Promise.all([friendService.incoming(), friendService.outgoing()]).then(([incoming, outgoing]) => {
      setAcceptedFriendIds(new Set([...incoming, ...outgoing].filter((request) => request.status === 'ACCEPTED').map((request) => request.userId)));
    }).catch(() => setAcceptedFriendIds(new Set()));
  }, [showNewConversation]);

  useEffect(() => {
    if (!showNewConversation) return;
    const ids = userResults.map((item) => item.id).filter((id) => acceptedFriendIds.has(id));
    if (!ids.length) return;
    void Promise.allSettled(ids.map((id) => presenceService.status([id]))).then((results) => setDirectoryPresence((current) => {
      const next = { ...current };
      results.forEach((result) => { if (result.status === 'fulfilled') result.value.forEach((entry) => { next[entry.userId] = entry.online; }); });
      return next;
    }));
  }, [showNewConversation, userResults, acceptedFriendIds]);

  useEffect(() => {
    const phoneLayout = window.matchMedia('(max-width: 767px)');
    const updatePhoneLayout = () => { phoneLayoutRef.current = phoneLayout.matches; };
    phoneLayout.addEventListener('change', updatePhoneLayout);
    return () => phoneLayout.removeEventListener('change', updatePhoneLayout);
  }, []);

  useEffect(() => {
    if (!API_MODE || !user) { setRealtimeStatus('offline'); return; }
    const token = authService.getAccessToken();
    if (!token) { setRealtimeStatus('offline'); return; }
    const client = createChatRealtimeClient(token, null, setRealtimeStatus, (frame) => {
      const incoming: Message = {
        id: frame.id,
        conversationId: frame.conversationId,
        senderId: frame.senderId,
        content: frame.format === 'TEXT' && typeof frame.content === 'string' ? frame.content : '',
        timestamp: frame.createdAt,
        status: frame.readAt ? 'read' : frame.deliveredAt ? 'delivered' : 'sent',
        encrypted: false,
        contentUnavailable: frame.format === 'LEGACY_ENCRYPTED',
      };
      setConversations((previous) => orderConversations(previous.map((conversation) => {
        if (conversation.id !== frame.conversationId) return conversation;
        const alreadyPresent = conversation.messages.some((message) => message.id === frame.id);
        const nextMessages = alreadyPresent
          ? conversation.messages.map((message) => message.id === frame.id ? { ...message, status: incoming.status } : message)
          : [...conversation.messages, incoming];
        const isRemoteMessage = frame.senderId !== user?.id;
        const isOpen = activeConversationRef.current === conversation.id;
        const preview = incoming.contentUnavailable ? 'Legacy encrypted message unavailable' : incoming.content;
        return { ...conversation, messages: nextMessages, unreadCount: isRemoteMessage ? isOpen ? conversation.unreadCount : conversation.unreadCount + (alreadyPresent ? 0 : 1) : conversation.unreadCount, lastMessage: preview || conversation.lastMessage, lastMessageAt: frame.createdAt };
      })));
      if (frame.senderId !== user?.id && activeConversationRef.current === frame.conversationId) {
        void conversationService.markRead(frame.conversationId, [frame.id]).then((count) => {
          if (count) setConversations((previous) => previous.map((conversation) => conversation.id === frame.conversationId
            ? { ...conversation, messages: conversation.messages.map((message) => message.id === frame.id ? { ...message, status: 'read' as const } : message) } : conversation));
        }).catch(() => addToast('warning', 'Message arrived, but its read state could not be saved.'));
      }
    }, (messageId, deliveredAt) => {
      setConversations((previous) => previous.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => message.id === messageId ? { ...message, status: 'delivered' as const, timestamp: message.timestamp || deliveredAt } : message),
      })));
    }, (conversationId, messageIds) => {
      const readIds = new Set(messageIds);
      setConversations((previous) => previous.map((conversation) => conversation.id !== conversationId ? conversation : {
        ...conversation,
        messages: conversation.messages.map((message) => readIds.has(message.id) ? { ...message, status: 'read' as const } : message),
      }));
    }, applyPresence, () => {
      const conversationId = activeConversationRef.current;
      if (!conversationId) return;
      void Promise.all([conversationService.getConversations(), conversationService.getMessages(conversationId)]).then(([latest, history]) => {
        const activeHistory = history.filter((message) => message.conversationId === conversationId);
        setHasMoreHistory(activeHistory.length === 50);
        const undeliveredRemoteIds = activeHistory
          .filter((message) => message.senderId !== user?.id && message.status === 'sent')
          .map((message) => message.id);
        setConversations((previous) => latest.map((conversation) => {
          const prior = previous.find((item) => item.id === conversation.id);
          const messages = conversation.id === conversationId
            ? mergeHistory(activeHistory, prior?.messages ?? [])
            : prior?.messages ?? [];
          return { ...conversation, messages };
        }));
        realtimeRef.current?.acknowledgeMessages(undeliveredRemoteIds);
        const unreadIds = activeHistory.filter((message) => message.senderId !== user?.id && message.status !== 'read').map((message) => message.id);
        void conversationService.markRead(conversationId, unreadIds).then((count) => {
          if (count) setConversations((previous) => previous.map((conversation) => conversation.id === conversationId
            ? { ...conversation, unreadCount: Math.max(0, conversation.unreadCount - count), messages: conversation.messages.map((message) => unreadIds.includes(message.id) ? { ...message, status: 'read' as const } : message) } : conversation));
        }).catch(() => addToast('warning', 'Reconnected history was loaded, but its read state could not be saved.'));
      }).catch(() => addToast('warning', 'Live connection restored, but recent message history could not be refreshed.'));
    }, (message) => addToast('error', message), () => authService.logout());
    realtimeRef.current = client;
    client.connect(user.id);
    return () => { client.close(); realtimeRef.current = null; };
  }, [addToast, user?.id]);

  useEffect(() => {
    realtimeRef.current?.setConversation(activeId);
    if (!activeId) return;
    let active = true;
    setHistoryError('');
    setHistoryLoading(true);
    void conversationService.getMessages(activeId).then(async (history) => {
      if (!active) return;
      setHasMoreHistory(history.length === 50);
      setConversations((previous) => previous.map((conversation) => conversation.id === activeId
        ? { ...conversation, messages: mergeHistory(history, conversation.messages) }
        : conversation));
      try {
        const unreadIds = history.filter((message) => message.senderId !== user?.id && message.status !== 'read').map((message) => message.id);
        const count = await conversationService.markRead(activeId, unreadIds);
        if (active && count) setConversations((previous) => previous.map((conversation) => conversation.id === activeId
          ? { ...conversation, unreadCount: Math.max(0, conversation.unreadCount - count), messages: conversation.messages.map((message) => unreadIds.includes(message.id) ? { ...message, status: 'read' as const } : message) } : conversation));
      } catch {
        if (active) addToast('warning', 'Messages loaded, but the conversation read state could not be saved.');
      }
    }).catch((error: unknown) => {
      if (active) setHistoryError(error instanceof Error ? error.message : 'Could not load this conversation’s message history.');
    }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [activeId, historyReloadKey, addToast, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    const conversation = conversations.find((item) => item.id === activeId);
    const oldest = conversation?.messages[0];
    if (!activeId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    setHistoryError('');
    try {
      const older = await conversationService.getMessages(activeId, oldest.timestamp);
      setHasMoreHistory(older.length === 50);
      setConversations((previous) => previous.map((item) => item.id === activeId
        ? { ...item, messages: mergeHistory(older, item.messages) } : item));
      const unreadIds = older.filter((message) => message.senderId !== user?.id && message.status !== 'read').map((message) => message.id);
      const count = await conversationService.markRead(activeId, unreadIds);
      if (count) setConversations((previous) => previous.map((item) => item.id === activeId
        ? { ...item, unreadCount: Math.max(0, item.unreadCount - count), messages: item.messages.map((message) => unreadIds.includes(message.id) ? { ...message, status: 'read' as const } : message) } : item));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load older messages.');
    } finally { setLoadingOlder(false); }
  }, [activeId, conversations, loadingOlder, user?.id]);

  useEffect(() => {
    let active = true;
    conversationService.getConversations().then(async (loaded) => {
      if (!active) return;
      let convs = loaded;
      if (requestedContactId) {
        const opened = await conversationService.openConversation(requestedContactId, loaded);
        if (!active) return;
        if (!loaded.some((conversation) => conversation.id === opened.id)) convs = [...loaded, opened];
        setActiveId(opened.id);
      } else if (convs.length > 0 && !phoneLayoutRef.current) {
        setActiveId(convs[0].id);
      }
      setLoadError('');
      setConversations(convs);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoading(false);
      const message = error instanceof Error ? error.message : 'Failed to load conversations and recent messages.';
      setLoadError(message);
      addToast('error', message);
    });
    return () => { active = false; };
  }, [addToast, requestedContactId]);

  useEffect(() => {
    if (!showNewConversation || userQuery.trim().length < 2) { setUserResults([]); return; }
    let active = true;
    setSearchingUsers(true);
    contactService.searchUsers(userQuery.trim())
      .then((result) => { if (active) setUserResults(result.users); })
      .catch((error: unknown) => { if (active) addToast('error', error instanceof Error ? error.message : 'User search failed.'); })
      .finally(() => { if (active) setSearchingUsers(false); });
    return () => { active = false; };
  }, [addToast, showNewConversation, userQuery]);


  const startConversation = async (contactId: string) => {
    try {
      setOpeningContactId(contactId);
      const conversation = await conversationService.openConversation(contactId);
      setConversations((previous) => orderConversations(previous.some((item) => item.id === conversation.id) ? previous : [...previous, conversation]));
      setActiveId(conversation.id);
      setShowNewConversation(false);
      setUserQuery('');
    } catch (error) {
      // If friendship is required (403), offer to send a request instead
      if (error instanceof ApiError && error.status === 403) {
        addToast('info', 'Accept a friend request first to start a conversation.');
      } else {
        addToast('error', error instanceof Error ? error.message : 'Could not open conversation.');
      }
    }
    finally { setOpeningContactId(null); }
  };

  const sendFriendRequest = async (recipientId: string) => {
    try {
      setOpeningContactId(recipientId);
      await friendService.send(recipientId);
      addToast('success', 'Friend request sent. You can message once it is accepted.');
      setShowNewConversation(false);
      setUserQuery('');
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? 'A friend request already exists with this user.'
        : error instanceof Error ? error.message : 'Could not send friend request.';
      addToast('error', message);
    } finally { setOpeningContactId(null); }
  };

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    const latestMessages = activeConv?.messages ?? [];
    const lastMessageId = latestMessages[latestMessages.length - 1]?.id ?? null;
    const previous = previousMessageView.current;
    const conversationChanged = previous.activeId !== activeId;
    const latestMessageChanged = previous.lastMessageId !== lastMessageId;
    previousMessageView.current = { activeId, lastMessageId };

    if (!activeId || (!latestMessageChanged && !conversationChanged)) return;
    const list = messagesListRef.current;
    if (!list) return;
    const closeToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (conversationChanged || closeToBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConv?.messages, activeId]);

  const filteredConvs = conversations.filter(
    (c) =>
      c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const retryLoad = async () => {
    setLoading(true);
    setLoadError('');
    try {
      let items = await conversationService.getConversations();
      if (requestedContactId) {
        const opened = await conversationService.openConversation(requestedContactId, items);
        if (!items.some((item) => item.id === opened.id)) items = [...items, opened];
        setActiveId(opened.id);
      } else setActiveId(phoneLayoutRef.current ? null : items[0]?.id ?? null);
      setConversations(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load conversations and recent messages.');
    } finally { setLoading(false); }
  };

  const handleSend = useCallback(async (retry = false) => {
    if (!input.trim() || !activeId || sendLock.current || (retryMessageId && !retry)) return;
    const text = input.trim();
    const clientMessageId = retry && retryMessageId ? retryMessageId : crypto.randomUUID();
    sendLock.current = true;
    setSending(true);
    setSendError('');
    try {
      const sent = await conversationService.sendMessage(activeId, text, clientMessageId);
      setConversations((previous) => orderConversations(previous.map((conversation) => {
        if (conversation.id !== activeId) return conversation;
        const exists = conversation.messages.some((message) => message.id === sent.id);
        const messages = exists
          ? conversation.messages.map((message) => message.id === sent.id ? sent : message)
          : [...conversation.messages, sent];
        return { ...conversation, messages, lastMessage: text, lastMessageAt: sent.timestamp };
      })));
      setInput('');
      setRetryMessageId(null);
    } catch (error) {
      const message = error instanceof ApiError && error.fields
        ? Object.values(error.fields).join(' ')
        : error instanceof Error ? error.message : 'Message could not be sent.';
      const definitelyRejected = error instanceof ApiError && [400, 403, 404].includes(error.status);
      setRetryMessageId(definitelyRejected ? null : clientMessageId);
      setSendError(definitelyRejected ? message : `${message} Retry will reuse this message ID.`);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }, [input, activeId, retryMessageId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
      {/* Conversation List */}
      <div className={`flex-shrink-0 w-64 xl:w-72 border-r border-slate-800/60 flex flex-col min-h-0 bg-[#080d1a] ${activeId ? 'hidden md:flex' : 'flex w-full'}`}>
        <div className="p-3 border-b border-slate-800/60">
          <div className="flex gap-2">
            <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
            <input
              id="conversation-search"
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-8 text-xs py-2"
            />
            </div>
            <button onClick={() => setShowNewConversation((value) => !value)} disabled={sending || Boolean(retryMessageId)} className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-emerald-300 hover:bg-slate-800/50 rounded-lg disabled:opacity-50" aria-label="Start new conversation"><UserPlus size={15} /></button>
          </div>
          {showNewConversation && <div className="mt-2 space-y-2">
            <label className="sr-only" htmlFor="registered-user-search">Search registered users</label>
            <input id="registered-user-search" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search registered users" className="input-field text-xs py-2" autoFocus />
            {searchingUsers && <p className="text-xs text-slate-500 px-1">Searching…</p>}
            {!searchingUsers && userQuery.trim().length >= 2 && userResults.length === 0 && <p className="text-xs text-slate-500 px-1" role="status">No registered users found.</p>}
            {userResults.map((user) => {
              const isBusy = openingContactId === user.id;
              const isExistingConv = conversations.some((c) => c.contact.id === user.id);
              const isAcceptedFriend = acceptedFriendIds.has(user.id);
              return (
                <div key={user.id} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/40">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" aria-hidden="true">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-slate-200 truncate">{user.name}</span>
                    <span className={`block text-[11px] ${isAcceptedFriend && directoryPresence[user.id] ? 'text-emerald-400' : 'text-slate-500'}`}>{isAcceptedFriend ? directoryPresence[user.id] ? 'Online' : 'Offline' : 'Presence private until friendship is accepted'}</span>
                  </span>
                  {isExistingConv || isAcceptedFriend ? (
                    <button disabled={openingContactId !== null} onClick={() => void startConversation(user.id)} className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">
                      {isBusy ? 'Opening…' : 'Message'}
                    </button>
                  ) : (
                    <button disabled={openingContactId !== null} onClick={() => void sendFriendRequest(user.id)} className="text-xs text-teal-300 hover:text-teal-200 disabled:opacity-50 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded flex items-center gap-1" aria-label={`Send friend request to ${user.name}`}>
                      <UserCheck size={11} />{isBusy ? 'Sending…' : 'Add Friend'}
                    </button>
                  )}
                </div>
              );
            })}

          </div>}
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading conversations and recent messages" />
          </div>
        ) : loadError ? (
          <div className="p-4 text-sm text-red-300" role="alert">{loadError}<button className="ml-2 underline" onClick={() => void retryLoad()}>Retry</button></div>
        ) : filteredConvs.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={searchQuery ? 'No matching conversations' : 'No conversations yet'}
            description={searchQuery ? 'Try a different name or message preview.' : 'Choose a registered user to start your first conversation.'}
            action={!searchQuery ? <button onClick={() => setShowNewConversation(true)} className="btn-primary px-4 py-2 rounded-lg text-sm">Start a conversation</button> : undefined}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                disabled={sending || Boolean(retryMessageId)}
                onClick={() => setActiveId(conv.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat Area */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#080d1a] flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden min-h-11 min-w-11 flex items-center justify-center text-slate-400 mr-1 rounded-lg"
                onClick={() => setActiveId(null)}
                disabled={sending || Boolean(retryMessageId)}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <Avatar name={activeConv.contact.name} status={activeConv.contact.status} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{activeConv.contact.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeConv.contact.status === 'online' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-xs text-slate-500 capitalize">{activeConv.contact.status}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {API_MODE && <span className="hidden sm:inline text-[11px] text-slate-500 mr-2" role="status" aria-live="polite">
                {realtimeStatus === 'connected' ? 'Live connection' : realtimeStatus === 'connecting' ? 'Connecting…' : realtimeStatus === 'reconnecting' ? 'Reconnecting…' : 'Live updates unavailable'}
              </span>}
              {/* API messages are readable by the service; the transport must use TLS. */}
              {settings.showEncryptionBadges && <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Shield size={10} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">{API_MODE ? 'Server-readable messages' : 'Demo messages'}</span>
              </div>}
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
                aria-label="Contact info"
              >
                <Info size={15} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 min-w-0">
            {/* Messages */}
            <div className="flex-1 flex flex-col min-w-0">
              <div ref={messagesListRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 sm:px-4 py-4 space-y-4">
                {historyLoading && activeConv.messages.length === 0 ? <div className="h-full flex items-center justify-center" role="status"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-label="Loading message history" /></div>
                  : historyError && activeConv.messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center gap-2 text-center" role="alert"><p className="text-sm text-red-300">{historyError}</p><button onClick={() => setHistoryReloadKey((value) => value + 1)} className="text-sm text-emerald-300 underline">Retry history</button></div>
                  : <>
                  {hasMoreHistory && activeConv.messages.length > 0 && <div className="flex justify-center"><button onClick={() => void loadOlderMessages()} disabled={loadingOlder} className="px-3 py-1.5 rounded-lg text-xs text-emerald-300 hover:bg-slate-800 disabled:opacity-50" aria-label="Load older messages">{loadingOlder ? 'Loading older messages…' : 'Load older messages'}</button></div>}
                  {historyError && activeConv.messages.length > 0 && <div className="text-center text-xs text-red-300" role="alert">{historyError}</div>}
                  {activeConv.messages.length === 0 ? <div className="flex-1 flex items-center justify-center"><EmptyState icon={MessageSquare} title="No messages yet" description="Send a message to start this conversation." /></div> : activeConv.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.senderId === (user?.id ?? DEMO_USER.id)}
                    contactName={activeConv.contact.name}
                    contactStatus={activeConv.contact.status}
                  />
                ))}</>}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-800/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {settings.showEncryptionBadges && <span title={API_MODE ? 'Messages are readable by the service and authorized conversation participants. This is not end-to-end encryption.' : 'Demo messages are not end-to-end encrypted.'}><Shield size={14} className="text-emerald-500/50 flex-shrink-0" /></span>}
                  <div className="flex-1 relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      aria-label="Message"
                      maxLength={4000}
                      disabled={sending || Boolean(retryMessageId)}
                      rows={1}
                      className="input-field resize-none py-2 pr-10 text-sm leading-relaxed"
                      style={{ minHeight: 44, maxHeight: 120 }}
                    />
                  </div>
                  <button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending || Boolean(retryMessageId)}
                    className="btn-primary min-h-11 min-w-11 flex items-center justify-center rounded-xl flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    aria-label="Send message"
                  >
                    {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
                {sendError && <div className="mt-2 flex items-center justify-between gap-3 text-xs text-red-300" role="alert"><span>{sendError}</span>{retryMessageId && <button className="underline font-medium" disabled={sending} onClick={() => void handleSend(true)}>Retry</button>}</div>}
                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                  <Shield size={10} />
                  {API_MODE ? 'Messages are readable by the service and authorized conversation participants. Transport encryption (HTTPS/WSS) is required; this is not end-to-end encryption.' : 'Demo messages are illustrative and are not end-to-end encrypted.'}
                </p>
              </div>
            </div>

            {/* Info Panel */}
            {showInfo && (
              <div className="hidden xl:flex flex-shrink-0 w-64 border-l border-slate-800/60 flex-col bg-[#080d1a] overflow-y-auto">
                <div className="p-5">
                  <div className="flex flex-col items-center text-center mb-5">
                    <Avatar name={activeConv.contact.name} status={activeConv.contact.status} size="lg" />
                    <h3 className="font-semibold text-slate-200 text-sm mt-3">{activeConv.contact.name}</h3>
                    {activeConv.contact.verified ? (
                      <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded-full badge-verified text-xs">
                        <ShieldCheck size={10} />
                        <span>Identity Verified</span>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded-full badge-unverified text-xs">
                        <Shield size={10} />
                        <span>Not Verified</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Key Fingerprint</p>
                      <p className="text-xs font-mono text-emerald-400/80 break-all bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                        {activeConv.contact.publicKeyFingerprint}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{import.meta.env.VITE_APP_MODE === 'api' ? 'Identity key metadata is supplied by the backend.' : 'This is mock data.'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Conversation</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Messages</span>
                          <span className="text-slate-300">{activeConv.messages.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Last active</span>
                          <span className="text-slate-300">{formatRelativeTime(activeConv.lastMessageAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="Select a conversation"
            description="Choose a conversation from the list to start messaging."
          />
        </div>
      )}
    </div>
  );
}
