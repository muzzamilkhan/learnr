import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './helpers/db.js';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('the test database', () => {
  it('has the schema applied', async () => {
    const user = await testPrisma().user.create({
      data: { name: 'Ada', role: 'parent' },
    });

    expect(user.id).toBeTypeOf('string');
    expect(user.stars).toBe(0);
    expect(user.playStreak).toBe(0);
  });

  it('is empty at the start of each test', async () => {
    expect(await testPrisma().user.count()).toBe(0);
  });
});
