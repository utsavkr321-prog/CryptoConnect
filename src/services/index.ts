import type { Contact, Conversation, Message, SecurityEvent, DashboardStats, ChartDataPoint, SecurityTest, User, DirectoryUser, FriendRequest } from '../types';
import { MOCK_CONTACTS, MOCK_CONVERSATIONS, MOCK_SECURITY_EVENTS, MOCK_DASHBOARD_STATS, MOCK_CHART_DATA, INITIAL_SECURITY_TESTS, DEMO_USER } from '../data/mockData';

export const API_MODE = import.meta.env.VITE_APP_MODE === 'api';
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const TOKEN_KEY = 'cc_access_token';
function readAccessToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } }
function persistAccessToken(token: string) { try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* The token remains available in memory for this tab. */ } }
function removeStoredAccessToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* Memory token is still cleared below. */ } }
let accessToken = readAccessToken();
let currentUser: User | null = null;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly fields?: Record<string, string>) { super(message); }
}

function clearToken() { accessToken = null; currentUser = null; removeStoredAccessToken(); window.dispatchEvent(new Event('cc:auth-invalid')); }

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const isPublicAuthRequest = path === '/api/auth/login' || path === '/api/auth/register';
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(!isPublicAuthRequest && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers } }); }
  catch { throw new ApiError(0, 'The backend could not be reached. Check that it is running and that VITE_API_URL is correct.'); }
  if (!response.ok) {
    let body: { error?: string; fields?: Record<string, string> } = {};
    try { body = await response.json(); } catch { /* empty error body */ }
    if (response.status === 401) clearToken();
    const message = response.status === 401 ? 'Invalid or expired credentials.' : body.error ?? (response.status === 409 ? 'This resource already exists.' : `Request failed (${response.status}).`);
    throw new ApiError(response.status, message, body.fields);
  }
  return response.status === 204 ? (undefined as T) : await response.json() as T;
}

type ApiUser = { id: string; email: string; name: string; publicKey?: string; keyFingerprint?: string };
/** Directory users expose only safe public fields — no email. */
type ApiDirectoryUser = { id: string; name: string; registeredAt?: string };
type ApiParticipant = { id: string; name: string; keyFingerprint?: string | null };
type ApiDirectoryPage = { users: ApiDirectoryUser[]; page: number; hasMore: boolean };
type ApiFriendRequest = { id: string; userId: string; name: string; status: string; outgoing: boolean; updatedAt: string };
type AuthResponse = { token: string; user: ApiUser };
type ApiConversation = { id: string; updatedAt: string; participants: ApiParticipant[]; unreadCount: number; lastMessageAt?: string | null; hasMessages: boolean };
type ApiMessage = { id: string; conversationId: string; senderId: string; clientMessageId: string; format: 'TEXT' | 'LEGACY_ENCRYPTED'; content: string | null; createdAt: string; deliveredAt?: string | null; readAt?: string | null };

function mapUser(u: ApiUser): User { return { id: u.id, name: u.name, email: u.email, status: 'unknown', joinedAt: new Date().toISOString(), keyFingerprint: u.keyFingerprint }; }
function mapParticipant(u: ApiParticipant): Contact { return { id: u.id, name: u.name, status: 'unknown', verified: false, publicKeyFingerprint: u.keyFingerprint ?? 'Not provided', lastSeen: '', addedAt: '' }; }
function mapDirectoryUser(u: ApiDirectoryUser): DirectoryUser { return { id: u.id, name: u.name, registeredAt: u.registeredAt }; }
function mapFriendRequest(r: ApiFriendRequest): FriendRequest { return { id: r.id, userId: r.userId, name: r.name, status: r.status as FriendRequest['status'], outgoing: r.outgoing, updatedAt: r.updatedAt }; }
function storeAuth(response: AuthResponse) { const user = mapUser(response.user); accessToken = response.token; persistAccessToken(response.token); currentUser = user; return user; }

export interface IAuthService { login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }>; register(name: string, email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }>; restoreSession(): Promise<User | null>; updateProfile(name: string): Promise<User>; loginDemo(): Promise<{ success: boolean }>; getAccessToken(): string | null; logout(): Promise<void>; }
export const authService: IAuthService = {
  async login(email, password) { if (!API_MODE) { await delay(400); return email && password.length >= 6 ? { success: true } : { success: false, error: 'Invalid credentials.' }; } try { return { success: true, user: storeAuth(await apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })) }; } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Login failed.' }; } },
  async register(name, email, password) { if (!API_MODE) { await delay(400); return { success: true }; } try { return { success: true, user: storeAuth(await apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })) }; } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Registration failed.' }; } },
  async restoreSession() { if (!API_MODE || !accessToken) return null; const user = mapUser(await apiRequest<ApiUser>('/api/auth/me')); currentUser = user; return user; },
  async updateProfile(name) { if (!API_MODE) throw new ApiError(0, 'Profile editing requires API mode.'); const user = mapUser(await apiRequest<ApiUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) })); currentUser = user; return user; },
  async loginDemo() { await delay(300); return { success: true }; },
  getAccessToken() { return API_MODE ? accessToken : null; },
  logout() { const revoke = API_MODE && accessToken ? apiRequest('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(3000) }).catch(() => undefined) : Promise.resolve(); clearToken(); currentUser = null; return revoke.then(() => undefined); },
};

type KeyChallenge = { challengeId: string; challenge: string };
type KeyInfo = { keyFingerprint: string };
const identityKeyStore = 'cryptoconnect-identity-keys';
const identityKeyName = (userId: string) => `p256:${userId}`;
function openIdentityKeyStore(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(identityKeyStore, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Secure browser key storage is unavailable.'));
  });
}
async function loadIdentityKey(userId: string): Promise<CryptoKeyPair | undefined> {
  const db = await openIdentityKeyStore();
  return new Promise<CryptoKeyPair | undefined>((resolve, reject) => {
    const request = db.transaction('keys', 'readonly').objectStore('keys').get(identityKeyName(userId));
    request.onsuccess = () => resolve(request.result as CryptoKeyPair | undefined);
    request.onerror = () => reject(new Error('Could not read the local identity key.'));
  }).finally(() => db.close());
}
async function storeIdentityKey(userId: string, pair: CryptoKeyPair): Promise<void> {
  const db = await openIdentityKeyStore();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction('keys', 'readwrite').objectStore('keys').put(pair, identityKeyName(userId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Could not save the local identity key.'));
  }).finally(() => db.close());
}
function base64(bytes: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function fromBase64Url(value: string) { const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }

export const identityKeyService = {
  async enroll(userId: string): Promise<KeyInfo> {
    if (!API_MODE) throw new ApiError(0, 'Identity-key enrollment requires API mode.');
    if (!window.isSecureContext || !crypto.subtle) throw new Error('Identity-key enrollment requires a secure browser context (HTTPS or localhost).');
    let keyPair = await loadIdentityKey(userId);
    if (!keyPair) {
      keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
      await storeIdentityKey(userId, keyPair);
    }
    const challenge = await apiRequest<KeyChallenge>('/api/auth/me/key/challenge', { method: 'POST' });
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, fromBase64Url(challenge.challenge));
    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return apiRequest<KeyInfo>('/api/auth/me/key', { method: 'POST', body: JSON.stringify({ challengeId: challenge.challengeId, algorithm: 'EC/P-256', publicKey: base64(publicKey), signature: base64(signature) }) });
  },
};

export interface IConversationService { getConversations(): Promise<Conversation[]>; getMessages(id: string, before?: string): Promise<Message[]>; getConversation(id: string): Promise<Conversation | null>; openConversation(recipientId: string, knownConversations?: Conversation[]): Promise<Conversation>; markRead(conversationId: string, messageIds: string[]): Promise<number>; sendMessage(conversationId: string, content: string, clientMessageId?: string): Promise<Message>; }
function conversationFromApi(c: ApiConversation, messages: Message[] = []): Conversation { const other = c.participants.find((p) => p.id !== currentUser?.id) ?? c.participants[0]; const contact = other ? mapParticipant(other) : { id: '', name: 'Unknown user', status: 'unknown' as const, verified: false, publicKeyFingerprint: 'Not provided', lastSeen: '', addedAt: '' }; return { id: c.id, participants: c.participants.map((p) => p.id), contact, lastMessage: c.hasMessages ? 'Conversation has messages' : 'No messages yet', lastMessageAt: c.lastMessageAt ?? c.updatedAt, unreadCount: c.unreadCount ?? 0, messages }; }
function messageFromApi(m: ApiMessage, historical = true): Message { const legacy = m.format === 'LEGACY_ENCRYPTED'; return { id: m.id, conversationId: m.conversationId, senderId: m.senderId, content: legacy || typeof m.content !== 'string' ? '' : m.content, timestamp: m.createdAt, status: m.readAt ? 'read' : m.deliveredAt ? 'delivered' : 'sent', encrypted: false, contentUnavailable: legacy, historical }; }
export const conversationService: IConversationService = {
  async getConversations() { if (!API_MODE) { await delay(150); return [...conversations]; } const apiConversations = await apiRequest<ApiConversation[]>('/api/conversations'); return apiConversations.map((c) => conversationFromApi(c)); },
  async getMessages(id, before) { if (!API_MODE) { await delay(100); const messages = conversations.find((conversation) => conversation.id === id)?.messages ?? []; return before ? messages.filter((message) => message.timestamp < before).slice(-50) : messages.slice(-50); } const query = before ? `?before=${encodeURIComponent(before)}` : ''; return (await apiRequest<ApiMessage[]>(`/api/conversations/${id}/messages${query}`)).reverse().map((message) => messageFromApi(message)); },
  async getConversation(id) { const all = await this.getConversations(); const summary = all.find((conversation) => conversation.id === id); if (!summary) return null; return { ...summary, messages: await this.getMessages(id) }; },
  async openConversation(recipientId, knownConversations) { if (!API_MODE) { const existing = conversations.find((conversation) => conversation.contact.id === recipientId); if (existing) return existing; const contact = mockUserDirectory.find((candidate) => candidate.id === recipientId); if (!contact) throw new Error('Contact not found.'); const timestamp = new Date().toISOString(); const created: Conversation = { id: `conv-demo-${recipientId}`, participants: [DEMO_USER.id, recipientId], contact, lastMessage: 'No messages yet', lastMessageAt: timestamp, unreadCount: 0, messages: [] }; conversations = [created, ...conversations]; return created; } const current = knownConversations ?? await this.getConversations(); const existing = current.find((conversation) => conversation.contact.id === recipientId); if (existing) return existing; return conversationFromApi(await apiRequest<ApiConversation>('/api/conversations', { method: 'POST', body: JSON.stringify({ recipientId }) })); },
  async markRead(conversationId, messageIds) { if (!messageIds.length) return 0; if (!API_MODE) { let count = 0; conversations = conversations.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: Math.max(0, conversation.unreadCount - (count = messageIds.filter((id) => conversation.messages.some((message) => message.id === id && message.senderId !== DEMO_USER.id && message.status !== 'read')).length)), messages: conversation.messages.map((message) => messageIds.includes(message.id) && message.senderId !== DEMO_USER.id ? { ...message, status: 'read' as const } : message) } : conversation); return count; } const result = await apiRequest<{ messagesMarkedRead: number; readAt: string }>(`/api/conversations/${conversationId}/read`, { method: 'POST', body: JSON.stringify({ messageIds }) }); return result.messagesMarkedRead; },
  async sendMessage(conversationId, content, clientMessageId = crypto.randomUUID()) { if (!API_MODE) { await delay(100); const msg: Message = { id: `msg-${Date.now()}`, conversationId, senderId: DEMO_USER.id, content, timestamp: new Date().toISOString(), status: 'sent', encrypted: false }; conversations = conversations.map((c) => c.id === conversationId ? { ...c, messages: [...c.messages, msg], lastMessage: content, lastMessageAt: msg.timestamp } : c); return msg; } return messageFromApi(await apiRequest<ApiMessage>(`/api/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ clientMessageId, content }) }), false); },
};

export interface IContactService { getContacts(): Promise<Contact[]>; searchUsers(query: string, page?: number, size?: number): Promise<{ users: DirectoryUser[]; hasMore: boolean }>; addContact(userId: string): Promise<Contact>; removeContact(userId: string): Promise<void>; verifyContact(id: string): Promise<Contact>; }
export const contactService: IContactService = {
  async getContacts() { if (!API_MODE) { await delay(150); return [...contacts]; } return (await apiRequest<ApiContact[]>('/api/contacts')).map(mapApiContact); },
  async searchUsers(query, page = 0, size = 20) { if (!API_MODE) { const filtered = mockUserDirectory.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())); return { users: filtered.map((c) => ({ id: c.id, name: c.name })), hasMore: false }; } const params = new URLSearchParams({ query, page: String(page), size: String(size) }); const page_ = await apiRequest<ApiDirectoryPage>(`/api/users?${params.toString()}`); return { users: page_.users.map(mapDirectoryUser), hasMore: page_.hasMore }; },
  async addContact(userId) { if (!API_MODE) { const found = mockUserDirectory.find((contact) => contact.id === userId); if (!found) throw new Error('User not found.'); if (mockContactIds.has(found.id)) throw new ApiError(409, 'This user is already a contact.'); mockContactIds.add(found.id); contacts = [...contacts, found]; return found; } return mapApiContact(await apiRequest<ApiContact>('/api/contacts', { method: 'POST', body: JSON.stringify({ userId }) })); },
  async removeContact(userId) { if (!API_MODE) { if (!mockContactIds.delete(userId)) throw new ApiError(404, 'Contact not found.'); contacts = contacts.filter((contact) => contact.id !== userId); return; } await apiRequest<void>(`/api/contacts/${encodeURIComponent(userId)}`, { method: 'DELETE' }); },
  async verifyContact(id) {
    if (!API_MODE) throw new ApiError(0, 'Contact verification requires API mode and an enrolled contact identity key.');
    return mapApiContact(await apiRequest<ApiContact>(`/api/contacts/${encodeURIComponent(id)}/verify`, { method: 'POST' }));
  },
};

type ApiContact = { id: string; name: string; email: string; keyFingerprint?: string | null; verified?: boolean; verifiedAt?: string | null };
function mapApiContact(contact: ApiContact): Contact { return { id: contact.id, name: contact.name, email: contact.email, status: 'unknown', verified: contact.verified === true, publicKeyFingerprint: contact.keyFingerprint ?? 'Not provided', lastSeen: '', addedAt: contact.verifiedAt ?? '' }; }

export interface IFriendService {
  send(recipientId: string): Promise<FriendRequest>;
  incoming(): Promise<FriendRequest[]>;
  outgoing(): Promise<FriendRequest[]>;
  accept(requestId: string): Promise<FriendRequest>;
  reject(requestId: string): Promise<FriendRequest>;
}
export const friendService: IFriendService = {
  async send(recipientId) { if (!API_MODE) throw new ApiError(0, 'Friend requests require API mode.'); return mapFriendRequest(await apiRequest<ApiFriendRequest>('/api/friend-requests', { method: 'POST', body: JSON.stringify({ recipientId }) })); },
  async incoming() { if (!API_MODE) return []; return (await apiRequest<ApiFriendRequest[]>('/api/friend-requests/incoming')).map(mapFriendRequest); },
  async outgoing() { if (!API_MODE) return []; return (await apiRequest<ApiFriendRequest[]>('/api/friend-requests/outgoing')).map(mapFriendRequest); },
  async accept(requestId) { if (!API_MODE) throw new ApiError(0, 'Friend requests require API mode.'); return mapFriendRequest(await apiRequest<ApiFriendRequest>(`/api/friend-requests/${encodeURIComponent(requestId)}/accept`, { method: 'POST' })); },
  async reject(requestId) { if (!API_MODE) throw new ApiError(0, 'Friend requests require API mode.'); return mapFriendRequest(await apiRequest<ApiFriendRequest>(`/api/friend-requests/${encodeURIComponent(requestId)}/reject`, { method: 'POST' })); },
};

export type Presence = { userId: string; online: boolean };
export const presenceService = {
  async status(userIds: string[]): Promise<Presence[]> {
    if (!API_MODE || userIds.length === 0) return [];
    const params = new URLSearchParams();
    userIds.forEach((id) => params.append('userId', id));
    return apiRequest<Presence[]>(`/api/presence?${params.toString()}`);
  },
};

export interface ISecurityEventService { getEvents(): Promise<SecurityEvent[]>; addEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<SecurityEvent>; }
export const securityEventService: ISecurityEventService = {
  async getEvents() {
    if (API_MODE) return apiRequest<SecurityEvent[]>('/api/security-events');
    await delay(100);
    return [...securityEvents];
  },
  async addEvent(event) {
    if (API_MODE) return apiRequest<SecurityEvent>('/api/security-events', { method: 'POST', body: JSON.stringify({ type: event.type }) });
    const item = { ...event, id: `ev-${Date.now()}`, timestamp: new Date().toISOString() };
    securityEvents = [item, ...securityEvents];
    return item;
  },
};

type ApiActivityPoint = { date: string; total: number; sent: number };
export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    if (API_MODE) return apiRequest<DashboardStats>('/api/dashboard/stats');
    await delay(100);
    return { ...MOCK_DASHBOARD_STATS };
  },
  async getChartData(): Promise<ChartDataPoint[]> {
    if (API_MODE) {
      const activity = await apiRequest<ApiActivityPoint[]>('/api/dashboard/activity?days=7');
      return activity.map((point) => ({ date: point.date.slice(5), total: point.total, sent: point.sent }));
    }
    await delay(100);
    return [...MOCK_CHART_DATA];
  },
};
export const securityLabService = { async getTests(): Promise<SecurityTest[]> { if (API_MODE) throw new Error('Security tests run locally and are not available from a backend API.'); await delay(100); return [...INITIAL_SECURITY_TESTS]; } };

let conversations = [...MOCK_CONVERSATIONS];
const mockUserDirectory = [...MOCK_CONTACTS];
let contacts = [...mockUserDirectory];
const mockContactIds = new Set(contacts.map((contact) => contact.id));
let securityEvents = MOCK_SECURITY_EVENTS.map((event) => ({ ...event, isSimulated: true }));
function delay(ms: number) { return new Promise<void>((resolve) => setTimeout(resolve, ms)); }
