import { randomUUID } from 'node:crypto';
import { testPrisma } from './db';

/** A parent who signed in with Google. */
export async function makeParent(
  overrides: { name?: string; email?: string } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'parent',
      name: overrides.name ?? 'Parent',
      email: overrides.email ?? `parent-${randomUUID()}@example.com`,
    },
  });
  return user.id;
}

/** A managed child: no email, no Account row, a parent who owns them. */
export async function makeChild(
  parentId: string,
  overrides: { name?: string; level?: string; avatar?: string } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'child',
      parentId,
      name: overrides.name ?? 'Child',
      selectedLevel: overrides.level ?? '3',
      avatar: overrides.avatar ?? 'fox',
    },
  });
  return user.id;
}
