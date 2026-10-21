// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'unknown';
  joinedAt: string;
  keyFingerprint?: string;
}

/** Safe public fields returned by the registered-user directory. No email or sensitive data. */
export interface DirectoryUser {
  id: string;
  name: string;
  registeredAt?: string;
}

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface FriendRequest {
  id: string;
  userId: string;
  name: string;
  status: FriendRequestStatus;
  outgoing: boolean;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'unknown';
  verified: boolean;
  publicKeyFingerprint: string;
  lastSeen: string;
  addedAt: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: MessageStatus;
  encrypted?: boolean; // retained only for illustrative demo messages
  contentUnavailable?: boolean; // legacy encrypted row has no recoverable key
  historical?: boolean; // loaded from persisted history rather than received live
}

export interface Conversation {
  id: string;
  participants: string[]; // contact ids
  contact: Contact;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
}

// ─── Security Events ─────────────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'critical' | 'success';
export type EventType =
  | 'encryption_success'
  | 'decryption_failure'
  | 'tamper_detected'
  | 'verification_change'
  | 'login_success'
  | 'login_failure'
  | 'key_generated'
  | 'contact_added'
  | 'account_created'
  | 'message_sent';

export interface SecurityEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  description: string;
  timestamp: string;
  isSimulated: boolean; // true = simulated backend event, false = real local demo event
  metadata?: Record<string, string>;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalConversations: number;
  messagesSent: number;
  messagesStored?: number;
  unreadMessages?: number;
  encryptedPercentage?: number;
  verifiedContacts?: number;
}

export interface ChartDataPoint {
  date: string;
  encrypted?: number;
  sent?: number;
  total: number;
}

// ─── Encryption Visualizer ────────────────────────────────────────────────────

export type EncryptStep =
  | 'idle'
  | 'input'
  | 'key_generation'
  | 'encrypting'
  | 'ciphertext'
  | 'transmission'
  | 'decrypting'
  | 'decrypted'
  | 'tamper_test'
  | 'error';

export interface EncryptionResult {
  algorithm: string;
  keyLength: number;
  iv: string; // hex
  authTag: string; // hex (last 16 bytes of AES-GCM output)
  ciphertext: string; // hex (without auth tag)
  plaintext: string;
}

// ─── Security Lab ────────────────────────────────────────────────────────────

export type TestStatus = 'not_run' | 'running' | 'passed' | 'failed';

export interface SecurityTest {
  id: string;
  name: string;
  description: string;
  status: TestStatus;
  result?: string;
  isReal: boolean; // true = runs actual Web Crypto, false = simulated
  duration?: number; // ms
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'dark'; // only dark for now
  notifications: boolean;
  soundEnabled: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  compactMode: boolean;
  showEncryptionBadges: boolean;
  autoLockMinutes: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}
