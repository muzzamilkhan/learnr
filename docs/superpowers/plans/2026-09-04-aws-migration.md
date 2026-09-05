# AWS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LearnR off Vercel onto AWS - a Next.js container on Lambda behind CloudFront in `ap-southeast-2`, keeping Neon, keeping the URL, and changing no behaviour.

**Architecture:** One container image (Next standalone + AWS Lambda Web Adapter) on a single Lambda, fronted by CloudFront which also serves static assets from S3. No API Gateway, no second service, no VPC. The `/api/v1` route handlers stay in the same deployment as the pages, so a page render remains an in-process call into `src/server/` and there is no network hop between the app and its API.

**Tech Stack:** Docker (Node 24, arm64), AWS Lambda Web Adapter, AWS CDK v2 (TypeScript), CloudFront, S3, ACM, Route 53, SSM Parameter Store, GitHub Actions with OIDC. Neon Postgres unchanged.

**Spec:** `docs/superpowers/specs/2026-09-04-aws-migration-design.md`

## Global Constraints

- **Region is `ap-southeast-2`** for every resource except the ACM certificate, which **must** be in `us-east-1` - CloudFront accepts certificates from that region and no other.
- **Node 24** in the container, matching what `.github/workflows/deploy.yml` already pins and what the suite runs against.
- **`arm64`** everywhere - the image, the Lambda architecture, and the buildx platform.
- **Lambda: 1769 MB memory, 30s timeout, Function URL with `AWS_IAM` auth, `RESPONSE_STREAM` invoke mode.**
- **The database does not change.** Neon `ap-southeast-2`, same connection string. No data migration, no dual-write.
- **`npm test` and `npm run typecheck` must pass before every commit.** `npm test` needs Docker for the `db` project.
- **Nothing in `src/lib` or `src/content` may import React, `next`, `@prisma/client` or `src/server`** - `src/lib/purity.test.ts` enforces it and this plan must not break it.
- **Shipped, as of `5c59d44`: email/password sign-in, with a test parent account.** `npm run test:account` creates it, `-- --remove` deletes it; `npm run test:timings [url]` signs in as it and reports cold and warm timings apart. Both write to whatever `DATABASE_URL` names, which here is production. Tracked as #22, still open at the time of writing. It makes most of the verification in Tasks 6, 9 and 10 far quicker - a browser at a staging hostname, no OAuth round trip. **It still does not replace the Google sign-in check.** Auth.js refuses a Credentials provider alongside database sessions (`UnsupportedStrategy`), so a password login must write a `Session` row and set the cookie by hand, exactly as `redeemLoginCode` does - which means it never touches the callback-URL machinery that `AUTH_URL` exists to fix. The one thing most likely to break behind CloudFront is the one thing a password login routes around.
- **Seven SSM parameters, not five.** The password flow added `RESEND_API_KEY` and `EMAIL_FROM`; without them the sign-up flow refuses to start rather than pretending to mail. Task 6 lists all seven.
- **`includeLocalVariables` stays `false` in `src/sentry.server.config.ts`.** It was ~95% of a 21-second cold start (`a12cbc5`), because `Sentry.init()` runs in `instrumentation.ts` before Next loads a page module and attaches a `node:inspector` session that pauses on every caught exception - so the whole module graph resolves under the debugger. That is a property of the Sentry config, not of Vercel, so it follows the app to Lambda unchanged. Do not re-enable it to debug a Lambda cold start; it is what a Lambda cold start would be measuring.
- **A staging hostname is used throughout: `aws.learnr.muzza.tech`.** Production `learnr.muzza.tech` keeps pointing at Vercel until Task 10. This is a deliberate addition to the spec - a full Google sign-in cannot be tested without a hostname Google will redirect to.

## Phases

**Both stacks stay live and both keep deploying until Vercel is deliberately retired.** The unit of rollback is a running, current stack - not a snapshot.

| Phase | Tasks | `learnr.muzza.tech` | `aws.learnr.muzza.tech` | Every push deploys |
| --- | --- | --- | --- | --- |
| **1. Parallel** | 1-9 | Vercel | AWS | both |
| **2. Cut over** | 10 | **AWS** | AWS | both |
| **3. Retire** | 11 | AWS | AWS | AWS only |

**Phase 1 is where the testing happens** and has no deadline. Both stacks serve the same Neon database off the same commit, so the AWS stack is never a stale branch you have to re-verify - it is production's code on production's data at a different hostname.

**Phase 2 is one repository variable and a deploy.** Vercel keeps receiving every push, so rolling back is pointing the Route 53 alias at a stack that is current rather than one frozen at cutover. That is the whole reason the Vercel job survives into phase 2.

**Phase 3 needs a deliberate decision, not a timer running out.** The spec says a week; the gate is that nothing surprising has happened, not that seven days elapsed.

**A session works on both stacks**, because a session is a `Session` row and both read the same database. Somebody signed in on Vercel is signed in on AWS. That is what makes a flip - or a flip back - invisible to a child mid-lesson.

**Weighted DNS was considered and refused.** Route 53 could send a percentage of production traffic to AWS, and sessions crossing between stacks would work for the reason above. But with a household's worth of users a percentage is not a sample, and it turns every report of a problem into a question about which stack served it. A clean flip reversible in 60 seconds is the better instrument.

---

### Task 1: Repository preparation

Make the app buildable as a standalone server and remove the dead weight. No AWS involved.

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json` (add `sharp`)
- Create: `.dockerignore`
- Delete: `apps/` (untracked leftovers from the Fly era)

**Interfaces:**
- Consumes: nothing.
- Produces: `.next/standalone/server.js` after `npm run build`; a `.dockerignore` that Task 2's Docker build relies on.

- [ ] **Step 1: Delete the Fly-era leftovers**

`apps/api/` is untracked build output and `node_modules` from the two-application era, still on disk months after `2026-08-29-api-collapse-design.md` undid it. Confirm it is untracked before deleting.

```bash
git ls-files apps/ | head
# Expect: no output (nothing tracked)
rm -rf apps/
```

- [ ] **Step 2: Add `output: 'standalone'` to the Next config**

In `next.config.ts`, add the key to `nextConfig` above `images`:

```ts
const nextConfig: NextConfig = {
  // Emits `.next/standalone`, a self-contained `server.js` with only the
  // traced dependencies beside it. This is what runs in the container, and
  // it is what makes the artifact portable: inside the image it is an
  // ordinary Node server on a port, not anything AWS-shaped.
  output: 'standalone',

  images: {
    // Google is the only sign-in, so its avatar host is the only remote image the
    // app ever loads. Narrow on purpose: anything else should not be renderable.
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
};
```

- [ ] **Step 3: Add `sharp`**

The image optimiser now runs in this process rather than on Vercel's, and `next/image` is used by `src/components/logo.tsx` and `src/components/profile-face.tsx`.

```bash
npm install sharp
```

- [ ] **Step 4: Create `.dockerignore`**

```
node_modules
.next
.git
.github
.claude
.superpowers
.vercel
apps
docs
coverage
*.tsbuildinfo
.env
.env.*
!.env.example
src/generated
```

`src/generated` is excluded because `prisma generate` runs inside the image via `postinstall`; copying a host-generated client in would be a stale artifact from another platform.

- [ ] **Step 5: Verify the standalone build**

```bash
npm run build
ls .next/standalone/server.js .next/static
```

Expected: both paths exist. If `server.js` is missing, `output: 'standalone'` did not take.

- [ ] **Step 6: Verify nothing else broke**

```bash
npm run typecheck && npm test
```

Expected: PASS. (`npm test` needs Docker running for the `db` project.)

- [ ] **Step 7: Commit**

```bash
git add next.config.ts package.json package-lock.json .dockerignore
git commit -m "Build a standalone server, and delete the Fly-era leftovers"
```

---

### Task 2: The container

Build an image that runs the app as an ordinary Node server, and prove it works locally before AWS is involved at all.

**Files:**
- Create: `Dockerfile`

**Interfaces:**
- Consumes: `.next/standalone` from Task 1.
- Produces: an image serving HTTP on `PORT` (default 3000) whose entrypoint is `node server.js`. Task 3 replaces that entrypoint.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

# Node 24 matches what the CI workflow pins and what the suite runs against.
# Two Node versions across a build and its tests is a difference nothing
# reports until it breaks.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
# prisma/ and prisma.config.ts are copied before `npm ci` because `postinstall`
# runs `prisma generate`, which needs the schema and the config to exist.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Dependencies are installed *inside* the target platform's image rather than
# copied from the host, so `sharp` resolves its own arm64 binary.
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .
# NEXT_PUBLIC_SENTRY_DSN is inlined into the browser bundle at build time, so it
# is a build argument and not a runtime variable. Getting this wrong ships a
# bundle with no DSN and silently loses client-side error reporting - the half
# of Sentry that matters most here, since the play screen is where a child is.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG SENTRY_AUTH_TOKEN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone output carries its own traced node_modules. `.next/static` and
# `public` are copied in as well so the container is complete on its own -
# CloudFront will serve them from S3 in production, but a container that cannot
# serve itself is a container that cannot be tested locally.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Build for the local platform and verify it fails cleanly without a database**

```bash
docker build -t learnr:local .
```

Expected: build succeeds. If `prisma generate` fails, check that `prisma.config.ts` and `prisma/` were copied before `npm ci`.

- [ ] **Step 3: Run it and verify the landing page serves**

The app is designed to run and play with no database (`isDatabaseConfigured`), so this needs no secrets.

```bash
docker run --rm -p 3000:3000 -e DATABASE_URL="postgresql://user:password@host/dbname?sslmode=verify-full" learnr:local &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/ | grep -c "LearnR"
```

Expected: `200`, and a non-zero grep count. Then stop the container.

- [ ] **Step 4: Verify the arm64 build works**

This is what actually ships. It needs buildx with QEMU on an x86 host.

```bash
docker buildx build --platform linux/arm64 -t learnr:arm64 --load .
```

Expected: build succeeds. A failure here is almost always `sharp` - confirm it was installed inside the image rather than copied from the host.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile
git commit -m "Build the app as a container that serves itself"
```

---

### Task 3: Lambda Web Adapter and the SSM entrypoint

Turn the container into something Lambda can invoke, and give it a way to read its secrets that keeps them out of CloudFormation and out of `GetFunctionConfiguration`.

**Files:**
- Modify: `Dockerfile`
- Create: `scripts/lambda-entrypoint.mjs`
- Create: `scripts/lambda-entrypoint.test.ts`
- Modify: `vitest.config.ts` (widen the `unit` project's `include` by one glob)
- Modify: `package.json` (add `@aws-sdk/client-ssm`)

**Interfaces:**
- Consumes: the image from Task 2.
- Produces: `envNameFor(parameterName, prefix): string | null` and `envFromParameters(parameters, prefix): Record<string, string>`, exported from `scripts/lambda-entrypoint.mjs`. The container entrypoint becomes `node scripts/lambda-entrypoint.mjs`. Task 5's CDK stack sets `SSM_PARAMETER_PREFIX` and grants `ssm:GetParametersByPath`.

- [ ] **Step 1: Widen the unit test project to see `scripts/`**

In `vitest.config.ts`, the `unit` project's include becomes:

```ts
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
```

Leave `exclude: ['src/server/**']` unchanged. The entrypoint's mapping logic is pure and belongs under test; it does not belong in `src/lib`, which is the engine.

- [ ] **Step 2: Write the failing test**

Create `scripts/lambda-entrypoint.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npx vitest run --project unit scripts/lambda-entrypoint.test.ts
```

Expected: FAIL - cannot resolve `./lambda-entrypoint.mjs`.

- [ ] **Step 4: Write the entrypoint**

Create `scripts/lambda-entrypoint.mjs`:

```js
/**
 * The container's entrypoint: fetch this app's secrets from SSM Parameter
 * Store, put them in the environment, then start the standalone server in this
 * same process.
 *
 * Parameter Store rather than Secrets Manager because Secrets Manager is $0.40
 * per secret per month and five secrets across nine apps is $18/month for
 * something Parameter Store does free. Read here rather than injected as Lambda
 * environment variables so the values are in neither the CloudFormation
 * template nor `GetFunctionConfiguration`.
 *
 * One API call per cold start, then cached for the life of the container.
 */

/** A plausible environment variable name: the shape a shell would accept. */
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

export function envNameFor(parameterName, prefix) {
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  if (!parameterName.startsWith(base)) return null;
  const name = parameterName.slice(base.length);
  return ENV_NAME.test(name) ? name : null;
}

export function envFromParameters(parameters, prefix) {
  const env = {};
  for (const parameter of parameters) {
    const name = envNameFor(parameter.Name ?? '', prefix);
    if (name && parameter.Value !== undefined) env[name] = parameter.Value;
  }
  return env;
}

async function loadSecrets(prefix) {
  const { SSMClient, GetParametersByPathCommand } = await import('@aws-sdk/client-ssm');
  const client = new SSMClient({});
  const parameters = [];
  let NextToken;
  do {
    const page = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        Recursive: false,
        NextToken,
      }),
    );
    parameters.push(...(page.Parameters ?? []));
    NextToken = page.NextToken;
  } while (NextToken);
  return envFromParameters(parameters, prefix);
}

async function main() {
  const prefix = process.env.SSM_PARAMETER_PREFIX;
  if (prefix) {
    try {
      Object.assign(process.env, await loadSecrets(prefix));
    } catch (error) {
      // Best-effort, like every other read on the play path. Without a database
      // the app still draws the first question and records nothing, which is a
      // far better outcome than a container that refuses to start.
      console.error('Failed to load parameters from SSM', error);
    }
  }
  await import('../server.js');
}

// Only run when this file is the entrypoint, so the test can import the two
// pure functions without starting a server.
if (process.argv[1]?.endsWith('lambda-entrypoint.mjs')) {
  await main();
}
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npx vitest run --project unit scripts/lambda-entrypoint.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Add the SSM client dependency**

```bash
npm install @aws-sdk/client-ssm
```

The AWS SDK ships in Lambda's managed runtimes but **not** in a container image, so it has to be a real dependency.

- [ ] **Step 7: Wire the adapter and the entrypoint into the Dockerfile**

Replace the `runner` stage's tail (from `COPY --from=builder /app/.next/standalone ./` onwards) with:

```dockerfile
# AWS Lambda Web Adapter, as a Lambda extension. This is the only AWS-specific
# thing inside the image: everything else is an ordinary Node server on a port,
# which is what lets this exact artifact run on Fargate, App Runner, Fly, Cloud
# Run or a VPS unchanged.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# The App Router streams RSC payloads. Buffered mode discards that and caps a
# response at 6 MB; response streaming is what the Function URL is configured
# for in the CDK stack, and the two must agree.
ENV AWS_LWA_INVOKE_MODE=response_stream
# The adapter waits for this to answer before declaring the container ready.
# `/` renders the landing page for a signed-out visitor and needs no database.
ENV AWS_LWA_READINESS_CHECK_PATH=/

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# node_modules for the entrypoint alone: the standalone trace has no reason to
# include the SSM client, because no application module imports it.
COPY --from=deps /app/node_modules/@aws-sdk ./node_modules/@aws-sdk
COPY --from=deps /app/node_modules/@smithy ./node_modules/@smithy
COPY scripts/lambda-entrypoint.mjs ./scripts/lambda-entrypoint.mjs

EXPOSE 3000
CMD ["node", "scripts/lambda-entrypoint.mjs"]
```

- [ ] **Step 8: Verify the container still serves itself with no SSM prefix set**

```bash
docker build -t learnr:local .
docker run --rm -p 3000:3000 -e DATABASE_URL="postgresql://user:password@host/dbname?sslmode=verify-full" learnr:local &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`. With `SSM_PARAMETER_PREFIX` unset the entrypoint skips SSM entirely and goes straight to the server.

- [ ] **Step 9: Verify the whole suite still passes**

```bash
npm run typecheck && npm test
```

Expected: PASS, including the widened `unit` project.

- [ ] **Step 10: Commit**

```bash
git add Dockerfile scripts/lambda-entrypoint.mjs scripts/lambda-entrypoint.test.ts vitest.config.ts package.json package-lock.json
git commit -m "Make the container invokable by Lambda, and read its secrets from SSM"
```

---

### Task 4: DNS into Route 53

**This task needs a human at a console and cannot be done by an agent.** It also has the only irreversible-feeling failure mode in the plan, and it is not the website.

**Files:** none in the repository.

**Interfaces:**
- Produces: a Route 53 public hosted zone for `muzza.tech` that is authoritative, which Task 5's ACM certificate validation depends on.

- [ ] **Step 1: Inventory every record currently in the zone**

```bash
vercel dns ls muzza.tech
```

Write the output down. **The failure mode here is email, not the website.** Every `MX`, `SPF` (a `TXT` starting `v=spf1`), `DKIM` and `DMARC` record must come across. A dropped mail record breaks silently and is discovered days later by someone who did not get a reply; a dropped website record is loud and immediate.

- [ ] **Step 2: Create the hosted zone**

```bash
aws route53 create-hosted-zone --name muzza.tech --caller-reference "$(date +%s)"
```

Note the four `ns-...` nameservers in the response and the zone id.

- [ ] **Step 3: Recreate every record from step 1 in the new zone**

Including the record that currently points `learnr.muzza.tech` at Vercel, and the records for the other eight apps. **Everything keeps working through this task** - the zone is a faithful copy, and nothing moves to AWS yet.

- [ ] **Step 4: Lower the TTL on `learnr.muzza.tech` to 60 seconds**

Do this now, not at cutover. Task 10's rollback is a DNS flip, and a TTL lowered on the day of a cutover has not propagated when it is needed.

- [ ] **Step 5: Verify the new zone answers correctly before switching**

Query the Route 53 nameservers directly, before they are authoritative:

```bash
dig @ns-XXX.awsdns-XX.com muzza.tech MX +short
dig @ns-XXX.awsdns-XX.com learnr.muzza.tech +short
```

Expected: the same answers the current registrar gives. Compare against `dig muzza.tech MX +short` run against the live resolver.

- [ ] **Step 6: Point the registrar's nameservers at Route 53**

In the Vercel dashboard, set the domain's nameservers to the four from step 2. This is a record change at the registrar, not a registrar transfer, and is subject to no lock - the transfer-out lock until 15 October 2026 does not apply.

- [ ] **Step 7: Verify propagation and that mail still resolves**

```bash
dig muzza.tech NS +short
dig muzza.tech MX +short
dig learnr.muzza.tech +short
```

Expected: NS shows the four AWS nameservers; MX unchanged from step 1; `learnr.muzza.tech` still resolving to Vercel. **Send yourself an email at the domain and confirm it arrives** before continuing.

---

### Task 5: The CDK stack

Stand the whole thing up on `aws.learnr.muzza.tech`. Production is untouched.

**Files:**
- Create: `infra/package.json`, `infra/tsconfig.json`, `infra/cdk.json`
- Create: `infra/bin/learnr.ts`
- Create: `infra/lib/certificate-stack.ts`
- Create: `infra/lib/learnr-stack.ts`

**Interfaces:**
- Consumes: the Dockerfile from Task 3; the hosted zone from Task 4.
- Produces: a deployed CloudFront distribution serving `aws.learnr.muzza.tech`; a Lambda whose environment carries `SSM_PARAMETER_PREFIX=/learnr/prod` and which may call `ssm:GetParametersByPath` on that path. Task 6 fills those parameters. Task 8 deploys this stack from CI.

**Deviation from the spec, deliberate:** the spec describes an explicit ECR repository with a lifecycle rule, CI pushing an image by digest, and `aws lambda update-function-code`. This plan uses CDK's `DockerImageCode.fromImageAsset` instead, which builds the image, manages its own ECR repository and rolls the function in one `cdk deploy`. That removes an ordering problem the explicit version has - the repository must exist and hold an image before the function referencing it can be created - and makes the deploy one command rather than four. The cost is that image retention follows CDK's asset garbage collection rather than a lifecycle rule you wrote. At nine hobby apps that is the right trade; revisit it if image storage ever appears on the bill.

- [ ] **Step 1: Scaffold the CDK app**

The stack lives inside this repository rather than a shared infrastructure repo, so a change to the app and its deployment is one commit.

```bash
mkdir -p infra/bin infra/lib
cd infra && npm init -y && npm install aws-cdk-lib constructs && npm install -D aws-cdk tsx typescript @types/node && cd ..
```

Then set `"type": "module"` in `infra/package.json` - `bin/learnr.ts` uses ESM imports with explicit `.js` extensions, which is what the `NodeNext` module resolution in step 3 expects. `tsx` is what `cdk.json` invokes in the next step, so it has to be a real dependency rather than assumed from the root.

- [ ] **Step 2: Write `infra/cdk.json`**

```json
{
  "app": "npx tsx bin/learnr.ts",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

- [ ] **Step 3: Write `infra/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["bin/**/*.ts", "lib/**/*.ts"]
}
```

- [ ] **Step 4: Write the certificate stack**

Create `infra/lib/certificate-stack.ts`:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  readonly hostedZoneId: string;
  readonly zoneName: string;
  readonly domainNames: string[];
}

/**
 * A stack of its own solely because CloudFront accepts certificates from
 * `us-east-1` and no other region, wherever the rest of the application lives.
 * It is provisioned explicitly rather than left to be discovered: this is the
 * single most reliable way to lose an afternoon to this design.
 */
export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainNames[0],
      subjectAlternativeNames: props.domainNames.slice(1),
      // DNS validation renews without a human, which is the whole reason the
      // hosted zone had to move before this stack could exist.
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
```

- [ ] **Step 5: Write the main stack**

Create `infra/lib/learnr-stack.ts`:

```ts
import * as path from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface LearnrStackProps extends StackProps {
  readonly hostedZoneId: string;
  readonly zoneName: string;
  readonly domainNames: string[];
  readonly certificate: acm.ICertificate;
  readonly parameterPrefix: string;
  readonly sentryDsn: string;
  readonly sentryAuthToken: string;
}

export class LearnrStack extends Stack {
  constructor(scope: Construct, id: string, props: LearnrStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    // Static assets. Private: reachable only by CloudFront through Origin
    // Access Control, so a 13 KB .m4a never costs a Lambda invocation and the
    // bucket is not a second public front door.
    const assets = new s3.Bucket(this, 'Assets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const fn = new lambda.DockerImageFunction(this, 'Web', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '..', '..'), {
        platform: ecrAssets.Platform.LINUX_ARM64,
        buildArgs: {
          NEXT_PUBLIC_SENTRY_DSN: props.sentryDsn,
          SENTRY_AUTH_TOKEN: props.sentryAuthToken,
        },
      }),
      architecture: lambda.Architecture.ARM_64,
      // One full vCPU, so cold init runs at full speed. The decision is to ship
      // without a warmer and add a 5-minute EventBridge ping only if a cold
      // start is actually felt on the iPad.
      memorySize: 1769,
      timeout: Duration.seconds(30),
      environment: {
        SSM_PARAMETER_PREFIX: props.parameterPrefix,
        // CloudFront signs origin requests with SigV4 and the signature covers
        // Host, so the Host reaching this function is the Function URL's and
        // cannot be rewritten. Auth.js would therefore build a Google callback
        // URL pointing at *.lambda-url.ap-southeast-2.on.aws, which Google
        // refuses. Naming the origin explicitly is the fix.
        AUTH_URL: `https://${props.domainNames[0]}`,
        AUTH_TRUST_HOST: 'true',
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${props.parameterPrefix}/*`,
        ],
      }),
    );

    const url = fn.addFunctionUrl({
      // Not NONE: with Origin Access Control below, the function cannot be
      // reached except through the distribution.
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      // Must agree with AWS_LWA_INVOKE_MODE in the Dockerfile.
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    const lambdaOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(url);
    const assetOrigin = origins.S3BucketOrigin.withOriginAccessControl(assets);

    // `/_next/image` varies on three query parameters and nothing else. The
    // built-in CACHING_OPTIMIZED policy forwards no query string at all, which
    // would collapse every size and quality onto one cached response.
    const imageCachePolicy = new cloudfront.CachePolicy(this, 'ImageCache', {
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('url', 'w', 'q'),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept'),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      defaultTtl: Duration.days(30),
      minTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: props.domainNames,
      certificate: props.certificate,
      defaultBehavior: {
        origin: lambdaOrigin,
        // Every page is either authenticated or a lesson in progress. Nothing
        // here is safe to cache at the edge.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // ALL_VIEWER_EXCEPT_HOST_HEADER, not ALL_VIEWER: forwarding the
        // viewer's Host would break the SigV4 signature that Origin Access
        // Control puts on the origin request.
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // Content-hashed filenames, so this is safe forever.
        '/_next/static/*': {
          origin: assetOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/sounds/*': {
          origin: assetOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/_next/image*': {
          origin: lambdaOrigin,
          cachePolicy: imageCachePolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    for (const domainName of props.domainNames) {
      new route53.ARecord(this, `Alias${domainName}`, {
        zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
      new route53.AaaaRecord(this, `AliasV6${domainName}`, {
        zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    new CfnOutput(this, 'AssetsBucket', { value: assets.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName });
  }
}
```

- [ ] **Step 6: Write the app entry point**

Create `infra/bin/learnr.ts`:

```ts
#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CertificateStack } from '../lib/certificate-stack.js';
import { LearnrStack } from '../lib/learnr-stack.js';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT!;
const zoneName = 'muzza.tech';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string;

// `domainNames` is context rather than a constant so the cutover in Task 10 is
// a one-line change: the staging host alone until production moves, then both.
const domainNames = ((app.node.tryGetContext('domainNames') as string) ?? 'aws.learnr.muzza.tech')
  .split(',')
  .map((name) => name.trim());

const certificates = new CertificateStack(app, 'LearnrCertificate', {
  // CloudFront takes certificates from us-east-1 and nowhere else.
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
  hostedZoneId,
  zoneName,
  domainNames,
});

new LearnrStack(app, 'Learnr', {
  env: { account, region: 'ap-southeast-2' },
  crossRegionReferences: true,
  hostedZoneId,
  zoneName,
  domainNames,
  certificate: certificates.certificate,
  parameterPrefix: '/learnr/prod',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN ?? '',
});
```

- [ ] **Step 7: Bootstrap both regions**

CDK needs its own assets bucket and roles in each region it deploys to.

```bash
cd infra
npx cdk bootstrap aws://ACCOUNT_ID/ap-southeast-2 aws://ACCOUNT_ID/us-east-1
```

- [ ] **Step 8: Synthesize and read the template before deploying anything**

```bash
npx cdk synth -c hostedZoneId=ZONE_ID
```

Expected: two stacks synthesize with no errors. Skim the `Learnr` template for the Function URL's `InvokeMode: RESPONSE_STREAM` and the distribution's four behaviours.

- [ ] **Step 9: Deploy**

```bash
npx cdk deploy --all -c hostedZoneId=ZONE_ID --require-approval never
```

Expected: the certificate stack completes first (validation may take a few minutes), then `Learnr`. Note the three `CfnOutput` values.

- [ ] **Step 10: Verify the site serves through CloudFront on the staging host**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://aws.learnr.muzza.tech/
curl -s https://aws.learnr.muzza.tech/ | grep -c "LearnR"
```

Expected: `200` and a non-zero count. The app has no secrets yet, so it renders as the "no database" case - which is exactly the behaviour `isDatabaseConfigured` describes and is the right result at this point.

- [ ] **Step 11: Verify the Lambda cannot be reached directly**

```bash
aws lambda get-function-url-config --function-name FUNCTION_NAME --region ap-southeast-2 --query FunctionUrl --output text
curl -s -o /dev/null -w "%{http_code}\n" "$(that URL)"
```

Expected: `403`. If it returns `200`, the Function URL auth type is not `AWS_IAM` and the distribution is not the only way in.

- [ ] **Step 12: Commit**

```bash
git add infra/
git commit -m "Stand LearnR up on Lambda behind CloudFront"
```

---

### Task 6: Secrets, and a working sign-in

**Files:** none in the repository. AWS and Google console work, verified against the running staging host.

**Interfaces:**
- Consumes: the stack from Task 5, which already grants `ssm:GetParametersByPath` on `/learnr/prod/*` and sets `SSM_PARAMETER_PREFIX`.
- Produces: a fully working application at `https://aws.learnr.muzza.tech` against the production database.

- [ ] **Step 1: Write the seven parameters**

Names must be exactly the environment variable names, since `envNameFor` takes the last path segment.

**`RESEND_API_KEY` and `EMAIL_FROM` are new since the spec was written** and are not optional: without them the password sign-up flow refuses to start rather than pretending to mail, which would make the test account unrecoverable on a fresh environment.

```bash
for name in DATABASE_URL AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET SENTRY_DSN RESEND_API_KEY EMAIL_FROM; do
  echo "Setting $name"
  aws ssm put-parameter --region ap-southeast-2 \
    --name "/learnr/prod/$name" --type SecureString --overwrite \
    --value "PASTE_VALUE"
done
```

Use the same values Vercel currently holds - `vercel env pull` writes them to `.env.local`. Three things are deliberately **not** here: `NEXT_PUBLIC_SENTRY_DSN`, which is inlined at build time and passed to `cdk deploy` instead; `NEON_API_KEY`, a tool credential nothing in the app reads; and `TEST_ACCOUNT_EMAIL`/`TEST_ACCOUNT_PASSWORD`, which belong to the harness on your machine and never to the running app.

- [ ] **Step 2: Register the staging redirect URI with Google**

In the Google Cloud console's OAuth credentials, add `https://aws.learnr.muzza.tech/api/auth/callback/google` **alongside** the existing production and localhost URIs. Do not remove anything - production is still live on Vercel.

- [ ] **Step 3: Force a cold start so the new parameters are read**

An already-warm container holds the environment it started with.

```bash
cd infra && npx cdk deploy Learnr -c hostedZoneId=ZONE_ID --require-approval never
```

- [ ] **Step 4: Verify the database is reachable**

```bash
curl -s https://aws.learnr.muzza.tech/curriculum | grep -c "Kindergarten"
```

Expected: non-zero. This page renders from shipped content, so it proves the app runs but not that the database works - continue to step 5 for that.

- [ ] **Step 5: Verify sign-in with the test account**

Sign in at `https://aws.learnr.muzza.tech` with the email/password test parent. This proves the database is reachable, the hand-written `Session` row is read back by `src/server/session.ts`, and the cookie survives CloudFront - three things, in one fast check, with no OAuth round trip.

Note that there is one database and no staging copy, so this test account and its children are **real rows in production**. That is the same trade preview deployments were refused over; here it is one account you created on purpose rather than every branch build reading real families' records.

- [ ] **Step 6: Verify a full Google sign-in as well - this cannot be skipped**

In a browser, sign in with Google and confirm you land on `/progress` as a parent with your real children listed. **Step 5 passing tells you nothing about this one.** A password login writes its own `Session` row and never asks Auth.js to build a callback URL, so it exercises none of `AUTH_URL`, `AUTH_TRUST_HOST`, or CloudFront's `ALL_VIEWER_EXCEPT_HOST_HEADER` origin request policy. This is the step Task 5 could not do and the reason the staging host exists. A failure here is almost certainly `AUTH_URL` - check CloudWatch logs for the callback URL Auth.js actually built.

- [ ] **Step 7: Verify a child's login code**

Generate a code on `/children`, sign out, redeem it, and confirm the child's home screen appears with their level and subjects. This exercises `redeemLoginCodeAction`, the hand-set cookie, and `src/server/session.ts` reading it - the path Auth.js knows nothing about.

- [ ] **Step 8: Verify the play path writes**

Answer ten questions in a lesson. Confirm the round's stars appear and the total increments. This exercises all six `/api/v1` handlers through CloudFront with `Cookie` forwarded, and the `SELECT ... FOR UPDATE` guards against the real database.

- [ ] **Step 9: Run the timings harness against the staging host**

```bash
npm run test:timings https://aws.learnr.muzza.tech
```

It mints a `Session` row directly rather than driving the sign-in form, so it reaches the screens behind a sign-in, and it reports cold and warm apart because the gap is the finding. Record both numbers - Task 9 compares them against Vercel's.

- [ ] **Step 10: Verify response streaming survived CloudFront**

The one behaviour in this design that has to be observed rather than reasoned about.

```bash
curl -sN -o /dev/null -w "%{http_version} %{size_download}\n" https://aws.learnr.muzza.tech/curriculum
curl -sI https://aws.learnr.muzza.tech/curriculum | grep -i "transfer-encoding\|content-length"
```

Expected: the page downloads in full. `Transfer-Encoding: chunked` confirms streaming reached the viewer; a `Content-Length` means CloudFront buffered, which works but loses the streaming benefit - record which it is and move on, it is not a blocker.

---

### Task 7: Static assets from S3

Take the assets off the Lambda's hot path.

**Files:** none in the repository - this is a deploy-time sync, wired into CI in Task 8 and done by hand once here to prove the behaviours are right.

**Interfaces:**
- Consumes: the `AssetsBucket` output from Task 5.
- Produces: proof that the `/_next/static/*` and `/sounds/*` behaviours serve from S3, which Task 8's workflow depends on.

- [ ] **Step 1: Build and sync the assets by hand**

```bash
npm run build
aws s3 sync .next/static "s3://ASSETS_BUCKET/_next/static" --cache-control "public,max-age=31536000,immutable" --delete
aws s3 sync public "s3://ASSETS_BUCKET" --cache-control "public,max-age=31536000,immutable"
```

- [ ] **Step 2: Verify a static chunk comes from S3, not Lambda**

```bash
curl -sI "https://aws.learnr.muzza.tech/_next/static/chunks/$(ls .next/static/chunks | head -1)" | grep -i "x-cache\|cache-control"
```

Expected: a `Cache-Control` of `max-age=31536000` and an `X-Cache` header. Fetch it twice - the second should report `Hit from cloudfront`.

- [ ] **Step 3: Verify a sound file**

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://aws.learnr.muzza.tech/sounds/correct.m4a
```

Expected: `200` and a size in the 5-13 KB range.

- [ ] **Step 4: Verify `/_next/image` optimises and caches per variant**

```bash
curl -sI "https://aws.learnr.muzza.tech/_next/image?url=%2Flogo-mark.png&w=128&q=75" | grep -i "content-type\|x-cache"
curl -sI "https://aws.learnr.muzza.tech/_next/image?url=%2Flogo-mark.png&w=128&q=75" | grep -i "x-cache"
curl -sI "https://aws.learnr.muzza.tech/_next/image?url=%2Flogo-mark.png&w=256&q=75" | grep -i "x-cache"
```

Expected: a `Content-Type` of `image/webp` or `image/avif` - proving `sharp` works in the arm64 image. The second call hits the cache; the third (a different `w`) misses, proving the cache policy forwards the query string rather than collapsing every size onto one response.

- [ ] **Step 5: Verify the child's home screen draws faces**

Visit the staging host signed in and confirm avatars and the logo render. `src/components/profile-face.tsx` is the one place a remote Google image goes through `next/image`.

---

### Task 8: CI/CD on OIDC, deploying to both stacks

**Files:**
- Rewrite: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the stack from Task 5, the assets bucket from Task 7.
- Produces: a push to `master` that migrates once and then deploys to Vercel **and** AWS in parallel, with no long-lived AWS credential anywhere in the repository.

**This is phase 1's defining change, and the reason it is not a swap.** Deploying to AWS *instead of* Vercel would leave Vercel frozen at whatever commit was last shipped, so by cutover the rollback target would be days behind production. Both jobs run until phase 3 deletes one.

- [ ] **Step 1: Create the GitHub OIDC provider and a deploy role**

In the AWS console or CLI, create an IAM OIDC identity provider for `token.actions.githubusercontent.com`, then a role trusting it, with the subject condition scoped to this repository and the `master` branch:

```
"token.actions.githubusercontent.com:sub": "repo:USER/learnr:ref:refs/heads/master"
```

Attach permissions for CDK deploys (assuming the CDK bootstrap roles), `s3:PutObject`/`DeleteObject` on the assets bucket, and `cloudfront:CreateInvalidation`. Note the role ARN.

- [ ] **Step 2: Set the repository variables and secrets**

- Variable `AWS_ROLE_ARN` - the role from step 1, and not a secret.
- Variable `AWS_REGION` - `ap-southeast-2`.
- Variable `HOSTED_ZONE_ID` - from Task 4.
- Variable `ASSETS_BUCKET`, `DISTRIBUTION_ID` - the Task 5 outputs.
- Variable `DOMAIN_NAMES` - `aws.learnr.muzza.tech` for now. Task 10 changes it, and that change *is* the cutover.
- Secret `DATABASE_URL` - already present, still needed for migrations.
- Secret `SENTRY_AUTH_TOKEN` - already present, still a build credential.
- Secret `NEXT_PUBLIC_SENTRY_DSN` - the DSN is public by design, but it is needed at build time and a repository secret is the simplest place for it.

Keep `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. They are not leftovers - the Vercel job uses them through phases 1 and 2, and Task 11 deletes them when the job goes.

- [ ] **Step 3: Split the deploy job into migrate, vercel and aws**

Keep the `test` job exactly as it is. The single `deploy` job becomes three, because **the migration must run once and both deploys must run behind it**:

```yaml
  # One migration for two stacks. Both read the same Neon database off the same
  # commit, so running `db:deploy` in each job would be the same migration
  # twice, racing itself for the advisory lock.
  migrate:
    name: Migrate the database
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      # A missing database secret must stop the deploy, because a skipped
      # migration is invisible in a green build. `scripts/migrate.mjs` skips
      # and exits 0 when it finds no `DATABASE_URL` - correct locally, where
      # the app is designed to run and play without a database
      # (`isDatabaseConfigured`), and wrong here, where "no secret" would
      # otherwise read as "nothing to migrate" rather than "the migration
      # never ran."
      - name: Refuse to deploy without a database
        run: |
          if [ -z "${DATABASE_URL}" ]; then
            echo "::error::DATABASE_URL is not set. Migrations would be skipped silently and a"
            echo "::error::schema change would ship without its migration. Add the repository"
            echo "::error::secret before deploying."
            exit 1
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      # `db:deploy` is `node scripts/migrate.mjs`, not a bare
      # `prisma migrate deploy`: Neon accepts a connection while its compute is
      # still waking from autosuspend, and the migration's advisory lock then
      # times out against a fixed 10s Prisma gives no way to raise (P1002) -
      # the script retries that one error three times, five seconds apart, and
      # fails on anything else.
      #
      # It runs on the runner rather than inside AWS: Neon is publicly
      # reachable, so there is no CodeBuild step, no VPC and no bastion to
      # justify.
      - run: npm run db:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  # Phases 1 and 2 only. Task 11 deletes this job, and that deletion is what
  # retiring Vercel actually means - until then it is what makes a rollback a
  # flip to a current stack rather than to a stale snapshot.
  vercel:
    name: Deploy to Vercel
    needs: migrate
    runs-on: ubuntu-latest
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      # Pinned rather than @latest: an unpinned CLI is unreviewed code in the
      # deploy pipeline.
      - run: npm install -g vercel@59.5.0
      - run: |
          vercel whoami
          vercel pull --yes --environment=production
      - run: vercel build --prod
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      - run: vercel deploy --prebuilt --prod --yes

  aws:
    name: Deploy to AWS
    needs: migrate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      # What lets this job assume the AWS role. There is no long-lived AWS key
      # in this repository at all, which is a real improvement on the three
      # Vercel secrets rather than a like-for-like swap.
      id-token: write
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}

      - uses: docker/setup-buildx-action@v3

      # `cdk deploy` builds the arm64 image, pushes it, and rolls the function.
      # NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN are read here and passed
      # through as Docker build arguments: both are build-time values, and a
      # Lambda environment variable is readable by anyone holding
      # GetFunctionConfiguration, where nothing needs them.
      - name: Deploy the stack
        working-directory: infra
        run: |
          npm ci
          npx cdk deploy --all --require-approval never \
            -c hostedZoneId=${{ vars.HOSTED_ZONE_ID }} \
            -c domainNames=${{ vars.DOMAIN_NAMES }}
        env:
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}

      # Assets before the invalidation, and both after the function is rolled:
      # a request served by the new code must always be able to find the chunk
      # it asks for. The reverse order leaves a window where it cannot.
      - name: Sync static assets
        run: |
          npm run build
          aws s3 sync .next/static "s3://${{ vars.ASSETS_BUCKET }}/_next/static" \
            --cache-control "public,max-age=31536000,immutable" --delete
          aws s3 sync public "s3://${{ vars.ASSETS_BUCKET }}" \
            --cache-control "public,max-age=31536000,immutable"
        env:
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}

      - name: Invalidate the distribution
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ vars.DISTRIBUTION_ID }} --paths "/*"
```

**`vercel` and `aws` run in parallel and neither needs the other.** In phase 1 an `aws` failure leaves production untouched, because `vercel` has already shipped - the build goes red and nothing is broken, which is the right asymmetry while AWS is the one being tested. **After the cutover in phase 2 that asymmetry inverts**, so a red `aws` job then is a production incident and should be treated as one.

Set the repository variable `DOMAIN_NAMES` to `aws.learnr.muzza.tech` for now. Task 10 changes it, and that change is the cutover.

- [ ] **Step 4: Update the workflow's header comment**

The existing comment block explains `vercel.json`, `git.deploymentEnabled: false` and preview deployments. **`vercel.json` stays for now** - Vercel is still deploying, so `git.deploymentEnabled: false` is still what stops it racing this workflow. Add a paragraph naming the three phases and saying plainly that the `vercel` job is temporary and Task 11 deletes it; **keep the two paragraphs on why previews are off and on the suite being the gate**, both unchanged by this move.

- [ ] **Step 5: Push and verify the workflow deploys**

```bash
git add .github/workflows/deploy.yml
git commit -m "Deploy to AWS from CI, with no long-lived credential"
git push
```

Expected: the workflow runs `test`, then `migrate`, then `vercel` and `aws` in parallel, and finishes green. Confirm **both** hostnames serve and both reflect the pushed commit - `learnr.muzza.tech` from Vercel and `aws.learnr.muzza.tech` from CloudFront. From here until Task 11, every push keeps them in step, which is what makes phase 1 open-ended.

---

### Task 9: The full verification pass

Nothing is committed here. This is the spec's cutover checklist, run against the staging host before production moves. **Do not proceed to Task 10 until every item passes.**

Use the email/password test account for steps 2 onwards - it is quicker and the parent screens do not care how a session was made. Step 1 is the exception and stays as written.

- [ ] **Step 1: Sign in with Google, and land on `/progress`** - the only item a password login cannot stand in for, per the constraint at the head of this plan
- [ ] **Step 2: Generate a login code on `/children`, redeem it as a child, and reach the home screen with the right level and subjects**
- [ ] **Step 3: Play a full round of ten questions; confirm the stars screen and that the total increments by the right amount**
- [ ] **Step 4: Answer a figure question; tap the figure and confirm the zoom overlay opens, traps focus, and closes**
- [ ] **Step 5: Turn narration on and confirm a question is spoken, and that tapping the prompt repeats it**
- [ ] **Step 6: Run a speed run; confirm a record is written and the result screen reports it**
- [ ] **Step 7: Open a parent report and confirm the "Needs a hand" disclosures redraw the stored figures**
- [ ] **Step 8: Confirm the practice calendar and the speed table render**
- [ ] **Step 9: Confirm Sentry receives an event from the browser** - the `/monitoring` tunnel route is a Lambda invocation now, so this proves both the tunnel and the build-time DSN
- [ ] **Step 10: Measure a cold start against the known Vercel baseline**

There is now a real number to beat. On Vercel, after `includeLocalVariables` was turned off, `/` cold is **1.09s** and warm requests are **0.08-0.22s** (`a12cbc5`, measured across four preview deployments one variable at a time). Before that fix it was 21.23s, so any reading in that neighbourhood means the option is back on, not that Lambda is slow.

Forcing a cold instance is **easier here than it was on Vercel**, where it needed a throwaway preview deployment. On Lambda, changing any configuration field replaces the execution environment:

```bash
aws lambda update-function-configuration --region ap-southeast-2 \
  --function-name FUNCTION_NAME --description "force cold start $(date +%s)"
npm run test:timings https://aws.learnr.muzza.tech
```

Then load the site on a real iPad over a real connection and time it by hand as well - the harness measures the server, and the iPad is what a child is holding.

**Decision rule:** Lambda adds container init on top of the app's own ~1.09s, so 1.5-3s total is the expected range and is the "accept it, tune later" case the spec chose. Materially worse than 3s, or a warm figure much above 0.22s, means something is wrong rather than merely cold - check `includeLocalVariables` first, then whether SSM is being re-read per request rather than once per container. Add the 5-minute EventBridge warmer only if a genuinely healthy cold start is still too slow on the iPad.

- [ ] **Step 11: Confirm CloudWatch logs show one session lookup per write**, not two - the property `2026-08-29-api-collapse-design.md` bought and the thing most worth not silently losing

---

### Task 10: Cutover

**Files:** none. Configuration and DNS only.

- [ ] **Step 1: Confirm the TTL lowered in Task 4 has propagated**

```bash
dig learnr.muzza.tech +noall +answer
```

Expected: a TTL of 60 or less. If it is still high, wait - the rollback depends on this.

- [ ] **Step 2: Add the production redirect URI in Google** - it is already registered, since the URL does not change. Confirm rather than add.

- [ ] **Step 3: Add the production hostname to the distribution and the certificate**

Set the repository variable `DOMAIN_NAMES` to `learnr.muzza.tech,aws.learnr.muzza.tech`. Note the order: `AUTH_URL` is built from the **first** name, so production must lead.

Deploy:

```bash
cd infra
npx cdk deploy --all --require-approval never \
  -c hostedZoneId=ZONE_ID \
  -c domainNames=learnr.muzza.tech,aws.learnr.muzza.tech
```

This adds a new name to the certificate (validated automatically through the hosted zone), adds it to the distribution, **and creates the Route 53 alias - which is the cutover itself.** CDK will replace the existing record pointing at Vercel.

- [ ] **Step 4: Verify production serves from CloudFront**

```bash
dig learnr.muzza.tech +short
curl -sI https://learnr.muzza.tech/ | grep -i "x-cache\|server"
curl -s -o /dev/null -w "%{http_code}\n" https://learnr.muzza.tech/
```

Expected: a CloudFront domain in the `dig`, an `X-Cache` header, and `200`.

- [ ] **Step 5: Sign in on production and play a round**

The same checks as Task 9, abbreviated: **Google sign-in first** - `AUTH_URL` now names production, and a failure here means step 3's name ordering was wrong - then a login code, ten questions, and a speed run on the test account.

- [ ] **Step 6: Watch for an hour**

CloudWatch Lambda errors and duration, CloudFront 5xx rate, and Sentry. **Rollback is pointing the Route 53 alias back at Vercel** - a record change with a 60s TTL, to a stack that is still receiving every push and is therefore running the same commit. That is phase 1's whole payoff.

```bash
# Rollback, if needed: restore the Vercel record and let CDK stop managing it.
cd infra
npx cdk deploy --all --require-approval never \
  -c hostedZoneId=ZONE_ID -c domainNames=aws.learnr.muzza.tech
# then recreate the learnr.muzza.tech record pointing at Vercel, as inventoried
# in Task 4 step 1.
```

- [ ] **Step 7: Stay in phase 2 until you decide to leave it**

Both stacks keep deploying. There is no cost to sitting here and no timer: the gate for Task 11 is that nothing surprising has happened, which the spec sizes at about a week. **Sentry sees both stacks reporting into one project during phases 1 and 2** - if an error's origin is ever ambiguous, that is worth a `server_name` tag rather than a guess.

---

### Task 11: Retire Vercel (phase 3)

**This is the phase gate, and it is a decision rather than an elapsed time.** Everything before it is reversible in 60 seconds; this is what makes AWS the only stack. Do it when phase 2 has been uneventful - about a week, per the spec - and not because a week has passed.

**Files:**
- Delete: `vercel.json`
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete the `vercel` job from `.github/workflows/deploy.yml`**

This is the actual retirement; everything else in this task is tidying behind it. `migrate` keeps its place and `aws` keeps `needs: migrate`. Update the header comment's phases paragraph to say phase 3 is done.

- [ ] **Step 2: Delete `vercel.json`**

It exists solely to set `git.deploymentEnabled: false` and stop Vercel racing the workflow. With no Vercel job and the project gone, there is nothing to race.

```bash
git rm vercel.json
```

- [ ] **Step 3: Remove the `.vercel` entry from `.gitignore`**

Also remove the stale `/fixtures/corpus/` entry, left behind when the golden corpus was deleted in the API collapse.

- [ ] **Step 4: Update `CLAUDE.md`**

This is not a footnote - it is how the next session learns the deployment, and a stale one is worse than none. Sections needing rewrites:

- **Commands** - the `vercel build && vercel deploy` line becomes `cd infra && npx cdk deploy --all`.
- **Deployed** table - "Vercel `syd1`" becomes "AWS Lambda + CloudFront, `ap-southeast-2`". Neon's row is unchanged, and **the reasoning about both being in Sydney is unchanged and should stay**.
- **A push to `master` deploys** - `vercel.json` no longer exists; the paragraph on preview deployments stays, with its reasoning intact, since AWS changes none of that argument.
- **Setup** - `.env.example` is unchanged for local development, but note that production values live in SSM at `/learnr/prod/*`.
- Add a short section on the two things that can silently break: `AUTH_URL` against CloudFront's SigV4-pinned `Host`, and `NEXT_PUBLIC_SENTRY_DSN` being a build argument.

- [ ] **Step 5: Delete the Vercel project and its three repository secrets**

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Keep the domain registered at Vercel - it is locked until 15 October 2026 and moving it is optional and operationally worthless.

- [ ] **Step 6: Set a billing alarm**

The Lambda and CloudFront free tiers are permanent and **account-wide**, so nine apps share one pool and one going viral spends it for the other eight. An alarm at $10 is worth more than any per-unit rate.

```bash
aws budgets create-budget --account-id ACCOUNT_ID --budget \
  '{"BudgetName":"monthly","BudgetLimit":{"Amount":"10","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}'
```

- [ ] **Step 7: Verify and commit**

```bash
npm run typecheck && npm test
git add -A
git commit -m "Retire Vercel"
git push
```

---

## Not in this plan

- **The child's iOS API.** Its own design session, per the spec. `src/server/session.ts`'s `resolveUserId` already takes a bare token, so accepting `Authorization: Bearer` is a small change whenever it is wanted.
- **A cold-start warmer**, unless Task 9 step 10 says otherwise.
- **Preview deployments.** Still absent, still because a preview would run against the production database and read real children's records. A Neon branch is the precondition, on AWS exactly as it was on Vercel.
- **Moving the database**, and **transferring the domain registration.** The registration is locked until 15 October 2026 and moving it is operationally worthless. If it is revisited then, check Route 53's `.tech` renewal price against what Vercel charges first - the spec lists this as an open item, and a lateral move is not worth a support ticket.
- **The other eight apps.** This plan produces the pattern; each one follows separately.
