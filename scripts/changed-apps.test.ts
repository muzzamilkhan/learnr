import { describe, expect, it } from 'vitest';
import { changedApps } from './changed-apps';

const both = { api: true, web: true };
const neither = { api: false, web: false };

describe('changedApps', () => {
  it('deploys both halves when it cannot tell what changed', () => {
    expect(changedApps(null)).toEqual(both);
  });

  it('deploys neither half when nothing changed', () => {
    expect(changedApps([])).toEqual(neither);
  });

  it('deploys neither half for prose', () => {
    expect(
      changedApps([
        'README.md',
        'CLAUDE.md',
        'apps/api/README.md',
        'docs/superpowers/notes/figure-content-notes.md',
        '.claude/settings.json',
        '.superpowers/state.json',
      ]),
    ).toEqual(neither);
  });

  it('deploys neither half for the fixture digests, which ship nowhere', () => {
    expect(changedApps(['fixtures/digests/maths.3.json', 'fixtures/digests/manifest.json'])).toEqual(
      neither,
    );
  });

  it('deploys the API alone for the API workspace and its deployment', () => {
    expect(changedApps(['apps/api/src/routes/speed.ts'])).toEqual({ api: true, web: false });
    expect(changedApps(['apps/api/contract/openapi.yaml'])).toEqual({ api: true, web: false });
    expect(changedApps(['fly.toml'])).toEqual({ api: true, web: false });
    expect(changedApps(['.dockerignore'])).toEqual({ api: true, web: false });
  });

  it('deploys the web app alone for the web app', () => {
    expect(changedApps(['src/app/page.tsx'])).toEqual({ api: false, web: true });
    expect(changedApps(['src/components/diagram.tsx'])).toEqual({ api: false, web: true });
    expect(changedApps(['src/api.ts'])).toEqual({ api: false, web: true });
    expect(changedApps(['public/logo.PNG'])).toEqual({ api: false, web: true });
    expect(changedApps(['prisma/auth.prisma'])).toEqual({ api: false, web: true });
    expect(changedApps(['next.config.ts'])).toEqual({ api: false, web: true });
    expect(changedApps(['vercel.json'])).toEqual({ api: false, web: true });
  });

  /**
   * The engine ships twice - inside the Next bundle and inside the API image -
   * so moving one half without the other leaves them running different code.
   */
  it('deploys both halves for the shared engine and the workspace root', () => {
    expect(changedApps(['src/lib/curriculum.ts'])).toEqual(both);
    expect(changedApps(['src/content/maths/3.ts'])).toEqual(both);
    expect(changedApps(['src/content/packs/maths.3.json'])).toEqual(both);
    expect(changedApps(['packages/core/test/exports.test.ts'])).toEqual(both);
    expect(changedApps(['package.json'])).toEqual(both);
    expect(changedApps(['package-lock.json'])).toEqual(both);
    expect(changedApps(['tsconfig.json'])).toEqual(both);
  });

  it('reads src/lib and src/content as the engine rather than as the web app', () => {
    expect(changedApps(['src/lib/rng.ts', 'src/app/page.tsx'])).toEqual(both);
  });

  it('deploys both halves for a path it does not recognise', () => {
    expect(changedApps(['Caddyfile'])).toEqual(both);
    expect(changedApps(['.github/workflows/deploy.yml'])).toEqual(both);
    expect(changedApps(['scripts/build-content.ts'])).toEqual(both);
  });

  it('ignores prose beside a change that matters', () => {
    expect(changedApps(['docs/plan.md', 'apps/api/src/index.ts'])).toEqual({
      api: true,
      web: false,
    });
  });

  it('unions the halves a mixed push touches', () => {
    expect(changedApps(['apps/api/src/index.ts', 'src/app/page.tsx'])).toEqual(both);
  });
});
