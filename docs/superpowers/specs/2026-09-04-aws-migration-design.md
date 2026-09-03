# Moving LearnR from Vercel to AWS

**Status:** designed, not yet implemented.
**Scope:** infrastructure only. No behaviour change, no API change, no content change.
**Companion:** the child's iOS API is deliberately *not* in this spec. See
**Deliberately not done** at the foot.

LearnR stops being a Vercel project and becomes a container image on AWS Lambda
behind CloudFront, in `ap-southeast-2`, with Neon exactly where it is. The
success test is blunt: **the site behaves identically at the same URL**. If a
child or a parent can tell, something went wrong.

## Why this, and what it is not

The ask is consolidation and portability - one account and one bill across nine
apps in `~/code`, and the ability to leave any provider in a weekend. It is not
cost: the current bill is near zero and the new one is too.

**It is emphatically not a return to the split.** `2026-08-29-api-collapse-design.md`
undid a two-application shape - a Fastify API on Fly with a `~530ms`
Vercel-to-Fly floor - and nothing here reintroduces one. There is no second
service, no API Gateway, and no network hop between the web app and its API.
The `/api/v1` route handlers stay inside the same deployment as the pages, which
is why a page render is still an in-process call into `src/server/`.

**API Gateway is refused on purpose.** Its free tier is 12 months and
new-customers-only, after which it is ~$1 per million requests forever, and it
would buy usage plans, API keys and per-route throttling - none of which this app
wants. CloudFront in front of a Lambda Function URL gives the custom domain, TLS
and caching for nothing, permanently. When the iOS client arrives it will
authenticate against the same handlers on the same origin, so it needs nothing
API Gateway sells.

**Neon stays, and that is not a compromise.** Neon `ap-southeast-2` *is* AWS
Sydney, the same building Vercel `syd1` runs in, so the ~3ms round trip that
justifies the whole hosting choice is unchanged. Moving to RDS would buy no
latency, and its free tier is twelve months against Neon's forever. A
`DATABASE_URL` is not lock-in.

## What does not change

Worth stating plainly, because it is most of the repository:

`src/lib` and `src/content` are untouched, and `src/lib/purity.test.ts` keeps
proving it. `src/server` is untouched, `server-only` still poisons the directory
for a client bundle, and the `db` vitest project still starts a real Postgres in
Testcontainers. All 553 templates, the figure anchoring check, `MAX_PROMPT_CHARS`,
the reinforcement selector, the rewards arithmetic and every UI decision are the
same code. `src/browser-api.ts` posts to the same six paths.

## Topology

Everything in `ap-southeast-2` except the certificate. CloudFront is global.

```
Route 53  (muzza.tech hosted zone)
   |
   +- learnr.muzza.tech  ALIAS -> CloudFront distribution
                                    |
                                    +- /_next/static/*   -> S3   immutable, cache forever
                                    +- /sounds/*, *.png  -> S3   public/ assets
                                    +- /_next/image*     -> Lambda, cached
                                    +- /*                -> Lambda, no cache,
                                                            forwards Cookie + Authorization
                                    |
                             Lambda Function URL
                             auth type AWS_IAM, signed by CloudFront
                             Origin Access Control - the function cannot
                             be reached except through the distribution
                                    |
                             Lambda: container image from ECR
                             arm64 - 1769 MB - 30s - response streaming
                             Next standalone + Lambda Web Adapter
                                    |
                             Neon  ap-southeast-2   (~3ms, unchanged)
```

## 1. DNS goes first, and alone

**Nameservers move before anything else exists, and the registration does not
move at all yet.** Vercel reports `muzza.tech` locked from transferring out until
**15 October 2026** - the ICANN 60-day lock, counted from a registration or
registrant change around 16 August. That lock is on the *registration*. Changing
nameservers is a record change at the existing registrar and is subject to no
lock, so it is available today and the migration is not blocked.

Create the Route 53 hosted zone, recreate every existing record, then point
Vercel's nameservers at the Route 53 NS set. Reversible in minutes by pointing
them back.

**The failure mode is email, not the website.** Enumerate the zone first
(`vercel dns ls muzza.tech`) and carry across every `MX`, `SPF`, `DKIM` and
`DMARC` record before touching nameservers. A dropped mail record breaks silently
and is discovered days later by someone who did not get a reply. The website
failing is loud; this is not.

**DNS has to be in Route 53 before the certificate can be, and that is the real
reason it goes first.** ACM validates by DNS. With the zone in Route 53, CDK's
`CertificateValidation.fromDns(hostedZone)` provisions and renews without a human;
with DNS at Vercel every certificate, for all nine apps, is a hand-pasted record.

Transferring the registration in October is optional and changes nothing
operational - once DNS is here and hosting is on Lambda, Vercel holds nothing but
a renewal invoice. Note for whoever attempts it: there are recurring reports of a
registrar-level lock persisting after Vercel's dashboard hands over the auth code,
clearable only by Vercel support. Budget days, not an afternoon.

## 2. The container

`next.config.ts` gains `output: 'standalone'`. A multi-stage Dockerfile and a
`.dockerignore` arrive at the repository root; the build copies out the standalone
server, and `sharp` is added as a dependency because the image optimiser now runs
in this process rather than on Vercel's.

**The base image is Node 24**, matching the version `.github/workflows/deploy.yml`
already pins and the version the suite runs against. Two Node versions across a
build and its tests is a difference nothing would report until it broke.

**AWS Lambda Web Adapter is copied in as a layer, and that is the whole of the
AWS-specific surface inside the image.** Everything else is `node server.js`
listening on a port, which is what makes this artifact run unchanged on Fargate,
App Runner, Fly, Cloud Run or a VPS. **This is where the portability actually
lives** - not in the CDK, which would be rewritten against any other cloud
regardless, because the resources genuinely differ.

`arm64`, because Graviton is about 20% cheaper and nothing here is
architecture-sensitive.

**Response streaming is on** - `AWS_LWA_INVOKE_MODE=response_stream` and the
Function URL in `RESPONSE_STREAM` mode. The App Router streams RSC payloads, and
buffered mode both discards that and caps a response at 6 MB. **Verify this
end-to-end through CloudFront during the cutover**, because CloudFront's handling
of chunked origin responses is the one part of this topology that has to be
observed rather than reasoned about.

**`NEXT_PUBLIC_SENTRY_DSN` is inlined at build time, so it is a Docker build
argument, not a runtime variable.** Getting this wrong produces a browser bundle
with no DSN and a Sentry that reports nothing from the client - the half of Sentry
`next.config.ts` says matters most, since the play screen and the speed run are
where a child is.

## 3. The CDK stack

One stack per app, defined in an `infra/` directory **inside each application's
own repository** rather than in a shared infrastructure repo - a stack lives beside
the app it deploys, so a change to both is one commit. Written so the second app is
a parameter rather than a rewrite. CDK was chosen over Terraform knowing it is AWS-only; the trade is
argued in section 2.

- **ECR repository** with a lifecycle rule keeping the last ~10 images.
- **Lambda** from that image: `arm64`, 1769 MB (one full vCPU, so cold init runs
  at full speed), 30s timeout, Function URL with `AWS_IAM` auth.
- **S3 bucket**, private, reachable only by CloudFront through Origin Access
  Control. Holds `.next/static` and `public/`.
- **CloudFront** with the four behaviours in the topology above. The default
  behaviour forwards `Cookie` and `Authorization` and caches nothing; the two S3
  behaviours cache forever; `/_next/image*` caches so each (image, size, quality)
  is optimised once rather than per request.
- **ACM certificate in `us-east-1`.** CloudFront accepts certificates from that
  region and no other, wherever the rest of the stack lives. Provision it
  explicitly in the stack rather than leaving it to be discovered - it is the most
  reliable way to lose an afternoon to this design.
- **Route 53 A/AAAA alias** for `learnr.muzza.tech` to the distribution.

**There is no VPC.** Neon is publicly reachable over TLS, so a VPC would buy
nothing and cost NAT gateway charges that would exceed every other line on the
bill combined.

## 4. Auth.js behind CloudFront

**This is the one place the new topology can break working code, and it needs
naming before it is discovered.** CloudFront signs origin requests with SigV4,
and the signature covers the `Host` header - so the `Host` reaching the Lambda is
the Function URL's, not `learnr.muzza.tech`, and it cannot be rewritten without
breaking the signature.

Auth.js derives callback URLs from the request host. Left alone it would build
`https://<something>.lambda-url.ap-southeast-2.on.aws/api/auth/callback/google`,
which Google will refuse because it is not a registered redirect URI - and would
be wrong even if Google accepted it.

The fix is to stop deriving it: set **`AUTH_URL=https://learnr.muzza.tech`** and
**`AUTH_TRUST_HOST=true`** as Lambda environment variables. CloudFront forwards
the real host as `X-Forwarded-Host` for anything else that wants it.

**The session cookie needs no change**, and that is a gift from an earlier
decision: `auth.ts` already pins `SESSION_COOKIE_NAME` and
`SESSION_COOKIE_OPTIONS` explicitly rather than letting Auth.js infer the
`__Secure-` prefix, so the cookie does not depend on how the origin perceives the
protocol. `src/server/session.ts` reads the raw `cookie` header directly and is
indifferent to all of this.

## 5. Secrets

**SSM Parameter Store, `SecureString`, read once at Lambda init and cached for
the container's life.** Not Secrets Manager: that is $0.40 per secret per month,
and five secrets across nine apps is **$18/month** for something Parameter Store
does free.

Runtime, on the Lambda: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `SENTRY_DSN`, plus the two `AUTH_URL`/`AUTH_TRUST_HOST`
values above, which are configuration rather than secrets.

Build-time, in CI and never on the Lambda: `SENTRY_AUTH_TOKEN` and
`NEXT_PUBLIC_SENTRY_DSN`. **The existing workflow's reasoning survives the move
intact** - `SENTRY_AUTH_TOKEN` is scoped to the one build step because it is a
build credential and nothing at runtime needs it. On Vercel the hazard was that a
Vercel environment variable is also handed to every function; here it is that a
Lambda environment variable is visible to anyone with `GetFunctionConfiguration`.
Same rule, different reason to keep it.

**Google's OAuth console needs `https://learnr.muzza.tech/api/auth/callback/google`
registered.** It already is, since the URL does not change - which is one of the
quieter benefits of keeping the domain.

## 6. CI/CD

The workflow keeps its shape: a `test` job, then a `deploy` job that migrates
before it ships. Both jobs' existing comments explain decisions that still hold
and should move across rather than be rewritten.

What changes:

- **`permissions: id-token: write`, and the AWS credential becomes an OIDC role
  assumption.** `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are
  deleted and nothing replaces them - there is no long-lived AWS key in the repo
  at all. This is a genuine security improvement, not merely a swap.
- `DATABASE_URL` and `SENTRY_AUTH_TOKEN` stay as repository secrets. The
  **"Refuse to deploy without a database"** guard stays exactly as written, for
  exactly its stated reason: `scripts/migrate.mjs` exits 0 on a missing
  `DATABASE_URL`, which is right on a laptop and catastrophic here.
- `npm run db:deploy` still runs on the runner, before the build, and still keeps
  its P1002 retry. **Migrations do not move into AWS.** Neon is publicly
  reachable, so there is no CodeBuild step, no VPC and no bastion to justify.
- `vercel pull` / `vercel build --prod` / `vercel deploy --prebuilt` become:
  `docker buildx build --platform linux/arm64` with the Sentry build args, push to
  ECR by digest, `aws lambda update-function-code`, `aws s3 sync` the static
  assets, and a CloudFront invalidation of `/*`.

**Order within the deploy job matters and is not arbitrary.** Migrate, then sync
static assets, then update the Lambda, then invalidate. Assets before code means
a request served by the new Lambda can always find the chunk it asks for; the
reverse leaves a window where it cannot.

**The gate is unchanged and is the point.** `next build` does not run
`src/content/catalog.test.ts`, so the suite is still the only thing that proves
553 templates validate, fit `MAX_PROMPT_CHARS` and never anchor a figure to an
answer. A red test still means nothing is built.

## 7. Cutover and rollback

1. Stack deployed, image pushed, everything reachable at the CloudFront domain.
   Vercel still serving `learnr.muzza.tech`.
2. Exercise it end-to-end against the **production** Neon database - there is one
   database and no staging copy, which is the same reason preview deployments are
   off. Sign in with Google; redeem a login code; play a round and see the stars
   bank; run a speed run and see a record; open a parent report and see the
   figures redraw; check a narrated question speaks.
3. Flip the Route 53 alias from Vercel to CloudFront.
4. Watch Sentry and CloudWatch. **Rollback is pointing the alias back**, which is
   a DNS record change with a short TTL - so set the TTL low a day before the
   cutover, not on the day.
5. After a week without incident, delete the Vercel project.

**Nothing about the database changes at any point**, so there is no data
migration, no dual-write and no rollback that could lose a child's answers. The
worst case is a DNS record pointing at the wrong healthy server.

## 8. What is deleted

- `vercel.json` - and with it `git.deploymentEnabled: false`, which existed to
  stop Vercel racing the workflow. Nothing to race once the project is gone.
- The three Vercel repository secrets.
- `apps/api/` - untracked leftovers from the Fly era, still on disk months after
  the collapse. Unrelated to this work and worth taking with it.
- `.vercel/` and its gitignore entry.

`CLAUDE.md` needs its **Deployed** table, **Setup** section and the Vercel
references throughout updated. That is not a footnote: this file is how the next
session learns the deployment, and a stale one is worse than none.

## 9. Cost

Across all nine apps, once they follow:

| | Monthly |
| --- | --- |
| Route 53 hosted zone (`muzza.tech`, all nine as subdomains) | $0.50 |
| Lambda | $0 - inside the permanent 1M requests / 400k GB-s |
| CloudFront | $0 - inside the permanent 1 TB out / 10M requests |
| S3 + ECR | ~$0.20 |
| ACM | $0 |
| Neon | $0 |
| **Total** | **~$1** |

**Lambda's and CloudFront's free tiers are permanent and account-wide, not
12-month and not per-app.** That cuts both ways: nine apps share one pool, so one
of them going viral spends it for the other eight. A billing alarm at $10 matters
more here than any per-unit rate does.

## 10. Deliberately not done

- **The child's iOS API.** It is a real and near-term want, and it is a separate
  project: new endpoints, a login code redeemed for a bearer token, and a genuine
  design fork about how a question reaches the device (per-question round trip, a
  batched round, or the pure engine in JavaScriptCore). None of it depends on
  AWS - it would ship identically on Vercel. Doing it here would mean a bug has
  two places to have come from, on the app children use. **This spec forecloses
  nothing**: `src/server/session.ts`'s `resolveUserId` already takes a bare token
  with the cookie reading layered on top, so accepting `Authorization: Bearer` is
  a handful of lines whenever it is wanted. `Figure` is already a serialisable
  0-100 box of four `Mark` kinds, so a native renderer is a translator like
  `diagram.tsx`. See also `2026-08-26-ios-port-design.md`, which is superseded but
  records what a Swift port cost last time.
- **A cold-start warmer.** A Next standalone container is roughly 1-3s cold. The
  decision is to ship without one, size memory at 1769 MB so init runs on a full
  vCPU, and add a 5-minute EventBridge ping only if it is actually felt on the
  iPad. The ping would cost ~8,600 invocations a month against 1M free, so this is
  a decision about complexity, not money.
- **Preview deployments.** Still absent, still for the original reason: a preview
  runs against the production database and so reads and writes real children's
  records. AWS changes nothing about that argument. A Neon branch is the
  precondition, on AWS exactly as it was on Vercel.
- **Moving the database.** Argued at the head of this spec.
- **The registrar transfer.** Locked until 15 October 2026, and worth nothing
  operationally. Revisit then or never.

## 11. To verify during implementation

Everything below is reasoned rather than observed, and each would change part of
the design if it came out differently:

1. **Response streaming through CloudFront to a Function URL.** The one behaviour
   that has to be watched rather than derived.
2. **`sharp` in the arm64 image**, and that `/_next/image` actually caches at the
   edge rather than invoking the Lambda per request.
3. **Cold start with the real image**, measured on a real iPad over a real
   connection, not from a laptop on the same LAN.
4. **`AUTH_URL` end to end** - a full Google sign-in and a full login-code
   redemption through CloudFront, since section 4 is the part most likely to be
   subtly wrong.
5. **Route 53 `.tech` renewal pricing** against what Vercel charges, before
   deciding October's transfer is an improvement rather than a lateral move.
