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
