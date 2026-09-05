import { describe, expect, it } from 'vitest';
import { envNameFor, envFromParameters } from './lambda-entrypoint.mjs';

describe('envNameFor', () => {
  it('takes the last path segment as the variable name', () => {
    expect(envNameFor('/learnr/prod/DATABASE_URL', '/learnr/prod')).toBe('DATABASE_URL');
  });

  it('refuses a parameter outside the prefix', () => {
    expect(envNameFor('/other/app/DATABASE_URL', '/learnr/prod')).toBeNull();
  });

  it('refuses a name that is not a plausible environment variable', () => {
    expect(envNameFor('/learnr/prod/not a name', '/learnr/prod')).toBeNull();
  });

  it('tolerates a trailing slash on the prefix', () => {
    expect(envNameFor('/learnr/prod/AUTH_SECRET', '/learnr/prod/')).toBe('AUTH_SECRET');
  });
});

describe('envFromParameters', () => {
  it('builds a name-to-value map', () => {
    const parameters = [
      { Name: '/learnr/prod/DATABASE_URL', Value: 'postgres://x' },
      { Name: '/learnr/prod/AUTH_SECRET', Value: 'shh' },
    ];
    expect(envFromParameters(parameters, '/learnr/prod')).toEqual({
      DATABASE_URL: 'postgres://x',
      AUTH_SECRET: 'shh',
    });
  });

  it('drops anything it cannot name, rather than throwing', () => {
    // A cold start with a waiting child is the wrong place to throw over one
    // stray parameter. The app already degrades without a database.
    const parameters = [
      { Name: '/learnr/prod/DATABASE_URL', Value: 'postgres://x' },
      { Name: '/learnr/prod/bad name', Value: 'ignored' },
      { Name: '/learnr/prod/EMPTY' },
    ];
    expect(envFromParameters(parameters, '/learnr/prod')).toEqual({
      DATABASE_URL: 'postgres://x',
    });
  });
});
