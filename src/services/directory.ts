import type { DirectoryUser } from '../types';

interface ApiDirectoryUser {
  id: string;
  name: string;
  registeredAt?: string;
}

export interface DirectorySearchResult {
  users: DirectoryUser[];
  hasMore: boolean;
}

export function directorySearchPath(query: string, page: number, size: number): string {
  const params = new URLSearchParams({ query: query.trim(), page: String(page), size: String(size) });
  return `/api/users?${params.toString()}`;
}

export function mapDirectoryPage(value: unknown): DirectorySearchResult {
  if (!value || typeof value !== 'object') {
    throw new Error('The user directory returned an invalid response.');
  }

  const page = value as { users?: unknown; hasMore?: unknown };
  if (!Array.isArray(page.users) || typeof page.hasMore !== 'boolean') {
    throw new Error('The user directory returned an invalid response.');
  }

  const users = page.users.map((user: unknown): DirectoryUser => {
    if (!user || typeof user !== 'object') {
      throw new Error('The user directory returned an invalid response.');
    }
    const item = user as Partial<ApiDirectoryUser>;
    if (typeof item.id !== 'string' || typeof item.name !== 'string'
      || (item.registeredAt !== undefined && typeof item.registeredAt !== 'string')) {
      throw new Error('The user directory returned an invalid response.');
    }
    return { id: item.id, name: item.name, registeredAt: item.registeredAt };
  });

  return { users, hasMore: page.hasMore };
}
