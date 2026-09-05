import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '@/lib/password';
import { testPrisma } from './db';

/**
 * A parent who signed in with Google.
 *
 * `emailVerified` is set because every parent this app can make has a
 * verified address - Google verifies one, and the password flow verifies the
 * other. A test about the absence of verification sets it back to null
 * explicitly.
 */
export async function makeParent(
  overrides: { name?: string; email?: string } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'parent',
      name: overrides.name ?? 'Parent',
      email: overrides.email ?? `parent-${randomUUID()}@example.com`,
      emailVerified: new Date(),
    },
  });
  return user.id;
}

/** A password on an existing account, written the way the app writes one. */
export async function makePassword(userId: string, password: string): Promise<void> {
  await testPrisma().parentPassword.create({
    data: { userId, hash: await hashPassword(password, randomBytes) },
  });
}

/** A managed child: no email, no Account row, a parent who owns them. */
export async function makeChild(
  parentId: string,
  overrides: { name?: string; level?: string; avatar?: string; subjects?: string[] } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'child',
      parentId,
      name: overrides.name ?? 'Child',
      selectedLevel: overrides.level ?? '3',
      avatar: overrides.avatar ?? 'fox',
      subjects: overrides.subjects ?? ['maths', 'english'],
    },
  });
  return user.id;
}
