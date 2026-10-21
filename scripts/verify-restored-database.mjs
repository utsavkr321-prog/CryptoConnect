import fs from 'node:fs';

const statePath = process.argv[2];
if (!statePath || !process.env.CC_RESTORED_API_URL) throw new Error('Restore verification requires a state file and CC_RESTORED_API_URL.');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const base = process.env.CC_RESTORED_API_URL.replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  if (!response.ok) throw new Error(`Restored application request failed: ${options.method ?? 'GET'} ${path} (${response.status}).`);
  return response.status === 204 ? undefined : response.json();
}

if ((await request('/health/ready')).status !== 'UP') throw new Error('Restored application did not report readiness.');
const auth = [];
for (const account of state.accounts) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  auth.push({ ...account, token: result.token });
}

const conversationPath = `/api/conversations/${state.conversationId}/messages`;
const history = await request(conversationPath, { headers: { authorization: `Bearer ${auth[0].token}` } });
for (const messageId of state.messageIds) {
  if (!history.some((message) => message.id === messageId)) throw new Error('A previously saved message was missing after restore.');
}

const envelope = {
  clientMessageId: `restore-check-${crypto.randomUUID()}`,
  content: 'Readable message sent after restoring the database.',
};
const saved = await request(conversationPath, {
  method: 'POST',
  headers: { authorization: `Bearer ${auth[0].token}`, 'content-type': 'application/json' },
  body: JSON.stringify(envelope),
});
const confirmed = await request(conversationPath, { headers: { authorization: `Bearer ${auth[1].token}` } });
if (!confirmed.some((message) => message.id === saved.id && message.format === 'TEXT' && message.content === envelope.content))
  throw new Error('A new readable message could not be persisted and retrieved after restore.');
console.log('Restore verification passed: readiness, both account logins, restored conversation history, and a new persisted message.');
