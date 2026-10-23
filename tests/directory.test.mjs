import test from 'node:test';
import assert from 'node:assert/strict';
import { directorySearchPath, mapDirectoryPage } from '../src/services/directory.ts';

test('directory requests encode exact email queries and pagination', () => {
  assert.equal(
    directorySearchPath(' user+tag@example.test ', 2, 10),
    '/api/users?query=user%2Btag%40example.test&page=2&size=10',
  );
});

test('directory response maps the users envelope without exposing extra fields', () => {
  assert.deepEqual(mapDirectoryPage({
    users: [{ id: 'user-1', name: 'Example User', registeredAt: '2026-10-23T00:00:00Z', email: 'private@example.test' }],
    page: 0,
    hasMore: true,
  }), {
    users: [{ id: 'user-1', name: 'Example User', registeredAt: '2026-10-23T00:00:00Z' }],
    hasMore: true,
  });
});

test('invalid directory response shapes fail instead of looking like empty results', () => {
  for (const value of [null, {}, { users: [], hasMore: 'false' }, { users: [null], hasMore: false }]) {
    assert.throws(() => mapDirectoryPage(value), /invalid response/);
  }
});
