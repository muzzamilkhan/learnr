# Child accounts

## Overview

Today every signed-in Google user is the same kind of account: they pick a
level and play. This adds a second way in. On first sign-in, a user chooses
**parent** or **child**. A parent doesn't play — they set up child profiles
(name, avatar, a level that's fixed once chosen) and hand each child a
short-lived login code instead of a Google account. A child who signs in with
their own Google account keeps behaving exactly as today.

Out of scope for this pass: changing role after it's chosen, parent-facing
analytics/reports, session revocation UI, rate-limiting code guesses, anything
else in parent login beyond generating a code. All noted in CLAUDE.md as
future work.

## Data model

All additions are columns on `User` — no new tables. A managed child is still
just a `User.id`, so `LearningSession`, `TopicSkill`, `Attempt`,
`records.ts`, and `play/actions.ts` need no changes at all.

```prisma
model User {
  // ...existing fields...

  /// Chosen once at first sign-in, then permanent — never offered again.
  /// Null means "hasn't chosen yet," which is what routes to the chooser.
  role     String? // 'parent' | 'child'

  /// Set only on a child profile a parent created. Null for every account
  /// that signed in with Google directly — parent or self-managed child.
  /// This is the flag that tells the home page whether the level is fixed.
  parentId String?
  parent   User?   @relation("ChildProfiles", fields: [parentId], references: [id], onDelete: Cascade)
  children User[]  @relation("ChildProfiles")

  /// Preset icon id, e.g. "fox". Parent-chosen for a managed child; unused
  /// for a Google-signed-in account (image already covers that case).
  avatar   String?

  /// A 4-character login code and its expiry, both null when there is no
  /// active code. Single-use: cleared the moment it's redeemed, not left to
  /// expire naturally. Only meaningful on a managed child's row.
  loginCode          String?
  loginCodeExpiresAt DateTime?
}
```

Email stays nullable+unique as it already is, so a managed child row simply
has no email and no `Account` row — there is nothing OAuth about it.

## Auth mechanism

Google sign-in is unchanged: still the `database` session strategy, still the
only NextAuth provider. Auth.js hard-errors (`UnsupportedStrategy`) if a
Credentials provider is combined with database sessions, and switching the
whole app to JWT sessions loses server-side session data for no benefit here
— so the code login is **not** a NextAuth provider. It's a plain server
action that does by hand what the database strategy would do for it:

1. Look up the `User` by `loginCode` where `loginCodeExpiresAt > now`.
2. If found: clear `loginCode`/`loginCodeExpiresAt` on that row and create a
   `Session` row for it — `prisma.session.create`, the same table the Prisma
   adapter already writes to.

   **The code is spent at redemption, and the session it creates does not
   expire on a schedule.** These are the two halves of one decision: the
   short-lived thing is the *code*, not the login. A child should not be
   locked out mid-term because a month elapsed — being asked to find a parent
   to get back into a maths app is exactly the friction this feature removes.
   The 60-minute window and single-use redemption protect the handoff; once
   the child is in, they are in. `expires` is a required column on `Session`,
   so it is set far in the future rather than left null.
3. Set the session cookie via `cookies().set(...)`.
4. If not found: return an error for the form to show, no session created.

`auth()` doesn't care how a `Session` row or cookie came to exist, only that
they're valid — so this works without a second auth system. To make step 3
reliable, `auth.ts` pins the cookie name/options explicitly (rather than
relying on Auth.js's implicit dev/prod cookie-name switching) and exports
that config so the redeem action uses the exact same name and options.

Login codes are generated with `crypto.randomInt`, not the seeded `Rng` used
elsewhere in `src/lib` — that determinism exists so question sequences can be
replayed from a seed, which is exactly the property a login code must *not*
have. Charset excludes visually ambiguous characters: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
(drops `0/O`, `1/I/L`). On generation, if the candidate collides with another
child's currently-active (unexpired) code, retry a few times — same shape as
the existing `WRITE_ATTEMPTS` retry in `records.ts`.

## Role selection

`page.tsx` already branches on `session?.user`. One more branch: signed in,
`role === null` → a two-card chooser ("I'm a grown-up" / "This is for me").
Saved via a server action that does a compare-and-set
(`UPDATE ... WHERE id = ? AND role IS NULL`), so the choice can't be replayed
into a change later and matches "permanent." Existing rows (role currently
null for every account that exists today) hit this chooser once on their next
sign-in — no separate migration/backfill step needed.

## Home page branches

Still all `/`, no new route:

- `role === null` → role chooser.
- `role === 'parent'` → dashboard only, no play access: list of child
  profiles (name, avatar, level), each with an edit control and a "Get code"
  button, plus "Add child." Add/edit is a small form: name, avatar (grid of
  ~8 preset icons, inline SVGs in the style of `star-icon.tsx` — no uploads,
  no new dependency), level (dropdown reusing `listLevels()`). A "Remove
  child" action is included alongside edit, as the natural counterpart to
  create.
- `role === 'child' && parentId === null` → today's behavior, unchanged:
  `LevelPicker`, dropdown, everything.
- `role === 'child' && parentId !== null` → managed child: same subject
  cards, but no level dropdown — subjects for `selectedLevel` only, since the
  parent set it and the child can't change it.

## Sign-in screen

Same landing block in `page.tsx` that currently renders `SignInButton` for
signed-out users, plus a second option: a 4-character code input. A wrong or
expired code shows an inline message ("That code doesn't work — ask your
grown-up for a new one.") rather than a redirect or page reload.

## Testing

Same split the codebase already uses. Pure functions get unit tests in
`src/lib`:

- Login code generation (charset, length) and the expiry/redeemability
  predicate (`isValidCode(code, storedCode, storedExpiresAt, now)`).
- Any ownership/role guard logic that can be expressed as a pure predicate.

Prisma-touching functions live in a new `src/lib/accounts.ts`, following
`records.ts`'s existing pattern (ownership-checked writes, best-effort where
that pattern already applies) and are not unit tested directly, consistent
with how `records.ts` is handled today.

## Non-goals (explicit)

- Changing role after first choice.
- Any parent-facing analytics/report screen.
- Session revocation UI, or any brute-force protection on code entry beyond
  the 60-minute window and single-use redemption.
- Any session expiry policy for the code path. A redeemed code creates a
  session that stays valid; only the code itself expires.
