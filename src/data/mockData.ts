import type {
  Contact,
  Conversation,
  Message,
  SecurityEvent,
  DashboardStats,
  ChartDataPoint,
  User,
  AppSettings,
  SecurityTest,
} from '../types';

// ─── Current User (Demo) ──────────────────────────────────────────────────────

export const DEMO_USER: User = {
  id: 'user-001',
  name: 'Alex Reeves',
  email: 'alex.reeves@cryptoconnect.demo',
  status: 'online',
  joinedAt: '2024-01-15',
};

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'c-001',
    name: 'Priya Sharma',
    email: 'priya.sharma@demo.local',
    status: 'online',
    verified: false,
    publicKeyFingerprint: 'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90',
    lastSeen: new Date().toISOString(),
    addedAt: '2024-02-10',
  },
  {
    id: 'c-002',
    name: 'Jordan Lee',
    email: 'jordan.lee@demo.local',
    status: 'away',
    verified: false,
    publicKeyFingerprint: 'F0:E1:D2:C3:B4:A5:96:87:78:69:5A:4B:3C:2D:1E:0F',
    lastSeen: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    addedAt: '2024-02-15',
  },
  {
    id: 'c-003',
    name: 'Marcus Chen',
    email: 'marcus.chen@demo.local',
    status: 'offline',
    verified: false,
    publicKeyFingerprint: '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    addedAt: '2024-03-01',
  },
  {
    id: 'c-004',
    name: 'Sarah Kim',
    email: 'sarah.kim@demo.local',
    status: 'online',
    verified: false,
    publicKeyFingerprint: 'DE:AD:BE:EF:CA:FE:BA:BE:00:11:22:33:44:55:66:77',
    lastSeen: new Date().toISOString(),
    addedAt: '2024-03-10',
  },
  {
    id: 'c-005',
    name: 'Rajan Patel',
    email: 'rajan.patel@demo.local',
    status: 'offline',
    verified: false,
    publicKeyFingerprint: '42:13:7F:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    addedAt: '2024-03-20',
  },
];

// ─── Conversations & Messages ─────────────────────────────────────────────────

const makeMsg = (
  id: string,
  convId: string,
  senderId: string,
  content: string,
  minutesAgo: number,
  encrypted = true,
): Message => ({
  id,
  conversationId: convId,
  senderId,
  content,
  timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  status: 'read',
  encrypted,
});

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    participants: ['user-001', 'c-001'],
    contact: MOCK_CONTACTS[0],
    lastMessage: 'Got it. Let me know when you\'re ready.',
    lastMessageAt: new Date(Date.now() - 2 * 60000).toISOString(),
    unreadCount: 0,
    messages: [
      makeMsg('m-001', 'conv-001', 'c-001', 'Hey! Did you check the encryption module?', 60),
      makeMsg('m-002', 'conv-001', 'user-001', 'Yes, AES-GCM demo is working. The IV generation is solid.', 55),
      makeMsg('m-003', 'conv-001', 'c-001', 'Great. We should also add the tamper detection test.', 40),
      makeMsg('m-004', 'conv-001', 'user-001', 'Already on it. Should be done by tonight.', 35),
      makeMsg('m-005', 'conv-001', 'c-001', 'Got it. Let me know when you\'re ready.', 2),
    ],
  },
  {
    id: 'conv-002',
    participants: ['user-001', 'c-002'],
    contact: MOCK_CONTACTS[1],
    lastMessage: 'The key fingerprints matched!',
    lastMessageAt: new Date(Date.now() - 25 * 60000).toISOString(),
    unreadCount: 2,
    messages: [
      makeMsg('m-010', 'conv-002', 'user-001', 'Jordan, can you verify your public key fingerprint?', 90),
      makeMsg('m-011', 'conv-002', 'c-002', 'Sure. F0:E1:D2:C3 ... 1E:0F', 80),
      makeMsg('m-012', 'conv-002', 'user-001', 'Matches mine. Secure channel confirmed ✓', 75),
      makeMsg('m-013', 'conv-002', 'c-002', 'The key fingerprints matched!', 25),
    ],
  },
  {
    id: 'conv-003',
    participants: ['user-001', 'c-003'],
    contact: MOCK_CONTACTS[2],
    lastMessage: 'Call me when you are free.',
    lastMessageAt: new Date(Date.now() - 180 * 60000).toISOString(),
    unreadCount: 0,
    messages: [
      makeMsg('m-020', 'conv-003', 'c-003', 'Hey Alex, are you available?', 200),
      makeMsg('m-021', 'conv-003', 'user-001', 'In a meeting. Will be free in an hour.', 190),
      makeMsg('m-022', 'conv-003', 'c-003', 'Call me when you are free.', 180),
    ],
  },
  {
    id: 'conv-004',
    participants: ['user-001', 'c-004'],
    contact: MOCK_CONTACTS[3],
    lastMessage: 'Security report is ready for review.',
    lastMessageAt: new Date(Date.now() - 30 * 60000).toISOString(),
    unreadCount: 1,
    messages: [
      makeMsg('m-030', 'conv-004', 'c-004', 'I finished the security audit.', 60),
      makeMsg('m-031', 'conv-004', 'user-001', 'Awesome! Any critical findings?', 50),
      makeMsg('m-032', 'conv-004', 'c-004', 'Two medium severity, no criticals. 🎉', 40),
      makeMsg('m-033', 'conv-004', 'user-001', 'That\'s great news!', 35),
      makeMsg('m-034', 'conv-004', 'c-004', 'Security report is ready for review.', 30),
    ],
  },
];

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalConversations: 4,
  messagesSent: 127,
  encryptedPercentage: 94,
  verifiedContacts: 0,
};

export const MOCK_CHART_DATA: ChartDataPoint[] = [
  { date: 'Oct 7', encrypted: 18, total: 20 },
  { date: 'Oct 8', encrypted: 24, total: 26 },
  { date: 'Oct 9', encrypted: 15, total: 17 },
  { date: 'Oct 10', encrypted: 29, total: 31 },
  { date: 'Oct 11', encrypted: 22, total: 24 },
  { date: 'Oct 12', encrypted: 19, total: 21 },
  { date: 'Oct 13', encrypted: 12, total: 13 },
];

// ─── Security Events ──────────────────────────────────────────────────────────

export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 'ev-001',
    type: 'encryption_success',
    severity: 'success',
    title: 'AES-GCM Encryption Test Passed',
    description: 'Local browser encryption test completed successfully. Plaintext was encrypted and decrypted with the correct key.',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    isSimulated: false,
  },
  {
    id: 'ev-002',
    type: 'tamper_detected',
    severity: 'warning',
    title: 'Message Tampering Detected',
    description: 'Modified ciphertext failed AES-GCM authentication verification. The authentication tag mismatch indicates tampering.',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    isSimulated: false,
  },
  {
    id: 'ev-003',
    type: 'verification_change',
    severity: 'info',
    title: 'Identity verification unavailable',
    description: 'A fingerprint alone does not verify identity. No verification protocol is implemented.',
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    isSimulated: false,
  },
  {
    id: 'ev-004',
    type: 'login_success',
    severity: 'success',
    title: 'Demo Session Started',
    description: 'User logged in with demo credentials. All data in this session is local mock data.',
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    isSimulated: true,
    metadata: { source: 'demo_login' },
  },
  {
    id: 'ev-005',
    type: 'decryption_failure',
    severity: 'critical',
    title: 'Wrong-Key Decryption Failed',
    description: 'Attempted decryption with an incorrect key was rejected. AES-GCM authentication prevented any data leakage.',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    isSimulated: false,
  },
  {
    id: 'ev-006',
    type: 'key_generated',
    severity: 'info',
    title: 'Session Key Generated',
    description: 'A new 256-bit AES-GCM key was generated for the current demo session using Web Crypto API.',
    timestamp: new Date(Date.now() - 150 * 60000).toISOString(),
    isSimulated: false,
  },
  {
    id: 'ev-007',
    type: 'contact_added',
    severity: 'info',
    title: 'New Contact Added: Rajan Patel',
    description: 'Contact added with unverified fingerprint 42:13:7F... Verification pending.',
    timestamp: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
    isSimulated: true,
  },
  {
    id: 'ev-008',
    type: 'login_failure',
    severity: 'warning',
    title: 'Simulated Login Attempt Blocked',
    description: 'Demo simulation: An account login attempt with incorrect credentials was rejected.',
    timestamp: new Date(Date.now() - 25 * 60 * 60000).toISOString(),
    isSimulated: true,
    metadata: { ip: '192.168.1.42 (simulated)', attempts: '3' },
  },
];

// ─── Security Lab Tests ───────────────────────────────────────────────────────

export const INITIAL_SECURITY_TESTS: SecurityTest[] = [
  {
    id: 'test-001',
    name: 'AES-GCM Encrypt/Decrypt',
    description: 'Encrypts a test phrase with a random 256-bit key and decrypts it. Verifies round-trip integrity.',
    status: 'not_run',
    isReal: true,
  },
  {
    id: 'test-002',
    name: 'Authentication Tag Verification',
    description: 'Modifies a single byte of ciphertext and confirms that AES-GCM authentication fails.',
    status: 'not_run',
    isReal: true,
  },
  {
    id: 'test-003',
    name: 'Wrong-Key Rejection',
    description: 'Attempts to decrypt data with a different key and confirms decryption is rejected.',
    status: 'not_run',
    isReal: true,
  },
  {
    id: 'test-004',
    name: 'SHA-256 Fingerprint Generation',
    description: 'Generates a SHA-256 digest of a demo string and validates the fingerprint format.',
    status: 'not_run',
    isReal: true,
  },
  {
    id: 'test-005',
    name: 'IV Uniqueness Check',
    description: 'Generates 100 random 96-bit IVs and verifies no duplicates (collision resistance demo).',
    status: 'not_run',
    isReal: true,
  },
  {
    id: 'test-006',
    name: 'Simulated Key Exchange',
    description: 'Simulates a Diffie-Hellman key exchange handshake (demonstration only — not real network).',
    status: 'not_run',
    isReal: false,
  },
  {
    id: 'test-007',
    name: 'Simulated Forward Secrecy',
    description: 'Demonstrates the concept of ephemeral keys and forward secrecy (simulation).',
    status: 'not_run',
    isReal: false,
  },
];

// ─── Default Settings ─────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: true,
  soundEnabled: false,
  fontSize: 'md',
  compactMode: false,
  showEncryptionBadges: true,
  autoLockMinutes: 15,
};
