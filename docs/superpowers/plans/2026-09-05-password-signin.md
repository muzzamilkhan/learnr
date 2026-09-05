# Password Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A grown-up can make a LearnR account with an email address and a
password, or add a password to the Google account they already have, and both
logins then work on one account.

**Architecture:** Not an Auth.js provider - Auth.js refuses a Credentials
provider alongside database sessions, so this follows `redeemLoginCode`: verify,
write a `Session` row by hand, set the cookie, and `auth()` cannot tell the paths
apart. Three screens in order - email, then a mailed code, then a password - so
no `User` row exists before the mailbox has answered. Google arriving later links
automatically, gated on its own `email_verified` claim in a `signIn` callback
that Auth.js runs before it links anything.

**Tech Stack:** Next.js App Router, Auth.js v5 (`next-auth@5.0.0-beta`), Prisma 7
against Neon Postgres, `node:crypto` scrypt, Resend via the Vercel Marketplace,
vitest (two projects: `unit` and `db`).

**Spec:** `docs/superpowers/specs/2026-09-05-password-signin-design.md` - read it
first. This plan argues from it and does not repeat its reasoning.

**Issue:** #22.

**Two of the spec's three open questions are answered by this plan**, and the
answers are here rather than left to the implementer: the code is six digits and
lives ten minutes (Task 2), and the first screen says the same thing whether the
address is already known or not (Task 7's `sendPasswordCodeAction`), so the form
cannot be used to ask whether somebody has an account here. The third - whether
Auth.js runs the `signIn` callback before it links - was settled against the
installed source and folded back into the spec.

## Global Constraints

- **No new npm dependency for hashing.** scrypt comes from `node:crypto`. This
  repository has one UI dependency and does not gain an auth one.
- **`src/lib` and `src/content` stay pure.** `src/lib/purity.test.ts` fails on any
  import of React, `next`, `@prisma/client` or `src/server`. `node:crypto` is not
  on that list and is allowed here, because what the rule protects is
  determinism - so **randomness is injected**, exactly as `login-code.ts` injects
  `crypto.randomInt`, and scrypt is called only as a deterministic function of
  (password, salt, parameters).
- **Never the seeded `Rng`.** Codes, salts and grant tokens take
  `crypto.randomInt` / `crypto.randomBytes`. Replayability is the property these
  must not have.
- **Three answers, never two.** Every read that can fail returns `'unavailable'`
  distinctly from `'rejected'`. A Neon cold start must never be reported as a
  wrong password or a wrong code, and must never spend a throttle attempt.
- **Only guesses count toward a throttle**, and a success clears the caller.
  `isGuess` is the existing rule; follow it.
- **A child can never reach any of this.** Children have no email. Every write
  guards on it anyway.
- **`claimParentRole` is not copied.** A row this flow creates is created with
  `role` already set; an existing row without one calls `claimParentRole`.
- **Copy rules:** the new Google refusal must not reuse the
  `OAuthAccountNotLinked` sentence. Parent screens run at parent density
  (`text-sm`/`text-base`, `rounded-xl`, single-width borders).
- **Run `npm run test:unit` while working, `npm test` and `npm run typecheck`
  before pushing.** The `db` project needs Docker.

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/password.ts` | Create: the stored-hash string, hashing, verifying. Pure, randomness injected. |
| `src/lib/password.test.ts` | Create: `unit` project. |
| `src/lib/verification-code.ts` | Create: the code, the grant, the TTLs, the throttle limits, email normalisation, `VerifyStatus`. Beside `login-code.ts`. |
| `src/lib/verification-code.test.ts` | Create: `unit` project. |
| `src/lib/signin.ts` | Modify: one new entry in `MESSAGES`. |
| `src/lib/signin.test.ts` | Modify or create: the new message. |
| `prisma/schema.prisma` | Modify: `ParentPassword` model, relation on `User`. |
| `src/server/passwords.ts` | Create: the Prisma side - issue a code, spend it for a grant, spend a grant to set a password, sign in. Sibling of `accounts.ts`. |
| `src/server/passwords.test.ts` | Create: `db` project, real Postgres. |
| `src/server/email.ts` | Create: the sender seam. One function. |
| `src/app/actions.ts` | Modify: three server actions plus throttles. |
| `src/app/signin/password/page.tsx` | Create: the sign-in form's screen. |
| `src/app/password/new/page.tsx` | Create: step 1, the address. |
| `src/app/password/code/page.tsx` | Create: step 2, the code. |
| `src/app/password/set/page.tsx` | Create: step 3, the password. |
| `src/components/password-forms.tsx` | Create: the four client forms, following `CodeSignIn`. |
| `src/app/signin/page.tsx` | Modify: the grown-up's panel gains a second method. |
| `src/auth.ts` | Modify: the provider flag and the `signIn` callback. |
| `.env.example` | Modify: the Resend key and the from address. |
| `CLAUDE.md` | Modify: the Accounts section. |

**Why `src/server/passwords.ts` and not more of `accounts.ts`:** `accounts.ts` is
356 lines and this would roughly double it. `sharing.ts` is the precedent for a
sibling module holding one feature's queries.

**Why the actions go in `src/app/actions.ts`:** the repository has exactly one
server-actions file and `redeemLoginCodeAction` - the closest analogue - lives in
it. Follow the pattern rather than starting a second file.

**On testing the actions and the screens:** there are no tests for either in this
repository, by design - vitest is node-only and the two component tests that
exist (`focus-trap.test.ts`, `diagram.test.ts`) test the *arithmetic half* of a
component, never the rendering. So the actions stay thin glue over
`src/server/passwords.ts` and `src/lib/*`, which are both tested hard. **Do not
invent a component test harness for this feature.** If an action grows logic
worth testing, that logic belongs in one of the tested modules instead.

---

### Task 1: The stored hash

**Files:**
- Create: `src/lib/password.ts`
- Test: `src/lib/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashPassword(password: string, randomBytes: RandomBytes): Promise<string>`,
  `verifyPassword(password: string, stored: string): Promise<boolean>`,
  `parseStoredHash(value: string | null | undefined): StoredHash | null`,
  `parsePassword(value: string): string | null`,
  `PASSWORD_MIN_LENGTH: number`, `PASSWORD_MAX_LENGTH: number`,
  `type RandomBytes = (size: number) => Buffer`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/password.test.ts
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  hashPassword,
  parsePassword,
  parseStoredHash,
  verifyPassword,
} from './password';

describe('hashPassword and verifyPassword', () => {
  it('verifies the password it was made from', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('refuses a different password', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    expect(await verifyPassword('correct horse batteru', stored)).toBe(false);
  });

  // The salt is what stops one leaked hash answering for two accounts.
  it('gives two identical passwords different hashes', async () => {
    const a = await hashPassword('same password here', randomBytes);
    const b = await hashPassword('same password here', randomBytes);
    expect(a).not.toEqual(b);
  });

  // The parameters travel with the hash so they can be raised later without
  // stranding every hash written before the change.
  it('reads the cost parameters back off the stored string', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    const parsed = parseStoredHash(stored);
    expect(parsed).not.toBeNull();
    expect(stored.startsWith(`scrypt$${parsed?.N}$${parsed?.r}$${parsed?.p}$`)).toBe(true);
  });
});

describe('parseStoredHash', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['not enough fields', 'scrypt$16384$8$1$abcd'],
    ['an algorithm it does not know', 'bcrypt$16384$8$1$abcd$abcd'],
    ['a cost that is not a number', 'scrypt$plenty$8$1$abcd$abcd'],
    ['salt that is not hex', 'scrypt$16384$8$1$zzzz$abcd'],
  ])('returns null for %s', (_label, value) => {
    expect(parseStoredHash(value)).toBeNull();
  });
});

// A hash that will not parse is a row nobody can sign in with, never an
// exception in front of somebody trying to.
describe('verifyPassword against an unreadable hash', () => {
  it('is false rather than throwing', async () => {
    expect(await verifyPassword('anything at all', 'not a hash')).toBe(false);
  });
});

describe('parsePassword', () => {
  it('accepts a password at the floor', () => {
    const password = 'x'.repeat(PASSWORD_MIN_LENGTH);
    expect(parsePassword(password)).toBe(password);
  });

  it('refuses one below the floor', () => {
    expect(parsePassword('x'.repeat(PASSWORD_MIN_LENGTH - 1))).toBeNull();
  });

  // Spaces at either end are somebody's password, not their typing - unlike a
  // login code, which is read off a screen and retyped.
  it('keeps surrounding spaces rather than trimming them', () => {
    const password = `  ${'x'.repeat(PASSWORD_MIN_LENGTH)}  `;
    expect(parsePassword(password)).toBe(password);
  });

  it('refuses one long enough to be a denial of service', () => {
    expect(parsePassword('x'.repeat(10_000))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/lib/password.test.ts`
Expected: FAIL - `Failed to resolve import "./password"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/password.ts
import { scrypt, timingSafeEqual } from 'node:crypto';

/**
 * A parent's password, hashed.
 *
 * Pure in the sense the rest of `src/lib` is - no clock, no network, no
 * database, and the randomness is passed in, exactly as `login-code.ts` takes
 * `crypto.randomInt` rather than reaching for it. scrypt itself is a
 * deterministic function of the password, the salt and the cost parameters, so
 * a test can pin all three and get the same bytes on every machine.
 *
 * `node:crypto` rather than a dependency: this repository has one UI dependency
 * and should not gain an auth one for a key derivation function that ships with
 * the runtime.
 */

/** `randomBytes(size)` must return `size` cryptographically random bytes. */
export type RandomBytes = (size: number) => Buffer;

/**
 * Long enough to be worth the scrypt cost in front of it, short enough that a
 * grown-up will actually choose one. Length is the only rule: composition rules
 * push people towards `Passw0rd!` and buy nothing.
 */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Not a security limit - a scrypt call is linear in the input it hashes, so an
 * unbounded password is a way to spend the server's CPU from a form.
 */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * scrypt's cost. 128 * N * r bytes of memory, so this is 16MB - under node's
 * 32MB `maxmem` default, which is why nothing here has to raise it.
 */
export const SCRYPT_N = 16_384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;

export type StoredHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

const HEX = /^[0-9a-f]+$/;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * The parameters travel with the hash rather than being read from the constants
 * above. Raising the cost later must not strand every hash written before the
 * change: an old row still says what it was made with, and verifies.
 */
export async function hashPassword(password: string, randomBytes: RandomBytes): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    key.toString('hex'),
  ].join('$');
}

/**
 * The boundary normaliser, beside `parsePhoto` and `parseYearLevel`: a stored
 * string is read back from a row and is not trusted to be one this code wrote.
 * Null means *there is no usable hash here*, which every caller reads as a
 * refused sign-in rather than an error.
 */
export function parseStoredHash(value: string | null | undefined): StoredHash | null {
  if (!value) return null;
  const parts = value.split('$');
  if (parts.length !== 6) return null;
  const [algorithm, rawN, rawR, rawP, salt, key] = parts;
  if (algorithm !== 'scrypt') return null;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r < 1 || p < 1) return null;
  if (!HEX.test(salt) || !HEX.test(key)) return null;
  if (salt.length % 2 !== 0 || key.length % 2 !== 0) return null;
  return { N, r, p, salt: Buffer.from(salt, 'hex'), key: Buffer.from(key, 'hex') };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  const key = await derive(password, parsed.salt, parsed.N, parsed.r, parsed.p);
  if (key.length !== parsed.key.length) return false;
  return timingSafeEqual(key, parsed.key);
}

/**
 * What was typed, as a password - or null if it could never be one. Unlike a
 * login code nothing is folded or trimmed: surrounding spaces are somebody's
 * password rather than their typing.
 */
export function parsePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return null;
  if (value.length > PASSWORD_MAX_LENGTH) return null;
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project unit src/lib/password.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Confirm the purity rule still holds**

Run: `npx vitest run --project unit src/lib/purity.test.ts`
Expected: PASS. `node:crypto` is not on the forbidden list; this step is here so
the next person sees it was checked rather than assumed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/password.ts src/lib/password.test.ts
git commit -m "Hash a parent's password with scrypt, and no new dependency"
```

---

### Task 2: The code, the grant, and the limits

**Files:**
- Create: `src/lib/verification-code.ts`
- Test: `src/lib/verification-code.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `VERIFICATION_CODE_LENGTH`, `VERIFICATION_CODE_TTL_MS`, `GRANT_TTL_MS`,
  `GRANT_LENGTH`, `CODE_FAILURE_LIMIT`, `CODE_FAILURE_WINDOW_MS`, `SEND_LIMIT`,
  `SEND_WINDOW_MS`, `PASSWORD_FAILURE_LIMIT`, `PASSWORD_FAILURE_WINDOW_MS`,
  `generateVerificationCode(randomInt: RandomInt): string`,
  `generateGrantToken(randomInt: RandomInt): string`,
  `normaliseVerificationCode(input: string): string | null`,
  `normaliseEmail(input: string): string | null`,
  `codeIdentifier(email: string): string`, `grantIdentifier(email: string): string`,
  `emailFromIdentifier(identifier: string): string | null`,
  `type VerifyStatus = 'verified' | 'rejected' | 'unavailable'`,
  `isGuess(status: VerifyStatus): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/verification-code.test.ts
import { describe, expect, it } from 'vitest';
import {
  GRANT_LENGTH,
  VERIFICATION_CODE_LENGTH,
  codeIdentifier,
  emailFromIdentifier,
  generateGrantToken,
  generateVerificationCode,
  grantIdentifier,
  isGuess,
  normaliseEmail,
  normaliseVerificationCode,
} from './verification-code';

// A counting stand-in for crypto.randomInt: whole numbers in [0, max).
const counter = (start = 0) => {
  let n = start;
  return (max: number) => (n++) % max;
};

describe('generateVerificationCode', () => {
  it('is digits, at the declared length', () => {
    const code = generateVerificationCode(counter());
    expect(code).toHaveLength(VERIFICATION_CODE_LENGTH);
    expect(code).toMatch(/^[0-9]+$/);
  });
});

describe('generateGrantToken', () => {
  it('is at the declared length', () => {
    expect(generateGrantToken(counter())).toHaveLength(GRANT_LENGTH);
  });

  // Not the seeded Rng, and long enough that guessing one is not a strategy.
  it('is far longer than the code it is exchanged for', () => {
    expect(GRANT_LENGTH).toBeGreaterThan(VERIFICATION_CODE_LENGTH * 4);
  });
});

describe('normaliseVerificationCode', () => {
  it('forgives surrounding space', () => {
    expect(normaliseVerificationCode('  123456  ')).toBe('123456');
  });

  it.each([
    ['too short', '12345'],
    ['too long', '1234567'],
    ['letters', '12345a'],
    ['empty', ''],
  ])('refuses %s', (_label, input) => {
    expect(normaliseVerificationCode(input)).toBeNull();
  });
});

describe('normaliseEmail', () => {
  it('folds case and surrounding space', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each([
    ['no at sign', 'ada.example.com'],
    ['two at signs', 'ada@example@com'],
    ['no local part', '@example.com'],
    ['no domain', 'ada@'],
    ['a domain with no dot', 'ada@example'],
    ['internal space', 'ada bell@example.com'],
    ['empty', ''],
  ])('refuses %s', (_label, input) => {
    expect(normaliseEmail(input)).toBeNull();
  });

  it('refuses one longer than an address may be', () => {
    expect(normaliseEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

// The two kinds of row share one table, so the prefix is what keeps a code from
// being spent as a grant.
describe('the identifiers', () => {
  it('round-trips an address through a code identifier', () => {
    expect(emailFromIdentifier(codeIdentifier('ada@example.com'))).toBe('ada@example.com');
  });

  it('round-trips an address through a grant identifier', () => {
    expect(emailFromIdentifier(grantIdentifier('ada@example.com'))).toBe('ada@example.com');
  });

  it('keeps the two apart', () => {
    expect(codeIdentifier('ada@example.com')).not.toBe(grantIdentifier('ada@example.com'));
  });

  it('returns null for an identifier of neither kind', () => {
    expect(emailFromIdentifier('ada@example.com')).toBeNull();
  });
});

describe('isGuess', () => {
  it('counts a rejection', () => {
    expect(isGuess('rejected')).toBe(true);
  });

  // The whole reason the status has three answers: an outage must not spend
  // somebody's attempts and then lock them out on top of it.
  it('does not count a database that could not answer', () => {
    expect(isGuess('unavailable')).toBe(false);
  });

  it('does not count a success', () => {
    expect(isGuess('verified')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/lib/verification-code.test.ts`
Expected: FAIL - `Failed to resolve import "./verification-code"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/verification-code.ts
import type { RandomInt } from './login-code';

/**
 * The code mailed to an address, and the grant it is exchanged for.
 *
 * Beside `login-code.ts` and pure for the same reasons: `now` and the randomness
 * are the caller's, and the caller must pass `crypto.randomInt` rather than the
 * seeded `Rng` - a code somebody can replay is not a code.
 *
 * **Two secrets, not one, and they are different shapes.** The code is six
 * digits because a grown-up reads it out of a mail client and types it into a
 * form, so it is short and the throttle is what makes it safe. The grant is what
 * the code buys - the right to set a password on the address just proved - and
 * nobody ever reads it, so it is long enough that guessing is not a strategy.
 */

export const VERIFICATION_CODE_CHARSET = '0123456789';
export const VERIFICATION_CODE_LENGTH = 6;

/** Long enough to find the mail, short enough that a forwarded one is stale. */
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export const GRANT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const GRANT_LENGTH = 32;

/** The last screen is the next thing they do, so this is short on purpose. */
export const GRANT_TTL_MS = 10 * 60 * 1000;

/**
 * Wrong codes allowed per window, keyed by address *and* by browser.
 *
 * Six digits is a million codes, which single use and ten minutes do not cover
 * on their own. Keying by address is safe here where it is not on a password
 * sign-in: what it slows is an attempt to take over an address, and it locks
 * nobody out of an account they already hold - a parent with a password still
 * signs in, and a parent with Google still signs in.
 */
export const CODE_FAILURE_LIMIT = 5;
export const CODE_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** So the form cannot be used to mail somebody over and over. */
export const SEND_LIMIT = 5;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

/**
 * Failed password sign-ins per browser, and **not** per address.
 *
 * Counting per account hands an attacker a way to lock a named parent out of
 * their own account, which is the objection CLAUDE.md already makes to a global
 * ceiling, narrowed to one person.
 */
export const PASSWORD_FAILURE_LIMIT = 10;
export const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** What came of checking a code. Three answers, for `RedeemStatus`'s reason. */
export type VerifyStatus = 'verified' | 'rejected' | 'unavailable';

/** Only a rejection is somebody guessing. See `login-code.ts`'s `isGuess`. */
export function isGuess(status: VerifyStatus): boolean {
  return status === 'rejected';
}

function draw(charset: string, length: number, randomInt: RandomInt): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += charset[randomInt(charset.length)];
  return out;
}

export function generateVerificationCode(randomInt: RandomInt): string {
  return draw(VERIFICATION_CODE_CHARSET, VERIFICATION_CODE_LENGTH, randomInt);
}

export function generateGrantToken(randomInt: RandomInt): string {
  return draw(GRANT_CHARSET, GRANT_LENGTH, randomInt);
}

export function normaliseVerificationCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length !== VERIFICATION_CODE_LENGTH) return null;
  for (const char of trimmed) {
    if (!VERIFICATION_CODE_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

/** The longest an address may be, per RFC 5321. */
const MAX_EMAIL_LENGTH = 254;

/**
 * What was typed, as an address - or null if it could never be one.
 *
 * Case is folded, which is lossy in theory: the local part of an address is
 * case-sensitive to the letter of the specification and to no mail provider in
 * practice. It is folded because this string is the key two sign-in paths match
 * on, and `Ada@` failing to find the row `ada@` made would be the bug.
 *
 * The shape test is deliberately loose. An address is proved by mailing it, not
 * by a regular expression, and every regular expression that tries refuses
 * somebody's real address.
 */
export function normaliseEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;
  if (/\s/.test(trimmed)) return null;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (local.length === 0 || domain.length === 0) return null;
  if (!domain.includes('.')) return null;
  if (domain.startsWith('.') || domain.endsWith('.')) return null;
  return trimmed;
}

/**
 * Both kinds of row live in Auth.js's `VerificationToken` table, which has no
 * column saying which kind it is - so the prefix on `identifier` is what keeps a
 * code from being spendable as a grant.
 */
const CODE_PREFIX = 'password-code:';
const GRANT_PREFIX = 'password-grant:';

export function codeIdentifier(email: string): string {
  return `${CODE_PREFIX}${email}`;
}

export function grantIdentifier(email: string): string {
  return `${GRANT_PREFIX}${email}`;
}

export function emailFromIdentifier(identifier: string): string | null {
  if (identifier.startsWith(CODE_PREFIX)) return identifier.slice(CODE_PREFIX.length);
  if (identifier.startsWith(GRANT_PREFIX)) return identifier.slice(GRANT_PREFIX.length);
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project unit src/lib/verification-code.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verification-code.ts src/lib/verification-code.test.ts
git commit -m "Add the mailed code and the grant it is exchanged for"
```

---

### Task 3: The table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `ParentPassword { userId String @id, hash String, createdAt DateTime, updatedAt DateTime }`
  and `password ParentPassword?` on `User`.

- [ ] **Step 1: Add the model**

In `prisma/schema.prisma`, beside `ChildPhoto`:

```prisma
/// A grown-up's password, hashed with scrypt.
///
/// A table rather than a column on `User`, for `ChildPhoto`'s reason: the
/// Auth.js adapter selects whole `User` rows on every authenticated request,
/// and a password hash has no business riding along with a session lookup. It
/// is joined only by the one query that checks a password.
///
/// `userId` is the primary key, so a parent has one password or none. Only ever
/// set on a row with `role = 'parent'`: a child has no email and so no way to
/// reach the flow that writes this.
model ParentPassword {
  userId    String   @id
  /// `scrypt$N$r$p$salt$key` - see `src/lib/password.ts`. The cost parameters
  /// travel with the hash so raising them later strands nothing.
  hash      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

And on `User`, beside `photo ChildPhoto?`:

```prisma
  /// The password a grown-up set, if they set one. A row of its own - see
  /// `ParentPassword`.
  password ParentPassword?
```

- [ ] **Step 2: Generate the migration SQL offline — do NOT run `db:migrate`**

**`npm run db:migrate` is forbidden in this task.** The only `DATABASE_URL` in
`.env` is the production Neon database - CLAUDE.md calls it "the one connection
the app has", and preview deployments are disabled precisely because they "read
and write real children's records". `prisma migrate dev` would run against it,
and offers to *reset* a database when it detects drift. The migration is authored
offline instead and proved against Testcontainers in Step 4.

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
mkdir -p prisma/migrations/20260905000000_parent_password
npx prisma migrate diff \
  --from-schema /tmp/schema-before.prisma \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/20260905000000_parent_password/migration.sql
```

The timestamp sorts after the latest existing migration
(`20260830100000_child_subjects`). The generated file must be exactly this, and
nothing else - no `CREATE SCHEMA`, no other table. This output was verified on
this checkout before the task was written:

```sql
-- CreateTable
CREATE TABLE "ParentPassword" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentPassword_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "ParentPassword" ADD CONSTRAINT "ParentPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

If the diff emits anything beyond those two statements, stop and report - it
means the schema edit in Step 1 did more than intended.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npm run db:generate`
Expected: success. This needs no database.

Then confirm the model reached the client:

```bash
grep -rn "ParentPassword" src/generated/prisma/*.ts | head -3
```
Expected: at least one hit.

- [ ] **Step 4: Prove the migration against a real Postgres**

Run: `npm run test:db`
Expected: PASS. This is the step that replaces `migrate dev`: the `db` project's
`globalSetup` starts a Postgres in Testcontainers and applies **every** migration
in order, so a migration that does not apply cleanly fails here - against a
throwaway container rather than against Neon. Docker must be running.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Give a parent a password, in a table of its own"
```

**Applying this to production is not part of this task and not yours to do.** It
ships the way every other migration ships, through `npm run db:deploy` on a
release.

---

### Task 4: Signing in with a password

**Files:**
- Create: `src/server/passwords.ts`
- Test: `src/server/passwords.test.ts`
- Modify: `src/server/test-helpers/factories.ts`

**Interfaces:**
- Consumes: Task 1's `hashPassword`, `verifyPassword`; Task 3's `ParentPassword`.
- Produces: `signInWithPassword(email: string, password: string, now?: Date): Promise<PasswordSignInResult>`,
  where `PasswordSignInResult` is
  `{ status: 'authenticated'; session: { token: string; expires: Date; userId: string } } | { status: 'rejected' } | { status: 'unavailable' }`;
  and `makePassword(userId: string, password: string): Promise<void>` in the factories.

- [ ] **Step 1: Add the factory**

In `src/server/test-helpers/factories.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { hashPassword } from '@/lib/password';

/** A password on an existing account, written the way the app writes one. */
export async function makePassword(userId: string, password: string): Promise<void> {
  await testPrisma().parentPassword.create({
    data: { userId, hash: await hashPassword(password, randomBytes) },
  });
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/server/passwords.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent, makePassword } from './test-helpers/factories';
import { signInWithPassword } from './passwords';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('signInWithPassword', () => {
  it('authenticates a parent with the right password', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('ada@example.com', 'correct horse battery');

    expect(result.status).toBe('authenticated');
    if (result.status !== 'authenticated') return;
    expect(result.session.userId).toBe(parentId);
  });

  // The session it writes is the row the Prisma adapter would have written, so
  // `auth()` cannot tell this path from Google's.
  it('writes a Session row auth() can read', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('ada@example.com', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    const session = await testPrisma().session.findUnique({
      where: { sessionToken: result.session.token },
    });
    expect(session?.userId).toBe(parentId);
  });

  it('folds the case of the address', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('  Ada@Example.com ', 'correct horse battery');
    expect(result.status).toBe('authenticated');
  });

  it('refuses the wrong password', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    expect((await signInWithPassword('ada@example.com', 'wrong')).status).toBe('rejected');
  });

  // Same answer as a wrong password, deliberately: a different one would turn
  // this form into a way to ask whether an address has an account here.
  it('refuses an address with no account', async () => {
    expect((await signInWithPassword('nobody@example.com', 'anything at all')).status)
      .toBe('rejected');
  });

  it('refuses a parent who has no password', async () => {
    await makeParent({ email: 'ada@example.com' });
    expect((await signInWithPassword('ada@example.com', 'anything at all')).status)
      .toBe('rejected');
  });

  // A child cannot reach the flow that sets one, so this is a row that should
  // not exist - and it is refused on the role rather than on the absence.
  it('refuses a child, even holding a password', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { email: 'kid@example.com' },
    });
    await makePassword(childId, 'correct horse battery');

    expect((await signInWithPassword('kid@example.com', 'correct horse battery')).status)
      .toBe('rejected');
  });

  it('refuses an address that was never verified', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');
    await testPrisma().user.update({
      where: { id: parentId },
      data: { emailVerified: null },
    });

    expect((await signInWithPassword('ada@example.com', 'correct horse battery')).status)
      .toBe('rejected');
  });

  it('refuses an address that will not normalise', async () => {
    expect((await signInWithPassword('not an address', 'anything at all')).status)
      .toBe('rejected');
  });
});
```

Note: `makeParent` in `factories.ts` does not set `emailVerified`. Add
`emailVerified: new Date()` to it as part of this task, since every parent this
app makes has a verified address - Google verifies one, and this flow verifies
the other. The test above then sets it back to null explicitly for the one case
that is about its absence.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:db -- src/server/passwords.test.ts`
Expected: FAIL - `Failed to resolve import "./passwords"`. Docker must be
running.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/server/passwords.ts
import { randomUUID } from 'node:crypto';
import { prisma } from './db';
import { normaliseEmail } from '@/lib/verification-code';
import { verifyPassword } from '@/lib/password';

/**
 * The Prisma side of signing in with a password.
 *
 * A sibling of `accounts.ts` rather than more of it, the way `sharing.ts` is.
 *
 * **This is not an Auth.js provider**, and cannot be: Auth.js refuses a
 * Credentials provider alongside database sessions (`UnsupportedStrategy`). So
 * it does what `redeemLoginCode` does - writes the very `Session` row the Prisma
 * adapter would have written - and `src/app/actions.ts` sets the cookie. `auth()`
 * cannot tell the three paths apart, which is the property worth preserving.
 */

/** A session made this way does not expire on a schedule. See `accounts.ts`. */
const SESSION_LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1000;

export type PasswordSignInResult =
  | { status: 'authenticated'; session: { token: string; expires: Date; userId: string } }
  /** The address, the password, or the account is wrong. One answer for all three. */
  | { status: 'rejected' }
  /** No database, or a read that threw. Never reported as a wrong password. */
  | { status: 'unavailable' };

export async function signInWithPassword(
  email: string,
  password: string,
  now = new Date(),
): Promise<PasswordSignInResult> {
  if (!prisma) return { status: 'unavailable' };

  const address = normaliseEmail(email);
  if (!address) return { status: 'rejected' };

  const db = prisma;
  try {
    const user = await db.user.findUnique({
      where: { email: address },
      select: {
        id: true,
        role: true,
        emailVerified: true,
        password: { select: { hash: true } },
      },
    });

    // One answer for four different failures. Telling them apart would make
    // this form a way to ask whether an address has an account here.
    if (!user) return { status: 'rejected' };
    if (user.role !== 'parent') return { status: 'rejected' };
    if (!user.emailVerified) return { status: 'rejected' };
    if (!user.password) return { status: 'rejected' };

    if (!(await verifyPassword(password, user.password.hash))) return { status: 'rejected' };

    const token = randomUUID();
    const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await db.session.create({ data: { sessionToken: token, userId: user.id, expires } });
    return { status: 'authenticated', session: { token, expires, userId: user.id } };
  } catch (error) {
    // `redeemLoginCode`'s reason: Neon accepts a connection while its compute is
    // still waking, so a read here can throw against a database that is fine a
    // second later. Telling somebody their password is wrong for that is the
    // lie the three-answer status exists to prevent.
    console.error('Failed to sign in with a password', error);
    return { status: 'unavailable' };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:db -- src/server/passwords.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Run the whole `db` project**

Run: `npm run test:db`
Expected: PASS. This step exists because Step 1 changed `makeParent`, which every
other file in the project builds its fixtures with - `accounts.test.ts`,
`records.test.ts`, `sharing.test.ts` and the rest. Setting `emailVerified` on
every parent should break nothing, and this is where you find out rather than two
tasks later.

- [ ] **Step 7: Commit**

```bash
git add src/server/passwords.ts src/server/passwords.test.ts src/server/test-helpers/factories.ts
git commit -m "Sign a parent in with a password, without an Auth.js provider"
```

---

### Task 5: The code and the grant, in the database

**Files:**
- Modify: `src/server/passwords.ts`
- Modify: `src/server/passwords.test.ts`

**Interfaces:**
- Consumes: Task 2's identifiers and TTLs, Task 1's `hashPassword`.
- Produces:
  `issueVerificationCode(email: string, code: string, now?: Date): Promise<boolean>`,
  `spendVerificationCode(email: string, code: string, grant: string, now?: Date): Promise<VerifyStatus>`,
  `setPasswordWithGrant(grant: string, password: string, now?: Date): Promise<PasswordSignInResult>`.

- [ ] **Step 1: Write the failing test**

Append to `src/server/passwords.test.ts`:

```ts
import {
  codeIdentifier,
  grantIdentifier,
} from '@/lib/verification-code';
import {
  issueVerificationCode,
  setPasswordWithGrant,
  spendVerificationCode,
} from './passwords';

describe('issueVerificationCode', () => {
  it('stores a code against the address', async () => {
    expect(await issueVerificationCode('ada@example.com', '123456')).toBe(true);

    const row = await testPrisma().verificationToken.findFirst({
      where: { identifier: codeIdentifier('ada@example.com') },
    });
    expect(row?.token).toBe('123456');
  });

  // Asking for a second code must not leave the first one working: a code lying
  // around in an old mail is a live credential nobody is watching.
  it('replaces a code already outstanding for the address', async () => {
    await issueVerificationCode('ada@example.com', '111111');
    await issueVerificationCode('ada@example.com', '222222');

    const rows = await testPrisma().verificationToken.findMany({
      where: { identifier: codeIdentifier('ada@example.com') },
    });
    expect(rows.map((row) => row.token)).toEqual(['222222']);
  });

  it('writes nothing for an address that will not normalise', async () => {
    expect(await issueVerificationCode('not an address', '123456')).toBe(false);
    expect(await testPrisma().verificationToken.count()).toBe(0);
  });
});

describe('spendVerificationCode', () => {
  it('verifies the right code and leaves a grant', async () => {
    await issueVerificationCode('ada@example.com', '123456');

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-token'))
      .toBe('verified');

    const grant = await testPrisma().verificationToken.findFirst({
      where: { identifier: grantIdentifier('ada@example.com') },
    });
    expect(grant?.token).toBe('grant-token');
  });

  it('spends the code, so it cannot be used twice', async () => {
    await issueVerificationCode('ada@example.com', '123456');
    await spendVerificationCode('ada@example.com', '123456', 'grant-one');

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-two'))
      .toBe('rejected');
  });

  it('rejects the wrong code', async () => {
    await issueVerificationCode('ada@example.com', '123456');
    expect(await spendVerificationCode('ada@example.com', '999999', 'grant-token'))
      .toBe('rejected');
  });

  it('rejects a code that has run out', async () => {
    const issued = new Date('2026-09-05T10:00:00Z');
    const late = new Date('2026-09-05T11:00:00Z');
    await issueVerificationCode('ada@example.com', '123456', issued);

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-token', late))
      .toBe('rejected');
  });

  it("rejects another address's code", async () => {
    await issueVerificationCode('ada@example.com', '123456');
    expect(await spendVerificationCode('bob@example.com', '123456', 'grant-token'))
      .toBe('rejected');
  });
});

describe('setPasswordWithGrant', () => {
  const verified = async (email: string, grant: string) => {
    await issueVerificationCode(email, '123456');
    await spendVerificationCode(email, '123456', grant);
  };

  it('creates a parent when the address is unknown', async () => {
    await verified('ada@example.com', 'grant-token');

    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    expect(result.status).toBe('authenticated');

    const user = await testPrisma().user.findUnique({ where: { email: 'ada@example.com' } });
    expect(user?.role).toBe('parent');
    expect(user?.emailVerified).not.toBeNull();
  });

  it('signs them straight in', async () => {
    await verified('ada@example.com', 'grant-token');
    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    const session = await testPrisma().session.findUnique({
      where: { sessionToken: result.session.token },
    });
    expect(session?.userId).toBe(result.session.userId);
  });

  it('leaves a password that signs in afterwards', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'correct horse battery');

    expect((await signInWithPassword('ada@example.com', 'correct horse battery')).status)
      .toBe('authenticated');
  });

  // Row two of the spec's table: the Google parent gets a password on the
  // account they already have, rather than a second one.
  it('attaches to the account an address already has', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await verified('ada@example.com', 'grant-token');

    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    expect(result.session.userId).toBe(parentId);
    expect(await testPrisma().user.count()).toBe(1);
  });

  // Row three: this is password reset, and it is the same three screens.
  it('replaces a password that is already there', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'the old password');
    await verified('ada@example.com', 'grant-token');

    await setPasswordWithGrant('grant-token', 'the new password');

    expect((await signInWithPassword('ada@example.com', 'the old password')).status)
      .toBe('rejected');
    expect((await signInWithPassword('ada@example.com', 'the new password')).status)
      .toBe('authenticated');
  });

  it('claims the parent role on an account that never had one', async () => {
    const user = await testPrisma().user.create({
      data: { email: 'ada@example.com', name: 'Ada' },
    });
    await verified('ada@example.com', 'grant-token');

    await setPasswordWithGrant('grant-token', 'correct horse battery');

    const after = await testPrisma().user.findUnique({ where: { id: user.id } });
    expect(after?.role).toBe('parent');
  });

  it('refuses to put a password on a child', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { email: 'kid@example.com' },
    });
    await verified('kid@example.com', 'grant-token');

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery')).status)
      .toBe('rejected');
    expect(await testPrisma().parentPassword.count()).toBe(0);
  });

  it('spends the grant, so it cannot be used twice', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'correct horse battery');

    expect((await setPasswordWithGrant('grant-token', 'another password')).status)
      .toBe('rejected');
  });

  it('rejects a grant that has run out', async () => {
    const issued = new Date('2026-09-05T10:00:00Z');
    const late = new Date('2026-09-05T11:00:00Z');
    await issueVerificationCode('ada@example.com', '123456', issued);
    await spendVerificationCode('ada@example.com', '123456', 'grant-token', issued);

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery', late)).status)
      .toBe('rejected');
  });

  it('rejects a password too short to be one', async () => {
    await verified('ada@example.com', 'grant-token');
    expect((await setPasswordWithGrant('grant-token', 'short')).status).toBe('rejected');
    expect(await testPrisma().parentPassword.count()).toBe(0);
  });

  // A refused password must not burn the grant - the grown-up is standing at
  // the screen and will type another one.
  it('leaves the grant alive after a refused password', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'short');

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery')).status)
      .toBe('authenticated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:db -- src/server/passwords.test.ts`
Expected: FAIL - `issueVerificationCode is not a function` and the rest.

- [ ] **Step 3: Write minimal implementation**

Append to `src/server/passwords.ts`. **Merge these imports into the ones Task 4
already wrote** rather than adding a second `import` from `node:crypto` - the
file needs `randomUUID` and `randomBytes` from it, and `normaliseEmail` is
already imported there.

```ts
import { randomBytes } from 'node:crypto';
import { hashPassword, parsePassword } from '@/lib/password';
import {
  GRANT_TTL_MS,
  VERIFICATION_CODE_TTL_MS,
  type VerifyStatus,
  codeIdentifier,
  emailFromIdentifier,
  grantIdentifier,
  normaliseVerificationCode,
} from '@/lib/verification-code';

/**
 * Both kinds of row live in Auth.js's own `VerificationToken` table, which has
 * been in the schema since it was written and unused, because this app has never
 * had an email provider. The prefix on `identifier` is what keeps a code from
 * being spendable as a grant - see `verification-code.ts`.
 */

/**
 * Issuing replaces rather than adds. A code left working after a second one was
 * asked for is a live credential sitting in an old mail nobody is watching.
 */
export async function issueVerificationCode(
  email: string,
  code: string,
  now = new Date(),
): Promise<boolean> {
  if (!prisma) return false;
  const address = normaliseEmail(email);
  if (!address) return false;

  const db = prisma;
  try {
    const identifier = codeIdentifier(address);
    await db.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { identifier } });
      await tx.verificationToken.create({
        data: { identifier, token: code, expires: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS) },
      });
    });
    return true;
  } catch (error) {
    console.error('Failed to issue a verification code', error);
    return false;
  }
}

/**
 * The code is spent in the same transaction the grant is written in, so a code
 * cannot buy two grants however fast it is submitted twice.
 */
export async function spendVerificationCode(
  email: string,
  code: string,
  grant: string,
  now = new Date(),
): Promise<VerifyStatus> {
  if (!prisma) return 'unavailable';
  const address = normaliseEmail(email);
  const typed = normaliseVerificationCode(code);
  if (!address || !typed) return 'rejected';

  const db = prisma;
  try {
    return await db.$transaction<VerifyStatus>(async (tx) => {
      const spent = await tx.$queryRaw<{ identifier: string }[]>`
        DELETE FROM "VerificationToken"
        WHERE "identifier" = ${codeIdentifier(address)}
          AND "token" = ${typed}
          AND "expires" > ${now}
        RETURNING "identifier"
      `;
      if (spent.length === 0) return 'rejected';

      const identifier = grantIdentifier(address);
      await tx.verificationToken.deleteMany({ where: { identifier } });
      await tx.verificationToken.create({
        data: { identifier, token: grant, expires: new Date(now.getTime() + GRANT_TTL_MS) },
      });
      return 'verified';
    });
  } catch (error) {
    console.error('Failed to spend a verification code', error);
    return 'unavailable';
  }
}

/**
 * The last step, and the one that decides which of the spec's four states the
 * address was in. The grant is only spent once a password has been accepted:
 * a refused password leaves it alive, because the grown-up is standing at the
 * screen and will type another one.
 */
export async function setPasswordWithGrant(
  grant: string,
  password: string,
  now = new Date(),
): Promise<PasswordSignInResult> {
  if (!prisma) return { status: 'unavailable' };

  const chosen = parsePassword(password);
  if (!chosen) return { status: 'rejected' };

  const db = prisma;
  try {
    const held = await db.verificationToken.findUnique({ where: { token: grant } });
    if (!held || held.expires <= now) return { status: 'rejected' };

    const address = emailFromIdentifier(held.identifier);
    if (!address || held.identifier !== grantIdentifier(address)) return { status: 'rejected' };

    const hash = await hashPassword(chosen, randomBytes);
    const token = randomUUID();
    const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);

    return await db.$transaction<PasswordSignInResult>(async (tx) => {
      const spent = await tx.verificationToken.deleteMany({ where: { token: grant } });
      // Somebody else spent it between the read above and here.
      if (spent.count === 0) return { status: 'rejected' };

      const existing = await tx.user.findUnique({
        where: { email: address },
        select: { id: true, role: true },
      });

      let userId: string;
      if (!existing) {
        // Created with the role already set, which is a different statement
        // from `claimParentRole`'s compare-and-set and has nothing to race.
        const created = await tx.user.create({
          data: { email: address, emailVerified: now, role: 'parent' },
          select: { id: true },
        });
        userId = created.id;
      } else {
        if (existing.role === 'child') return { status: 'rejected' };
        // The healing case, for an account that predates the role column.
        await tx.user.update({
          where: { id: existing.id },
          data: { emailVerified: now, ...(existing.role === null ? { role: 'parent' } : {}) },
        });
        userId = existing.id;
      }

      await tx.parentPassword.upsert({
        where: { userId },
        create: { userId, hash },
        update: { hash },
      });

      await tx.session.create({ data: { sessionToken: token, userId, expires } });
      return { status: 'authenticated', session: { token, expires, userId } };
    });
  } catch (error) {
    console.error('Failed to set a password', error);
    return { status: 'unavailable' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:db -- src/server/passwords.test.ts`
Expected: PASS, all cases including Task 4's.

- [ ] **Step 5: Commit**

```bash
git add src/server/passwords.ts src/server/passwords.test.ts
git commit -m "Exchange a mailed code for a grant, and a grant for a password"
```

---

### Task 6: The sender

**Files:**
- Create: `src/server/email.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sendVerificationCode(to: string, code: string): Promise<boolean>`.

**This task provisions a real integration.** Do not write a mock, a
`.env.example`-only stand-in, or a `console.log` sender and "wire it later".

- [ ] **Step 1: Provision Resend through the Marketplace**

```bash
vercel link
vercel integration add resend/resend-email --yes --no-claim
```

If the CLI hands off to a dashboard or browser step, **stop and ask the user to
finish it there**, then continue. Then:

```bash
vercel env pull --yes
vercel integration guide resend/resend-email --framework nextjs
```

- [ ] **Step 2: Read the guide before writing the call**

The guide printed above is the authority on the environment variable's name and
the shape of the call. The implementation below assumes `RESEND_API_KEY`; if the
guide says otherwise, follow the guide and adjust.

- [ ] **Step 3: Write the sender**

```ts
// src/server/email.ts
import 'server-only';

/**
 * The one place this app sends mail from.
 *
 * A seam rather than a spread: one function, so the provider is swappable
 * without anything above it knowing who sends the mail. That matters more than
 * usual here, because the AWS migration may later replace Resend with SES and
 * this is the whole of what would change.
 *
 * **Best-effort in the same sense the play writes are**, with one difference
 * that matters: the caller is told whether it worked. A code that was never
 * sent leaves a grown-up staring at an empty inbox, so the screen says the mail
 * could not be sent rather than telling them to check their spam folder.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export const isEmailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  if (!isEmailConfigured) {
    console.error('Cannot send a verification code: no mail provider is configured');
    return false;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject: `${code} is your LearnR code`,
        // The code is in the subject as well as the body, so it can be read off
        // a notification without opening anything.
        text: [
          `Your LearnR code is ${code}.`,
          '',
          'Type it into the page you left open. It stops working in ten minutes.',
          '',
          "If you didn't ask for this, you can ignore it - nothing has changed.",
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      console.error('Failed to send a verification code', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to send a verification code', error);
    return false;
  }
}
```

- [ ] **Step 4: Add the variables to `.env.example`**

```
# Resend, via the Vercel Marketplace: `vercel integration add resend/resend-email`.
# Without these the sign-up flow refuses to start rather than pretending to mail.
RESEND_API_KEY=
# The address the code is sent from. Its domain must be verified in Resend;
# `onboarding@resend.dev` works while the only recipient is your own address.
EMAIL_FROM=
```

- [ ] **Step 5: Send one, by hand**

```bash
npx tsx -e "import('./src/server/email.ts').then(m => m.sendVerificationCode('<your address>', '123456')).then(console.log)"
```
Expected: `true`, and the mail arrives. If it returns `false`, read the logged
status - a 403 is usually an unverified `from` domain.

- [ ] **Step 6: Commit**

```bash
git add src/server/email.ts .env.example
git commit -m "Send the verification code, through one function"
```

---

### Task 7: The three actions

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 6.
- Produces:
  `sendPasswordCodeAction(email: string): Promise<{ error: string } | null>`,
  `checkPasswordCodeAction(email: string, code: string): Promise<{ error: string } | null>`,
  `setPasswordAction(password: string): Promise<{ error: string } | null>`,
  `signInWithPasswordAction(email: string, password: string): Promise<{ error: string } | null>`,
  and the cookie name `PASSWORD_GRANT_COOKIE`.

There are no tests in this task. See **On testing the actions and the screens**
at the head of this plan: these are thin glue over modules already tested hard,
and the repository has no harness for actions. Keep them thin - if logic appears
here that wants a test, move it into `src/lib/` or `src/server/passwords.ts`.

- [ ] **Step 1: Add the throttles and the cookie name**

Near the top of `src/app/actions.ts`, beside the existing `redeemFailures`:

```ts
import { randomInt, randomBytes } from 'node:crypto';
import {
  CODE_FAILURE_LIMIT,
  CODE_FAILURE_WINDOW_MS,
  GRANT_TTL_MS,
  PASSWORD_FAILURE_LIMIT,
  PASSWORD_FAILURE_WINDOW_MS,
  SEND_LIMIT,
  SEND_WINDOW_MS,
  generateGrantToken,
  generateVerificationCode,
  isGuess as isCodeGuess,
  normaliseEmail,
} from '@/lib/verification-code';
import {
  issueVerificationCode,
  setPasswordWithGrant,
  signInWithPassword,
  spendVerificationCode,
} from '@/server/passwords';
import { sendVerificationCode } from '@/server/email';

/** So the form cannot be used to mail somebody over and over. */
const codeSends = createThrottle({ limit: SEND_LIMIT, windowMs: SEND_WINDOW_MS });
/** Six digits is a million codes; the window is what makes that enough. */
const codeGuesses = createThrottle({ limit: CODE_FAILURE_LIMIT, windowMs: CODE_FAILURE_WINDOW_MS });
/** By browser only - see `PASSWORD_FAILURE_LIMIT` for why not by address. */
const passwordGuesses = createThrottle({
  limit: PASSWORD_FAILURE_LIMIT,
  windowMs: PASSWORD_FAILURE_WINDOW_MS,
});

/**
 * The grant rides in an HttpOnly cookie rather than the URL. It is a credential
 * - it buys the right to set a password on an address - and a URL lands in
 * history and in a log.
 */
export const PASSWORD_GRANT_COOKIE = 'learnr-password-grant';
```

- [ ] **Step 2: Write the four actions**

```ts
/**
 * Step one: the address. The answer is the same whether the address is known,
 * unknown or nonsense, because a different one would make this form a way to
 * ask whether somebody has an account here.
 */
export async function sendPasswordCodeAction(email: string): Promise<{ error: string } | null> {
  const address = normaliseEmail(email);
  if (!address) return { error: "That doesn't look like an email address." };

  const bag = await headers();
  const browser = browserIp(bag.get('x-real-ip'), bag.get('x-forwarded-for'));
  const now = Date.now();

  // Keyed by address as well as browser here, unlike the sign-in below: what
  // this limits is mail sent to somebody, so the address is the thing to count.
  if (codeSends.blocked(address, now) || (browser && codeSends.blocked(browser, now))) {
    return { error: 'Too many codes asked for. Wait a little while and try again.' };
  }
  codeSends.fail(address, now);
  if (browser) codeSends.fail(browser, now);

  const code = generateVerificationCode(randomInt);
  if (!(await issueVerificationCode(address, code))) {
    return { error: 'Something went wrong. Wait a moment and try again.' };
  }
  if (!(await sendVerificationCode(address, code))) {
    // Said plainly rather than "check your spam folder": the mail was never
    // sent, and sending them to look for it wastes their time.
    return { error: "We couldn't send that email. Wait a moment and try again." };
  }
  return null;
}

/**
 * Step two: the code. On success the grant goes into an HttpOnly cookie and the
 * screen moves on.
 */
export async function checkPasswordCodeAction(
  email: string,
  code: string,
): Promise<{ error: string } | null> {
  const address = normaliseEmail(email);
  if (!address) return { error: 'That code doesn’t work. Ask for a new one.' };

  const bag = await headers();
  const browser = browserIp(bag.get('x-real-ip'), bag.get('x-forwarded-for'));
  const now = Date.now();

  if (codeGuesses.blocked(address, now) || (browser && codeGuesses.blocked(browser, now))) {
    return { error: 'Too many tries. Wait a few minutes and ask for a new code.' };
  }

  const grant = generateGrantToken(randomInt);
  const status = await spendVerificationCode(address, code, grant);

  if (status !== 'verified') {
    // Only a rejection is somebody guessing. An unreachable database must not
    // spend the attempts of the person it is failing.
    if (isCodeGuess(status)) {
      codeGuesses.fail(address, now);
      if (browser) codeGuesses.fail(browser, now);
    }
    return {
      error:
        status === 'rejected'
          ? "That code doesn't work. Check it, or ask for a new one."
          : 'Something went wrong. Wait a moment and try the same code again.',
    };
  }

  codeGuesses.clear(address);
  if (browser) codeGuesses.clear(browser);

  const store = await cookies();
  store.set(PASSWORD_GRANT_COOKIE, grant, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(Date.now() + GRANT_TTL_MS),
  });
  return null;
}

/** Step three: the password. Setting one signs them in - they just proved the address. */
export async function setPasswordAction(password: string): Promise<{ error: string } | null> {
  const store = await cookies();
  const grant = store.get(PASSWORD_GRANT_COOKIE)?.value;
  if (!grant) return { error: 'That took too long. Start again and we will send a new code.' };

  const result = await setPasswordWithGrant(grant, password);

  if (result.status === 'unavailable') {
    return { error: 'Something went wrong. Wait a moment and try again.' };
  }
  if (result.status === 'rejected') {
    // The grant survives a refused password - see `setPasswordWithGrant`.
    return {
      error: `Choose a password of at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  store.delete(PASSWORD_GRANT_COOKIE);
  store.set(SESSION_COOKIE_NAME, result.session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: result.session.expires,
  });
  revalidatePath('/');
  return null;
}

/** Signing in with one. Throttled by browser only - never by address. */
export async function signInWithPasswordAction(
  email: string,
  password: string,
): Promise<{ error: string } | null> {
  const bag = await headers();
  const browser = browserIp(bag.get('x-real-ip'), bag.get('x-forwarded-for'));
  const now = Date.now();

  if (browser && passwordGuesses.blocked(browser, now)) {
    return { error: 'Too many tries. Wait a few minutes and have another go.' };
  }

  const result = await signInWithPassword(email, password);

  if (result.status !== 'authenticated') {
    if (browser && result.status === 'rejected') passwordGuesses.fail(browser, now);
    return {
      error:
        result.status === 'rejected'
          ? "That email address and password don't match an account."
          : 'Something went wrong. Wait a moment and try again.',
    };
  }

  if (browser) passwordGuesses.clear(browser);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, result.session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: result.session.expires,
  });
  revalidatePath('/');
  return null;
}
```

Import `PASSWORD_MIN_LENGTH` from `@/lib/password` at the top of the file.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts
git commit -m "Wire the password flow up, with a throttle on each of its three doors"
```

---

### Task 8: The four screens

**Files:**
- Create: `src/components/password-forms.tsx`
- Create: `src/app/signin/password/page.tsx`
- Create: `src/app/password/new/page.tsx`
- Create: `src/app/password/code/page.tsx`
- Create: `src/app/password/set/page.tsx`

**Interfaces:**
- Consumes: Task 7's four actions, `PASSWORD_MIN_LENGTH`,
  `VERIFICATION_CODE_LENGTH`.
- Produces: `PasswordSignInForm`, `EmailStepForm`, `CodeStepForm`,
  `PasswordStepForm`.

No tests - see the note at the head of the plan.

- [ ] **Step 1: Write the forms**

`src/components/password-forms.tsx`, `'use client'`. Follow
`src/components/code-sign-in.tsx` exactly for shape: local `useState` for the
field and the error, `useTransition` for pending, an inline error rather than a
navigation, and `router.refresh()` or `router.push()` on success.

`EmailStepForm` in full, as the pattern the other three follow:

```tsx
'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordCodeAction } from '@/app/actions';

/**
 * Step one of three. The answer is the same whether the address is known,
 * unknown or nonsense - so this screen always moves on, and the only thing that
 * holds it back is the mail failing to send.
 */
export function EmailStepForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.length === 0) return;

    setError(null);
    startTransition(async () => {
      const result = await sendPasswordCodeAction(email);
      if (result) {
        setError(result.error);
        return;
      }
      router.push(`/password/code?email=${encodeURIComponent(email)}`);
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-(--color-ink-soft)">
        Your email address
      </label>
      <input
        id={id}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-base"
      />
      {error ? (
        <p role="alert" className="text-sm text-(--color-wrong)">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || email.length === 0}
        className="rounded-xl bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Sending...' : 'Send me a code'}
      </button>
    </form>
  );
}
```

The other three are the same shape with a different field, a different action and
a different destination:

- `PasswordSignInForm` - email and password, calls `signInWithPasswordAction`,
  `router.refresh()` on success. Carries a "Forgot your password?" link to
  `/password/new`.
- `EmailStepForm` - one email field, calls `sendPasswordCodeAction`, then
  `router.push('/password/code?email=' + encodeURIComponent(address))`.
- `CodeStepForm` - takes `email` as a prop, one code field of
  `VERIFICATION_CODE_LENGTH` digits with `inputMode="numeric"`, calls
  `checkPasswordCodeAction`, then `router.push('/password/set')`. Carries a
  "Send another code" link back to `/password/new`.
- `PasswordStepForm` - one password field with `minLength={PASSWORD_MIN_LENGTH}`
  and `autoComplete="new-password"`, calls `setPasswordAction`, then
  `router.push('/')` and `router.refresh()`.

Use `type="email"` with `autoComplete="email"` on every address field, and
`autoComplete="current-password"` on the sign-in one, so a password manager
behaves.

- [ ] **Step 2: Write the four pages**

Each is a server component in the shape of `src/app/signin/page.tsx`: the logo
lockup, one `rounded-2xl` card holding the form, and a link back. Each carries
`export const dynamic = 'force-dynamic'` for the reason `/signin` does, and each
redirects a signed-in visitor to `/` - signing in again is meaningless.

- `/signin/password` - "Sign in with a password".
- `/password/new` - "Set a password", one line saying a code is coming and that
  this is also how a forgotten password is replaced.
- `/password/code` - reads `?email=` through `normaliseEmail` and redirects to
  `/password/new` if it will not normalise. Says which address the code went to.
- `/password/set` - "Choose a password", with the minimum length said before it
  is typed rather than after it is refused.

- [ ] **Step 3: Walk the flow in a browser**

Run: `npm run dev`, then:
1. `/password/new` with a fresh address → the code arrives → `/password/code` →
   `/password/set` → land signed in on `/` at the "Add a child" screen.
2. Sign out, `/signin/password`, the same address and password → signed in.
3. `/password/new` with the same address again → set a different password →
   sign in with the new one, and confirm the old one is refused.

- [ ] **Step 4: Commit**

```bash
git add src/components/password-forms.tsx src/app/signin/password src/app/password
git commit -m "Draw the three steps, and the form that signs in with what they set"
```

---

### Task 9: Linking Google

**Files:**
- Modify: `src/auth.ts`
- Modify: `src/lib/signin.ts`
- Create: `src/lib/signin.test.ts` (if absent; otherwise modify)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the `?error=GoogleEmailUnverified` code and its sentence.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/signin.test.ts - add to the existing file, or create it
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './signin';

describe('authErrorMessage for a Google address Google will not vouch for', () => {
  it('has a sentence of its own', () => {
    expect(authErrorMessage('GoogleEmailUnverified')).not.toBeNull();
  });

  // The existing sentence tells somebody to sign in the way they signed up,
  // which is the one thing that will not work here.
  it('does not reuse the already-signed-up-another-way sentence', () => {
    expect(authErrorMessage('GoogleEmailUnverified'))
      .not.toBe(authErrorMessage('OAuthAccountNotLinked'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/lib/signin.test.ts`
Expected: FAIL - the two sentences are equal, because both fall through to
`FALLBACK`.

- [ ] **Step 3: Add the message**

In `src/lib/signin.ts`, inside `MESSAGES`:

```ts
  // Its own sentence rather than OAuthAccountNotLinked's, which says "use the
  // way you signed up the first time" - the one thing that cannot work here.
  // Nothing was linked and nothing was created, so there is no other way in yet.
  GoogleEmailUnverified:
    "Google couldn't confirm that email address belongs to you, so nothing was linked. Try a different Google account.",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit src/lib/signin.test.ts`
Expected: PASS.

- [ ] **Step 5: Turn the linking on, behind the check**

In `src/auth.ts`:

```ts
  providers: [
    /**
     * The flag links a Google sign-in onto an existing account with the same
     * address instead of throwing `OAuthAccountNotLinked`. It is called
     * dangerous because on its own it links on a bare address match and
     * consults no verification claim - so it is never on its own here: the
     * `signIn` callback below refuses anything Google will not vouch for.
     *
     * The order is what makes that work, and it was read off the installed
     * source rather than assumed: `@auth/core/lib/actions/callback/index.js`
     * calls `handleAuthorized` - the callback - before `handleLoginOrRegister`,
     * which is where both the flag and the throw live.
     */
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
```

and in `callbacks`, beside `session`:

```ts
    /**
     * **Every** Google sign-in with an unverified address is refused, not only
     * the ones that would link. An account made from a claim Google will not
     * stand behind is a row holding an address its real owner may verify here
     * later, which is the collision this whole design exists to avoid.
     *
     * Returning a string redirects, which is how this reaches `/signin` with an
     * `?error=` of its own rather than the generic `AccessDenied`.
     */
    signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if ((profile as { email_verified?: boolean } | undefined)?.email_verified !== true) {
        return '/signin?error=GoogleEmailUnverified';
      }
      return true;
    },
```

- [ ] **Step 6: Prove the link in a browser**

1. Run the flow from Task 8 on the address of a Google account you hold, and set
   a password on it.
2. Sign out. Sign in with Google on that same address.
3. Expected: signed in, on the **same** account - check that
   `select count(*) from "User" where email = '<address>'` is 1, and that an
   `Account` row now exists for it.
4. Sign out, sign in with the password again. Expected: the same account.

- [ ] **Step 7: Commit**

```bash
git add src/auth.ts src/lib/signin.ts src/lib/signin.test.ts
git commit -m "Link a Google sign-in to a password account, on Google's own claim"
```

---

### Task 10: Putting it on the sign-in screen

**Files:**
- Modify: `src/app/signin/page.tsx`

**Interfaces:**
- Consumes: Task 8's routes.
- Produces: nothing.

- [ ] **Step 1: Add the second method to the grown-up's panel**

In `src/app/signin/page.tsx`, inside the "For a grown-up" panel and under
`SignInButton`:

```tsx
        {/* The second method, and a peer of the button above it rather than a
            fallback for it - which is why it is a rule and two links and not a
            line of small print. */}
        <div className="flex w-full flex-col items-center gap-2 border-t border-(--color-line) pt-4">
          <Link
            href={`/signin/password?callbackUrl=${encodeURIComponent(redirectTo)}`}
            className="text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
          >
            Sign in with a password
          </Link>
          <Link
            href="/password/new"
            className="text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
          >
            Create an account with a password
          </Link>
        </div>
```

Keep the child's panel untouched and keep the two panels the same weight - the
peers are the grown-up and the child, not Google and a code. `redirectTo` is
already computed on that page by `parseCallbackUrl`, and `/signin/password`
normalises it again at its own end.

- [ ] **Step 2: Check both panels at both sizes**

Run: `npm run dev`, open `/signin` at an iPad width and a phone width. The
grown-up's panel is now taller than the child's; confirm neither reads as the
fallback for the other.

- [ ] **Step 3: Commit**

```bash
git add src/app/signin/page.tsx
git commit -m "Offer the password beside the Google button, and the code beside both"
```

---

### Task 11: Saying so in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Correct the sentence this feature falsifies**

In **Accounts**, `a Google sign-in can only ever produce a parent` becomes a
Google sign-in **or a password sign-up**, with the reason: proving you can read
the mail sent to an address is a grown-up saying they are a grown-up, as much as
Google is, and a child has no email.

- [ ] **Step 2: Add the flow, briefly**

Under the login-code paragraphs, a short section covering: the three screens and
why they are in that order; that reset is the same flow; that `VerificationToken`
holds both the code and the grant, kept apart by an identifier prefix; that the
Google link is gated on `email_verified` in a `signIn` callback which Auth.js
runs before it links; and that the three throttles are keyed differently and why
the sign-in one is not keyed by address.

Point at the spec for the rest rather than repeating it.

- [ ] **Step 3: Full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Docker must be running.

- [ ] **Step 4: Commit and push**

```bash
git add CLAUDE.md
git commit -m "Say that a password sign-up makes a parent too"
git push
```

- [ ] **Step 5: Close the issue**

```bash
gh issue close 22 --comment "Shipped. Design: docs/superpowers/specs/2026-09-05-password-signin-design.md"
```

---

### Task 12: Dressing the email

**Files:**
- Create: `src/lib/email-template.ts`
- Test: `src/lib/email-template.test.ts`
- Modify: `src/server/email.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `renderVerificationEmail(code: string): { html: string; text: string }`.

The code mail currently goes out as plain text. It is the first thing this app
has ever sent to a parent, and it arrives beside every other mail they get - so
it should look like LearnR rather than like a cron job.

**The pure half is in `src/lib`, and that is what makes this testable.** An email
body is a string built from a code; nothing about it touches React, Next, Prisma
or `src/server`, so it lives beside the rest of the pure engine and gets unit
tests in the fast project. Task 6's sender deliberately has no test because it is
one `fetch` against a third party - this is the part of it that *can* be tested,
so it is separated out rather than left inline. `src/server/email.ts` keeps its
one-function seam: `sendVerificationCode` calls this and posts both parts.

**Both parts, always.** Resend takes `html` and `text` together and the text part
is not a fallback nobody sees - it is what a screen reader, a plain-text client
and a spam filter read. The existing wording is already right; keep it as the
text part rather than rewriting it.

**The design rules that are not negotiable, because email is not a browser:**

- **Inline every style.** No `<style>` block, no classes, no CSS variables -
  Gmail strips much of a `<head>`, and `var(--color-brand)` resolves to nothing.
  The palette must be written as literal hex, read from `src/app/globals.css`:
  `--color-ink` `#1b2430`, `--color-ink-soft` `#5b6b7f`, `--color-paper`
  `#f7f9fc`, `--color-card` `#ffffff`, `--color-brand` `#3b6ef5`,
  `--color-brand-soft` `#e5edff`, `--color-line` `#dfe6ef`. The logo palette
  (`--color-grape` `#6c4de0`, `--color-berry` `#ee4d7d`, `--color-leaf`
  `#6fb52f`, `--color-sun` `#f5a623`) is scoped on the web to the two screens
  someone is *choosing* on - a sign-up mail is one of those moments, so a single
  accent from it is allowed, but the body stays `--color-brand`.
- **Tables for layout, not flex or grid.** Outlook renders through Word and
  supports neither.
- **No image is load-bearing.** Most clients block images until asked. The mark
  at `https://learnr.muzza.tech/logo-mark.png` may be included, but the mail must
  read correctly with every image blocked - so the wordmark is live text, not a
  picture of text, and the code is never an image.
- **The code is the one thing the eye should land on**: large, spaced, selectable
  live text in a `--color-brand-soft` panel. Never a picture, never a link.
- **A `max-width` of 600px** on the outer table, centred, so it is not a full-bleed
  wall on a desktop client.
- **Do not add a dark-mode block.** The app's own pages are single-palette and
  `prefers-color-scheme` support across mail clients is inconsistent enough that
  a half-working dark variant looks worse than a light one everywhere.

**What it must say, and what it must not.** The same three things the text part
says: here is your code, type it into the page you left open, it stops working in
ten minutes - plus the line that matters most, that somebody who did not ask for
this can ignore it and nothing has changed. **No marketing, no unsubscribe link,
no tracking pixel**: this is a transactional mail and the only reason it exists is
that somebody asked for a code thirty seconds ago.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/email-template.test.ts
import { describe, expect, it } from 'vitest';
import { renderVerificationEmail } from './email-template';

describe('renderVerificationEmail', () => {
  it('puts the code in both parts', () => {
    const { html, text } = renderVerificationEmail('123456');
    expect(html).toContain('123456');
    expect(text).toContain('123456');
  });

  // The reason the text part exists at all: a plain-text client, a screen
  // reader and a spam filter all read it, and it is not a fallback nobody sees.
  it('says what the code is for in the text part', () => {
    const { text } = renderVerificationEmail('123456');
    expect(text).toMatch(/ten minutes/i);
    expect(text).toMatch(/ignore/i);
  });

  // Email clients strip a <head>, so a style block or a class is a style that
  // silently does not apply. Everything has to be on the element.
  it('carries no style block and no class attributes', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/class=/i);
  });

  // `var(--color-brand)` resolves to nothing in a mail client.
  it('uses literal colours rather than CSS variables', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toContain('var(--');
    expect(html).toContain('#3b6ef5');
  });

  // A transactional mail that somebody asked for thirty seconds ago.
  it('carries no tracking pixel and no unsubscribe link', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toMatch(/width=["\']?1["\']?\s+height=["\']?1/i);
  });

  // The mail has to survive every image being blocked, which is the default in
  // most clients - so the code can never be one.
  it('renders the code as text rather than an image', () => {
    const { html } = renderVerificationEmail('123456');
    const withoutImages = html.replace(/<img[^>]*>/gi, '');
    expect(withoutImages).toContain('123456');
  });

  it('escapes a code that is not what we generate', () => {
    const { html } = renderVerificationEmail('<script>');
    expect(html).not.toContain('<script>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit src/lib/email-template.test.ts`
Expected: FAIL - `Failed to resolve import "./email-template"`.

- [ ] **Step 3: Write the template**

Write `renderVerificationEmail` to satisfy the tests and the design rules above.
The text part is the wording already in `src/server/email.ts`, moved here
unchanged. The doc comment explains why the constraints exist - inlined styles,
tables, no load-bearing image - because every one of them looks like a mistake to
a reader who has only written for browsers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project unit src/lib/email-template.test.ts`
Expected: PASS.

- [ ] **Step 5: Call it from the sender**

In `src/server/email.ts`, replace the inline `text:` body with:

```ts
const { html, text } = renderVerificationEmail(code);
```

and pass both to Resend. `sendVerificationCode`'s signature does not change, and
nothing above it learns that the mail has a shape now.

- [ ] **Step 6: Send one and look at it**

```bash
npx tsx -e "import('./src/server/email.ts').then(m => m.sendVerificationCode('muzzamil.akhan@gmail.com', '123456')).then(console.log)"
```

Expected: `true`. **Then actually look at what arrived** - in a client, not just
in the source. Report what it looked like. Send at most two.

- [ ] **Step 7: Commit**

```bash
npm run test:unit && npm run typecheck
git add src/lib/email-template.ts src/lib/email-template.test.ts src/server/email.ts
git commit -m "Dress the code email so it looks like LearnR"
```

---

## Verification

The spec's list, as a checklist to run once at the end:

- [ ] A new address signs up, verifies, sets a password, and lands signed in on
      the "Add a child" screen at `/`.
- [ ] A Google parent runs the same flow on their own address and ends with both
      logins working on one account - one `User` row, one `Account` row, one
      `ParentPassword` row.
- [ ] Google arriving on a password-only account links and signs in.
- [ ] A wrong code, a stale code and a reused code are each refused.
- [ ] Six wrong codes in a row are throttled, and the message says so.
- [ ] Stopping the database mid-flow reports "something went wrong" rather than
      "that code doesn't work", and spends no attempts.
- [ ] The code email arrives looking like LearnR, and still reads correctly with
      every image blocked.
- [ ] `npm test` and `npm run typecheck` pass, `src/lib/purity.test.ts` included.
