'use server';

import { randomInt } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/auth';
import {
  createChild,
  issueLoginCode,
  redeemLoginCode,
  removeChild,
  updateChild,
  type ChildInput,
} from '@/server/accounts';
import { writeSelectedLevel } from '@/server/records';
import {
  acceptShareInvite,
  cancelShareInvite,
  createShareInvite,
  leaveShare,
  revokeShare,
} from '@/server/sharing';
import {
  issueVerificationCode,
  setPasswordWithGrant,
  signInWithPassword,
  spendVerificationCode,
} from '@/server/passwords';
import { isEmailConfigured, sendVerificationCode } from '@/server/email';
import { readViewer } from '@/app/viewer';
import { availableSubjects } from '@/content/catalog';
import { parseYearLevel } from '@/lib/curriculum';
import { parseSubjects } from '@/lib/subjects';
import { parseAvatar } from '@/lib/avatars';
import { parseTarget } from '@/lib/rewards/target';
import { browserIp, createThrottle } from '@/lib/throttle';
import { isGuess, REDEEM_FAILURE_LIMIT, REDEEM_FAILURE_WINDOW_MS } from '@/lib/login-code';
import { parsePhoto } from '@/lib/photo/photo';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';
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
import type { AcceptResult } from '@/lib/dto';

/**
 * The home screen's level picker is usable before this resolves - remembering the
 * choice is a convenience, so a signed-out child or a failed write costs the
 * memory, not the pick.
 */
export async function saveSelectedLevelAction(level: string): Promise<void> {
  const parsed = parseYearLevel(level);
  if (!parsed) return;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  await writeSelectedLevel(userId, parsed);
}

/**
 * Every parent action goes through this first, and it is a courtesy rather than
 * the guard.
 *
 * The child id arrives from the browser, so the parent's identity has to come
 * from the session and the ownership check has to happen in the `where` - which
 * is what every mutation in `src/server/accounts.ts` does, scoping by the
 * `parentId` this resolved. This one refuses early so a child or a signed-out
 * caller never reaches a mutation at all, and so these actions keep answering
 * `false`. It is not the thing standing between one family and another's child;
 * that is the `where`.
 */
async function requireParentId(): Promise<string | null> {
  const { userId, account } = await readViewer();
  return userId && account?.role === 'parent' ? userId : null;
}

/**
 * A child's details as the dashboard form submits them, before they are trusted.
 *
 * `parseAvatar`, `parseTarget` and `parsePhoto` are the boundary functions that
 * decide what may be stored, and this is where they run - once, rather than once
 * on each side of a wire. `createChild` and `updateChild` take the parsed shapes,
 * so a value that does not parse cannot reach them at all. The one rule that is
 * this form's and not the store's is that "no goal" is a choice a parent makes
 * rather than a target that failed to parse.
 */
function parseChildInput(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): ChildInput | null {
  const trimmed = name.trim();
  const parsedAvatar = parseAvatar(avatar);
  const parsedLevel = parseYearLevel(level);

  // Which subjects exist is derived from the shipped templates, so the catalog
  // is what the choice is checked against - and a choice naming none of them
  // fails the whole save, exactly as a level that is not a school year does.
  // "At least one subject" is decided in `parseSubjects` and nowhere else.
  const parsedSubjects = parseSubjects(subjects, availableSubjects());
  if (!trimmed || trimmed.length > 40 || !parsedAvatar || !parsedLevel || !parsedSubjects) {
    return null;
  }

  // "No goal" is a choice a parent makes, so it is a valid input that clears the
  // target - and a target that fails to parse is refused outright rather than
  // quietly saved as no target, which would tell a parent they set one.
  const target = targetKind === 'none' ? null : parseTarget(targetKind, targetValue);
  if (targetKind !== 'none' && target === null) return null;

  // A photo that doesn't parse is no photo, and never a refused save: the
  // picture is the smallest thing on the form, and losing a name, a level and a
  // goal over a browser that encoded a face oddly is the wrong trade. `parsePhoto`
  // is the only thing that decides what may be stored, here as everywhere.
  return {
    name: trimmed,
    avatar: parsedAvatar,
    photo: parsePhoto(photo),
    level: parsedLevel,
    target,
    subjects: parsedSubjects,
  };
}

export async function createChildAction(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo, subjects);
  if (!parentId || !input) return false;

  const created = await createChild(parentId, input);
  revalidatePath('/');
  return created !== null;
}

export async function updateChildAction(
  childId: string,
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo, subjects);
  if (!parentId || !input) return false;

  const updated = await updateChild(parentId, childId, input);
  revalidatePath('/');
  return updated;
}

export async function removeChildAction(childId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const removed = await removeChild(parentId, childId);
  revalidatePath('/');
  return removed;
}

/** Returns the code to read out. A new code replaces whatever the child had. */
export async function issueLoginCodeAction(childId: string): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId) return null;

  const issued = await issueLoginCode(parentId, childId);
  revalidatePath('/');
  return issued;
}

/**
 * Failed redemptions, per browser.
 *
 * **This is the limit on guessing a login code.** The charset is 31 characters
 * and the code is 4, which is 923,521 codes; `redeemLoginCode` matches *any*
 * live code rather than one child's, so a guesser is attacking the pool of
 * every code out at that moment; and a hit buys a session that never expires.
 * The hour-long window and single-use redemption were always the argument for
 * why four characters is safe, and an unbounded number of guesses is what would
 * retire it.
 *
 * **Best-effort, and the cost is written down rather than hidden.** This module
 * runs in a Vercel Function, so the map is per-instance and per-lifetime: a
 * guesser spread across instances gets more than `REDEEM_FAILURE_LIMIT` tries
 * per window, and a cold start forgets. It raises the cost of guessing by a
 * large factor without being a wall, which against a 923,521-code space and an
 * hour-long window is the trade being made. A shared store is what would make
 * it a wall, and it is not worth a dependency at this size.
 */
const redeemFailures = createThrottle({
  limit: REDEEM_FAILURE_LIMIT,
  windowMs: REDEEM_FAILURE_WINDOW_MS,
});

/**
 * This one counts every mail that actually went out, successful ones
 * included - unlike the guess throttles below, which only count a failure.
 * What it limits is mail arriving in somebody's inbox, and every send is that
 * event, whether or not the code inside it ever gets typed back correctly.
 *
 * That is also why `sendPasswordCodeAction` counts against it only after
 * `sendVerificationCode` has returned - a mail provider outage or an
 * unconfigured `RESEND_API_KEY` is not mail arriving anywhere, and counting
 * it would spend a real parent's budget for something that never happened to
 * them.
 */
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
const PASSWORD_GRANT_COOKIE = 'learnr-password-grant';

/**
 * The child's way in. `redeemLoginCode` writes the same `Session` row the Prisma
 * adapter would and this sets the same cookie, so `auth()` cannot tell the two
 * paths apart - which is the whole reason `SESSION_COOKIE_NAME` is pinned in
 * `auth.ts` rather than left to Auth.js to switch implicitly.
 *
 * The one action here that needs no session, because the code *is* the
 * credential: it is spent in the statement that reads it, so two taps cannot
 * both get a session.
 *
 * Returns a message rather than throwing: a mistyped code is the expected case,
 * not an error, and the child needs to read something they can act on.
 */
export async function redeemLoginCodeAction(code: string): Promise<{ error: string } | null> {
  const bag = await headers();
  const browser = browserIp(bag.get('x-real-ip'), bag.get('x-forwarded-for'));
  const now = Date.now();

  // An unattributable request is let through rather than sharing a key with
  // every other one: a single key here is not a throttle, it is a lockout of
  // every child in the service at once, which is worse than the guessing it
  // would prevent.
  if (browser && redeemFailures.blocked(browser, now)) {
    return { error: 'Too many tries - wait a few minutes and have another go.' };
  }

  const result = await redeemLoginCode(code);

  if (result.status !== 'redeemed') {
    // Only a rejection is somebody trying a code. A database that could not
    // answer must not spend a child's ten attempts - see `isGuess`.
    if (browser && isGuess(result.status)) redeemFailures.fail(browser, now);

    return {
      error:
        result.status === 'rejected'
          ? "That code doesn't work - ask your grown-up for a new one."
          : // Deliberately not about the code. The code may be perfectly good,
            // and telling a child to go and get a new one sends them to a
            // grown-up to fix something that is not broken.
            'Something went wrong. Wait a moment and try the same code again.',
    };
  }

  if (browser) redeemFailures.clear(browser);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, result.session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: result.session.expires,
  });

  revalidatePath('/');
  return null;
}

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

  // Its own sentence, and not the generic one below it. This is a server that
  // was never given a mail provider - waiting and trying again will produce it
  // again forever, and the reader cannot do anything about it. It is the same
  // distinction `authErrorMessage` draws for `Configuration`, and it was worth
  // making the moment two unrelated causes started sharing one message.
  if (!isEmailConfigured) {
    return { error: "Email isn't set up on this server yet. Nothing you did caused this." };
  }

  const code = generateVerificationCode(randomInt);
  if (!(await issueVerificationCode(address, code))) {
    return { error: 'Something went wrong. Wait a moment and try again.' };
  }
  if (!(await sendVerificationCode(address, code))) {
    // Said plainly rather than "check your spam folder": the mail was never
    // sent, and sending them to look for it wastes their time.
    return { error: "We couldn't send that email. Wait a moment and try again." };
  }

  // Counted only now that a mail has actually gone out - see `codeSends`'s
  // own comment. A provider outage or a database blip must not spend a real
  // parent's budget for mail that never reached them.
  codeSends.fail(address, now);
  if (browser) codeSends.fail(browser, now);
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
  if (result.status === 'invalid-grant') {
    // Not a bad password - the grant itself is gone (expired, already spent,
    // or never a grant at all). The sentence above already exists for this:
    // a grown-up who stepped away from an open screen sees the same message
    // whether the cookie or the row behind it is what timed out.
    return { error: 'That took too long. Start again and we will send a new code.' };
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

/**
 * Sharing a child with another grown-up.
 *
 * Every one of these goes through `requireParentId` like the rest, and the read
 * behind it scopes its `where` through the child, which is where ownership lives
 * - a viewer reaching one of these with a child id they can see is refused by
 * that `where`, not by a check written here or there. The one exception is
 * `acceptShareInviteAction`, which is the only action a person who owns nothing
 * may call, and which is scoped by the token instead.
 */
export async function createShareInviteAction(childIds: string[]): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId || childIds.length === 0) return null;

  const invite = await createShareInvite(parentId, childIds);
  revalidatePath('/children');
  return invite?.token ?? null;
}

export async function cancelShareInviteAction(inviteId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const cancelled = await cancelShareInvite(parentId, inviteId);
  revalidatePath('/children');
  return cancelled;
}

/** One child of theirs, or - with no child id - everything that person can see. */
export async function revokeShareAction(viewerId: string, childId?: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const revoked = await revokeShare(parentId, viewerId, childId);
  revalidatePath('/children');
  revalidatePath('/progress');
  return revoked;
}

/**
 * A viewer giving up access they were given. Not a parent action: it needs no
 * ownership at all, only that the grant being dropped is their own.
 */
export async function leaveShareAction(childId: string): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const left = await leaveShare(userId, childId);
  revalidatePath('/children');
  revalidatePath('/progress');
  return left;
}

/**
 * Take a link. The one action here that anyone signed in may call, because the
 * person calling it has by definition never had access to anything yet - the
 * token is what authorises it, and `acceptShareInvite` spends the token in the
 * same statement that reads it.
 *
 * A failed read is `reason: 'error'` rather than null: this returns a result the
 * page renders a sentence from, and "something is down at our end" and "that
 * link did not work" are the same sentence to the person holding the link.
 */
export async function acceptShareInviteAction(token: string): Promise<AcceptResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: 'error' };

  const result = await acceptShareInvite(token, userId);
  if (result.ok) {
    revalidatePath('/');
    revalidatePath('/children');
    revalidatePath('/progress');
  }
  return result;
}
