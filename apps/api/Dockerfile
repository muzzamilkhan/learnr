# Built from the repository root, not from apps/api.
#
# The API depends on @learnr/core, which is a workspace package whose `src` is a
# symlink to the repo's own src/. So the build context has to include the root
# package.json, packages/core, and the engine sources under src/ - copying only
# apps/api produces exactly the dangling symlink that broke the first deploy.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
RUN npm ci --ignore-scripts

# packages/core/src is a symlink to ../../src, so the engine it points at has to
# be here too. Only the pure parts - the web app's components are not needed.
COPY src/lib ./src/lib
COPY src/content ./src/content
COPY packages/core ./packages/core
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The bundle inlines our code and the engine; these stay external because they
# are ordinary published JavaScript.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/
# Deliberately not --include-workspace-root: that pulls the web app's Next.js,
# React and recharts into an image that never serves a page, and took it to 1.6GB.
RUN npm ci --omit=dev --ignore-scripts --workspace apps/api

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
