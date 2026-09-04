# Signing in with an email and a password

**Status:** designed, not yet implemented.
**Scope:** grown-ups only. A child's way in is a login code and nothing here
touches it.
**Issue:** #22, *"A password sign-in cannot be an Auth.js provider, and is a
second way to mint a parent"*.
**Companion:** `2026-09-04-aws-migration-design.md`, whose plan names this as an
assumed-shipped Global Constraint.

A grown-up can make a LearnR account with an email address and a password, and a
grown-up who already signed in with Google can add one to the account they have.
Both logins then work, on one account.

## Why, and what it is not

**The ask is a test account.** End-to-end verification of the AWS migration needs
a parent a browser can reach without an OAuth round trip - most of Tasks 6, 9 and
10 of that plan are a browser and a hostname, and every one of them is quicker
against an account that signs in with a form.

**It does not replace the Google check in the cutover.** A password login writes
its own `Session` row and never asks Auth.js to build a callback URL, so it
exercises none of `AUTH_URL`, `AUTH_TRUST_HOST`, or CloudFront's
`ALL_VIEWER_EXCEPT_HOST_HEADER` origin request policy - which is the machinery
most likely to break behind a SigV4-pinned `Host`. Task 6 Step 1 of the migration
plan stays exactly as written. The thing this speeds up is every step after it.

**It is not a way for a child to sign in**, and the reason is the one already
written down: an `Attempt` and a `TopicSkill` belong to a child their parent
manages, and a child a parent does not manage is the shape the app stopped
creating. A child has no email. Their way in is a code, and the code is
untouched.

## The two rules it inherits

**It cannot be a Credentials provider.** Auth.js refuses to combine one with
database sessions (`UnsupportedStrategy`), and moving the app to JWT sessions to
get around that would cost server-side session state for nothing. This is the
same argument `src/auth.ts` already records for why login-code redemption is not
a provider either, and the answer is the same: verify, write the `Session` row by
hand, set `SESSION_COOKIE_NAME` with `SESSION_COOKIE_OPTIONS`. **`auth()` cannot
tell the three paths apart**, and that is the property to preserve - every screen,
every route handler and every gate in `src/server/session.ts` is unchanged
because none of them can see how a session came to exist.

**It mints a parent, on Google's own rule.** This is the issue's second question
and it gets a deliberate answer rather than an inherited one. Filling in an email
address, proving you can read the mail sent to it, and choosing a password is a
grown-up saying they are a grown-up - as much as signing in with Google is. So
`claimParentRole` applies unchanged, on the same compare-and-set against
`role IS NULL`. CLAUDE.md's sentence becomes *a Google sign-in or a password
sign-up can only ever produce a parent*, and the reason it is safe is unchanged:
a managed child has no email, cannot reach this form, and a role already set is
never overwritten.

## The flow

**Three screens: email, code, password.** In that order, and the order is the
design.

1. **Email.** The address, and nothing else. We mail a code to it. The screen
   says the same thing whatever state the address is in.
2. **Code.** Six digits, typed back. Single-use, short-lived, throttled.
3. **Password.** Chosen only once the code has come back.

**No `User` row exists before the mailbox answers.** That is what the order buys,
and it closes a hole a link-then-password flow leaves open: `User.email` is
`@unique`, so an unverified row holding `someone@gmail.com` would make that
person's Google sign-in fail with `OAuthAccountNotLinked` forever - anyone could
lock any Gmail address out of this app by typing it into a form. Verifying first
makes that unreachable rather than guarded against. Nothing is written until the
code comes back, and what is written is verified by construction.

**Which of four states the address is in changes only what the last step does:**

| The address | Setting a password |
| --- | --- |
| Unknown | Creates the parent - `role` claimed on Google's rule, `emailVerified` set |
| Has a Google account, no password | Attaches the password to that account; both logins work from then on |
| Has a password already | Replaces it |
| Belongs to a child | Refused - impossible, since children have no email, and guarded anyway |

**Row three is password reset, and it is not a second feature.** Same three
screens, same code, same mailbox proof; only the entry point differs - a "Forgot
password" link rather than "Sign up". Building the flow without it would leave a
password-only parent who forgets permanently locked out, for no saving.

## Linking with Google

One account per address, reached from either side.

**Password first, Google later.** Google arriving on an address that has a
password account links automatically **when Google's own `email_verified` claim
is true**, and refuses loudly when it is not. Two independent proofs of control
over one mailbox - our code came back from it, and Google asserts it - is what
makes them the same person.

**That check is the whole difference between this design and a dangerous one.**
Auth.js's own switch for the behaviour, `allowDangerousEmailAccountLinking`,
links on a bare email match and consults no verification claim; its name is the
review.

**Settled against the installed source rather than from memory:**
`@auth/core/lib/actions/callback/index.js` calls `handleAuthorized` - which is
the `signIn` callback - at line 63, and `handleLoginOrRegister` at line 70. The
`allowDangerousEmailAccountLinking` branch and the `OAuthAccountNotLinked` throw
both live inside the latter. **The callback runs first and can refuse before
anything is linked**, so the shape is the flag turned on and a `signIn` callback
in front of it, not linking written by hand.

**The callback refuses every Google sign-in whose `email_verified` is not true**,
not only the ones that would link. A fresh account made from an unverified claim
is a row holding an address its owner may later verify for real, which is the
collision this design exists to avoid - so the rule is one line and has no
exceptions. Returning a string from the callback redirects, which is how it
reaches `/signin` with an `?error=` of its own.

**Google first, password later.** Covered by row two of the table above: the code
comes back from the mailbox, and a password is attached to the account already
there. There is no separate "add a password" screen inside a session, and there
does not need to be - the mailbox proof serves both directions with one flow. It
is also how the migration's test account gets made, on a real Google parent.

**The refusal gets its own sentence.** `src/lib/signin.ts` already has the
`MESSAGES` table and a fallback for codes it has not heard of, so this is an
entry rather than a mechanism. It must not reuse the existing
`OAuthAccountNotLinked` sentence - *"already signed up here a different way, use
the way you signed up the first time"* tells somebody to do a thing that will not
work. This one says linking failed and to try a different Google account.

## What is stored

**`ParentPassword` is a table, not a column on `User`.** `ChildPhoto`'s exact
reason: the Auth.js adapter selects whole `User` rows on every authenticated
request, and a password hash has no business riding along with a session lookup.
One row per parent, `userId` unique, cascading with the user.

**`VerificationToken` already exists** (`prisma/schema.prisma:165`) - the Auth.js
adapter's own table, carried since the schema was written and unused, because
this app has never had an email provider. The sign-up code and the reset code
both belong in it, keyed by the address. So this adds **one** table, not three.

**scrypt from `node:crypto`, and no new dependency.** This repository has one UI
dependency and should not gain an auth one for a key derivation function in the
standard library. The hash is stored as a single self-describing string -
algorithm, cost parameters, salt, derived key - so the parameters can be raised
later and an old hash still verifies against the parameters it was made with.

**The split follows `crop.ts` / `photo-crop.tsx`.** `src/lib/password.ts` is the
pure half: formatting that string, `parseStoredHash` as a boundary normaliser
beside `parsePhoto` and `parseYearLevel`, and a constant-time comparison.
`src/server/password.ts` is the half that calls scrypt and reads randomness.
`src/lib/purity.test.ts` keeps the first half honest.

**The Prisma side is `src/server/passwords.ts`**, a sibling of `accounts.ts` the
way `sharing.ts` is, rather than more of `accounts.ts` - which is 356 lines and
would roughly double. `signInWithPassword` returns the three-answer status `RedeemStatus` has, for
that status's reason: a Neon cold start must never be reported as a wrong
password. `unavailable` is not a failed sign-in and must not be counted as one.

## Throttling

`src/lib/throttle.ts` unchanged - fixed window, injected `now`, per caller, a
success clears the caller - with `isGuess`'s rule that an unreachable database
never spends somebody's attempts.

**Three things are throttled, and they are not the same thing.**

- **Password sign-in**, keyed by IP. Not by address as well: per-account counting
  hands an attacker a way to lock a named parent out of their own account, which
  is the objection CLAUDE.md already makes to a global ceiling, narrowed to one
  person.
- **Code entry**, keyed by address *and* IP. Six digits is a million codes and a
  single-use short-lived code is not enough on its own. Keying by address is safe
  here where it is not above: what it slows is an attempt to take over an
  address, and it locks nobody out of an account they already hold - a parent
  with a password still signs in, and a parent with Google still signs in.
- **Code sending**, keyed by address and IP, so the form cannot be used to mail
  somebody repeatedly.

## The sender

**Resend**, provisioned through the Vercel Marketplace
(`vercel integration add resend/resend-email`) - the only `messaging` integration
the marketplace offers, and the right shape regardless: an HTTPS API and a key,
with no Vercel coupling, so it survives the move to AWS unchanged. SES is the
AWS-native sibling and is *not* recommended here: it needs its sandbox lifted and
a domain verified before it can mail anyone but the account holder, which is lead
time bought for a feature whose first user is the account holder.

**It is one module and one function** - `sendVerificationCode(address, code)` -
so the provider is a seam rather than a spread. Nothing above it knows who sends
the mail.

**Provisioning is the first implementation step, before any code.** The
integration supplies the environment variable; hand-wiring an SDK against a
guessed key name is the thing to avoid.

## Where it lives on screen

`/signin` currently draws two ways in **as peers** - a grown-up and a child - and
that stays true, because the peers were never Google and a code. The grown-up's
panel gains a second method beside its Google button; the child's code box is
untouched. The same holds on the landing page's top bar and inside `GetStarted`,
where below `sm` the pair already collapses behind one button.

The three screens of the flow are their own routes rather than state inside the
sign-in page - each is a form that posts and moves on, so a half-finished
sign-up is a URL and the back button does what it looks like it does.

**They follow `CodeSignIn`'s pattern and need JavaScript**, which is a departure
from the `<details>` reasoning on the speed cards and is deliberate: the closest
thing in the app to these three forms is the child's code box, and it is a client
component answering a wrong code inline rather than by navigating. Two form
idioms for two boxes that sit beside each other on `/signin` is the worse trade.

**The grant travels in an HttpOnly cookie, the address in the form.** The address
is not a secret and the code is bound to it in the database, so editing it only
makes the code not match. The grant is a credential and must not be in a URL,
where it would land in history and in a log.

## What does not change

Worth stating plainly, because it is most of the repository.

`src/lib` and `src/content` are untouched. `auth()`, `requireUser`,
`requireParent` and every screen's gating are untouched, because none of them can
tell how a session was made. The login code, its charset, its hour, its
single-use redemption and its throttle are untouched. The compare-and-set in
`claimParentRole` is **not** written a fourth time: a row created by this flow is
created with `role` already set, which is a different statement and has nothing
to race against, and an existing row without one - an account predating the
column - goes through `claimParentRole` itself, unchanged. Children,
sharing, the report, the play path and the speed run are all unaware this
happened.

## Deliberately not in scope

- **A password for a child.** Codes are the child's way in and the reasons are
  unchanged.
- **Changing a password while signed in.** The reset flow already sets a new one
  and needs no session; a settings screen can come later if anybody wants it.
- **Email as a notification channel.** A sender exists after this, and the
  temptation will be to mail parents about a child's progress. That is a product
  decision with its own consent question and is not this.
- **Rotating an address.** The address is the account's identity here; changing
  it is a separate flow with its own proof-of-both-mailboxes problem.

## Verification

- A new parent signs up, verifies, sets a password, signs in, and lands on the
  "Add a child" screen at `/` - a parent with no children is the one parent `/`
  does not redirect to `/progress`.
- A Google parent runs the same flow on their own address and ends with both
  logins working on one account - the migration's test account, made the ordinary
  way.
- Google arriving on a password-only account links and signs in.
- Google arriving with `email_verified` false is refused, with its own sentence
  and not `OAuthAccountNotLinked`'s.
- A wrong code, a stale code and a reused code are each refused, and a run of
  wrong ones is throttled.
- A database that cannot be reached reports `unavailable` and spends nobody's
  attempts.
- `npm test` and `npm run typecheck`, including `src/lib/purity.test.ts`.

## Open questions

- **Code length and lifetime.** Six digits and ten minutes are the convention and
  the starting point; the throttle is what makes either safe, so this is a
  usability choice rather than a security one.
- **What the sign-up screen says when the address is already known.** Saying so
  is an account-enumeration leak; saying nothing means a parent who forgot they
  have an account gets a code and a password screen with no explanation. Leaning
  towards saying nothing on the first screen, since the flow succeeds either way.
