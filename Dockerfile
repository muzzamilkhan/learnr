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

# Stage the entrypoint's dependency closure on its own, because the standalone
# trace has no reason to carry the SSM client - no application module imports
# it. The closure is *computed* from the installed tree rather than hand-listed:
# `@aws-sdk/client-ssm` reaches `@aws`, `bowser` and `tslib` beyond the obvious
# `@aws-sdk` and `@smithy`, and the entrypoint's SSM read is best-effort - a
# package missed here is swallowed by that catch and the container runs with no
# secrets at all, looking exactly like a misconfigured Parameter Store.
RUN node -e "\
const fs = require('node:fs');\
const seen = new Set(), stack = ['@aws-sdk/client-ssm'];\
while (stack.length) {\
  const name = stack.pop();\
  if (seen.has(name)) continue;\
  seen.add(name);\
  let manifest;\
  try { manifest = require.resolve(name + '/package.json', { paths: ['/app'] }); } catch { continue; }\
  const json = JSON.parse(fs.readFileSync(manifest, 'utf8'));\
  stack.push(...Object.keys(json.dependencies ?? {}));\
}\
const entries = new Set([...seen].map((n) => (n.startsWith('@') ? n.split('/')[0] : n)));\
fs.writeFileSync('/tmp/closure.txt', [...entries].sort().join('\n') + '\n');\
" \
  && mkdir -p /entrypoint/node_modules \
  && while read -r entry; do cp -r "node_modules/$entry" "/entrypoint/node_modules/$entry"; done < /tmp/closure.txt \
  && cat /tmp/closure.txt

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
# Beside the entrypoint rather than merged into the app's own node_modules:
# Node resolves from the importing file upwards, so `scripts/node_modules` is
# found first by the entrypoint and by nothing else. Merging would overwrite
# whatever the standalone trace resolved for a shared package like `tslib`.
COPY --from=deps /entrypoint/node_modules ./scripts/node_modules
COPY scripts/lambda-entrypoint.mjs ./scripts/lambda-entrypoint.mjs

EXPOSE 3000
CMD ["node", "scripts/lambda-entrypoint.mjs"]
