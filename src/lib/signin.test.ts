import { describe, expect, it } from 'vitest';
import { authErrorMessage, parseCallbackUrl } from './signin';

describe('authErrorMessage', () => {
  it('says what happened for the error a parent will actually hit', () => {
    // Tapping "Sign in with Google" and then changing your mind on Google's own
    // consent screen is the ordinary failure, not an exotic one. It is not a
    // fault and must not read as one.
    expect(authErrorMessage('AccessDenied')).toMatch(/wasn.t completed/i);
  });

  it('explains an account collision in terms of the account, not the protocol', () => {
    expect(authErrorMessage('OAuthAccountNotLinked')).toMatch(/already/i);
    expect(authErrorMessage('AccountNotLinked')).toMatch(/already/i);
  });

  it('tells a misconfigured server apart from a refused sign-in', () => {
    // The two want different things from the reader: one is worth retrying and
    // the other never will be, so the same "try again" would be a lie half the
    // time.
    expect(authErrorMessage('Configuration')).not.toBe(authErrorMessage('AccessDenied'));
    expect(authErrorMessage('Configuration')).toMatch(/set up|configur/i);
  });

  it('falls back rather than refusing, like parseScoreTab', () => {
    // An unrecognised code still means a sign-in failed, and the page behind it
    // works perfectly. Showing nothing would leave somebody staring at a screen
    // that gives no account of why they are on it.
    expect(authErrorMessage('SomethingNewInAuthJs')).toBeTruthy();
    expect(authErrorMessage('SomethingNewInAuthJs')).toBe(authErrorMessage('OAuthCallbackError'));
  });

  it('says nothing at all when there is no error', () => {
    // Arriving with no `?error=` is the ordinary way to be here - from
    // `/api/auth/signin`, or by typing the URL - and an alert on that screen
    // would be inventing a problem.
    expect(authErrorMessage(undefined)).toBeNull();
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage('')).toBeNull();
  });
});

describe('parseCallbackUrl', () => {
  it('keeps a path within this app, so a share link survives the round trip', () => {
    // The one caller that needs it: somebody who followed a share link and has
    // to sign in before they can take it.
    expect(parseCallbackUrl('/share/abc123?go=1')).toBe('/share/abc123?go=1');
    expect(parseCallbackUrl('/progress')).toBe('/progress');
  });

  it('refuses anywhere that is not this app', () => {
    // It is the browser's word, and it decides where a signed-in person is sent
    // next - so an absolute URL here is a way to hand somebody's fresh session
    // to a site somebody else chose. The same argument `parsePhoto` makes.
    expect(parseCallbackUrl('https://evil.example/steal')).toBe('/');
    expect(parseCallbackUrl('//evil.example/steal')).toBe('/');
    expect(parseCallbackUrl('http://evil.example')).toBe('/');
    // A backslash is a slash to some URL parsers and not to others, which is
    // exactly the disagreement an open redirect lives in.
    expect(parseCallbackUrl('/\\evil.example')).toBe('/');
    expect(parseCallbackUrl('javascript:alert(1)')).toBe('/');
  });

  it('falls back to home when there is nothing to go back to', () => {
    expect(parseCallbackUrl(undefined)).toBe('/');
    expect(parseCallbackUrl(null)).toBe('/');
    expect(parseCallbackUrl('')).toBe('/');
    // A bare relative path is not a path this app can navigate to.
    expect(parseCallbackUrl('progress')).toBe('/');
  });
});

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
